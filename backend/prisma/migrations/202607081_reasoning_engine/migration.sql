create table if not exists visitor_conversation_context (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade unique,
  visitor_id uuid not null references visitors(id),
  detected_needs text,
  detected_city text,
  detected_service text,
  detected_budget text,
  detected_urgency text,
  detected_contact_intent text,
  previous_intents text[] not null default '{}',
  lead_readiness_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reasoning_traces (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  detected_intent text not null,
  intent_confidence numeric(4, 3) not null default 0,
  selected_knowledge_item_id text,
  applied_goal text,
  applied_personality text,
  next_best_action text not null,
  confidence_score numeric(4, 3) not null default 0,
  trace_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_visitor_context_org_site_score
  on visitor_conversation_context(organization_id, site_id, lead_readiness_score desc);

create index if not exists idx_reasoning_traces_conversation_created
  on reasoning_traces(conversation_id, created_at desc);

create index if not exists idx_reasoning_traces_org_intent
  on reasoning_traces(organization_id, detected_intent);

create index if not exists idx_reasoning_traces_org_action
  on reasoning_traces(organization_id, next_best_action);
