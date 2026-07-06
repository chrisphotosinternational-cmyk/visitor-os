alter table sites add column if not exists allowed_domains text[] not null default '{}';
alter table sites add column if not exists widget_primary_color text;
alter table sites add column if not exists widget_welcome_message text;
alter table sites add column if not exists widget_fallback_message text;
alter table sites add column if not exists widget_privacy_message text;
alter table sites add column if not exists lead_capture_enabled boolean not null default false;
alter table sites add column if not exists lead_capture_trigger text not null default 'after_messages';
alter table sites add column if not exists lead_capture_after_messages integer not null default 3;
alter table sites add column if not exists lead_capture_fields text[] not null default '{name,email,phone,need}';

create table if not exists site_qa_items (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  category text not null default 'general',
  question text not null,
  answer text not null,
  tags text[] not null default '{}',
  priority integer not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, question)
);

create table if not exists chatbot_unanswered_questions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  question text not null,
  status text not null default 'pending',
  suggested_answer text,
  category text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sites_allowed_domains on sites using gin(allowed_domains);
create index if not exists idx_site_qa_items_site_active_priority
  on site_qa_items(site_id, is_active, priority desc);
create index if not exists idx_site_qa_items_tags on site_qa_items using gin(tags);
create index if not exists idx_chatbot_unanswered_site_status_created
  on chatbot_unanswered_questions(site_id, status, created_at desc);
create index if not exists idx_chatbot_unanswered_organization
  on chatbot_unanswered_questions(organization_id, created_at desc);
