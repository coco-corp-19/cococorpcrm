-- Asset disposals: mark a capex asset as sold on a date. From that date it
-- leaves PPE and its remaining net book value is written off to the income
-- statement (netting against the sale proceeds recorded under Other Income).
alter table fact_costs add column if not exists disposed_at date;

notify pgrst, 'reload schema';
