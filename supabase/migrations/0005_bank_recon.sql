-- Bank statement transactions for reconciliation
create table if not exists fact_bank_transactions (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  account_id bigint references dim_accounts(id),
  txn_date date not null,
  description text not null,
  reference text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  balance numeric(14,2),
  reconciled boolean not null default false,
  invoice_id bigint references fact_invoices(id) on delete set null,
  cost_id bigint references fact_costs(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

alter table fact_bank_transactions enable row level security;
drop policy if exists fact_bank_txn_select on fact_bank_transactions;
drop policy if exists fact_bank_txn_insert on fact_bank_transactions;
drop policy if exists fact_bank_txn_update on fact_bank_transactions;
drop policy if exists fact_bank_txn_delete on fact_bank_transactions;
create policy fact_bank_txn_select on fact_bank_transactions for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy fact_bank_txn_insert on fact_bank_transactions for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_bank_txn_update on fact_bank_transactions for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_bank_txn_delete on fact_bank_transactions for delete using (has_org_role(org_id, array['owner','admin']));
