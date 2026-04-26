"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createActivity(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const leadId = formData.get("lead_id");
  const customerId = formData.get("customer_id");
  const { error } = await supabase.from("fact_activities").insert({
    org_id: orgId,
    type: formData.get("type"),
    subject: formData.get("subject"),
    notes: formData.get("notes") || null,
    lead_id: leadId ? Number(leadId) : null,
    customer_id: customerId ? Number(customerId) : null,
    due_date: formData.get("due_date") || null,
    done: false,
  });
  if (error) throw new Error(error.message);
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export async function toggleActivity(id: number, done: boolean, leadId?: number, customerId?: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_activities").update({ done }).eq("id", id);
  if (error) throw new Error(error.message);
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export async function deleteActivity(id: number, leadId?: number, customerId?: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (leadId) revalidatePath(`/leads/${leadId}`);
  if (customerId) revalidatePath(`/customers/${customerId}`);
}
