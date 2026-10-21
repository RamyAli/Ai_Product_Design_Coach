"use client";

import { CheckCircle2, X, XCircle, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = React.createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null);

export function ToastProvider({ children, dismissLabel }: { children: React.ReactNode; dismissLabel: string }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-3), { id, tone, message }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), tone === "error" ? 9000 : 5000);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2">
        {items.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-[var(--shadow-pop)]"
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-info")} aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button type="button" className="rounded p-0.5 text-subtle hover:text-foreground" aria-label={dismissLabel} onClick={() => setItems((p) => p.filter((i) => i.id !== t.id))}>
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
