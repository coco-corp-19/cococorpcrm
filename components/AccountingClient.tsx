"use client";

import { useState, useMemo } from "react";
import { useToast } from "@/components/Toast";
import {
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  toggleReconciled,
} from "@/server-actions/banking";

type Invoice = { id: number; amount: number; status: string; transaction_date: string; customer_id: number };
type Cost = { id: number; amount: number; transaction_date: string; cost_category_id: number | null; category_name: string };
type Cashflow = { balance: number; account_id: number | null; record_date: string };
type BankTxn = {
  id: number; account_id: number | null; txn_date: string; description: string;
  reference: string | null; debit: number; credit: number; balance: number | null;
  reconciled: boolean; notes: string | null;
};
type Account = { id: number; name: string };

type Props = {
  invoices: Invoice[];
  costs: Cost[];
  cashflow: Cashflow[];
  bankTxns: BankTxn[];
  accounts: Account[];
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
function fdate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}
function fdateShort(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── IS / BS helpers ──────────────────────────────────────────────────────────
function Row({ label, value, cur, indent = 0, bold = false, color, note }: { label: string; value: number; cur: string; indent?: number; bold?: boolean; color?: string; note?: string }) {
  const col = color || (bold ? "#fff" : value < 0 ? "var(--red-c)" : "var(--muted)");
  return (
    <div className="flex items-center py-2 border-b" style={{ paddingLeft: 32 + indent * 16, paddingRight: 32, borderColor: "#e5e5e5" }}>
      <span className="flex-1 text-sm" style={{ fontWeight: bold ? 700 : 400, color: bold ? "#1a1a2e" : "#333" }}>
        {label}{note && <span className="ml-2 text-xs" style={{ color: "#aaa" }}>{note}</span>}
      </span>
      <span className="font-mono text-sm" style={{ color: col, fontWeight: bold ? 700 : 400, minWidth: 120, textAlign: "right" }}>
        {fmtVal(value, cur)}
      </span>
      <span style={{ minWidth: 80 }}>&nbsp;</span>
    </div>
  );
}
function SectionHdr({ label }: { label: string }) {
  return <div className="px-8 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: "#f8f9fa", color: "#555", borderBottom: "1px solid #e5e5e5" }}>{label}</div>;
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

// ── Bank recon modal form ────────────────────────────────────────────────────
const inp = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inpS = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" } as const;

function BankModal({ accounts, initial, onClose, onSave }: {
  accounts: Account[];
  initial?: BankTxn | null;
  onClose: () => void;
  onSave: (fd: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try { await onSave(new FormData(e.currentTarget)); onClose(); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
      style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">{initial ? "Edit Transaction" : "Add Bank Transaction"}</h2>
          <button onClick={onClose} style={{ color: "var(--muted2)" }}>✕</button>
        </div>
        <form onSubmit={handle}>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Account</label>
                <select name="account_id" defaultValue={initial?.account_id ?? ""} className={inp} style={inpS}>
                  <option value="">— No account —</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                <input name="txn_date" type="date" required defaultValue={initial?.txn_date ?? new Date().toISOString().slice(0, 10)} className={inp} style={inpS} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Reference</label>
                <input name="reference" defaultValue={initial?.reference ?? ""} className={inp} style={inpS} placeholder="TXN-001" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description *</label>
                <input name="description" required defaultValue={initial?.description ?? ""} className={inp} style={inpS} placeholder="Payment received / Supplier payment…" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Credit (Money In)</label>
                <input name="credit" type="number" min={0} step={0.01} defaultValue={initial?.credit ?? 0} className={inp} style={inpS} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Debit (Money Out)</label>
                <input name="debit" type="number" min={0} step={0.01} defaultValue={initial?.debit ?? 0} className={inp} style={inpS} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Running Balance</label>
                <input name="balance" type="number" step={0.01} defaultValue={initial?.balance ?? ""} className={inp} style={inpS} placeholder="Optional" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Notes</label>
                <input name="notes" defaultValue={initial?.notes ?? ""} className={inp} style={inpS} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
            <button type="submit" disabled={busy}
              className="px-5 py-2 rounded text-sm font-semibold"
              style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
              {busy ? "Saving…" : initial ? "Save Changes" : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function AccountingClient({ invoices, costs, cashflow, bankTxns, accounts, orgName, orgRegNo, currency, defaultStart, defaultEnd }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<"is" | "bs" | "bank" | "cashflow">("is");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);

  // Bank recon state
  const [bankModal, setBankModal] = useState(false);
  const [editTxn, setEditTxn] = useState<BankTxn | null>(null);
  const [bankSearch, setBankSearch] = useState("");
  const [reconFilter, setReconFilter] = useState<"" | "reconciled" | "unreconciled">("");
  const [bankAccFilter, setBankAccFilter] = useState("");

  // Cashflow quick-entry state
  const [cfBusy, setCfBusy] = useState(false);
  const [cfType, setCfType] = useState<"in" | "out">("in");

  // ── IS / BS data ─────────────────────────────────────────────────────────
  const isData = useMemo(() => {
    const inPeriod = (d: string) => d >= start && d <= end;
    const completed = invoices.filter(i => i.status === "Completed" && inPeriod(i.transaction_date));
    const pending = invoices.filter(i => i.status === "Pending" && inPeriod(i.transaction_date));
    const revenue = completed.reduce((s, i) => s + i.amount, 0);
    const pendingRev = pending.reduce((s, i) => s + i.amount, 0);
    const periodCosts = costs.filter(c => inPeriod(c.transaction_date));
    const byCat: Record<string, number> = {};
    periodCosts.forEach(c => { const cat = c.category_name || "Other"; byCat[cat] = (byCat[cat] || 0) + c.amount; });
    const totalCosts = periodCosts.reduce((s, c) => s + c.amount, 0);
    return { revenue, pendingRev, byCat, totalCosts, operatingProfit: revenue - totalCosts };
  }, [invoices, costs, start, end]);

  const bsData = useMemo(() => {
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
    const totalPending = invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0);
    return { totalCash, retainedEarnings: totalRevenue - totalCosts, totalPending };
  }, [invoices, costs, cashflow]);

  // ── Bank txn filtering ────────────────────────────────────────────────────
  const filteredTxns = useMemo(() => {
    return bankTxns
      .filter(t => {
        if (bankAccFilter && String(t.account_id) !== bankAccFilter) return false;
        if (reconFilter === "reconciled" && !t.reconciled) return false;
        if (reconFilter === "unreconciled" && t.reconciled) return false;
        if (bankSearch) {
          const q = bankSearch.toLowerCase();
          return (t.description + (t.reference || "")).toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => b.txn_date.localeCompare(a.txn_date));
  }, [bankTxns, bankAccFilter, reconFilter, bankSearch]);

  const bankTotals = useMemo(() => ({
    credits: bankTxns.reduce((s, t) => s + t.credit, 0),
    debits: bankTxns.reduce((s, t) => s + t.debit, 0),
    unreconciled: bankTxns.filter(t => !t.reconciled).length,
  }), [bankTxns]);

  // ── Cashflow monthly data ─────────────────────────────────────────────────
  const cashflowData = useMemo(() => {
    const months: Record<string, { credit: number; debit: number }> = {};
    bankTxns.forEach(t => {
      const m = t.txn_date.slice(0, 7); // YYYY-MM
      if (!months[m]) months[m] = { credit: 0, debit: 0 };
      months[m].credit += t.credit;
      months[m].debit += t.debit;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v, net: v.credit - v.debit }));
  }, [bankTxns]);

  const maxCashflow = useMemo(() => Math.max(...cashflowData.map(d => Math.max(d.credit, d.debit)), 1), [cashflowData]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleAddTxn(fd: FormData) {
    try { await createBankTransaction(fd); toast.success("Transaction added"); }
    catch { toast.error("Failed to add transaction"); throw new Error(); }
  }
  async function handleEditTxn(fd: FormData) {
    if (!editTxn) return;
    try { await updateBankTransaction(editTxn.id, fd); toast.success("Transaction updated"); }
    catch { toast.error("Failed to update transaction"); throw new Error(); }
  }
  async function handleDelete(id: number) {
    if (!confirm("Delete this transaction?")) return;
    try { await deleteBankTransaction(id); toast.success("Deleted"); }
    catch { toast.error("Failed to delete"); }
  }
  async function handleToggle(id: number, current: boolean) {
    try { await toggleReconciled(id, !current); }
    catch { toast.error("Failed to update"); }
  }

  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)}
      className="px-3 py-2 text-xs font-semibold rounded transition-colors"
      style={{ background: tab === t ? "var(--accent)" : "var(--card3)", color: tab === t ? "#fff" : "var(--muted)", border: "1px solid var(--border)" }}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <div className="flex flex-wrap gap-2">
          {tabBtn("is", "📊 Income Statement")}
          {tabBtn("bs", "📋 Balance Sheet")}
          {tabBtn("bank", "🏦 Bank Statement")}
          {tabBtn("cashflow", "💸 Cashflow")}
        </div>
      </div>

      {/* ── Income Statement ─────────────────────────────────────────────── */}
      {tab === "is" && (
        <>
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
          <div className="rounded-lg overflow-hidden" style={{ background: "#fff", color: "#111", boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
            <div className="px-8 py-6" style={{ background: "#1a1a2e", color: "#fff" }}>
              <h2 className="text-lg font-bold">{orgName}</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>INCOME STATEMENT{orgRegNo ? ` | Reg: ${orgRegNo}` : ""}</p>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>For the period: {fdate(start)} to {fdate(end)}</p>
            </div>
            <div className="flex text-xs font-bold uppercase tracking-wider py-2" style={{ paddingLeft: 32, paddingRight: 32, background: "#f8f9fa", color: "#888", borderBottom: "1px solid #e5e5e5" }}>
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
            {Object.keys(isData.byCat).length === 0 && <Row label="No costs recorded in period" value={0} cur={currency} />}
            <Subtotal label="TOTAL EXPENSES" value={-isData.totalCosts} cur={currency} />
            <SectionHdr label="PROFIT" />
            <Total label="OPERATING PROFIT / (LOSS)" value={isData.operatingProfit} cur={currency} />
          </div>
        </>
      )}

      {/* ── Balance Sheet ────────────────────────────────────────────────── */}
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
            Note: Simplified view. Use a dedicated accounting system for PPE, loans, and other adjustments.
          </div>
        </div>
      )}

      {/* ── Bank Statement / Recon ───────────────────────────────────────── */}
      {tab === "bank" && (
        <div>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              ["Total Credits (In)", bankTotals.credits, "var(--accent)"],
              ["Total Debits (Out)", bankTotals.debits, "var(--red-c)"],
              ["Unreconciled", bankTotals.unreconciled, "var(--amber-c)"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
                <div className="text-xl font-bold font-mono" style={{ color: c as string }}>
                  {typeof v === "number" && l !== "Unreconciled" ? `${currency} ${fmt(v)}` : String(v)}
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <input value={bankSearch} onChange={e => setBankSearch(e.target.value)} placeholder="Search transactions…"
              className="px-3 py-2 text-sm rounded border outline-none flex-1 min-w-[160px]"
              style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            <select value={bankAccFilter} onChange={e => setBankAccFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded border outline-none"
              style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </select>
            <select value={reconFilter} onChange={e => setReconFilter(e.target.value as "" | "reconciled" | "unreconciled")}
              className="px-3 py-2 text-sm rounded border outline-none"
              style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
              <option value="">All</option>
              <option value="reconciled">Reconciled</option>
              <option value="unreconciled">Unreconciled</option>
            </select>
            <button onClick={() => { setEditTxn(null); setBankModal(true); }}
              className="px-4 py-2 text-sm font-semibold rounded"
              style={{ background: "var(--accent)", color: "#fff" }}>
              + Add Transaction
            </button>
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Description", "Reference", "Credit (In)", "Debit (Out)", "Balance", "Reconciled", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTxns.map(t => (
                    <tr key={t.id} className="border-b hover:bg-[var(--card3)] transition-colors"
                      style={{ borderColor: "var(--border)", opacity: t.reconciled ? 0.65 : 1 }}>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdateShort(t.txn_date)}</td>
                      <td className="px-3 py-2.5 max-w-[180px] truncate font-medium">{t.description}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{t.reference || "—"}</td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>
                        {t.credit > 0 ? `${currency} ${fmt(t.credit)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>
                        {t.debit > 0 ? `${currency} ${fmt(t.debit)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {t.balance != null ? `${currency} ${fmt(t.balance)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => handleToggle(t.id, t.reconciled)}
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            background: t.reconciled ? "rgba(16,185,129,.15)" : "rgba(245,158,11,.12)",
                            color: t.reconciled ? "var(--accent)" : "var(--amber-c)",
                            border: `1px solid ${t.reconciled ? "var(--accent)" : "var(--amber-c)"}`,
                          }}>
                          {t.reconciled ? "✓ Done" : "Pending"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditTxn(t); setBankModal(true); }}
                            className="px-2 py-1 rounded text-xs"
                            style={{ border: "1px solid var(--border)", background: "var(--card)" }}>✏️</button>
                          <button onClick={() => handleDelete(t.id)}
                            className="px-2 py-1 rounded text-xs"
                            style={{ border: "1px solid var(--border)", background: "var(--card)" }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTxns.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-sm" style={{ color: "var(--muted2)" }}>
                      No transactions found. Add your first bank entry above.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Cashflow ─────────────────────────────────────────────────────── */}
      {tab === "cashflow" && (
        <div>
          {/* Quick-entry form */}
          <form
            onSubmit={async e => {
              e.preventDefault();
              setCfBusy(true);
              const fd = new FormData(e.currentTarget);
              const amount = Math.abs(Number(fd.get("amount") || 0));
              fd.set("credit", cfType === "in" ? String(amount) : "0");
              fd.set("debit", cfType === "out" ? String(amount) : "0");
              fd.delete("amount");
              try {
                await createBankTransaction(fd);
                toast.success("Cashflow entry added");
                (e.target as HTMLFormElement).reset();
                setCfType("in");
              } catch { toast.error("Failed to save entry"); }
              finally { setCfBusy(false); }
            }}
            className="rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Type</label>
              <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {(["in", "out"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setCfType(t)}
                    className="px-4 py-2 text-xs font-semibold transition-colors"
                    style={{
                      background: cfType === t ? (t === "in" ? "var(--accent)" : "var(--red-c)") : "var(--background)",
                      color: cfType === t ? "#fff" : "var(--muted)",
                    }}>
                    {t === "in" ? "▲ Money In" : "▼ Money Out"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
              <input name="txn_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)}
                className="px-3 py-2 rounded border text-sm outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description *</label>
              <input name="description" required placeholder="e.g. Client payment, Rent, Salary…"
                className="w-full px-3 py-2 rounded border text-sm outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div style={{ width: 140 }}>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Amount *</label>
              <input name="amount" type="number" min={0.01} step={0.01} required placeholder="0.00"
                className="w-full px-3 py-2 rounded border text-sm outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div style={{ width: 150 }}>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Account</label>
              <select name="account_id" className="w-full px-3 py-2 rounded border text-sm outline-none"
                style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--muted)" }}>
                <option value="">— Optional —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={cfBusy}
              className="px-5 py-2 rounded text-sm font-semibold"
              style={{ background: cfType === "in" ? "var(--accent)" : "var(--red-c)", color: "#fff", opacity: cfBusy ? .6 : 1, whiteSpace: "nowrap" }}>
              {cfBusy ? "Saving…" : `+ Add ${cfType === "in" ? "Income" : "Expense"}`}
            </button>
          </form>

          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              ["Total Money In", bankTotals.credits, "var(--accent)"],
              ["Total Money Out", bankTotals.debits, "var(--red-c)"],
              ["Net Position", bankTotals.credits - bankTotals.debits, bankTotals.credits - bankTotals.debits >= 0 ? "var(--cyan-c)" : "var(--red-c)"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
                <div className="text-xl font-bold font-mono" style={{ color: c as string }}>
                  {(v as number) < 0 ? `-${currency} ${fmt(v as number)}` : `${currency} ${fmt(v as number)}`}
                </div>
              </div>
            ))}
          </div>

          {cashflowData.length === 0 ? (
            <div className="rounded-lg p-10 text-center" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--muted2)" }}>No entries yet — add your first cashflow entry above.</p>
            </div>
          ) : (
            <>
              {/* Bar chart */}
              <div className="rounded-lg p-5 mb-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>Monthly Cashflow</h3>
                <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ minHeight: 180 }}>
                  {cashflowData.map(d => {
                    const creditH = Math.round((d.credit / maxCashflow) * 140);
                    const debitH = Math.round((d.debit / maxCashflow) * 140);
                    const isPositive = d.net >= 0;
                    return (
                      <div key={d.month} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 64 }}>
                        <div className="text-xs font-mono" style={{ color: isPositive ? "var(--accent)" : "var(--red-c)" }}>
                          {isPositive ? "+" : ""}{fmt(d.net)}
                        </div>
                        <div className="flex items-end gap-1">
                          <div title={`In: ${currency} ${fmt(d.credit)}`} style={{ width: 20, height: Math.max(creditH, 2), background: "var(--accent)", borderRadius: "3px 3px 0 0" }} />
                          <div title={`Out: ${currency} ${fmt(d.debit)}`} style={{ width: 20, height: Math.max(debitH, 2), background: "var(--red-c)", borderRadius: "3px 3px 0 0" }} />
                        </div>
                        <div className="text-xs whitespace-nowrap" style={{ color: "var(--muted2)" }}>
                          {new Date(d.month + "-01").toLocaleDateString("en-ZA", { month: "short", year: "2-digit" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t text-xs" style={{ borderColor: "var(--border)" }}>
                  <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, background: "var(--accent)", borderRadius: 2, display: "inline-block" }} /> Money In</span>
                  <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12, background: "var(--red-c)", borderRadius: 2, display: "inline-block" }} /> Money Out</span>
                </div>
              </div>

              {/* Monthly breakdown table */}
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                      {["Month", "Money In", "Money Out", "Net"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cashflowData.slice().reverse().map(d => (
                      <tr key={d.month} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                        <td className="px-4 py-2.5 font-medium">
                          {new Date(d.month + "-01").toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}
                        </td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: "var(--accent)" }}>{currency} {fmt(d.credit)}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: "var(--red-c)" }}>{currency} {fmt(d.debit)}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: d.net >= 0 ? "var(--accent)" : "var(--red-c)" }}>
                          {d.net >= 0 ? "+" : ""}{currency} {fmt(d.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent entries list */}
              <div className="rounded-lg overflow-hidden mt-4" style={{ border: "1px solid var(--border)" }}>
                <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ background: "var(--card)", color: "var(--muted2)", borderBottom: "1px solid var(--border)" }}>
                  Recent Entries
                </div>
                <div style={{ background: "var(--card2)" }}>
                  {bankTxns.slice(0, 20).map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b text-xs" style={{ borderColor: "var(--border)" }}>
                      <span style={{ color: "var(--muted2)", minWidth: 70 }}>{fdateShort(t.txn_date)}</span>
                      <span className="flex-1 truncate font-medium">{t.description}</span>
                      {t.credit > 0 && <span className="font-mono font-semibold" style={{ color: "var(--accent)" }}>+{currency} {fmt(t.credit)}</span>}
                      {t.debit > 0 && <span className="font-mono font-semibold" style={{ color: "var(--red-c)" }}>-{currency} {fmt(t.debit)}</span>}
                      <button onClick={() => handleDelete(t.id)} className="px-1.5 py-0.5 rounded" style={{ color: "var(--muted2)", border: "1px solid var(--border)", background: "var(--card)" }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Bank Modal ───────────────────────────────────────────────────── */}
      {bankModal && (
        <BankModal
          accounts={accounts}
          initial={editTxn}
          onClose={() => { setBankModal(false); setEditTxn(null); }}
          onSave={editTxn ? handleEditTxn : handleAddTxn}
        />
      )}
    </div>
  );
}
