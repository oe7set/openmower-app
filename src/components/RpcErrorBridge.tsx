'use client';

import {useToast} from '@/hooks/useToast';
import {addRpcErrorListener} from '@/lib/rpc-base';
import {useEffect} from 'react';

// Listens to RPC errors from anywhere in the app and surfaces them as toasts.
// Must be mounted inside SnackbarProvider.
export default function RpcErrorBridge() {
  const toast = useToast();
  useEffect(
    () =>
      addRpcErrorListener(({method, message}) => {
        toast.error(`${method}: ${message}`);
      }),
    [toast],
  );
  return null;
}
