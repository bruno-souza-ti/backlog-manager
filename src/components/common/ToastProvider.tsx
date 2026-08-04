import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

/**
 * App-wide toast feed. Replaces the blocking window.alert() calls that were
 * scattered across CRUD handlers with consistent, non-blocking feedback that
 * never surfaces raw Supabase/Postgres error text to the user.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 p-3 rounded-xl border shadow-lg text-xs animate-fade-in ${
              toast.type === "error"
                ? "bg-red-100 text-red-700 dark:bg-red-950/90 dark:text-red-300 border-red-200 dark:border-red-900/60"
                : toast.type === "success"
                ? "bg-teal-100 text-teal-800 dark:bg-teal-950/90 dark:text-teal-300 border-teal-200 dark:border-teal-900/60"
                : "bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300 border-slate-200 dark:border-zinc-800"
            }`}
          >
            {toast.type === "error" ? (
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
