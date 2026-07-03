create table if not exists message_templates (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  name text not null,
  channel text not null,
  purpose text not null,
  content text not null,
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists message_template_usage (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  template_id uuid not null references message_templates(id) on delete cascade,
  prospect_id uuid references prospects(id) on delete set null,
  user_id uuid references users(id),
  action text not null,
  rendered_content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_templates_organization_active
  on message_templates(organization_id, is_active);

create index if not exists idx_message_template_usage_organization_created
  on message_template_usage(organization_id, created_at desc);

create index if not exists idx_message_template_usage_template
  on message_template_usage(template_id, created_at desc);
