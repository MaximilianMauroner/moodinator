declare module "toastify-react-native" {
  import type * as React from "react";

  export type ToastShowOptions = {
    type?: "success" | "error" | "info" | "warning" | (string & {});
    text1?: string;
    text2?: string;
    autoHide?: boolean;
    visibilityTime?: number;
    progressBarColor?: string;
    onPress?: () => void | Promise<void>;
  };

  export const Toast: {
    show: (options: ToastShowOptions) => void;
    hide: () => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };

  export type ToastManagerProps = {
    config?: Record<string, unknown>;
    useModal?: boolean;
  };

  const ToastManager: React.ComponentType<ToastManagerProps>;
  export default ToastManager;
}

