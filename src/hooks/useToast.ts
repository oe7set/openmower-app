import {useSnackbar, type VariantType} from 'notistack';
import {useCallback} from 'react';

interface ToastApi {
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  show: (message: string, variant?: VariantType) => void;
}

export function useToast(): ToastApi {
  const {enqueueSnackbar} = useSnackbar();

  const show = useCallback(
    (message: string, variant: VariantType = 'default') => {
      enqueueSnackbar(message, {variant});
    },
    [enqueueSnackbar],
  );

  return {
    success: (m) => show(m, 'success'),
    info: (m) => show(m, 'info'),
    warning: (m) => show(m, 'warning'),
    error: (m) => show(m, 'error'),
    show,
  };
}
