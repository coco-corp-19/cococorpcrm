"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId } from "@/lib/supabase/org";
import { createServerClient } from "@/lib/supabase/server";

export async function createCampaign(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { error } = await supabase.from("fact_campaigns").insert({
    org_id: orgId,
    name: formData.get("name"),
    platform: formData.get("platform") || null,
    objective: formData.get("objective") || null,
    status: formData.get("status") || "Draft",
    total_budget: formData.get("total_budget") ? Number(formData.get("total_budget")) : null,
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
    notes: formData.get("notes") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function updateCampaignStatus(id: number, status: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_campaigns").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function deleteCampaign(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function logCampaignUpdate(formData: FormData) {
  const orgId = await getCurrentOrgId();
  const supabase = await createServerClient();

  const { error } = await supabase.from("fact_campaign_updates").insert({
    org_id: orgId,
    campaign_id: Number(formData.get("campaign_id")),
    date: formData.get("date"),
    spend: Number(formData.get("spend")) || 0,
    impressions: Number(formData.get("impressions")) || 0,
    clicks: Number(formData.get("clicks")) || 0,
    conversions: Number(formData.get("conversions")) || 0,
    revenue: Number(formData.get("revenue")) || 0,
    notes: formData.get("notes") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}

export async function deleteCampaignUpdate(id: number) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("fact_campaign_updates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/marketing");
}
