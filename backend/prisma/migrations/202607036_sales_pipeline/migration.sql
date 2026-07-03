create table if not exists crm_activity_log (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  prospect_id uuid references prospects(id) on delete cascade,
  action_type text not null,
  previous_value text,
  new_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_activity_log_organization_created
  on crm_activity_log(organization_id, created_at desc);

create index if not exists idx_crm_activity_log_prospect_created
  on crm_activity_log(prospect_id, created_at desc);

create index if not exists idx_crm_activity_log_action_type
  on crm_activity_log(organization_id, action_type, created_at desc);
