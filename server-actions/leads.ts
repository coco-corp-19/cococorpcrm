"use server";

import { revalidatePath } from "next/cache";
import { LeadSchema } from "@/lib/schemas/leads";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createLead(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = LeadSchema.parse({
    org_id: orgId,
    name: formData.get("name"),
    phone: formData.get("phone"),
    contact: formData.get("contact"),
    lead_date: formData.get("lead_date") || new Date().toISOString().split("T")[0],
    status_id: formData.get("status_id") || null,
    last_follow_up: formData.get("last_follow_up") || null,
    opportunity_value: formData.get("opportunity_value") || 0,
    weight: formData.get("weight") || 0,
    contacted: formData.get("contacted") === "true",
    responded: formData.get("responded") === "true",
    developed: formData.get("developed") === "true",
    paid: formData.get("paid") === "true",
    total_revenue: formData.get("total_revenue") || null,
    secured_revenue: formData.get("secured_revenue") || null,
  });

  const { error } = await supabase.from("fact_leads").insert({
    ...parsed,
    total_revenue: parsed.total_revenue || null,
    secured_revenue: parsed.secured_revenue || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function updateLead(id: number, formData: FormData) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("fact_leads").update({
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    contact: formData.get("contact") || null,
    lead_date: formData.get("lead_date") || null,
    status_id: formData.get("status_id") ? Number(formData.get("status_id")) : null,
    last_follow_up: formData.get("last_follow_up") || null,
    opportunity_value: formData.get("opportunity_value") ? Number(formData.get("opportunity_value")) : null,
    weight: formData.get("weight") ? Number(formData.get("weight")) : 0,
    total_revenue: formData.get("total_revenue") ? Number(formData.get("total_revenue")) : null,
    secured_revenue: formData.get("secured_revenue") ? Number(formData.get("secured_revenue")) : null,
    contacted: formData.get("contacted") === "true",
    responded: formData.get("responded") === "true",
    developed: formData.get("developed") === "true",
    paid: formData.get("paid") === "true",
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function updateLeadStatus(id: number, statusId: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_leads")
    .update({ status_id: statusId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function convertLeadToCustomer(leadId: number) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { data: lead } = await supabase.from("fact_leads").select("*").eq("id", leadId).single();
  if (!lead) throw new Error("Lead not found");

  const { data: customer, error: custErr } = await supabase.from("dim_customers").insert({
    org_id: orgId,
    name: lead.name,
    phone: lead.phone,
    contact_person: lead.contact,
    source: "CRM",
  }).select("id").single();

  if (custErr) throw new Error(custErr.message);

  await supabase.from("fact_leads").update({ customer_id: customer.id }).eq("id", leadId);
  revalidatePath("/leads");
  revalidatePath("/customers");
}

export async function deleteLead(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function restoreLead(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_leads").update({ deleted_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
}
