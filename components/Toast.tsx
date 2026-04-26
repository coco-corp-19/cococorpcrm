"use client";

import { createContext, useContext, useState, useCallback } from "react";

type T = { id: number; msg: string; type: "success" | "error" };
type Ctx = { success: (m: string) => void; error: (m: string) => void };

const ToastCtx = createContext<Ctx>({ success: () => {}, error: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);

  const add = useCallback((msg: string, type: T["type"]) => {
    const id = Date.now() + Math.random();
    setList(l => [...l, { id, msg, type }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ success: m => add(m, "success"), error: m => add(m, "error") }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2" style={{ maxWidth: 340, pointerEvents: "none" }}>
        {list.map(t => (
          <div key={t.id}
            className="rounded-lg px-4 py-3 text-sm font-semibold shadow-xl"
            style={{ background: t.type === "success" ? "var(--accent)" : "#ef4444", color: "#fff", pointerEvents: "auto" }}>
            {t.type === "success" ? "✓ " : "✕ "}{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
