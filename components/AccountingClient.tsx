"use client";

import { useState, useMemo } from "react";

type Invoice = { id: number; amount: number; status: string; transaction_date: string; customer_id: number };
type Cost = { id: number; amount: number; transaction_date: string; cost_category_id: number | null; category_name: string };
type Cashflow = { balance: number; account_id: number | null; record_date: string };
type Props = {
  invoices: Invoice[];
  costs: Cost[];
  cashflow: Cashflow[];
  orgName: string;
  orgRegNo: string;
  currency: string;
  defaultStart: string;
  defaultEnd: string;
};

function fmt(n: number) {
  return Number(Math.abs(n)).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtVal(n: number, cur: string) {
  return n < 0 ? `(${cur} ${fmt(n)})` : n === 0 ? "—" : `${cur} ${fmt(n)}`;
}

function Row({ label, value, cur, indent = 0, bold = false, color, note }: { label: string; value: number; cur: string; indent?: number; bold?: boolean; color?: string; note?: string }) {
  const col = color || (bold ? "#fff" : value < 0 ? "var(--red-c)" : "var(--muted)");
  return (
    <div className="flex items-center py-2 border-b" style={{ paddingLeft: 32 + indent * 16, paddingRight: 32, borderColor: "#e5e5e5" }}>
      <span className="flex-1 text-sm" style={{ fontWeight: bold ? 700 : 400, color: bold ? "#1a1a2e" : "#333" }}>
        {label}
        {note && <span className="ml-2 text-xs" style={{ color: "#aaa" }}>{note}</span>}
      </span>
      <span className="font-mono text-sm" style={{ color: col, fontWeight: bold ? 700 : 400, minWidth: 120, textAlign: "right" }}>
        {fmtVal(value, cur)}
      </span>
      {/* % col placeholder — keeps alignment */}
      <span style={{ minWidth: 80, textAlign: "right", color: "#999", fontSize: 11 }}>&nbsp;</span>
    </div>
  );
}

function SectionHdr({ label }: { label: string }) {
  return (
    <div className="px-8 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: "#f8f9fa", color: "#555", borderBottom: "1px solid #e5e5e5", letterSpacing: ".8px" }}>
      {label}
    </div>
  );
}

function Subtotal({ label, value, cur }: { label: string; value: number; cur: string }) {
  return (
    <div className="flex items-center py-2.5" style={{ paddingLeft: 32, paddingRight: 32, background: "#f0fdf4", borderBottom: "2px solid #10b981" }}>
      <span className="flex-1 text-sm font-bold" style={{ color: "#1a1a2e" }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: "#10b981", minWidth: 120, textAlign: "right" }}>{fmtVal(value, cur)}</span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}

function Total({ label, value, cur }: { label: string; value: number; cur: string }) {
  return (
    <div className="flex items-center py-3" style={{ paddingLeft: 32, paddingRight: 32, background: "#1a1a2e" }}>
      <span className="flex-1 text-sm font-bold" style={{ color: "#fff" }}>{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color: "#10b981", minWidth: 120, textAlign: "right" }}>{fmtVal(value, cur)}</span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}

export function AccountingClient({ invoices, costs, cashflow, orgName, orgRegNo, currency, defaultStart, defaultEnd }: Props) {
  const [tab, setTab] = useState<"is" | "bs">("is");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  const fdate = (d: string) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  };

  const isData = useMemo(() => {
    const inPeriod = (d: string) => d >= start && d <= end;
    const completed = invoices.filter(i => i.status === "Completed" && inPeriod(i.transaction_date));
    const pending = invoices.filter(i => i.status === "Pending" && inPeriod(i.transaction_date));
    const revenue = completed.reduce((s, i) => s + i.amount, 0);
    const pendingRev = pending.reduce((s, i) => s + i.amount, 0);

    const periodCosts = costs.filter(c => inPeriod(c.transaction_date));

    // Group costs by category
    const byCat: Record<string, number> = {};
    periodCosts.forEach(c => {
      const cat = c.category_name || "Other";
      byCat[cat] = (byCat[cat] || 0) + c.amount;
    });

    const totalCosts = periodCosts.reduce((s, c) => s + c.amount, 0);
    const operatingProfit = revenue - totalCosts;

    return { revenue, pendingRev, byCat, totalCosts, operatingProfit };
  }, [invoices, costs, start, end]);

  const bsData = useMemo(() => {
    // Latest balance per account
    const latestByAcct: Record<string, number> = {};
    cashflow.forEach(r => {
      const key = String(r.account_id || "unknown");
      if (!latestByAcct[key] || r.record_date > (cashflow.find(x => String(x.account_id || "unknown") === key)?.record_date || "")) {
        latestByAcct[key] = r.balance;
      }
    });
    const totalCash = Object.values(latestByAcct).reduce((s, b) => s + b, 0);
    const totalRevenue = invoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0);
    const totalCosts = costs.reduce((s, c) => s + c.amount, 0);
    const retainedEarnings = totalRevenue - totalCosts;
    const totalPending = invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0);

    return { totalCash, retainedEarnings, totalPending };
  }, [invoices, costs, cashflow]);

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)}
      className="px-4 py-2 text-xs font-semibold rounded transition-colors"
      style={{ background: tab === t ? "var(--accent)" : "var(--card3)", color: tab === t ? "#fff" : "var(--muted)", border: "1px solid var(--border)" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <div className="flex gap-2">
          {tabBtn("is", "📊 Income Statement")}
          {tabBtn("bs", "📋 Balance Sheet")}
        </div>
      </div>

      {tab === "is" && (
        <>
          {/* Period controls */}
          <div className="flex flex-wrap gap-3 items-center mb-4 p-3 rounded-lg" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Start</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>End</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="px-2 py-1.5 text-xs rounded border outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>

          {/* Statement */}
          <div className="rounded-lg overflow-hidden" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
            {/* Header */}
            <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
              <h2 className="text-lg font-bold">{orgName}</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>
                INCOME STATEMENT{orgRegNo ? ` | Reg: ${orgRegNo}` : ""}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>
                For the period: {fdate(start)} to {fdate(end)}
              </p>
            </div>

            {/* Column headers */}
            <div className="flex text-xs font-bold uppercase tracking-wider py-2"
              style={{ paddingLeft: 32, paddingRight: 32, background: "#f8f9fa", color: "#888", borderBottom: "1px solid #e5e5e5" }}>
              <span className="flex-1">Description</span>
              <span style={{ minWidth: 120, textAlign: "right" }}>Amount</span>
              <span style={{ minWidth: 80 }}>&nbsp;</span>
            </div>

            <SectionHdr label="REVENUE" />
            <Row label="Turnover (Completed Invoices)" value={isData.revenue} cur={currency} />
            <Row label="Deferred Revenue (Pending)" value={0} cur={currency} note={`${currency} ${fmt(isData.pendingRev)} not yet earned`} />
            {isData.revenue > 0 && <Subtotal label="TOTAL REVENUE" value={isData.revenue} cur={currency} />}

            <SectionHdr label="OPERATING EXPENSES" />
            {Object.entries(isData.byCat).map(([cat, val]) => (
              <Row key={cat} label={cat} value={-val} cur={currency} indent={1} />
            ))}
            {Object.keys(isData.byCat).length === 0 && (
              <Row label="No costs recorded in period" value={0} cur={currency} />
            )}
            <Subtotal label="TOTAL EXPENSES" value={-isData.totalCosts} cur={currency} />

            <SectionHdr label="PROFIT" />
            <Total label="OPERATING PROFIT / (LOSS)" value={isData.operatingProfit} cur={currency} />
          </div>
        </>
      )}

      {tab === "bs" && (
        <div className="rounded-lg overflow-hidden" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
          <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
            <h2 className="text-lg font-bold">{orgName}</h2>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>BALANCE SHEET (SIMPLIFIED)</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>As at {fdate(new Date().toISOString().slice(0, 10))}</p>
          </div>

          <SectionHdr label="ASSETS" />
          <Row label="Cash and Cash Equivalents" value={bsData.totalCash} cur={currency} />
          <Row label="Trade Receivables (Pending Invoices)" value={bsData.totalPending} cur={currency} />
          <Subtotal label="TOTAL ASSETS" value={bsData.totalCash + bsData.totalPending} cur={currency} />

          <SectionHdr label="EQUITY" />
          <Row label="Retained Earnings (Revenue – Costs)" value={bsData.retainedEarnings} cur={currency} />
          <Total label="TOTAL EQUITY" value={bsData.retainedEarnings} cur={currency} />

          <div className="px-8 py-3 text-xs italic" style={{ color: "#888", background: "#f9f9f9" }}>
            Note: This is a simplified view. For a full balance sheet with PPE, loans, and other adjustments, use manual entries in your accounting software.
          </div>
        </div>
      )}
    </div>
  );
}
