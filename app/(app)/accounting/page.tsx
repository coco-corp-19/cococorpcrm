import { createServerClient } from "@/lib/supabase/server";
import { AccountingClient } from "@/components/AccountingClient";

export default async function AccountingPage() {
  const supabase = await createServerClient();

  const now = new Date();
  const fyStart = `${now.getFullYear()}-01-01`;
  const fyEnd = now.toISOString().slice(0, 10);

  const [{ data: invoices }, { data: costs }, { data: cashflow }, { data: org }, { data: accounts }] = await Promise.all([
    supabase.from("fact_invoices").select("id, amount, status, transaction_date, customer_id").is("deleted_at", null),
    supabase.from("fact_costs").select("id, amount, transaction_date, cost_category_id, dim_cost_categories(name)").is("deleted_at", null),
    supabase.from("fact_cashflow").select("id, balance, account_id, record_date, notes").order("record_date", { ascending: false }),
    supabase.from("organizations").select("currency, name, reg_no").single(),
    supabase.from("dim_accounts").select("id, name").order("name"),
  ]);

  // Bank transactions — graceful if table not yet migrated
  let bankTxns: {
    id: number; account_id: number | null; txn_date: string; description: string;
    reference: string | null; debit: number; credit: number; balance: number | null;
    reconciled: boolean; notes: string | null;
  }[] = [];
  try {
    const { data } = await supabase
      .from("fact_bank_transactions")
      .select("id, account_id, txn_date, description, reference, debit, credit, balance, reconciled, notes")
      .order("txn_date", { ascending: false });
    bankTxns = (data || []).map(t => ({
      id: t.id,
      account_id: t.account_id,
      txn_date: t.txn_date,
      description: t.description,
      reference: t.reference ?? null,
      debit: Number(t.debit || 0),
      credit: Number(t.credit || 0),
      balance: t.balance != null ? Number(t.balance) : null,
      reconciled: Boolean(t.reconciled),
      notes: t.notes ?? null,
    }));
  } catch { /* table not yet created — show empty state */ }

  const currency = org?.currency || "ZAR";
  const cur = currency === "ZAR" ? "R" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "R";

  return (
    <section>
      <AccountingClient
        invoices={(invoices || []).map(i => ({ id: i.id, amount: Number(i.amount || 0), status: i.status || "", transaction_date: i.transaction_date || "", customer_id: i.customer_id }))}
        costs={(costs || []).map(c => ({ id: c.id, amount: Number(c.amount || 0), transaction_date: c.transaction_date || "", cost_category_id: c.cost_category_id, category_name: (c.dim_cost_categories as unknown as { name: string } | null)?.name ?? "Other" }))}
        cashflow={(cashflow || []).map(r => ({ id: r.id, balance: Number(r.balance || 0), account_id: r.account_id, record_date: r.record_date || "", notes: r.notes ?? null }))}
        bankTxns={bankTxns}
        accounts={(accounts || []).map(a => ({ id: a.id, name: a.name }))}
        orgName={org?.name || "Company"}
        orgRegNo={org?.reg_no || ""}
        currency={cur}
        defaultStart={fyStart}
        defaultEnd={fyEnd}
      />
    </section>
  );
}
