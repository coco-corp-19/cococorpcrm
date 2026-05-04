import { createServerClient } from "@/lib/supabase/server";
import { DashboardCharts } from "@/components/DashboardCharts";

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const [
    { data: leads },
    { data: invoices },
    { data: costs },
    { data: cashflow },
    { data: customers },
    { data: statuses },
    { data: org },
  ] = await Promise.all([
    supabase.from("fact_leads").select("id, name, status_id, lead_date, opportunity_value, opportunity_weighted, weight, last_follow_up, contacted, responded, developed, completed, created_at").is("deleted_at", null),
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id, payment_type_id, due_date").is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id").is("deleted_at", null),
    supabase.from("fact_cashflow").select("id, balance, record_date, account_id").order("record_date", { ascending: false }),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("organizations").select("currency, name").single(),
  ]);

  // Bank transactions (new table — graceful fallback if not yet migrated)
  let bankActual = 0;
  let bankLastDate: string | null = null;
  try {
    const { data: bankTxns } = await supabase
      .from("fact_bank_transactions")
      .select("balance, txn_date, credit, debit")
      .order("txn_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200);
    if (bankTxns && bankTxns.length > 0) {
      // Use the latest balance field if available, else derive from net credits/debits
      const latest = bankTxns[0];
      bankActual = latest.balance != null
        ? Number(latest.balance)
        : bankTxns.reduce((s: number, t: { credit: number; debit: number }) => s + Number(t.credit || 0) - Number(t.debit || 0), 0);
      bankLastDate = latest.txn_date;
    }
  } catch { /* table not yet created */ }

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";
  void cur;

  const allLeads = leads || [];
  const allInvoices = invoices || [];
  const allCosts = costs || [];
  const allCustomers = customers || [];
  const allCashflow = cashflow || [];
  const statusList = statuses || [];

  // Status helpers
  const wonStatusId = statusList.find(s => s.name === "Closed Won")?.id ?? 3;
  const lostStatusId = statusList.find(s => s.name === "Closed Lost")?.id ?? 4;

  // Lead KPIs
  const totalLeads = allLeads.length;
  const wonLeads = allLeads.filter(l => l.status_id === wonStatusId).length;
  const openLeads = allLeads.filter(l => l.status_id !== wonStatusId && l.status_id !== lostStatusId && l.status_id !== 5).length;
  const conversionRate = totalLeads > 0 ? wonLeads / totalLeads : 0;
  const pipelineValue = allLeads.reduce((s, l) => s + Number(l.opportunity_weighted || 0), 0);
  const avgDealSize = wonLeads > 0 ? allLeads.filter(l => l.status_id === wonStatusId).reduce((s, l) => s + Number(l.opportunity_value || 0), 0) / wonLeads : 0;

  // Invoice KPIs
  const completedInvoices = allInvoices.filter(i => i.status === "Completed" || i.status === "Paid");
  const pendingInvoices = allInvoices.filter(i => i.status === "Pending");
  const revenue = completedInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const pendingAmount = pendingInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalInvoices = allInvoices.length;

  // Cost KPIs
  const totalOpex = allCosts.reduce((s, c) => s + Number(c.amount || 0), 0);

  // Profit
  const profit = revenue - totalOpex;
  const margin = revenue > 0 ? profit / revenue : 0;

  // Cashflow — prefer bank transactions, fall back to legacy fact_cashflow
  const latestCf = allCashflow[0];
  const legacyCfBalance = latestCf ? Number(latestCf.balance) : 0;
  const legacyCfDate = latestCf?.record_date || null;
  const actualCashflow = bankActual > 0 ? bankActual : legacyCfBalance;
  const lastCfDate = bankActual > 0 ? bankLastDate : legacyCfDate;
  const calcCashflow = revenue - totalOpex;
  const cfVariance = actualCashflow - calcCashflow;

  // Customer count
  const totalCustomers = allCustomers.length;

  // --- Chart data ---
  const months12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  });

  const monthlyRevenue: Record<string, number> = {};
  const monthlyCosts: Record<string, number> = {};
  months12.forEach(m => { monthlyRevenue[m] = 0; monthlyCosts[m] = 0; });

  completedInvoices.forEach(inv => {
    const m = inv.transaction_date?.slice(0, 7);
    if (m && monthlyRevenue[m] !== undefined) monthlyRevenue[m] += Number(inv.amount || 0);
  });
  allCosts.forEach(c => {
    const m = c.transaction_date?.slice(0, 7);
    if (m && monthlyCosts[m] !== undefined) monthlyCosts[m] += Number(c.amount || 0);
  });

  // Leads by status name
  const leadsByStatus: Record<string, number> = {};
  allLeads.forEach(l => {
    const sName = statusList.find(s => s.id === l.status_id)?.name || "Unknown";
    leadsByStatus[sName] = (leadsByStatus[sName] || 0) + 1;
  });

  // Revenue by payment type — just use status for now (payment_type_id would need join)
  const revenueByPayType: Record<string, number> = {};
  completedInvoices.forEach(inv => {
    const key = inv.payment_type_id ? `Type ${inv.payment_type_id}` : "Unspecified";
    revenueByPayType[key] = (revenueByPayType[key] || 0) + Number(inv.amount || 0);
  });

  // Funnel
  const funnel = {
    Contacted: allLeads.filter(l => l.contacted).length,
    Responded: allLeads.filter(l => l.responded).length,
    Developed: allLeads.filter(l => l.developed).length,
    Completed: allLeads.filter(l => l.completed).length,
    Won: wonLeads,
  };

  // Alerts: overdue invoices (pending > 30 days)
  const now = Date.now();
  const overdueInvoices = pendingInvoices
    .filter(inv => {
      const d = inv.due_date || inv.transaction_date;
      if (!d) return false;
      return (now - new Date(d).getTime()) / 86400000 > 30;
    })
    .map(inv => ({
      id: inv.id,
      amount: Number(inv.amount || 0),
      customerName: allCustomers.find(c => c.id === inv.customer_id)?.name || "Unknown",
      transaction_date: inv.transaction_date || "",
      days: Math.floor((now - new Date(inv.due_date || inv.transaction_date || "").getTime()) / 86400000),
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 10);

  // Stale leads: open leads with no follow-up in 7+ days
  const staleLeads = allLeads
    .filter(l => l.status_id !== wonStatusId && l.status_id !== lostStatusId && l.status_id !== 5)
    .filter(l => {
      if (!l.last_follow_up) return true;
      return (now - new Date(l.last_follow_up).getTime()) / 86400000 > 7;
    })
    .map(l => ({ id: l.id, name: l.name, last_follow_up: l.last_follow_up }))
    .slice(0, 10);

  // Top 5 customers by completed revenue
  const customerRevMap: Record<number, number> = {};
  completedInvoices.forEach(inv => {
    if (inv.customer_id) customerRevMap[inv.customer_id] = (customerRevMap[inv.customer_id] || 0) + Number(inv.amount || 0);
  });
  const topCustomers = allCustomers
    .map(c => ({ name: c.name, revenue: customerRevMap[c.id] || 0 }))
    .filter(c => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Recent 5 leads
  const recentLeads = allLeads
    .sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime())
    .slice(0, 5)
    .map(l => ({ id: l.id, name: l.name, status_id: l.status_id, lead_date: l.lead_date || "", opportunity_value: Number(l.opportunity_value || 0) }));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--card2)", color: "var(--muted2)", border: "1px solid var(--border)" }}>
          {org?.name || "CocoCRM"}
        </span>
      </div>
      <DashboardCharts
        kpis={{ totalLeads, wonLeads, openLeads, conversionRate, revenue, pendingAmount, totalOpex, profit, margin, pipelineValue, avgDealSize, totalCustomers, totalInvoices, actualCashflow, calcCashflow, cfVariance, lastCfDate }}
        charts={{ monthlyRevenue, monthlyCosts, leadsByStatus, revenueByPayType, funnel }}
        topCustomers={topCustomers}
        recentLeads={recentLeads}
        overdueInvoices={overdueInvoices}
        staleLeads={staleLeads}
        currency={currency}
      />
    </section>
  );
}
