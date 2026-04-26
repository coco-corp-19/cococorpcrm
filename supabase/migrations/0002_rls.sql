create or replace function has_org_role(target_org uuid, roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from memberships
    where user_id = auth.uid()
      and org_id = target_org
      and role = any(roles)
  );
$$;

do $$
declare
  t text;
  org_tables text[] := array[
    'dim_statuses',
    'dim_payment_types',
    'dim_cost_categories',
    'dim_accounts',
    'dim_customers',
    'fact_leads',
    'fact_rough_leads',
    'fact_invoices',
    'fact_costs',
    'fact_cashflow',
    'fact_performance',
    'ce_settings',
    'ce_themes',
    'ce_templates',
    'ce_posts',
    'ce_chat_history',
    'ce_gemini_usage',
    'fact_campaigns',
    'fact_campaign_updates',
    'activity_log',
    'notes',
    'custom_metrics',
    'accounting_manual_entries'
  ];
begin
  foreach t in array org_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);

    execute format(
      'create policy %I on %I for select using (has_org_role(org_id, array[''owner'',''admin'',''member'',''viewer'']))',
      t || '_select',
      t
    );

    execute format(
      'create policy %I on %I for insert with check (has_org_role(org_id, array[''owner'',''admin'',''member'']))',
      t || '_insert',
      t
    );

    execute format(
      'create policy %I on %I for update using (has_org_role(org_id, array[''owner'',''admin'',''member''])) with check (has_org_role(org_id, array[''owner'',''admin'',''member'']))',
      t || '_update',
      t
    );

    execute format(
      'create policy %I on %I for delete using (has_org_role(org_id, array[''owner'',''admin'']))',
      t || '_delete',
      t
    );
  end loop;
end $$;

alter table fact_invoice_lines enable row level security;
drop policy if exists fact_invoice_lines_select on fact_invoice_lines;
drop policy if exists fact_invoice_lines_insert on fact_invoice_lines;
drop policy if exists fact_invoice_lines_update on fact_invoice_lines;
drop policy if exists fact_invoice_lines_delete on fact_invoice_lines;

create policy fact_invoice_lines_select
  on fact_invoice_lines
  for select
  using (
    exists (
      select 1
      from fact_invoices i
      where i.id = fact_invoice_lines.invoice_id
        and has_org_role(i.org_id, array['owner','admin','member','viewer'])
    )
  );

create policy fact_invoice_lines_insert
  on fact_invoice_lines
  for insert
  with check (
    exists (
      select 1
      from fact_invoices i
      where i.id = fact_invoice_lines.invoice_id
        and has_org_role(i.org_id, array['owner','admin','member'])
    )
  );

create policy fact_invoice_lines_update
  on fact_invoice_lines
  for update
  using (
    exists (
      select 1
      from fact_invoices i
      where i.id = fact_invoice_lines.invoice_id
        and has_org_role(i.org_id, array['owner','admin','member'])
    )
  )
  with check (
    exists (
      select 1
      from fact_invoices i
      where i.id = fact_invoice_lines.invoice_id
        and has_org_role(i.org_id, array['owner','admin','member'])
    )
  );

create policy fact_invoice_lines_delete
  on fact_invoice_lines
  for delete
  using (
    exists (
      select 1
      from fact_invoices i
      where i.id = fact_invoice_lines.invoice_id
        and has_org_role(i.org_id, array['owner','admin'])
    )
  );

alter table organizations enable row level security;
alter table memberships enable row level security;

drop policy if exists organizations_select on organizations;
create policy organizations_select
  on organizations
  for select
  using (exists (
    select 1 from memberships
    where memberships.org_id = organizations.id
      and memberships.user_id = auth.uid()
  ));

drop policy if exists organizations_insert on organizations;
create policy organizations_insert
  on organizations
  for insert
  with check (auth.uid() is not null);

drop policy if exists organizations_update on organizations;
create policy organizations_update
  on organizations
  for update
  using (has_org_role(id, array['owner','admin']))
  with check (has_org_role(id, array['owner','admin']));

drop policy if exists memberships_select on memberships;
create policy memberships_select
  on memberships
  for select
  using (user_id = auth.uid() or has_org_role(org_id, array['owner','admin']));

drop policy if exists memberships_insert on memberships;
create policy memberships_insert
  on memberships
  for insert
  with check (has_org_role(org_id, array['owner','admin']) or user_id = auth.uid());

drop policy if exists memberships_update on memberships;
create policy memberships_update
  on memberships
  for update
  using (has_org_role(org_id, array['owner']))
  with check (has_org_role(org_id, array['owner']));

drop policy if exists memberships_delete on memberships;
create policy memberships_delete
  on memberships
  for delete
  using (has_org_role(org_id, array['owner']));
