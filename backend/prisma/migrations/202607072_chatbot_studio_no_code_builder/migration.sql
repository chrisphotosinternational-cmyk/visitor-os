create table if not exists chatbot_studios (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade unique,
  name text not null,
  domain text,
  business_type text not null default 'autre',
  primary_goal text not null default 'information',
  tone text not null default 'professionnel',
  current_stage text not null default 'draft',
  draft_version integer not null default 1,
  preproduction_version integer,
  published_version integer,
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbot_studio_versions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, version_number)
);

create table if not exists chatbot_template_library (
  id text primary key,
  name text not null,
  business_type text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists chatbot_import_proposals (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  extracted_questions text[] not null default '{}',
  extracted_links text[] not null default '{}',
  proposed_knowledge jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbot_simulations (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  message text not null,
  detected_intent text,
  knowledge_item_id uuid,
  confidence_score numeric not null default 0,
  reply text not null,
  fallback boolean not null default false,
  actions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_chatbot_studios_org_stage on chatbot_studios(organization_id, current_stage);
create index if not exists idx_chatbot_studio_versions_site_created on chatbot_studio_versions(site_id, created_at desc);
create index if not exists idx_chatbot_import_proposals_site_status on chatbot_import_proposals(site_id, status, created_at desc);
create index if not exists idx_chatbot_simulations_site_created on chatbot_simulations(site_id, created_at desc);
