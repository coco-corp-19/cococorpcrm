-- 0032_vat_compliance.sql
-- VAT compliance for a registered vendor.
-- Store money VAT-INCLUSIVE (gross); derive VAT as gross * 15/115 via GENERATED
-- STORED columns so it can never drift; add SARS identifiers to the org; derive a
-- category-aware tax_period; expose a VAT201 summary view.
-- Idempotent + transaction-wrapped. CRM data model only — filing returns is OUT OF SCOPE.
-- Spec: 80-Specs/cococrm-vat-compliance-spec.md  (vault)
-- NOTE: vat_category defaults to 'B' (two-monthly, periods ending Feb/Apr/Jun/Aug/
--       Oct/Dec) to match the 2026-08 reconciliation. CONFIRM the org's real SARS
--       category and update it — the tax_period buckets shift by one month for 'A'.

begin;

-- ── 1. SARS identifiers on the organisation ───────────────────────────────────
alter table organizations
  add column if not exists income_tax_no text,
  add column if not exists vat_category  char(1) not null default 'B'
    check (vat_category in ('A','B','C','D','E','F')),
  add column if not exists vat_registered boolean not null default true,
  add column if not exists fy_start_month int not null default 3
    check (fy_start_month between 1 and 12);

comment on column organizations.income_tax_no is 'SARS company income-tax reference (ITR14 / IRP6)';
comment on column organizations.vat_category  is 'SARS VAT category: A/B=two-monthly, C=monthly, D=6-monthly, E=annual, F=4-monthly';

-- ── 2. Output VAT — fact_invoices ─────────────────────────────────────────────
alter table fact_invoices
  add column if not exists vat_rate numeric(4,3) not null default 0.150,
  add column if not exists supply_type text not null default 'standard'
    check (supply_type in ('standard','zero_rated','exempt','out_of_scope')),
  add column if not exists vat_amount numeric(12,2)
    generated always as (
      case when supply_type = 'standard'
           then round(amount * vat_rate / (1 + vat_rate), 2) else 0 end) stored,
  add column if not exists amount_net numeric(12,2)
    generated always as (
      amount - case when supply_type = 'standard'
           then round(amount * vat_rate / (1 + vat_rate), 2) else 0 end) stored,
  add column if not exists vat_shown_to_client  boolean not null default false,
  add column if not exists is_valid_tax_invoice boolean not null default false,
  add column if not exists tax_period text;

-- ── 3. Input VAT — fact_costs ─────────────────────────────────────────────────
alter table fact_costs
  add column if not exists vat_rate numeric(4,3) not null default 0.150,
  add column if not exists supply_type text not null default 'standard'
    check (supply_type in ('standard','zero_rated','exempt','out_of_scope')),
  add column if not exists has_valid_tax_invoice boolean not null default false,
  add column if not exists input_vat_claimable   boolean not null default false,
  add column if not exists input_vat_amount numeric(12,2)
    generated always as (
      case when has_valid_tax_invoice and input_vat_claimable and supply_type = 'standard'
           then round(amount * vat_rate / (1 + vat_rate), 2) else 0 end) stored,
  add column if not exists tax_period text;

-- ── 4. Category-aware tax_period derivation ───────────────────────────────────
create or replace function crm_tax_period(d date, category char)
returns text language plpgsql immutable as $$
declare m int; y int; em int; ey int;
begin
  if d is null then return null; end if;
  m := extract(month from d)::int;
  y := extract(year  from d)::int;
  if category = 'C' then                       -- monthly
    return to_char(d, 'YYYY-MM');
  elsif category = 'A' then                     -- two-monthly, periods END odd months (Jan, Mar, …)
    if m % 2 = 1 then em := m; ey := y;         --   odd month → that month
    else em := m + 1; ey := y; end if;          --   even month → next (odd) month
    if em = 13 then em := 1; ey := y + 1; end if;  -- Dec → Jan of next year
    return ey::text || '-' || lpad(em::text, 2, '0');
  else                                          -- 'B' default: periods END even months (Feb, Apr, …)
    em := ceil(m::numeric / 2)::int * 2; ey := y;
    return ey::text || '-' || lpad(em::text, 2, '0');
  end if;
end $$;

-- Keep tax_period in sync on write, using the row's org VAT category.
create or replace function set_tax_period()
returns trigger language plpgsql as $$
begin
  new.tax_period := crm_tax_period(
    new.transaction_date,
    coalesce((select vat_category from organizations o where o.id = new.org_id), 'B'));
  return new;
end $$;

drop trigger if exists trg_set_tax_period_inv on fact_invoices;
create trigger trg_set_tax_period_inv
  before insert or update of transaction_date, org_id on fact_invoices
  for each row execute function set_tax_period();

drop trigger if exists trg_set_tax_period_cost on fact_costs;
create trigger trg_set_tax_period_cost
  before insert or update of transaction_date, org_id on fact_costs
  for each row execute function set_tax_period();

-- ── 5. Backfill tax_period for existing rows (idempotent) ─────────────────────
update fact_invoices i
   set tax_period = crm_tax_period(i.transaction_date,
       coalesce((select vat_category from organizations o where o.id = i.org_id), 'B'))
 where i.tax_period is distinct from crm_tax_period(i.transaction_date,
       coalesce((select vat_category from organizations o where o.id = i.org_id), 'B'));

update fact_costs c
   set tax_period = crm_tax_period(c.transaction_date,
       coalesce((select vat_category from organizations o where o.id = c.org_id), 'B'))
 where c.tax_period is distinct from crm_tax_period(c.transaction_date,
       coalesce((select vat_category from organizations o where o.id = c.org_id), 'B'));

-- ── 6. VAT201 summary view (org-scoped) ───────────────────────────────────────
create or replace view vat_summary_by_period as
with out_vat as (
  select org_id, tax_period,
         sum(amount)     as gross_sales,
         sum(vat_amount) as output_vat
    from fact_invoices where deleted_at is null
   group by org_id, tax_period),
in_vat as (
  select org_id, tax_period,
         sum(input_vat_amount) as input_vat
    from fact_costs where deleted_at is null
   group by org_id, tax_period)
select
  coalesce(o.org_id, i.org_id)                     as org_id,
  coalesce(o.tax_period, i.tax_period)             as tax_period,
  coalesce(o.gross_sales, 0)                       as gross_sales,
  coalesce(o.output_vat, 0)                        as output_vat,
  coalesce(i.input_vat, 0)                         as input_vat,
  coalesce(o.output_vat, 0) - coalesce(i.input_vat, 0) as net_vat_payable
from out_vat o
full outer join in_vat i on o.org_id = i.org_id and o.tax_period = i.tax_period;

-- Run the view with the querying user's RLS (not the view owner's), so it
-- cannot leak cross-org rows.
alter view vat_summary_by_period set (security_invoker = on);

commit;

-- ── Post-migration reconciliation (run manually; read-only) ───────────────────
-- select tax_period, gross_sales, output_vat, input_vat, net_vat_payable
--   from vat_summary_by_period order by tax_period;
-- Worked checks the generated columns must reproduce:
--   gross 1150.00 -> vat_amount 150.00, amount_net 1000.00
--   gross 1000.00 -> vat_amount 130.43, amount_net  869.57
-- IMPORTANT after running:
--   * Set organizations.vat_category to the org's REAL SARS category (A vs B shifts buckets).
--   * input_vat starts at 0 until costs are flagged has_valid_tax_invoice + input_vat_claimable.
--   * Reverse written-off invoices with credit notes (negative gross) — they still carry output VAT.
