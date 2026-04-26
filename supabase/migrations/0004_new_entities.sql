-- Products / Services catalog
create table if not exists dim_products (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  sku text,
  description text,
  unit_price numeric(12,2) not null default 0,
  category text,
  is_active boolean default true,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table dim_products enable row level security;
drop policy if exists dim_products_select on dim_products;
drop policy if exists dim_products_insert on dim_products;
drop policy if exists dim_products_update on dim_products;
drop policy if exists dim_products_delete on dim_products;
create policy dim_products_select on dim_products for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy dim_products_insert on dim_products for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy dim_products_update on dim_products for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy dim_products_delete on dim_products for delete using (has_org_role(org_id, array['owner','admin']));

-- Contacts (people within customer companies)
create table if not exists dim_contacts (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  customer_id bigint references dim_customers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table dim_contacts enable row level security;
drop policy if exists dim_contacts_select on dim_contacts;
drop policy if exists dim_contacts_insert on dim_contacts;
drop policy if exists dim_contacts_update on dim_contacts;
drop policy if exists dim_contacts_delete on dim_contacts;
create policy dim_contacts_select on dim_contacts for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy dim_contacts_insert on dim_contacts for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy dim_contacts_update on dim_contacts for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy dim_contacts_delete on dim_contacts for delete using (has_org_role(org_id, array['owner','admin']));

-- Quotes / Proposals
create table if not exists fact_quotes (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  customer_id bigint references dim_customers(id),
  quote_number text not null,
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Accepted', 'Declined', 'Invoiced')),
  valid_until date,
  notes text,
  amount numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table fact_quotes enable row level security;
drop policy if exists fact_quotes_select on fact_quotes;
drop policy if exists fact_quotes_insert on fact_quotes;
drop policy if exists fact_quotes_update on fact_quotes;
drop policy if exists fact_quotes_delete on fact_quotes;
create policy fact_quotes_select on fact_quotes for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy fact_quotes_insert on fact_quotes for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_quotes_update on fact_quotes for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_quotes_delete on fact_quotes for delete using (has_org_role(org_id, array['owner','admin']));

create table if not exists fact_quote_lines (
  id bigserial primary key,
  quote_id bigint not null references fact_quotes(id) on delete cascade,
  product_id bigint references dim_products(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  position int not null default 0
);

alter table fact_quote_lines enable row level security;
drop policy if exists fact_quote_lines_select on fact_quote_lines;
drop policy if exists fact_quote_lines_insert on fact_quote_lines;
drop policy if exists fact_quote_lines_delete on fact_quote_lines;
create policy fact_quote_lines_select on fact_quote_lines for select
  using (exists (select 1 from fact_quotes q where q.id = fact_quote_lines.quote_id and has_org_role(q.org_id, array['owner','admin','member','viewer'])));
create policy fact_quote_lines_insert on fact_quote_lines for insert
  with check (exists (select 1 from fact_quotes q where q.id = fact_quote_lines.quote_id and has_org_role(q.org_id, array['owner','admin','member'])));
create policy fact_quote_lines_delete on fact_quote_lines for delete
  using (exists (select 1 from fact_quotes q where q.id = fact_quote_lines.quote_id and has_org_role(q.org_id, array['owner','admin'])));

-- Activities (calls, emails, meetings, tasks, notes)
create table if not exists fact_activities (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  type text not null check (type in ('Call', 'Email', 'Meeting', 'Task', 'Note')),
  subject text not null,
  notes text,
  lead_id bigint references fact_leads(id) on delete set null,
  customer_id bigint references dim_customers(id) on delete set null,
  due_date date,
  done boolean default false,
  created_at timestamptz default now()
);

alter table fact_activities enable row level security;
drop policy if exists fact_activities_select on fact_activities;
drop policy if exists fact_activities_insert on fact_activities;
drop policy if exists fact_activities_update on fact_activities;
drop policy if exists fact_activities_delete on fact_activities;
create policy fact_activities_select on fact_activities for select using (has_org_role(org_id, array['owner','admin','member','viewer']));
create policy fact_activities_insert on fact_activities for insert with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_activities_update on fact_activities for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']));
create policy fact_activities_delete on fact_activities for delete using (has_org_role(org_id, array['owner','admin']));
