-- Capex assets: capture depreciation terms on the cost so PPE depreciates
-- straight-line through the financial statements (useful life stored in months).
alter table fact_costs add column if not exists depreciation_months int;
alter table fact_costs add column if not exists residual_value numeric(14,2) not null default 0;

notify pgrst, 'reload schema';
