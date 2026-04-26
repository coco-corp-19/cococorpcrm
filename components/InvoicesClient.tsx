"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { createInvoice, updateInvoice, deleteInvoice, updateInvoiceStatus } from "@/server-actions/invoices";

type Invoice = {
  id: number; invoice_number: string | null; amount: number; status: string;
  transaction_date: string | null; due_date: string | null;
  customer_id: number; description: string | null; payment_type_name: string | null;
};
type Customer = { id: number; name: string };
type PaymentType = { id: number; name: string };

type Props = { invoices: Invoice[]; customers: Customer[]; paymentTypes: PaymentType[]; currency: string };

function fmt(n: number) { return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fdate(d: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return "—"; } }

const STATUS_COLORS: Record<string, string> = {
  Completed: "var(--accent)", Pending: "var(--amber-c)", "Written Off": "var(--red-c)"
};

type Line = { description: string; quantity: number; unit_price: number };

export function InvoicesClient({ invoices, customers, paymentTypes, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = invoices.filter(inv => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const cust = customers.find(c => c.id === inv.customer_id)?.name || "";
      return (inv.invoice_number || "" + cust + (inv.description || "")).toLowerCase().includes(q);
    }
    return true;
  });

  const totals = {
    completed: invoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0),
    writtenOff: invoices.filter(i => i.status === "Written Off").reduce((s, i) => s + i.amount, 0),
  };

  function addLine() { setLines(l => [...l, { description: "", quantity: 1, unit_price: 0 }]); }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)); }
  function setLine(i: number, field: keyof Line, val: string | number) {
    setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln));
  }
  const lineTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("lines", JSON.stringify(lines));
    fd.set("amount", String(lineTotal || Number(fd.get("amount") || 0)));
    try { await createInvoice(fd); toast.success("Invoice created"); setModal(false); setLines([{ description: "", quantity: 1, unit_price: 0 }]); }
    catch { toast.error("Failed to create invoice"); }
    finally { setBusy(false); }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editInvoice) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("lines", JSON.stringify(lines));
    fd.set("amount", String(lineTotal || Number(fd.get("amount") || 0)));
    try { await updateInvoice(editInvoice.id, fd); toast.success("Invoice updated"); setEditInvoice(null); }
    catch { toast.error("Failed to update invoice"); }
    finally { setBusy(false); }
  }

  function openEdit(inv: Invoice) {
    setEditInvoice(inv);
    setLines([{ description: inv.description || "Service", quantity: 1, unit_price: inv.amount }]);
  }

  async function handleDelete(id: number) {
    if (!confirm("Archive this invoice?")) return;
    setBusy(true);
    try { await deleteInvoice(id); toast.success("Invoice archived"); }
    catch { toast.error("Failed to archive"); }
    finally { setBusy(false); }
  }

  async function handleStatusChange(id: number, status: string) {
    try { await updateInvoiceStatus(id, status); toast.success("Status updated"); }
    catch { toast.error("Failed to update status"); }
  }

  const inputCss = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputStyle = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div>
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[["Collected", totals.completed, "var(--accent)"], ["Pending", totals.pending, "var(--amber-c)"], ["Written Off", totals.writtenOff, "var(--red-c)"]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{l}</div>
            <div className="text-xl font-bold font-mono" style={{ color: c as string }}>{cur} {fmt(v as number)}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices…"
          className="px-3 py-2 text-sm rounded border outline-none flex-1 min-w-[160px]"
          style={inputStyle} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded border outline-none"
          style={inputStyle}>
          <option value="">All Statuses</option>
          {["Completed", "Pending", "Written Off"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setModal(true)}
          className="px-4 py-2 rounded text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}>
          + Invoice
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                {["Date", "Invoice #", "Customer", "Description", "Due", "Amount", "Pay Type", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const cust = customers.find(c => c.id === inv.customer_id);
                const col = STATUS_COLORS[inv.status] || "var(--muted2)";
                return (
                  <tr key={inv.id} className="border-b hover:bg-[var(--card3)] transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(inv.transaction_date)}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>{inv.invoice_number || <span style={{ color: "var(--muted2)", fontStyle: "italic" }}>—</span>}</td>
                    <td className="px-3 py-2 max-w-[130px] truncate font-medium">{cust?.name ?? `#${inv.customer_id}`}</td>
                    <td className="px-3 py-2 max-w-[150px] truncate" style={{ color: "var(--muted)" }}>{inv.description || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: inv.due_date && inv.status === "Pending" && new Date(inv.due_date) < new Date() ? "var(--red-c)" : "var(--muted2)" }}>{fdate(inv.due_date)}</td>
                    <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{cur} {fmt(inv.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{inv.payment_type_name || "—"}</td>
                    <td className="px-3 py-2">
                      <select value={inv.status} onChange={e => handleStatusChange(inv.id, e.target.value)}
                        className="px-2 py-0.5 rounded text-xs font-semibold border-0 outline-none cursor-pointer"
                        style={{ background: col + "22", color: col }}>
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                        <option value="Written Off">Written Off</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(inv)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>✏️</button>
                        <Link href={`/invoices/${inv.id}/print`} target="_blank"
                          className="px-2 py-1 rounded text-xs font-semibold"
                          style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>🖨️</Link>
                        <button onClick={() => handleDelete(inv.id)}
                          className="px-2 py-1 rounded text-xs font-semibold"
                          style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm" style={{ color: "var(--muted2)" }}>No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editInvoice && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setEditInvoice(null); }}>
          <div className="w-full max-w-2xl rounded-xl shadow-2xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Edit Invoice — {editInvoice.invoice_number}</h2>
              <button onClick={() => setEditInvoice(null)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Customer *</label>
                    <select name="customer_id" required defaultValue={editInvoice.customer_id} className={inputCss} style={inputStyle}>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Invoice #</label>
                    <input name="invoice_number" required defaultValue={editInvoice.invoice_number || ""} className={inputCss} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date</label>
                    <input name="transaction_date" type="date" required defaultValue={editInvoice.transaction_date?.slice(0, 10) || today} className={inputCss} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                    <input name="due_date" type="date" defaultValue={editInvoice.due_date?.slice(0, 10) || ""} className={inputCss} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue={editInvoice.status} className={inputCss} style={inputStyle}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Written Off">Written Off</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" className={inputCss} style={inputStyle}>
                      <option value="">— Select —</option>
                      {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                    <input name="description" defaultValue={editInvoice.description || ""} className={inputCss} style={inputStyle} />
                  </div>
                </div>
                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Line Items</label>
                    <button type="button" onClick={addLine} className="text-xs px-2 py-1 rounded" style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--border)" }}>+ Add Row</button>
                  </div>
                  <div className="space-y-2">
                    {lines.map((line, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_80px_28px] gap-2 items-center">
                        <input value={line.description} onChange={e => setLine(i, "description", e.target.value)} placeholder="Description" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.quantity} min={1} onChange={e => setLine(i, "quantity", Number(e.target.value))} placeholder="Qty" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.unit_price} min={0} step={0.01} onChange={e => setLine(i, "unit_price", Number(e.target.value))} placeholder="Price" className={inputCss + " text-xs"} style={inputStyle} />
                        <button type="button" onClick={() => removeLine(i)} className="rounded text-xs font-bold w-7 h-7 flex items-center justify-center" style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm font-bold" style={{ color: "var(--accent)" }}>Total: {cur} {fmt(lineTotal)}</div>
                </div>
                <input type="hidden" name="amount" value={lineTotal} />
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setEditInvoice(null)} className="px-4 py-2 rounded text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="px-5 py-2 rounded text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Update Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="w-full max-w-2xl rounded-xl shadow-2xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Create Invoice</h2>
              <button onClick={() => setModal(false)} className="text-xl" style={{ color: "var(--muted2)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Customer *</label>
                    <select name="customer_id" required className={inputCss} style={inputStyle}>
                      <option value="">Select customer…</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Invoice # *</label>
                    <input name="invoice_number" required className={inputCss} style={inputStyle} placeholder="INV-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Date *</label>
                    <input name="transaction_date" type="date" required defaultValue={today} className={inputCss} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Due Date</label>
                    <input name="due_date" type="date" className={inputCss} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                    <select name="status" defaultValue="Pending" className={inputCss} style={inputStyle}>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Payment Type</label>
                    <select name="payment_type_id" className={inputCss} style={inputStyle}>
                      <option value="">— Select —</option>
                      {paymentTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Description</label>
                    <input name="description" className={inputCss} style={inputStyle} placeholder="Service description…" />
                  </div>
                </div>

                {/* Line Items */}
                <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Line Items</label>
                    <button type="button" onClick={addLine}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "var(--card3)", color: "var(--accent)", border: "1px solid var(--border)" }}>+ Add Row</button>
                  </div>
                  <div className="space-y-2">
                    {lines.map((line, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px_80px_28px] gap-2 items-center">
                        <input value={line.description} onChange={e => setLine(i, "description", e.target.value)}
                          placeholder="Description" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.quantity} min={1} onChange={e => setLine(i, "quantity", Number(e.target.value))}
                          placeholder="Qty" className={inputCss + " text-xs"} style={inputStyle} />
                        <input type="number" value={line.unit_price} min={0} step={0.01} onChange={e => setLine(i, "unit_price", Number(e.target.value))}
                          placeholder="Price" className={inputCss + " text-xs"} style={inputStyle} />
                        <button type="button" onClick={() => removeLine(i)}
                          className="rounded text-xs font-bold w-7 h-7 flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,.1)", color: "var(--red-c)" }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-2 text-sm font-bold" style={{ color: "var(--accent)" }}>
                    Total: {cur} {fmt(lineTotal)}
                  </div>
                </div>
                {/* hidden amount fallback */}
                <input type="hidden" name="amount" value={lineTotal} />
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setModal(false)}
                  className="px-4 py-2 rounded text-sm" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>Cancel</button>
                <button type="submit" disabled={busy}
                  className="px-5 py-2 rounded text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
