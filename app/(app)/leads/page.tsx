import { createServerClient } from "@/lib/supabase/server";
import { LeadsClient } from "@/components/LeadsClient";

export default async function LeadsPage() {
  const supabase = await createServerClient();

  const [{ data: leads }, { data: statuses }, { data: customers }, { data: org }] = await Promise.all([
    supabase
      .from("fact_leads")
      .select("id, name, phone, contact, lead_date, status_id, last_follow_up, opportunity_value, opportunity_weighted, weight, total_revenue, secured_revenue, contacted, responded, developed, paid, customer_id, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("organizations").select("currency").single(),
  ]);

  return (
    <section>
      <LeadsClient
        leads={leads || []}
        statuses={statuses || []}
        customers={customers || []}
        currency={org?.currency || "ZAR"}
      />
    </section>
  );
}
