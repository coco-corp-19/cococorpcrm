"use client";

import { useState, useRef } from "react";
import { updateLeadStatus, deleteLead, createLead, updateLead, convertLeadToCustomer } from "@/server-actions/leads";

type Status = { id: number; name: string };
type Lead = {
  id: number; name: string; phone: string | null; contact: string | null;
  lead_date: string | null; status_id: number | null; last_follow_up: string | null;
  opportunity_value: number | null; weight: number | null; opportunity_weighted: number | null;
  total_revenue: number | null; secured_revenue: number | null;
  contacted: boolean; responded: boolean; developed: boolean; paid: boolean;
};
type Customer = { id: number; name: string };

type Props = {
  leads: Lead[];
  statuses: Status[];
  customers: Customer[];
  currency: string;
};

const STATUS_COLORS: Record<number, string> = { 1: "var(--pink)", 2: "var(--amber-c)", 3: "var(--accent)", 4: "var(--red-c)", 5: "var(--muted2)" };
function fmt(n: number | null) { return n == null ? "0" : Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fdate(d: string | null) { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return "—"; } }
function pct(n: number | null) { if (!n) return "0%"; return `${Number(n)}%`; }
const dot = (v: boolean) => <span style={{ color: v ? "var(--accent)" : "var(--muted2)", marginRight: 1 }}>{v ? "●" : "○"}</span>;

export function LeadsClient({ leads, statuses, customers, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : "$";
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [busy, setBusy] = useState(false);
  const dragId = useRef<number | null>(null);

  const filtered = leads.filter(l => {
    if (statusFilter && String(l.status_id) !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (l.name + (l.phone || "") + (l.contact || "")).toLowerCase().includes(q);
    }
    return true;
  });

  async function handleStatusDrop(e: React.DragEvent, newStatusId: number) {
    e.preventDefault();
    const lid = dragId.current;
    if (!lid) return;
    document.querySelectorAll("[data-kcol]").forEach(el => el.classList.remove("ring-2", "ring-[var(--accent)]"));
    await updateLeadStatus(lid, newStatusId);
  }

  function openModal(lead: Lead | null) { setModal({ open: true, lead }); }
  function closeModal() { setModal({ open: false, lead: null }); }

  async function handleDelete(id: number) {
    if (!confirm("Archive this lead?")) return;
    setBusy(true);
    await deleteLead(id);
    setBusy(false);
  }

  async function handleConvert(id: number) {
    if (!confirm("Convert this lead to a customer?")) return;
    setBusy(true);
    await convertLeadToCustomer(id);
    setBusy(false);
  }

  const inputStyle = "w-full px-3 py-2 rounded border text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]";
  const inputCss = { background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {(["table", "kanban"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-2 text-xs font-semibold capitalize transition-colors"
              style={{ background: view === v ? "var(--accent)" : "var(--card2)", color: view === v ? "#fff" : "var(--muted)" }}>
              {v === "table" ? "Table" : "Board"}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="px-3 py-2 text-xs rounded border outline-none"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)", minWidth: 180 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded border outline-none"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--muted)" }}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="text-xs ml-auto" style={{ color: "var(--muted2)" }}>{filtered.length}/{leads.length}</span>
        <button onClick={() => openModal(null)}
          className="px-4 py-2 text-xs font-semibold rounded"
          style={{ background: "var(--accent)", color: "#fff" }}>
          + New Lead
        </button>
      </div>

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Name", "Status", "Opp", "Wt", "Pipeline", "Funnel", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const st = statuses.find(s => s.id === l.status_id);
                  const stColor = STATUS_COLORS[l.status_id ?? 0] || "var(--muted2)";
                  return (
                    <tr key={l.id} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted2)" }}>{fdate(l.lead_date)}</td>
                      <td className="px-3 py-2 font-medium max-w-[160px] truncate">{l.name}</td>
                      <td className="px-3 py-2">
                        {st && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: stColor + "22", color: stColor }}>{st.name}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{cur} {fmt(l.opportunity_value)}</td>
                      <td className="px-3 py-2">{pct(l.weight)}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap" style={{ color: "var(--purple-c)" }}>{cur} {fmt(l.opportunity_weighted)}</td>
                      <td className="px-3 py-2">{dot(l.contacted)}{dot(l.responded)}{dot(l.developed)}{dot(l.paid)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button onClick={() => openModal(l)} className="mr-1 px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }}>✏️</button>
                        {!leads.find(x => x.id === l.id)?.contact && (
                          <button onClick={() => handleConvert(l.id)} className="mr-1 px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }} title="Convert to Customer">🔄</button>
                        )}
                        <button onClick={() => handleDelete(l.id)} className="px-2 py-1 rounded text-xs" style={{ border: "1px solid var(--border)", background: "var(--card2)" }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-xs" style={{ color: "var(--muted2)" }}>No leads found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {statuses.map(status => {
            const colLeads = leads.filter(l => l.status_id === status.id);
            const stColor = STATUS_COLORS[status.id] || "var(--muted2)";
            return (
              <div key={status.id} data-kcol={status.id}
                className="shrink-0 rounded-lg w-64"
                style={{ background: "var(--card)", border: "1px solid var(--border)", minHeight: 200 }}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,.08)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                onDrop={async e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; await handleStatusDrop(e, status.id); }}>
                <div className="px-3 py-2.5 border-b flex justify-between items-center" style={{ borderColor: "var(--border)", borderTop: `3px solid ${stColor}` }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: stColor }}>{status.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--card2)", color: "var(--muted2)" }}>{colLeads.length}</span>
                </div>
                <div className="p-2 space-y-2">
                  {colLeads.map(l => (
                    <div key={l.id} draggable
                      onDragStart={() => { dragId.current = l.id; }}
                      onDragEnd={() => { dragId.current = null; }}
                      onClick={() => openModal(l)}
                      className="rounded p-2.5 cursor-grab active:cursor-grabbing transition-colors"
                      style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
                      <p className="text-xs font-semibold truncate">{l.name}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--muted2)" }}>{cur} {fmt(l.opportunity_value)}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted2)" }}>{fdate(l.lead_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-lg rounded-xl" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-center px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h3 className="font-semibold">{modal.lead ? `Edit Lead #${modal.lead.id}` : "New Lead"}</h3>
              <button onClick={closeModal} className="text-lg" style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <form className="p-5 space-y-3"
              action={async (fd: FormData) => {
                setBusy(true);
                try {
                  if (modal.lead) await updateLead(modal.lead.id, fd);
                  else await createLead(fd);
                  closeModal();
                } finally { setBusy(false); }
              }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={modal.lead?.name || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Lead Date</label>
                  <input name="lead_date" type="date" defaultValue={modal.lead?.lead_date?.slice(0, 10) || new Date().toISOString().slice(0, 10)} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input name="phone" defaultValue={modal.lead?.phone || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Contact Person</label>
                  <input name="contact" defaultValue={modal.lead?.contact || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Status</label>
                  <select name="status_id" defaultValue={modal.lead?.status_id ?? ""} className={inputStyle} style={inputCss}>
                    <option value="">— Select —</option>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Follow Up Date</label>
                  <input name="last_follow_up" type="date" defaultValue={modal.lead?.last_follow_up?.slice(0, 10) || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Opportunity Value</label>
                  <input name="opportunity_value" type="number" step="0.01" defaultValue={modal.lead?.opportunity_value || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Weight (%)</label>
                  <input name="weight" type="number" min="0" max="100" step="1" defaultValue={modal.lead?.weight || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Total Revenue</label>
                  <input name="total_revenue" type="number" step="0.01" defaultValue={modal.lead?.total_revenue || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Secured Revenue</label>
                  <input name="secured_revenue" type="number" step="0.01" defaultValue={modal.lead?.secured_revenue || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {(["contacted", "responded", "developed", "paid"] as const).map(f => (
                  <div key={f} className="flex flex-col items-center gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>{f}</label>
                    <select name={f} defaultValue={modal.lead ? String(modal.lead[f]) : "false"} className="w-full px-2 py-1.5 text-xs rounded border outline-none" style={inputCss}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 py-2 text-sm font-semibold rounded" style={{ background: "var(--accent)", color: "#fff", opacity: busy ? .6 : 1 }}>
                  {busy ? "Saving…" : modal.lead ? "Update Lead" : "Create Lead"}
                </button>
              </div>
            </form>
            {modal.lead && (
              <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => handleConvert(modal.lead!.id)}
                  className="w-full py-2 text-sm rounded border mt-3 font-semibold"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                  🔄 Convert to Customer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
