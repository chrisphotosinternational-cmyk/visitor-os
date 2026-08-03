create table if not exists intelligent_retrieval_benchmarks (
  id uuid primary key,
  organization_id uuid not null,
  site_id uuid not null,
  baseline_report_id uuid not null,
  enhanced_report_id uuid not null,
  report jsonb not null,
  accepted boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_intelligent_retrieval_benchmarks_latest
  on intelligent_retrieval_benchmarks(organization_id, site_id, created_at desc);
