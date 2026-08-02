create table if not exists visitor_evaluation_questions (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  category text not null,
  question text not null,
  expected_answer text not null,
  required_facts jsonb not null default '[]'::jsonb,
  forbidden_facts jsonb not null default '[]'::jsonb,
  expected_source_page text,
  importance integer not null check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists visitor_evaluation_reports (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  report jsonb not null,
  global_score numeric(5,2) not null,
  question_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_visitor_evaluation_questions_site
  on visitor_evaluation_questions(organization_id, site_id, category);
create index if not exists idx_visitor_evaluation_reports_latest
  on visitor_evaluation_reports(organization_id, site_id, created_at desc);
