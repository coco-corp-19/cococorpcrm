import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { getCachedDimensions, getCachedOrgMeta } from "@/lib/supabase/cache";
import { DashboardCharts } from "@/components/DashboardCharts";
import { DashboardTimeSummary } from "@/components/DashboardTimeSummary";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const orgId = await getCurrentOrgId();

  // Fact tables must always be fresh; dimensions and org meta are stable (5 min cache)
  const [
    { data: leads },
    { data: invoices },
    { data: costs },
    { data: income },
    { data: cashflow },
    { data: orgSettings },
    { data: timeRows },
    { data: rdProjects },
    { data: customerRows },
    dims,
    orgMeta,
  ] = await Promise.all([
    supabase.from("fact_leads").select("id, name, status_id, lead_date, opportunity_value, opportunity_weighted, weight, last_follow_up, contacted, responded, developed, completed, created_at, total_revenue").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id, payment_type_id, due_date").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id, include_in_pnl, customer_id, apportion_to_customers").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_income").select("id, amount, transaction_date, income_type").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_cashflow").select("id, balance, record_date, account_id").eq("org_id", orgId).order("record_date", { ascending: false }),
    supabase.from("organizations").select("dashboard_settings").eq("id", orgId).single(),
    // Time tracking — degrades to [] if the migration hasn't run yet
    supabase.from("time_entries").select("entity_type, entity_id, minutes, spent_on").eq("org_id", orgId),
    supabase.from("rd_projects").select("id, name").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("dim_customers").select("id, name, status, created_at").eq("org_id", orgId).is("deleted_at", null),
    getCachedDimensions(orgId),
    getCachedOrgMeta(orgId),
  ]);

  // Aggregate time invested across leads and R&D projects for the review block
  const leadNames = new Map((leads || []).map(l => [l.id as number, l.name as string]));
  const rdNames = new Map((rdProjects || []).map(p => [p.id as number, p.name as string]));
  const monthPrefix = new Date().toISOString().slice(0, 7);
  let leadMinutes = 0, rdMinutes = 0, monthMinutes = 0;
  const byEntity = new Map<string, { label: string; type: "lead" | "rd_project"; minutes: number }>();
  for (const t of (timeRows || []) as { entity_type: string; entity_id: number; minutes: number; spent_on: string | null }[]) {
    const min = Number(t.minutes) || 0;
    if (t.entity_type === "lead") leadMinutes += min;
    else if (t.entity_type === "rd_project") rdMinutes += min;
    if ((t.spent_on || "").slice(0, 7) === monthPrefix) monthMinutes += min;
    const key = `${t.entity_type}:${t.entity_id}`;
    const label = t.entity_type === "lead"
      ? (leadNames.get(t.entity_id) || `Lead #${t.entity_id}`)
      : (rdNames.get(t.entity_id) || `Project #${t.entity_id}`);
    const cur = byEntity.get(key) || { label, type: t.entity_type as "lead" | "rd_project", minutes: 0 };
    cur.minutes += min;
    byEntity.set(key, cur);
  }
  const timeBreakdown = [...byEntity.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 8);

  // Bank balance: sum latest snapshot per account
  const cfData = cashflow || [];
  const latestByAcct: Record<string, { balance: number; record_date: string }> = {};
  for (const entry of cfData) {
    const key = String((entry as { account_id?: number | null }).account_id ?? "unassigned");
    const existing = latestByAcct[key];
    if (!existing || entry.record_date > existing.record_date) {
      latestByAcct[key] = { balance: Number(entry.balance), record_date: entry.record_date };
    }
  }
  const acctValues = Object.values(latestByAcct);
  const bankBalance = acctValues.length > 0 ? acctValues.reduce((s, e) => s + e.balance, 0) : 0;
  const bankLastDate: string | null = acctValues.length > 0
    ? acctValues.map(e => e.record_date).sort().reverse()[0]
    : null;

  // ── Customer analysis (all-time) ──────────────────────────────────────────
  const custList = (customerRows || []) as { id: number; name: string; status: string | null; created_at: string | null }[];
  const custStatus = (c: { status: string | null }) => c.status || "Active";
  const activeCust = custList.filter(c => custStatus(c) === "Active");
  const activeCount = Math.max(activeCust.length, 1);
  const statusCounts = { Active: 0, Inactive: 0, Churned: 0, Prospect: 0 } as Record<string, number>;
  custList.forEach(c => { const s = custStatus(c); statusCounts[s] = (statusCounts[s] ?? 0) + 1; });

  // Per-customer LTV / pending / CAC
  const ltvBy = new Map<number, number>(), pendBy = new Map<number, number>(), invCntBy = new Map<number, number>();
  for (const inv of invoices || []) {
    const cid = inv.customer_id as number | null; if (cid == null) continue;
    const amt = Number(inv.amount || 0);
    invCntBy.set(cid, (invCntBy.get(cid) ?? 0) + 1);
    if (inv.status === "Completed" || inv.status === "Paid") ltvBy.set(cid, (ltvBy.get(cid) ?? 0) + amt);
    else if (inv.status === "Pending") pendBy.set(cid, (pendBy.get(cid) ?? 0) + amt);
  }
  const cacBy = new Map<number, number>();
  for (const cost of (costs || []) as { customer_id: number | null; amount: number | null; apportion_to_customers: boolean | null }[]) {
    const amt = Number(cost.amount || 0);
    if (cost.apportion_to_customers) {
      const share = amt / activeCount;
      activeCust.forEach(c => cacBy.set(c.id, (cacBy.get(c.id) ?? 0) + share));
    } else if (cost.customer_id != null) {
      cacBy.set(cost.customer_id, (cacBy.get(cost.customer_id) ?? 0) + amt);
    }
  }
  const custDetail = custList.map(c => ({
    id: c.id, name: c.name, status: custStatus(c),
    ltv: ltvBy.get(c.id) ?? 0, pending: pendBy.get(c.id) ?? 0,
    cac: Math.round((cacBy.get(c.id) ?? 0) * 100) / 100,
    invoiceCount: invCntBy.get(c.id) ?? 0,
  })).map(r => ({ ...r, net: Math.round((r.ltv - r.cac) * 100) / 100 }));
  const totalLtv = custDetail.reduce((s, r) => s + r.ltv, 0);
  const withSales = custDetail.filter(r => r.ltv > 0).length;
  const customerAnalysis = {
    counts: {
      total: custList.length,
      active: statusCounts.Active ?? 0,
      inactive: statusCounts.Inactive ?? 0,
      churned: statusCounts.Churned ?? 0,
      prospect: statusCounts.Prospect ?? 0,
    },
    totalLtv,
    avgLtv: withSales > 0 ? Math.round((totalLtv / withSales) * 100) / 100 : 0,
    totalPending: custDetail.reduce((s, r) => s + r.pending, 0),
    totalCac: Math.round(custDetail.reduce((s, r) => s + r.cac, 0) * 100) / 100,
    withSales,
    noSales: custList.length - withSales,
    top: [...custDetail].sort((a, b) => b.ltv - a.ltv).slice(0, 8),
  };

  // Current-month range computed once on the server, so the dashboard's default
  // period filter is identical during SSR and client hydration.
  const nowDate = new Date();
  const defaultPeriod = {
    from: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).toISOString().slice(0, 10),
    to: nowDate.toISOString().slice(0, 10),
  };

  return (
    <section>
      <DashboardCharts
        rawLeads={leads || []}
        rawInvoices={invoices || []}
        rawCosts={costs || []}
        rawIncome={income || []}
        rawCashflow={cashflow || []}
        customers={dims.customers}
        statuses={dims.statuses}
        paymentTypes={dims.paymentTypes}
        costCategories={dims.costCategories}
        accounts={dims.accounts}
        currency={orgMeta?.currency || "ZAR"}
        orgName={orgMeta?.name || "CocoCRM"}
        orgId={orgId}
        bankBalance={bankBalance}
        bankLastDate={bankLastDate}
        fiscalYearStart={orgMeta?.fiscal_year_start ?? 3}
        savedDashboardSettings={(orgSettings?.dashboard_settings as Record<string, unknown>) ?? {}}
        defaultPeriod={defaultPeriod}
        customerAnalysis={customerAnalysis}
      />
      <DashboardTimeSummary
        leadMinutes={leadMinutes}
        rdMinutes={rdMinutes}
        monthMinutes={monthMinutes}
        breakdown={timeBreakdown}
      />
    </section>
  );
}
