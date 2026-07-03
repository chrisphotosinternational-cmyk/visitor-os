create table if not exists prospect_ai_analysis (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  prospect_id uuid not null references prospects(id) on delete cascade,
  summary text not null,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  recommended_offer text not null,
  priority text not null,
  confidence integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospect_ai_analysis_prospect_created
  on prospect_ai_analysis(prospect_id, created_at desc);

create index if not exists idx_prospect_ai_analysis_organization_priority
  on prospect_ai_analysis(organization_id, priority, confidence desc);
