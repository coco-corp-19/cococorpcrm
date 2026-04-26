"use server";

import { revalidatePath } from "next/cache";
import { CustomerSchema } from "@/lib/schemas/customers";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";

export async function createCustomer(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = CustomerSchema.parse({
    org_id: orgId,
    name: formData.get("name"),
    phone: formData.get("phone"),
    contact_person: formData.get("contact_person"),
    email: formData.get("email"),
    source: formData.get("source"),
    notes: formData.get("notes"),
  });

  const payload = {
    ...parsed,
    email: parsed.email || null,
  };

  const { error } = await supabase.from("dim_customers").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/customers");
}

export async function deleteCustomer(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("dim_customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}

export async function updateCustomer(id: number, formData: FormData) {
  const supabase = await createServerClient();
  const email = String(formData.get("email") || "").trim();
  const { error } = await supabase.from("dim_customers").update({
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    contact_person: formData.get("contact_person") || null,
    email: email || null,
    source: formData.get("source") || null,
    notes: formData.get("notes") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function restoreCustomer(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("dim_customers")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/customers");
}
