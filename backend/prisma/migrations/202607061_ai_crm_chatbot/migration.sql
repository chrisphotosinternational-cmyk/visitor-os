create table if not exists ai_chat_sessions (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  title text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_chat_messages (
  id uuid primary key,
  session_id uuid not null references ai_chat_sessions(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  role text not null,
  content text not null,
  intent text,
  citations jsonb not null default '[]'::jsonb,
  result_csv text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_chat_sessions_organization_updated
  on ai_chat_sessions(organization_id, updated_at desc);

create index if not exists idx_ai_chat_messages_session_created
  on ai_chat_messages(session_id, created_at);
