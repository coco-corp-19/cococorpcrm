import { createClient } from "@supabase/supabase-js";

type LegacyLead = {
  lead_name: string;
  lead_phone?: string;
  lead_contact?: string;
  lead_date?: string;
  opportunity_value?: number;
  weight?: number;
};

function getArg(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = getArg("--dry-run");
  const verify = getArg("--verify");

  if (!process.env.APPS_SCRIPT_API_URL) {
    throw new Error("Missing APPS_SCRIPT_API_URL");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const res = await fetch(`${process.env.APPS_SCRIPT_API_URL}?action=getAllData`);
  if (!res.ok) throw new Error(`Apps Script request failed: ${res.status}`);
  const payload = await res.json();

  const rows: LegacyLead[] = payload?.fact_leads ?? [];
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => ({
      name: row.lead_name,
      phone: row.lead_phone,
      contact: row.lead_contact,
      lead_date: row.lead_date,
      opportunity_value: row.opportunity_value ?? 0,
      weight: row.weight ?? 0,
    }));

    if (!dryRun) {
      const { error } = await supabase.from("fact_leads").insert(batch);
      if (error) throw error;
    }
  }

  if (verify) {
    const { count } = await supabase
      .from("fact_leads")
      .select("*", { count: "exact", head: true });
    console.log(`# Migration report\n\n- Source leads: ${rows.length}\n- Target leads: ${count ?? 0}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
