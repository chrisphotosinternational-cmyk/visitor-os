create table if not exists site_intelligence_reports (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  report jsonb not null,
  page_count integer not null,
  chunk_count integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_intelligence_reports_latest
  on site_intelligence_reports(organization_id, site_id, created_at desc);
