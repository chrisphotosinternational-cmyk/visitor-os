create table if not exists contact_history (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  prospect_id uuid not null references prospects(id) on delete cascade,
  user_id uuid references users(id),
  contact_date timestamptz not null default now(),
  channel text not null,
  message_used text,
  response text,
  outcome text not null,
  next_action text,
  follow_up_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contact_history_prospect_date
  on contact_history(prospect_id, contact_date desc);

create index if not exists idx_contact_history_organization_followup
  on contact_history(organization_id, follow_up_date);

create index if not exists idx_contact_history_organization_outcome
  on contact_history(organization_id, outcome);
