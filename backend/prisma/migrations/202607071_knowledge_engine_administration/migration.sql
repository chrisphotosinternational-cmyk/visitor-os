alter table chatbot_unanswered_questions
  add column if not exists detected_intent text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists last_seen_at timestamptz,
  add column if not exists confidence_score numeric,
  add column if not exists suggested_knowledge_item uuid,
  add column if not exists action_status text not null default 'pending';

create unique index if not exists idx_chatbot_unanswered_site_question
  on chatbot_unanswered_questions(site_id, question);

create table if not exists chatbot_intents (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  category text not null default 'general',
  examples text[] not null default '{}',
  synonyms text[] not null default '{}',
  priority integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table if not exists knowledge_items (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  intent_id uuid references chatbot_intents(id) on delete set null,
  title text not null,
  main_question text not null,
  alternative_questions text[] not null default '{}',
  short_answer text not null,
  detailed_answer text,
  commercial_answer text,
  reassurance_answer text,
  links text[] not null default '{}',
  cta_label text,
  cta_url text,
  conditions text,
  tags text[] not null default '{}',
  priority integer not null default 50,
  status text not null default 'draft',
  version integer not null default 1,
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_flows (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  description text,
  trigger_intent_id uuid references chatbot_intents(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_flow_steps (
  id uuid primary key,
  flow_id uuid not null references conversation_flows(id) on delete cascade,
  step_order integer not null,
  step_type text not null,
  content text not null,
  conditions text,
  next_step_id uuid,
  action_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbot_personality (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade unique,
  tone text not null default 'professionnel',
  style text,
  answer_length text not null default 'medium',
  formality text not null default 'vouvoiement',
  emoji_level text not null default 'none',
  commercial_intensity integer not null default 50,
  reassurance_level integer not null default 70,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chatbot_goals (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  goal_type text not null,
  description text not null,
  priority integer not null default 50,
  success_action text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_suggestions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  suggested_intent text,
  suggested_question text not null,
  suggested_answer text not null,
  suggested_tags text[] not null default '{}',
  confidence_score numeric,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chatbot_intents_site_active on chatbot_intents(site_id, is_active, priority desc);
create index if not exists idx_knowledge_items_site_status on knowledge_items(site_id, status, priority desc);
create index if not exists idx_knowledge_items_tags on knowledge_items using gin(tags);
create index if not exists idx_conversation_flows_site on conversation_flows(site_id, is_active);
create index if not exists idx_chatbot_goals_site on chatbot_goals(site_id, is_active, priority desc);
create index if not exists idx_knowledge_suggestions_site_status on knowledge_suggestions(site_id, status, created_at desc);
