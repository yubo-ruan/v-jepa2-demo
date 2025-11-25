"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { ToastState } from "@/types";

interface ToastContextType {
  toast: ToastState;
  showToast: (message: string, type?: ToastState["type"]) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const DEFAULT_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback((message: string, type: ToastState["type"] = "success") => {
    setToast({ visible: true, message, type });
    setTimeout(hideToast, DEFAULT_DURATION);
  }, [hideToast]);

  const value = useMemo(() => ({ toast, showToast, hideToast }), [toast, showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
