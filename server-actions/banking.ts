"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";

export async function createBankTransaction(formData: FormData) {
  const supabase = await createServerClient();
  const org_id = await getCurrentOrgId();

  const debit = Math.abs(Number(formData.get("debit") || 0));
  const credit = Math.abs(Number(formData.get("credit") || 0));
  const balance = formData.get("balance") ? Number(formData.get("balance")) : null;
  const account_id = formData.get("account_id") ? Number(formData.get("account_id")) : null;

  const { error } = await supabase.from("fact_bank_transactions").insert({
    org_id,
    account_id,
    txn_date: String(formData.get("txn_date")),
    description: String(formData.get("description")).trim(),
    reference: String(formData.get("reference") || "").trim() || null,
    debit,
    credit,
    balance,
    notes: String(formData.get("notes") || "").trim() || null,
    reconciled: false,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}

export async function updateBankTransaction(id: number, formData: FormData) {
  const supabase = await createServerClient();

  const debit = Math.abs(Number(formData.get("debit") || 0));
  const credit = Math.abs(Number(formData.get("credit") || 0));
  const balance = formData.get("balance") ? Number(formData.get("balance")) : null;
  const account_id = formData.get("account_id") ? Number(formData.get("account_id")) : null;

  const { error } = await supabase.from("fact_bank_transactions").update({
    account_id,
    txn_date: String(formData.get("txn_date")),
    description: String(formData.get("description")).trim(),
    reference: String(formData.get("reference") || "").trim() || null,
    debit,
    credit,
    balance,
    notes: String(formData.get("notes") || "").trim() || null,
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}

export async function toggleReconciled(id: number, reconciled: boolean) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_bank_transactions")
    .update({ reconciled })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}

export async function deleteBankTransaction(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_bank_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}
