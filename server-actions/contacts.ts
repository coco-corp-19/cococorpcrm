"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createContact(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_contacts").insert({
    org_id: orgId,
    customer_id: Number(formData.get("customer_id")),
    name: formData.get("name"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    role: formData.get("role") || null,
    is_primary: formData.get("is_primary") === "true",
    notes: formData.get("notes") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${formData.get("customer_id")}`);
}

export async function updateContact(id: number, formData: FormData) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_contacts").update({
    name: formData.get("name"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    role: formData.get("role") || null,
    is_primary: formData.get("is_primary") === "true",
    notes: formData.get("notes") || null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  const cid = formData.get("customer_id");
  if (cid) revalidatePath(`/customers/${cid}`);
}

export async function deleteContact(id: number, customerId: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("dim_contacts")
    .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${customerId}`);
}
