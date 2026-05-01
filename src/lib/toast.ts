import type React from "react";
import { toast as nativeToast } from "sonner-native";

type ToastId = string | number;
type NativeToastOptions = Parameters<typeof nativeToast>[1];

function createToastId(): ToastId {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const toast = {
  success(message: string, options?: NativeToastOptions) {
    return nativeToast.success(message, options);
  },

  error(message: string, options?: NativeToastOptions) {
    return nativeToast.error(message, options);
  },

  dismiss(id?: ToastId) {
    return nativeToast.dismiss(id);
  },

  custom(
    render: (id: ToastId) => React.ReactElement,
    options?: NativeToastOptions
  ) {
    const id = options?.id ?? createToastId();
    return nativeToast.custom(render(id), {
      ...options,
      id,
    });
  },
};

export default toast;
