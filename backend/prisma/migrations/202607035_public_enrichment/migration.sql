create table if not exists prospect_enrichments (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  prospect_id uuid not null references prospects(id) on delete cascade,
  source_type text not null,
  source_url text not null,
  page_title text,
  meta_description text,
  detected_emails jsonb not null default '[]'::jsonb,
  detected_phones jsonb not null default '[]'::jsonb,
  detected_social_links jsonb not null default '[]'::jsonb,
  detected_platforms jsonb not null default '[]'::jsonb,
  detected_location text,
  detected_activity text,
  extracted_summary text,
  confidence_score integer not null default 0,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prospect_field_suggestions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  prospect_id uuid not null references prospects(id) on delete cascade,
  field_name text not null,
  current_value text,
  suggested_value text not null,
  source_url text not null,
  confidence_score integer not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospect_enrichments_prospect_created
  on prospect_enrichments(prospect_id, created_at desc);

create index if not exists idx_prospect_enrichments_organization_status
  on prospect_enrichments(organization_id, status, created_at desc);

create index if not exists idx_prospect_enrichments_source
  on prospect_enrichments(organization_id, source_type, confidence_score desc);

create index if not exists idx_prospect_field_suggestions_prospect_status
  on prospect_field_suggestions(prospect_id, status, created_at desc);

create index if not exists idx_prospect_field_suggestions_organization_status
  on prospect_field_suggestions(organization_id, status, created_at desc);
