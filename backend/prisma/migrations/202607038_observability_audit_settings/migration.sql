create table if not exists audit_trail (
  id uuid primary key,
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  ip text,
  user_agent text,
  trace_id text,
  action text not null,
  resource text not null,
  resource_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_trail_org_created
  on audit_trail(organization_id, created_at desc);

create index if not exists idx_audit_trail_user_created
  on audit_trail(user_id, created_at desc);

create index if not exists idx_audit_trail_action_created
  on audit_trail(action, created_at desc);

create index if not exists idx_audit_trail_trace
  on audit_trail(trace_id);

create table if not exists app_settings (
  id uuid primary key,
  organization_id uuid references organizations(id),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_organization_key_unique unique (organization_id, key)
);

create unique index if not exists idx_app_settings_global_key
  on app_settings(key)
  where organization_id is null;

create index if not exists idx_app_settings_org_key
  on app_settings(organization_id, key);
