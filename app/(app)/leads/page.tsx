import { createServerClient } from "@/lib/supabase/server";
import { LeadsClient } from "@/components/LeadsClient";

export default async function LeadsPage() {
  const supabase = await createServerClient();

  const [{ data: leads }, { data: statuses }, { data: customers }, { data: products }, { data: org }] = await Promise.all([
    supabase
      .from("fact_leads")
      .select("id, name, phone, contact, lead_date, status_id, last_follow_up, opportunity_value, opportunity_weighted, weight, total_revenue, secured_revenue, contacted, responded, developed, paid, customer_id, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("dim_statuses").select("id, name").order("id"),
    supabase.from("dim_customers").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("dim_products").select("id, name, unit_price, is_active").is("deleted_at", null).eq("is_active", true).order("name"),
    supabase.from("organizations").select("currency").single(),
  ]);

  return (
    <section>
      <LeadsClient
        leads={(leads || []).map(l => ({ ...l, product_id: null }))}
        statuses={statuses || []}
        customers={customers || []}
        products={(products || []).map(p => ({ id: p.id, name: p.name, unit_price: Number(p.unit_price) }))}
        currency={org?.currency || "ZAR"}
      />
    </section>
  );
}
