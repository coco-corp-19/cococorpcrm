"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrgId } from "@/lib/supabase/org";

// ── Cashflow ledger (fact_bank_transactions) ──────────────────────────────────

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

export async function deleteBankTransaction(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_bank_transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}

// ── Bank balance snapshots (fact_cashflow) ────────────────────────────────────

export async function saveBankBalance(formData: FormData) {
  const supabase = await createServerClient();
  const org_id = await getCurrentOrgId();

  const { error } = await supabase.from("fact_cashflow").insert({
    org_id,
    record_date: String(formData.get("record_date")),
    balance: Number(formData.get("balance")),
    account_id: formData.get("account_id") ? Number(formData.get("account_id")) : null,
    notes: String(formData.get("notes") || "").trim() || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}

export async function deleteBankBalance(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_cashflow").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}

// ── Reconciliation adjustments ────────────────────────────────────────────────
// income type: negative cost amount (reduces total costs = effectively adds to system balance)
// cost type: positive cost amount (increases total costs = reduces system balance)

export async function createReconAdjustment(formData: FormData) {
  const supabase = await createServerClient();
  const org_id = await getCurrentOrgId();

  const type = String(formData.get("type")) as "income" | "cost";
  const rawAmount = Math.abs(Number(formData.get("amount")));
  const amount = type === "income" ? -rawAmount : rawAmount;

  const { error } = await supabase.from("fact_costs").insert({
    org_id,
    amount,
    transaction_date: String(formData.get("date")),
    cost_details: String(formData.get("description")).trim(),
    cost_category_id: null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/accounting");
}
