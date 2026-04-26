create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reg_no text,
  vat_no text,
  address text,
  phone text,
  email text,
  bank_holder text,
  bank_name text,
  bank_account text,
  bank_branch text,
  currency char(3) default 'ZAR',
  locale text default 'en-ZA',
  created_at timestamptz default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz default now(),
  unique(user_id, org_id)
);

create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select (current_setting('request.jwt.claims', true)::json ->> 'org_id')::uuid
$$;

create table if not exists dim_statuses (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  category text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists dim_payment_types (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  description text
);

create table if not exists dim_cost_categories (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  description text
);

create table if not exists dim_accounts (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  account_type text
);

create table if not exists dim_customers (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  phone text,
  contact_person text,
  email text,
  source text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists fact_leads (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  phone text,
  contact text,
  customer_id bigint references dim_customers(id),
  lead_date date,
  status_id bigint references dim_statuses(id),
  last_follow_up date,
  contacted boolean default false,
  responded boolean default false,
  developed boolean default false,
  paid boolean default false,
  opportunity_value numeric(14, 2),
  weight numeric(5, 2),
  opportunity_weighted numeric(14, 2) generated always as (opportunity_value * weight / 100) stored,
  total_revenue numeric(14, 2),
  secured_revenue numeric(14, 2),
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists fact_rough_leads (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  business_name text not null,
  score numeric(3,1),
  reviews_count int,
  street text,
  city text,
  state text,
  country_code char(2),
  website text,
  phone text,
  category text,
  google_maps_url text,
  imported_to_crm boolean default false,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists fact_invoices (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  customer_id bigint not null references dim_customers(id),
  transaction_date date not null,
  invoice_number text not null,
  description text,
  amount numeric(14, 2) not null,
  payment_type_id bigint references dim_payment_types(id),
  reference text,
  status text not null default 'Pending' check (status in ('Pending', 'Completed', 'Written Off')),
  due_date date,
  pdf_storage_path text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  unique(org_id, invoice_number)
);

create table if not exists fact_invoice_lines (
  id bigserial primary key,
  invoice_id bigint not null references fact_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  position int default 0
);

create table if not exists fact_costs (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  transaction_date date not null,
  cost_details text,
  cost_category_id bigint references dim_cost_categories(id),
  amount numeric(14, 2) not null,
  account_id bigint references dim_accounts(id),
  recouped text,
  is_recurring boolean default false,
  recurring_frequency text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists fact_cashflow (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  record_date date not null,
  account_id bigint references dim_accounts(id),
  balance numeric(14,2) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists fact_performance (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  snapshot_date date not null,
  total_revenue_yearly numeric(14,2),
  revenue_ytd numeric(14,2),
  completed_revenue_pct numeric(5,2),
  cashflow numeric(14,2),
  total_opex numeric(14,2),
  margin numeric(5,4),
  avg_monthly_revenue numeric(14,2),
  opportunity_value numeric(14,2),
  weighted_pipeline numeric(14,2),
  conversion_rate numeric(5,4),
  open_leads int,
  created_at timestamptz default now()
);

create table if not exists ce_settings (
  id bigserial primary key,
  org_id uuid not null unique references organizations(id),
  brand_voice text,
  brand_description text,
  target_audience text,
  posting_cadence_per_week int default 5,
  preferred_post_time time default '09:00',
  publish_to_facebook boolean default true,
  publish_to_instagram boolean default true,
  publish_to_linkedin boolean default false,
  meta_page_id text,
  meta_ig_id text,
  meta_token_secret_id uuid,
  gemini_key_secret_id uuid,
  linkedin_token_secret_id uuid,
  meta_token_expires_at timestamptz,
  gemini_model text default 'gemini-2.0-flash',
  auto_publish_enabled boolean default false,
  updated_at timestamptz default now()
);

create table if not exists ce_themes (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  description text,
  color_primary text,
  color_secondary text,
  font_family text,
  config jsonb default '{}'::jsonb
);

create table if not exists ce_templates (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  description text,
  template_type text,
  config jsonb default '{}'::jsonb,
  thumbnail_url text
);

create table if not exists ce_posts (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  caption text,
  hashtags text,
  image_url text,
  image_storage_path text,
  template_id bigint references ce_templates(id),
  theme_id bigint references ce_themes(id),
  status text not null default 'Draft'
    check (status in ('Draft', 'In Review', 'Approved', 'Ready', 'Scheduled', 'Published', 'Failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  publish_targets jsonb default '["facebook","instagram"]'::jsonb,
  publish_results jsonb,
  qa_score int,
  qa_feedback text,
  source text default 'manual' check (source in ('manual', 'ai_ideate', 'ai_month')),
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_ce_posts_org_status_sched on ce_posts (org_id, status, scheduled_for);

create table if not exists ce_chat_history (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  user_id uuid references auth.users(id),
  role text not null check (role in ('user', 'assistant', 'system')),
  text text not null,
  context text,
  created_at timestamptz default now()
);

create table if not exists ce_gemini_usage (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  date date not null,
  model text not null,
  call_count int default 0,
  token_input bigint default 0,
  token_output bigint default 0,
  unique (org_id, date, model)
);

create table if not exists fact_campaigns (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  name text not null,
  platform text not null check (platform in ('Meta', 'Google', 'TikTok', 'LinkedIn', 'X', 'Other')),
  objective text,
  status text not null default 'Draft' check (status in ('Draft', 'Active', 'Paused', 'Completed')),
  total_budget numeric(14, 2),
  start_date date,
  end_date date,
  crm_synced boolean default false,
  external_campaign_id text,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists fact_campaign_updates (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  campaign_id bigint not null references fact_campaigns(id) on delete cascade,
  date date not null,
  spend numeric(14, 2) default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  conversions int default 0,
  revenue numeric(14, 2) default 0,
  notes text,
  source text default 'manual' check (source in ('manual', 'meta_api', 'google_api', 'import')),
  created_at timestamptz default now()
);

create index if not exists idx_campaign_updates_org_campaign_date on fact_campaign_updates (org_id, campaign_id, date desc);

create table if not exists activity_log (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id bigint not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_activity_log_entity on activity_log (org_id, entity_type, entity_id, created_at desc);

create table if not exists notes (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id bigint not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists custom_metrics (
  id bigserial primary key,
  org_id uuid not null references organizations(id),
  user_id uuid references auth.users(id),
  name text not null,
  source_table text not null,
  formula text not null,
  column_name text,
  filter_column text,
  filter_value text,
  group_by text,
  display_format text default 'number',
  position int default 0
);

create table if not exists accounting_manual_entries (
  id bigserial primary key,
  org_id uuid not null unique references organizations(id),
  finance_income numeric(14,2) default 0,
  finance_costs numeric(14,2) default 0,
  tax_expense numeric(14,2) default 0,
  ppe numeric(14,2) default 0,
  intangibles numeric(14,2) default 0,
  investments numeric(14,2) default 0,
  other_current_assets numeric(14,2) default 0,
  trade_payables numeric(14,2) default 0,
  short_term_loans numeric(14,2) default 0,
  tax_payable numeric(14,2) default 0,
  other_current_liabilities numeric(14,2) default 0,
  long_term_loans numeric(14,2) default 0,
  other_long_term_liabilities numeric(14,2) default 0,
  share_capital numeric(14,2) default 0,
  updated_at timestamptz default now()
);
