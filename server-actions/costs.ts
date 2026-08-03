"use server";

import { revalidatePath } from "next/cache";
import { CostSchema, CashflowSchema, CostVatFlagsSchema } from "@/lib/schemas/costs";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createCost(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const apportion = formData.get("apportion_to_customers") === "on";
  const costType = (formData.get("cost_type") as string) || "operational";
  const includeInPnlRaw = formData.get("include_in_pnl");
  const includeInPnl = includeInPnlRaw !== null ? includeInPnlRaw === "true" || includeInPnlRaw === "on" : costType === "operational";
  const depYears = formData.get("depreciation_years");
  const disposedAt = formData.get("disposed_at");
  const parsed = CostSchema.parse({
    org_id: orgId,
    transaction_date: formData.get("transaction_date"),
    cost_details: formData.get("cost_details"),
    cost_category_id: formData.get("cost_category_id") || null,
    amount: formData.get("amount"),
    account_id: formData.get("account_id") || null,
    customer_id: apportion ? null : (formData.get("customer_id") || null),
    recouped: formData.get("recouped") || "",
    receipt_image_url: formData.get("receipt_image_url") || null,
    apportion_to_customers: apportion,
    cost_type: costType,
    include_in_pnl: includeInPnl,
    // Depreciation terms only apply to capex assets.
    depreciation_months: costType === "capex" && depYears ? Math.round(Number(depYears) * 12) : null,
    residual_value: costType === "capex" ? Number(formData.get("residual_value") || 0) : 0,
    disposed_at: costType === "capex" && disposedAt ? String(disposedAt) : null,
    supply_type: formData.get("supply_type") || undefined,
    has_valid_tax_invoice: formData.get("has_valid_tax_invoice") === "on" || formData.get("has_valid_tax_invoice") === "true",
    input_vat_claimable: formData.get("input_vat_claimable") === "on" || formData.get("input_vat_claimable") === "true",
  });

  const { error } = await supabase.from("fact_costs").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/dashboard");
  revalidatePath("/accounting");
  revalidatePath("/customers/kpi");
}

// Set only the VAT attributes of a cost (for the bulk-flag UI). input_vat_amount
// recomputes automatically (DB-generated, gated on both flags).
export async function setCostVatFlags(id: number, flags: unknown) {
  const supabase = await createServerClient();
  const patch = CostVatFlagsSchema.parse(flags);
  const { error } = await supabase.from("fact_costs").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/accounting");
}

export async function bulkSetCostVatFlags(ids: number[], flags: unknown) {
  if (ids.length === 0) return;
  const supabase = await createServerClient();
  const patch = CostVatFlagsSchema.parse(flags);
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("fact_costs").update(patch).in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/accounting");
}

export async function updateCost(id: number, formData: FormData) {
  const supabase = await createServerClient();

  const receiptUrl = formData.get("receipt_image_url");
  const apportion = formData.get("apportion_to_customers") === "on";
  const costType = (formData.get("cost_type") as string) || "operational";
  const includeInPnlRaw = formData.get("include_in_pnl");
  const includeInPnl = includeInPnlRaw !== null ? includeInPnlRaw === "true" || includeInPnlRaw === "on" : costType === "operational";
  const depYears = formData.get("depreciation_years");
  const disposedAt = formData.get("disposed_at");
  const { error } = await supabase.from("fact_costs").update({
    transaction_date: formData.get("transaction_date"),
    cost_details: formData.get("cost_details") || null,
    cost_category_id: formData.get("cost_category_id") ? Number(formData.get("cost_category_id")) : null,
    amount: Number(formData.get("amount")),
    account_id: formData.get("account_id") ? Number(formData.get("account_id")) : null,
    customer_id: apportion ? null : (formData.get("customer_id") ? Number(formData.get("customer_id")) : null),
    recouped: formData.get("recouped") || "",
    apportion_to_customers: apportion,
    cost_type: costType,
    include_in_pnl: includeInPnl,
    depreciation_months: costType === "capex" && depYears ? Math.round(Number(depYears) * 12) : null,
    residual_value: costType === "capex" ? Number(formData.get("residual_value") || 0) : 0,
    disposed_at: costType === "capex" && disposedAt ? String(disposedAt) : null,
    supply_type: formData.get("supply_type") || "standard",
    has_valid_tax_invoice: formData.get("has_valid_tax_invoice") === "on" || formData.get("has_valid_tax_invoice") === "true",
    input_vat_claimable: formData.get("input_vat_claimable") === "on" || formData.get("input_vat_claimable") === "true",
    ...(receiptUrl !== null ? { receipt_image_url: receiptUrl || null } : {}),
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/dashboard");
  revalidatePath("/accounting");
  revalidatePath("/customers/kpi");
}

export async function deleteCost(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("fact_costs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/costs");
  revalidatePath("/dashboard");
  revalidatePath("/customers/kpi");
}

export async function recordCashflow(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const parsed = CashflowSchema.parse({
    org_id: orgId,
    record_date: formData.get("record_date"),
    account_id: formData.get("account_id"),
    balance: formData.get("balance"),
    notes: formData.get("notes"),
  });

  const { error } = await supabase.from("fact_cashflow").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
