-- Add product_id to invoice lines (was missing, quotes already have it)
alter table fact_invoice_lines
  add column if not exists product_id bigint references dim_products(id) on delete set null;

-- Add product_id to leads (optional tag — what product/service the lead is interested in)
alter table fact_leads
  add column if not exists product_id bigint references dim_products(id) on delete set null;
