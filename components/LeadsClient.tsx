"use client";

import { useState, useRef } from "react";
import { updateLeadStatus, deleteLead, createLead, updateLead, convertLeadToCustomer } from "@/server-actions/leads";

// ─── Tinder-style swipe card view ────────────────────────────────────────────
function SwipeView({ leads, statuses, cur, onStatusChange }: {
  leads: Lead[]; statuses: Status[]; cur: string;
  onStatusChange: (id: number, newStatusId: number) => Promise<void>;
}) {
  const [idx, setIdx] = useState(0);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const THRESHOLD = 90;

  const remaining = leads.slice(idx);
  const lead = remaining[0];

  async function act(direction: "promote" | "demote" | "skip") {
    if (direction !== "skip" && lead) {
      const stIdx = statuses.findIndex(s => s.id === lead.status_id);
      const next = direction === "promote" ? statuses[stIdx + 1] : statuses[stIdx - 1];
      if (next) await onStatusChange(lead.id, next.id);
    }
    setOffset(0);
    setIdx(i => i + 1);
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset(e.clientX - startX.current);
  }
  function onPointerUp() {
    setDragging(false);
    const stIdx = statuses.findIndex(s => s.id === lead?.status_id);
    if (offset > THRESHOLD && stIdx < statuses.length - 1) act("promote");
    else if (offset < -THRESHOLD && stIdx > 0) act("demote");
    else setOffset(0);
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">✓</div>
        <p className="text-lg font-semibold">All leads reviewed!</p>
        <p className="text-sm mt-1 mb-6" style={{ color: "var(--muted2)" }}>You&apos;ve gone through all {leads.length} leads</p>
        <button onClick={() => setIdx(0)} className="px-5 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}>Start over</button>
      </div>
    );
  }

  const st = statuses.find(s => s.id === lead.status_id);
  const stColor = STATUS_COLORS[lead.status_id ?? 0] || "var(--muted2)";
  const stIdx = statuses.findIndex(s => s.id === lead.status_id);
  const canPromote = stIdx < statuses.length - 1;
  const canDemote = stIdx > 0;
  const nextSt = canPromote ? statuses[stIdx + 1] : null;
  const prevSt = canDemote ? statuses[stIdx - 1] : null;
  const rotation = offset * 0.07;
  const swipeRatio = Math.min(1, Math.abs(offset) / THRESHOLD);

  return (
    <div className="flex flex-col items-center py-4 select-none">
      <p className="text-xs mb-6 font-mono" style={{ color: "var(--muted2)" }}>
        {idx + 1} / {leads.length}
      </p>

      {/* Card stack */}
      <div className="relative w-full max-w-sm" style={{ height: 420 }}>
        {/* Shadow cards */}
        {remaining[2] && (
          <div className="absolute inset-x-6 bottom-0 rounded-2xl" style={{ height: 400, background: "var(--card)", border: "1px solid var(--border)", transform: "scale(0.90) translateY(8px)", transformOrigin: "bottom" }} />
        )}
        {remaining[1] && (
          <div className="absolute inset-x-3 bottom-0 rounded-2xl" style={{ height: 400, background: "var(--card2)", border: "1px solid var(--border)", transform: "scale(0.95) translateY(4px)", transformOrigin: "bottom" }} />
        )}

        {/* Main card */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { setDragging(false); setOffset(0); }}
          className="absolute inset-0 rounded-2xl cursor-grab active:cursor-grabbing overflow-hidden"
          style={{
            background: "var(--card2)",
            border: "1px solid var(--border)",
            transform: `translateX(${offset}px) rotate(${rotation}deg)`,
            transition: dragging ? "none" : "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
            boxShadow: "0 24px 64px rgba(0,0,0,.35)",
            userSelect: "none",
            touchAction: "none",
          }}>

          {/* Swipe labels */}
          {offset > 20 && (
            <div className="absolute top-5 left-5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wider"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", opacity: swipeRatio, background: "rgba(16,185,129,.12)" }}>
              Promote → {nextSt?.name}
            </div>
          )}
          {offset < -20 && (
            <div className="absolute top-5 right-5 px-3 py-1.5 rounded-lg border-2 text-xs font-bold uppercase tracking-wider"
              style={{ borderColor: "var(--red-c)", color: "var(--red-c)", opacity: swipeRatio, background: "rgba(239,68,68,.12)" }}>
              {prevSt?.name} ← Demote
            </div>
          )}

          {/* Status bar */}
          <div className="px-6 pt-5 pb-2 flex justify-between items-center">
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: stColor + "22", color: stColor }}>{st?.name || "—"}</span>
            <span className="text-xs font-mono" style={{ color: "var(--muted2)" }}>{fdate(lead.lead_date)}</span>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <h2 className="text-2xl font-bold mb-2 leading-tight">{lead.name}</h2>
            {lead.contact && <p className="text-sm mb-1" style={{ color: "var(--muted2)" }}>👤 {lead.contact}</p>}
            {lead.phone && <p className="text-sm mb-1" style={{ color: "var(--muted2)" }}>📞 {lead.phone}</p>}
          </div>

          {/* Values */}
          <div className="mx-6 grid grid-cols-2 gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Opportunity</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--accent)" }}>{cur} {fmt(lead.opportunity_value)}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>Pipeline</p>
              <p className="text-lg font-bold font-mono" style={{ color: "var(--purple-c)" }}>{cur} {fmt(lead.opportunity_weighted)}</p>
            </div>
          </div>

          {/* Funnel indicators */}
          <div className="mx-6 mt-4 flex gap-4 justify-around">
            {(["contacted", "responded", "developed", "paid"] as const).map(f => (
              <div key={f} className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: lead[f] ? "rgba(16,185,129,.2)" : "var(--card)", color: lead[f] ? "var(--accent)" : "var(--muted2)", border: `1px solid ${lead[f] ? "var(--accent)" : "var(--border)"}` }}>
                  {lead[f] ? "✓" : "○"}
                </div>
                <span className="text-xs capitalize" style={{ color: "var(--muted2)" }}>{f.slice(0, 4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs mt-5 mb-4" style={{ color: "var(--muted2)" }}>
        Swipe right to promote · Swipe left to demote · Tap buttons below
      </p>

      {/* Action buttons */}
      <div className="flex gap-5 items-center">
        <div className="text-center">
          <button onClick={() => canDemote && act("demote")} disabled={!canDemote}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg transition-all active:scale-90"
            style={{
              background: canDemote ? "rgba(239,68,68,.15)" : "var(--card)",
              border: `2px solid ${canDemote ? "var(--red-c)" : "var(--border)"}`,
              color: canDemote ? "var(--red-c)" : "var(--muted2)",
            }}>←</button>
          <p className="text-xs mt-1 w-14 text-center truncate" style={{ color: "var(--muted2)" }}>{prevSt?.name || ""}</p>
        </div>
        <div className="text-center">
          <button onClick={() => act("skip")}
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg shadow transition-all active:scale-90"
            style={{ background: "var(--card2)", border: "2px solid var(--border)", color: "var(--muted2)" }}>↺</button>
          <p className="text-xs mt-1" style={{ color: "var(--muted2)" }}>Skip</p>
        </div>
        <div className="text-center">
          <button onClick={() => canPromote && act("promote")} disabled={!canPromote}
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg transition-all active:scale-90"
            style={{
              background: canPromote ? "rgba(16,185,129,.15)" : "var(--card)",
              border: `2px solid ${canPromote ? "var(--accent)" : "var(--border)"}`,
              color: canPromote ? "var(--accent)" : "var(--muted2)",
            }}>→</button>
          <p className="text-xs mt-1 w-14 text-center truncate" style={{ color: "var(--muted2)" }}>{nextSt?.name || ""}</p>
        </div>
      </div>
    </div>
  );
}

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
  const [view, setView] = useState<"table" | "kanban" | "cards">("table");
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
          {([["table", "Table"], ["kanban", "Board"], ["cards", "Cards"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-2 text-xs font-semibold transition-colors"
              style={{ background: view === v ? "var(--accent)" : "var(--card2)", color: view === v ? "#fff" : "var(--muted)" }}>
              {label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="px-3 py-2 text-xs rounded border outline-none"
          style={{ background: "var(--card2)", borderColor: "var(--border)", color: "var(--foreground)" }} />
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

      {/* CARDS / TINDER VIEW */}
      {view === "cards" && (
        <SwipeView
          leads={filtered}
          statuses={statuses}
          cur={cur}
          onStatusChange={async (id, newStatusId) => {
            await updateLeadStatus(id, newStatusId);
          }}
        />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Name *</label>
                  <input name="name" required defaultValue={modal.lead?.name || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Lead Date</label>
                  <input name="lead_date" type="date" defaultValue={modal.lead?.lead_date?.slice(0, 10) || new Date().toISOString().slice(0, 10)} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Phone</label>
                  <input name="phone" defaultValue={modal.lead?.phone || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Contact Person</label>
                  <input name="contact" defaultValue={modal.lead?.contact || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Opportunity Value</label>
                  <input name="opportunity_value" type="number" step="0.01" defaultValue={modal.lead?.opportunity_value || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Weight (%)</label>
                  <input name="weight" type="number" min="0" max="100" step="1" defaultValue={modal.lead?.weight || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Total Revenue</label>
                  <input name="total_revenue" type="number" step="0.01" defaultValue={modal.lead?.total_revenue || ""} className={inputStyle} style={inputCss} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--muted2)" }}>Secured Revenue</label>
                  <input name="secured_revenue" type="number" step="0.01" defaultValue={modal.lead?.secured_revenue || ""} className={inputStyle} style={inputCss} />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
