create table if not exists users (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  first_name text not null,
  last_name text not null,
  email text not null,
  password_hash text,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);
