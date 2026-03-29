/* eslint-disable react-refresh/only-export-components -- ToastProvider + useToast hook */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type Variant = "success" | "error";

type ToastItem = { id: string; message: string; variant: Variant };

type ToastContextValue = {
  toast: (message: string, variant?: Variant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

function ToastItemView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(item.id), 4200);
    return () => window.clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg transition",
        item.variant === "success"
          ? "border-slate-200/90 bg-white text-slate-800"
          : "border-red-200 bg-red-50 text-red-900",
      )}
    >
      {item.message}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const regionId = useId();

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: Variant = "success") => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), message, variant },
    ]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        id={regionId}
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100%-2rem,24rem)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => (
          <ToastItemView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
