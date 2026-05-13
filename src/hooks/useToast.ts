import {useSnackbar, type VariantType} from 'notistack';
import {useCallback, useMemo} from 'react';

interface ToastApi {
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  show: (message: string, variant?: VariantType) => void;
}

// The returned API object is memoised so callers can safely list the toast
// in useEffect/useCallback dependency arrays without re-triggering on every
// render. Without this, any effect that depends on `toast` re-runs on each
// render and can drive infinite update loops in screens that call setState
// from those effects.
export function useToast(): ToastApi {
  const {enqueueSnackbar} = useSnackbar();

  const show = useCallback(
    (message: string, variant: VariantType = 'default') => {
      enqueueSnackbar(message, {variant});
    },
    [enqueueSnackbar],
  );

  return useMemo<ToastApi>(
    () => ({
      success: (m) => show(m, 'success'),
      info: (m) => show(m, 'info'),
      warning: (m) => show(m, 'warning'),
      error: (m) => show(m, 'error'),
      show,
    }),
    [show],
  );
}
