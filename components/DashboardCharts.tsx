"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type KPIs = {
  totalLeads: number; wonLeads: number; openLeads: number; conversionRate: number;
  revenue: number; pendingAmount: number; totalOpex: number; profit: number;
  margin: number; pipelineValue: number; avgDealSize: number; totalCustomers: number;
  totalInvoices: number; actualCashflow: number; calcCashflow: number;
  cfVariance: number; lastCfDate: string | null;
};
type ChartData = {
  monthlyRevenue: Record<string, number>; monthlyCosts: Record<string, number>;
  leadsByStatus: Record<string, number>; revenueByPayType: Record<string, number>;
  funnel: Record<string, number>;
};
type TopCustomer = { name: string; revenue: number };
type RecentLead = { id: number; name: string; status_id: number; lead_date: string; opportunity_value: number };
type OverdueInv = { id: number; amount: number; customerName: string; transaction_date: string; days: number };
type StaleLead = { id: number; name: string; last_follow_up: string | null };

type Props = {
  kpis: KPIs; charts: ChartData; topCustomers: TopCustomer[];
  recentLeads: RecentLead[]; overdueInvoices: OverdueInv[]; staleLeads: StaleLead[];
  currency: string;
};

const PIE_COLORS = ["#10b981", "#e84393", "#8b5cf6", "#f59e0b", "#06b6d4", "#ef4444"];
const LS_KEY = "crm_kpi_hidden";

type KpiDef = { key: string; label: string };
const KPI_DEFS: KpiDef[] = [
  { key: "totalLeads", label: "Total Leads" },
  { key: "wonLeads", label: "Won Leads" },
  { key: "openLeads", label: "Open Leads" },
  { key: "conversionRate", label: "Conversion" },
  { key: "revenue", label: "Revenue" },
  { key: "pendingAmount", label: "Pending" },
  { key: "totalOpex", label: "OPEX" },
  { key: "profit", label: "Profit" },
  { key: "margin", label: "Margin" },
  { key: "pipelineValue", label: "Pipeline" },
  { key: "avgDealSize", label: "Avg Deal" },
  { key: "totalCustomers", label: "Customers" },
  { key: "totalInvoices", label: "Invoices" },
];

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(n: number) { return (n * 100).toFixed(1) + "%"; }

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</div>
      <div className="text-2xl font-bold font-mono truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, defaultOpen = true, action }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <div className="flex items-center rounded-lg text-sm font-semibold"
        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
        <button onClick={() => setOpen(!open)}
          className="flex-1 flex justify-between items-center px-4 py-3 text-left transition-colors"
          style={{ color: "var(--muted)" }}>
          <span>{title}</span>
          <span style={{ color: "var(--muted2)", fontSize: 11, transform: open ? "rotate(0)" : "rotate(-90deg)", display: "inline-block", transition: "transform .2s" }}>▼</span>
        </button>
        {action && <div className="pr-3 shrink-0">{action}</div>}
      </div>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}

export function DashboardCharts({ kpis, charts, topCustomers, recentLeads, overdueInvoices, staleLeads, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";
  const nowMs = useMemo(() => Date.now(), []);

  // Custom KPI config (localStorage)
  const [kpiHidden, setKpiHidden] = useState<string[]>([]);
  const [kpiModal, setKpiModal] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setKpiHidden(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const toggleKpi = useCallback((key: string) => {
    setKpiHidden(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Prepare chart data
  const months12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (11 - i));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });
  const monthLabel = (m: string) => {
    const [, mo] = m.split("-");
    return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo];
  };
  const revenueData = months12.map(m => ({
    month: monthLabel(m),
    Revenue: charts.monthlyRevenue[m] || 0,
    Costs: charts.monthlyCosts[m] || 0,
  }));

  const statusPieData = Object.entries(charts.leadsByStatus).map(([name, value]) => ({ name, value }));
  const payPieData = Object.entries(charts.revenueByPayType).map(([name, value]) => ({ name, value }));
  const funnelData = Object.entries(charts.funnel).map(([name, value]) => ({ name, value }));
  const funnelMax = Math.max(1, ...Object.values(charts.funnel));

  const varColor = kpis.cfVariance >= 0 ? "var(--accent)" : "var(--red-c)";
  const profitColor = kpis.profit >= 0 ? "var(--accent)" : "var(--red-c)";
  const convColor = kpis.conversionRate >= 0.1 ? "var(--accent)" : "var(--amber-c)";

  // Build data-driven KPI items
  const allKpiItems = [
    { key: "totalLeads", label: "Total Leads", value: String(kpis.totalLeads), sub: `${kpis.openLeads} open`, color: "var(--cyan-c)" },
    { key: "wonLeads", label: "Won", value: String(kpis.wonLeads), sub: `of ${kpis.totalLeads}`, color: "var(--accent)" },
    { key: "openLeads", label: "Open", value: String(kpis.openLeads), sub: "active leads", color: "var(--amber-c)" },
    { key: "conversionRate", label: "Conversion", value: pct(kpis.conversionRate), sub: `${kpis.wonLeads}/${kpis.totalLeads}`, color: convColor },
    { key: "revenue", label: "Revenue", value: `${cur} ${fmt(kpis.revenue)}`, sub: `${cur} ${fmt(kpis.pendingAmount)} pending`, color: "var(--accent)" },
    { key: "pendingAmount", label: "Pending", value: `${cur} ${fmt(kpis.pendingAmount)}`, sub: "awaiting payment", color: "var(--amber-c)" },
    { key: "totalOpex", label: "OPEX", value: `${cur} ${fmt(kpis.totalOpex)}`, sub: "operating costs", color: "var(--red-c)" },
    { key: "profit", label: "Profit", value: `${cur} ${fmt(kpis.profit)}`, sub: `Margin: ${pct(kpis.margin)}`, color: profitColor },
    { key: "margin", label: "Margin", value: pct(kpis.margin), sub: "profit margin", color: profitColor },
    { key: "pipelineValue", label: "Pipeline", value: `${cur} ${fmt(kpis.pipelineValue)}`, sub: "weighted value", color: "var(--purple-c)" },
    { key: "avgDealSize", label: "Avg Deal", value: `${cur} ${fmt(kpis.avgDealSize)}`, sub: `${kpis.wonLeads} deals`, color: "var(--amber-c)" },
    { key: "totalCustomers", label: "Customers", value: String(kpis.totalCustomers), sub: `${kpis.totalInvoices} inv`, color: "var(--cyan-c)" },
    { key: "totalInvoices", label: "Invoices", value: String(kpis.totalInvoices), sub: "total raised", color: "var(--muted2)" },
  ];
  const visibleKpis = allKpiItems.filter(k => !kpiHidden.includes(k.key));

  // Monthly performance table data
  const monthlyTableData = months12.map((m, i) => {
    const rev = charts.monthlyRevenue[m] || 0;
    const cost = charts.monthlyCosts[m] || 0;
    const profit = rev - cost;
    const prevRev = i > 0 ? (charts.monthlyRevenue[months12[i - 1]] || 0) : null;
    const mom = prevRev !== null && prevRev > 0 ? ((rev - prevRev) / prevRev * 100) : null;
    return { month: monthLabel(m) + " " + m.slice(0, 4), rev, cost, profit, mom };
  }).reverse();

  return (
    <div>
      {/* KPIs */}
      <Section
        title="📊 KPIs & Metrics"
        action={
          <button onClick={() => setKpiModal(true)}
            className="px-2.5 py-1 rounded text-xs font-semibold"
            style={{ background: "var(--card3)", color: "var(--muted2)", border: "1px solid var(--border)" }}
            title="Configure visible KPIs">
            ⚙ Configure
          </button>
        }>
        {visibleKpis.length === 0
          ? <p className="text-sm py-4 text-center" style={{ color: "var(--muted2)" }}>All KPIs hidden — click Configure to show some.</p>
          : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visibleKpis.map(k => <KpiCard key={k.key} label={k.label} value={k.value} sub={k.sub} color={k.color} />)}
            </div>
        }
      </Section>

      {/* KPI Config Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setKpiModal(false); }}>
          <div className="w-full max-w-sm rounded-xl shadow-2xl"
            style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-semibold text-sm">Configure KPIs</h2>
              <button onClick={() => setKpiModal(false)} style={{ color: "var(--muted2)" }}>✕</button>
            </div>
            <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
              {KPI_DEFS.map(def => {
                const hidden = kpiHidden.includes(def.key);
                return (
                  <button key={def.key} onClick={() => toggleKpi(def.key)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors"
                    style={{ background: hidden ? "var(--card)" : "rgba(16,185,129,.08)", border: `1px solid ${hidden ? "var(--border)" : "var(--accent)"}` }}>
                    <span style={{ color: hidden ? "var(--muted2)" : "var(--foreground)" }}>{def.label}</span>
                    <span className="font-bold" style={{ color: hidden ? "var(--muted2)" : "var(--accent)" }}>
                      {hidden ? "Hidden" : "Visible ✓"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="px-5 pb-4 pt-2 flex gap-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => { setKpiHidden([]); localStorage.removeItem(LS_KEY); }}
                className="flex-1 py-2 rounded text-xs font-semibold" style={{ background: "var(--card3)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                Show All
              </button>
              <button onClick={() => setKpiModal(false)}
                className="flex-1 py-2 rounded text-xs font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cashflow reconciliation */}
      <Section title="💰 Cashflow Reconciliation">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="Calculated" value={`${cur} ${fmt(kpis.calcCashflow)}`} sub="Revenue − OPEX" color="var(--pink)" />
          <KpiCard
            label="Actual (Bank)"
            value={kpis.actualCashflow > 0 ? `${cur} ${fmt(kpis.actualCashflow)}` : "— not recorded —"}
            sub={kpis.lastCfDate ? new Date(kpis.lastCfDate).toLocaleDateString("en-ZA") : ""}
            color={kpis.actualCashflow > 0 ? "var(--accent)" : "var(--amber-c)"}
          />
          {kpis.actualCashflow > 0 && (
            <KpiCard
              label="Variance"
              value={`${kpis.cfVariance >= 0 ? "+" : ""}${cur} ${fmt(Math.abs(kpis.cfVariance))}`}
              sub={kpis.cfVariance === 0 ? "Balanced" : kpis.cfVariance > 0 ? "More in bank" : "Less in bank"}
              color={varColor}
            />
          )}
        </div>
      </Section>

      {/* Charts + Monthly Table */}
      <Section title="📈 Revenue & Leads">
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Monthly Revenue vs Costs</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1b45" />
                  <XAxis dataKey="month" tick={{ fill: "#8a84b0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8a84b0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#171535", border: "1px solid #2d2860", borderRadius: 6, color: "#f0f0fc", fontSize: 11 }} />
                  <Bar dataKey="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Costs" fill="rgba(239,68,68,.5)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Leads by Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                    {statusPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#171535", border: "1px solid #2d2860", borderRadius: 6, color: "#f0f0fc", fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: "#8a84b0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Revenue by Payment Type</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={payPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                    {payPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#171535", border: "1px solid #2d2860", borderRadius: 6, color: "#f0f0fc", fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: "#8a84b0" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Revenue by Month (recent)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueData.filter(d => d.Revenue > 0).slice(-6)} layout="vertical" margin={{ left: 30 }}>
                  <XAxis type="number" tick={{ fill: "#8a84b0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="month" tick={{ fill: "#8a84b0", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#171535", border: "1px solid #2d2860", borderRadius: 6, color: "#f0f0fc", fontSize: 11 }} />
                  <Bar dataKey="Revenue" fill="rgba(16,185,129,.7)" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly performance table */}
          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted2)" }}>Monthly Performance Breakdown</h3>
            </div>
            <div className="overflow-x-auto" style={{ background: "var(--card2)" }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
                    {["Month", "Revenue", "Costs", "Profit", "MoM %"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyTableData.map(row => (
                    <tr key={row.month} className="border-b hover:bg-[var(--card3)]" style={{ borderColor: "var(--border)" }}>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--muted)" }}>{row.month}</td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--accent)" }}>{cur} {fmt(row.rev)}</td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--red-c)" }}>{cur} {fmt(row.cost)}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold whitespace-nowrap" style={{ color: row.profit >= 0 ? "var(--accent)" : "var(--red-c)" }}>
                        {cur} {fmt(row.profit)}
                      </td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: row.mom === null ? "var(--muted2)" : row.mom >= 0 ? "var(--accent)" : "var(--red-c)" }}>
                        {row.mom === null ? "—" : `${row.mom >= 0 ? "+" : ""}${row.mom.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      </Section>

      {/* Funnel + Top Customers */}
      <Section title="🔻 Funnel & Top Customers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Sales Funnel</h3>
            {funnelData.map(({ name, value }, i) => (
              <div key={name} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-right w-20 shrink-0" style={{ color: "var(--muted2)" }}>{name}</span>
                <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: "var(--card3)" }}>
                  <div className="h-full rounded flex items-center px-2 text-xs font-semibold text-white transition-all"
                    style={{ width: `${Math.max(value / funnelMax * 100, 8)}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}>
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Top Customers by Revenue</h3>
            {topCustomers.length === 0 && <p className="text-xs" style={{ color: "var(--muted2)" }}>No data</p>}
            {topCustomers.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: "var(--muted2)" }}>#{i + 1}</span>
                <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--muted)" }}>{c.name}</span>
                <span className="text-xs font-semibold font-mono" style={{ color: "var(--accent)" }}>{cur} {fmt(c.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Alerts */}
      {(overdueInvoices.length > 0 || staleLeads.length > 0) && (
        <Section title="⚠️ Alerts & Intelligence">
          {overdueInvoices.length > 0 && (
            <div className="rounded-lg p-4 mb-3" style={{ background: "rgba(239,68,68,.08)", border: "1px solid var(--red-c)", borderLeft: "4px solid var(--red-c)" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--red-c)" }}>🚨 Overdue Invoices ({overdueInvoices.length}) — {cur} {fmt(overdueInvoices.reduce((s, i) => s + i.amount, 0))}</p>
              {overdueInvoices.slice(0, 8).map(inv => (
                <div key={inv.id} className="flex justify-between items-center py-1.5 border-b text-xs" style={{ borderColor: "rgba(255,255,255,.05)", color: "var(--muted)" }}>
                  <span>{inv.customerName} — {cur} {fmt(inv.amount)} <span style={{ color: "var(--muted2)" }}>({inv.days}d)</span></span>
                </div>
              ))}
            </div>
          )}
          {staleLeads.length > 0 && (
            <div className="rounded-lg p-4" style={{ background: "rgba(245,158,11,.08)", border: "1px solid var(--amber-c)", borderLeft: "4px solid var(--amber-c)" }}>
              <p className="text-xs font-bold mb-2" style={{ color: "var(--amber-c)" }}>📞 Follow-Up Needed ({staleLeads.length})</p>
              {staleLeads.slice(0, 8).map(l => (
                <div key={l.id} className="flex justify-between items-center py-1.5 border-b text-xs" style={{ borderColor: "rgba(255,255,255,.05)", color: "var(--muted)" }}>
                  <span>{l.name} — {l.last_follow_up ? `${Math.floor((nowMs - new Date(l.last_follow_up).getTime()) / 86400000)}d ago` : "Never"}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Recent Leads */}
      <Section title="🎯 Recent Leads">
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {recentLeads.length === 0 && <p className="p-4 text-xs" style={{ color: "var(--muted2)" }}>No leads yet</p>}
          {recentLeads.map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 border-b" style={{ borderColor: "var(--border)", background: "var(--card2)" }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: l.status_id === 3 ? "var(--accent)" : l.status_id === 4 ? "var(--red-c)" : "var(--pink)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.name}</p>
                <p className="text-xs" style={{ color: "var(--muted2)" }}>{l.lead_date ? new Date(l.lead_date).toLocaleDateString("en-ZA") : "—"} · {cur} {fmt(l.opportunity_value || 0)}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
