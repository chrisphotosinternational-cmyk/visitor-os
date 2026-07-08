alter table reasoning_traces add column if not exists knowledge_match_score numeric(4, 3);
alter table reasoning_traces add column if not exists goal_alignment_score numeric(4, 3);
alter table reasoning_traces add column if not exists lead_action_score numeric(4, 3);
alter table reasoning_traces add column if not exists response_quality_score numeric(4, 3);

alter table messages add column if not exists response_quality_score numeric(4, 3);

create table if not exists chatbot_runtime_metrics (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  total_time_ms integer not null default 0,
  knowledge_time_ms integer not null default 0,
  reasoning_time_ms integer not null default 0,
  db_time_ms integer not null default 0,
  payload_bytes integer not null default 0,
  response_bytes integer not null default 0,
  cache_hits integer not null default 0,
  cache_misses integer not null default 0,
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists widget_runtime_events (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  event_type text not null,
  public_key text,
  source_url text,
  domain text,
  user_agent text,
  debug_enabled boolean not null default false,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists chatbot_review_queue (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  reason text not null,
  status text not null default 'pending',
  confidence_score numeric(4, 3),
  lead_readiness_score integer,
  next_best_action text,
  question text,
  admin_note text,
  resolved_by_user_id uuid references users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_runtime_metrics_site_created on chatbot_runtime_metrics(site_id, created_at desc);
create index if not exists idx_widget_events_site_created on widget_runtime_events(site_id, created_at desc);
create index if not exists idx_review_queue_site_status on chatbot_review_queue(site_id, status, created_at desc);
