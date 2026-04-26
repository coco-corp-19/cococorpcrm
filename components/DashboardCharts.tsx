"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
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

function fmt(n: number) {
  return Number(n).toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(n: number) { return (n * 100).toFixed(1) + "%"; }

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted2)" }}>{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted2)" }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 rounded-lg text-sm font-semibold text-left transition-colors"
        style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
        <span>{title}</span>
        <span style={{ color: "var(--muted2)", fontSize: 11, transform: open ? "rotate(0)" : "rotate(-90deg)", display: "inline-block", transition: "transform .2s" }}>▼</span>
      </button>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}

export function DashboardCharts({ kpis, charts, topCustomers, recentLeads, overdueInvoices, staleLeads, currency }: Props) {
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";
  const nowMs = useMemo(() => Date.now(), []);

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

  const varColor = kpis.cfVariance === 0 ? "var(--accent)" : kpis.cfVariance > 0 ? "var(--accent)" : "var(--red-c)";
  const profitColor = kpis.profit >= 0 ? "var(--accent)" : "var(--red-c)";
  const convColor = kpis.conversionRate >= 0.1 ? "var(--accent)" : "var(--amber-c)";

  return (
    <div>
      {/* KPIs */}
      <Section title="📊 KPIs & Metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <KpiCard label="Total Leads" value={String(kpis.totalLeads)} sub={`${kpis.openLeads} open`} color="var(--cyan-c)" />
          <KpiCard label="Won" value={String(kpis.wonLeads)} sub={`of ${kpis.totalLeads}`} color="var(--accent)" />
          <KpiCard label="Conversion" value={pct(kpis.conversionRate)} sub={`${kpis.wonLeads}/${kpis.totalLeads}`} color={convColor} />
          <KpiCard label="Revenue" value={`${cur} ${fmt(kpis.revenue)}`} sub={`${cur} ${fmt(kpis.pendingAmount)} pending`} color="var(--accent)" />
          <KpiCard label="OPEX" value={`${cur} ${fmt(kpis.totalOpex)}`} color="var(--red-c)" />
          <KpiCard label="Profit" value={`${cur} ${fmt(kpis.profit)}`} sub={`Margin: ${pct(kpis.margin)}`} color={profitColor} />
          <KpiCard label="Pipeline" value={`${cur} ${fmt(kpis.pipelineValue)}`} color="var(--purple-c)" />
          <KpiCard label="Avg Deal" value={`${cur} ${fmt(kpis.avgDealSize)}`} sub={`${kpis.wonLeads} deals`} color="var(--amber-c)" />
          <KpiCard label="Customers" value={String(kpis.totalCustomers)} sub={`${kpis.totalInvoices} inv`} color="var(--cyan-c)" />
        </div>
      </Section>

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

      {/* Charts */}
      <Section title="📈 Revenue & Leads">
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
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted2)" }}>Revenue by Status (Won Leads)</h3>
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
