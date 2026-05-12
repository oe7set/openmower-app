import {generateId} from '@/utils/area-utils';
import type {MqttClient} from 'mqtt';

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
}

type RpcErrorListener = (err: {method: string; message: string}) => void;
const rpcErrorListeners = new Set<RpcErrorListener>();

// Global RPC error broadcaster. A UI bridge component subscribes to this and
// surfaces errors as toasts — keeps the store free of React dependencies.
export function addRpcErrorListener(fn: RpcErrorListener): () => void {
  rpcErrorListeners.add(fn);
  return () => rpcErrorListeners.delete(fn);
}

export interface Methods {
  [method: string]: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: object | any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
  };
}

export default class OpenMowerRpcBase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingRequests = new Map<string, PendingRequest<any>>();

  constructor(private mqtt: MqttClient, private prefix: string) {}

  // 30s default — settings schemas (~29KB), large logs.tail responses, and
  // the first call after a fresh broker connect can all exceed 10s. Callers
  // that know they're hitting a fast RPC can override.
  public call<T>(method: string, params?: object, timeoutMs: number = 30_000): Promise<T> {
    const id = generateId();
    this.mqtt.publish(
      this.prefix + 'rpc/request',
      JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id,
      }),
    );

    return new Promise<T>((resolve, reject) => {
      const request: PendingRequest<T> = {
        resolve,
        reject: (reason) => {
          const message = reason instanceof Error ? reason.message : String(reason);
          rpcErrorListeners.forEach((l) => l({method, message}));
          reject(reason);
        },
        timeout: setTimeout(() => {
          this.pendingRequests.delete(id);
          const err = new Error('RPC timeout');
          rpcErrorListeners.forEach((l) => l({method, message: err.message}));
          reject(err);
        }, timeoutMs),
      };
      this.pendingRequests.set(id, request);
    });
  }

  public _handleResponse(payload: string) {
    const json = JSON.parse(payload);
    const request = this.pendingRequests.get(json.id);
    if (request === undefined) return;
    if ('error' in json) {
      request.reject(new Error(json.error.message));
    } else {
      request.resolve(json.result);
    }
  }
}
