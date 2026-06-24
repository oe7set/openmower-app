import {BSON} from 'bson';

// xbot_remote listens on this WebSocket port and forwards BSON {vx, vz}
// frames to the cmd_vel topic. Same path the legacy Flutter app uses for
// manual driving; the MQTT teleop topic that ships with xbot_monitoring is
// not wired through to mower_logic.
const TELEOP_PORT = 9002;

const RECONNECT_DELAY_MS = 1000;

// A thin wrapper around the xbot_remote WebSocket. Each Mower owns one and
// uses it for joystick output. Outgoing frames are BSON {vx, vz} pairs in the
// [-1, 1] range — the receiver scales them to a Twist message.
export class TeleopSocket {
  private ws: WebSocket | null = null;
  private closed = false;
  private reconnectHandle: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;

  constructor(host: string) {
    this.url = `ws://${host}:${TELEOP_PORT}`;
    this.connect();
  }

  send(vx: number, vz: number): void {
    if (this.closed) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Guard against NaN/Infinity coming from a misbehaving joystick or gamepad
    // axis: a non-finite value would either throw in BSON.serialize (silently
    // dropping the frame) or, worse, reach the mower as garbage. Coerce to a
    // safe stop and clamp to the documented [-1, 1] range.
    const safeVx = Number.isFinite(vx) ? Math.max(-1, Math.min(1, vx)) : 0;
    const safeVz = Number.isFinite(vz) ? Math.max(-1, Math.min(1, vz)) : 0;
    const payload = BSON.serialize({vx: safeVx, vz: safeVz});
    try {
      // BSON.serialize returns a Uint8Array on browsers; the WebSocket API
      // accepts ArrayBuffer / Blob / typed-array directly.
      this.ws.send(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
    } catch {
      // Drop the frame; the next send() retries after the socket recovers.
    }
  }

  close(): void {
    this.closed = true;
    if (this.reconnectHandle) {
      clearTimeout(this.reconnectHandle);
      this.reconnectHandle = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore — already torn down
      }
      this.ws = null;
    }
  }

  private connect(): void {
    if (this.closed) return;
    try {
      const ws = new WebSocket(this.url);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onclose = () => this.scheduleReconnect();
      ws.onerror = () => this.scheduleReconnect();
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectHandle) return;
    this.ws = null;
    this.reconnectHandle = setTimeout(() => {
      this.reconnectHandle = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
}

// Pulls the host out of a ws://host:port[/path] URL. Returns null if the
// input doesn't look like a URL we can use; callers should skip teleop in
// that case rather than hardcoding a host.
export function hostFromMqttUrl(mqttUrl: string): string | null {
  try {
    return new URL(mqttUrl).hostname || null;
  } catch {
    return null;
  }
}
