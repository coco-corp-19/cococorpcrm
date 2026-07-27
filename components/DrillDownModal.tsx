"use client";

import { X } from "lucide-react";

export type DrillRow = { date?: string | null; label: string; sub?: string | null; amount: number };

function fmtMoney(n: number, cur: string): string {
  const abs = Math.abs(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? `(${cur} ${abs})` : `${cur} ${abs}`;
}
function fdate(d?: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function DrillDownModal({
  title, subtitle, rows, currency, onClose,
}: {
  title: string;
  subtitle?: string;
  rows: DrillRow[];
  currency: string;
  onClose: () => void;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,.55)" }} onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--card2)" }}>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>{title}</h3>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: "var(--card3)", color: "var(--muted)" }}><X size={15} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--muted2)" }}>No underlying records.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate" style={{ color: "var(--foreground)" }}>{r.label || "—"}</div>
                    <div className="text-xs" style={{ color: "var(--muted2)" }}>
                      {[fdate(r.date), r.sub].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="font-mono text-sm shrink-0" style={{ color: r.amount < 0 ? "#ef4444" : "var(--foreground)" }}>
                    {fmtMoney(r.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--card2)" }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Total ({rows.length})</span>
          <span className="font-mono text-sm font-bold" style={{ color: "var(--accent)" }}>{fmtMoney(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
