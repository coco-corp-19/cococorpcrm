"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function takeSnapshot() {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const [{ data: invoices }, { data: costs }, { data: leads }, { data: cashflow }] = await Promise.all([
    supabase.from("fact_invoices").select("amount, status, transaction_date").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_costs").select("amount").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_leads").select("status_id, opportunity_weighted, total_revenue").eq("org_id", orgId).is("deleted_at", null),
    supabase.from("fact_cashflow").select("balance, account_id, record_date").eq("org_id", orgId).order("record_date", { ascending: false }),
  ]);

  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const yearStart = new Date(now.getFullYear() - 1, 0, 1);

  const completed = (invoices ?? []).filter(i => i.status === "Completed");
  const revenue = completed.reduce((s, i) => s + Number(i.amount || 0), 0);
  const ytd = completed.filter(i => new Date(i.transaction_date) >= ytdStart).reduce((s, i) => s + Number(i.amount || 0), 0);
  const yearly = completed.filter(i => new Date(i.transaction_date) >= yearStart).reduce((s, i) => s + Number(i.amount || 0), 0);
  const opex = (costs ?? []).reduce((s, c) => s + Number(c.amount || 0), 0);
  const wonLeads = (leads ?? []).filter(l => l.status_id === 3);
  const totalRevLeads = wonLeads.reduce((s, l) => s + Number(l.total_revenue || 0), 0);
  const pipeline = (leads ?? []).reduce((s, l) => s + Number(l.opportunity_weighted || 0), 0);
  const openLeads = (leads ?? []).filter(l => l.status_id && l.status_id <= 2).length;
  const convRate = (leads ?? []).length ? wonLeads.length / (leads ?? []).length : 0;

  const latestCash: Record<number, { balance: number; record_date: string }> = {};
  (cashflow ?? []).forEach(r => {
    const aid = r.account_id as number;
    if (!latestCash[aid] || r.record_date > latestCash[aid].record_date) {
      latestCash[aid] = { balance: Number(r.balance), record_date: r.record_date };
    }
  });
  const actualCash = Object.values(latestCash).reduce((s, r) => s + r.balance, 0);
  const margin = revenue > 0 ? (revenue - opex) / revenue : 0;
  const months = Math.max(1, (now.getMonth() + 1));
  const avgMonthly = ytd / months;

  const { error } = await supabase.from("fact_performance").insert({
    org_id: orgId,
    snapshot_date: now.toISOString().split("T")[0],
    total_revenue_yearly: yearly,
    revenue_ytd: ytd,
    completed_revenue_pct: revenue > 0 ? ytd / revenue : 0,
    cashflow: actualCash,
    total_opex: opex,
    margin,
    avg_monthly_revenue: avgMonthly,
    opportunity_value: totalRevLeads,
    weighted_pipeline: pipeline,
    conversion_rate: convRate,
    open_leads: openLeads,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/performance");
}
