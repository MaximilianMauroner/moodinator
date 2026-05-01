import type React from "react";
import { toast as webToast } from "sonner";

type ToastId = string | number;
type WebToastOptions = Parameters<typeof webToast>[1];

export const toast = {
  success(message: string, options?: WebToastOptions) {
    return webToast.success(message, options);
  },

  error(message: string, options?: WebToastOptions) {
    return webToast.error(message, options);
  },

  dismiss(id?: ToastId) {
    return webToast.dismiss(id);
  },

  custom(
    render: (id: ToastId) => React.ReactElement,
    options?: WebToastOptions
  ) {
    return webToast.custom((id) => render(id), options);
  },
};

export default toast;
