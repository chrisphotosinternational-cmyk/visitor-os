import type { Database } from './client.js';

export async function initializeSchema(database: Database): Promise<void> {
  await database.query(`
    create table if not exists organizations (
      id uuid primary key,
      name text not null,
      slug text not null unique,
      created_at timestamptz not null default now()
    );

    create table if not exists sites (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      name text not null,
      domain text,
      widget_public_key text not null unique,
      activity text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists visitors (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid not null references sites(id),
      anonymous_id text not null,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      unique (site_id, anonymous_id)
    );

    create table if not exists prospects (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid not null references sites(id),
      visitor_id uuid references visitors(id),
      display_name text not null,
      email text,
      phone text,
      status text not null default 'Nouveau',
      temperature text not null default 'tiede',
      score_current integer not null default 40,
      source text not null default 'widget',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists conversations (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid not null references sites(id),
      visitor_id uuid not null references visitors(id),
      prospect_id uuid references prospects(id),
      status text not null default 'open',
      page_url text,
      referrer text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists messages (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      conversation_id uuid not null references conversations(id),
      sender_type text not null,
      content text not null,
      response_source text,
      response_confidence numeric(4, 3),
      should_escalate boolean,
      processing_time_ms integer,
      matched_item_id text,
      decision_reason text,
      created_at timestamptz not null default now()
    );

    create table if not exists decision_events (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      conversation_id uuid not null references conversations(id),
      message_id uuid references messages(id),
      source text not null,
      confidence numeric(4, 3) not null,
      should_escalate boolean not null,
      processing_time_ms integer not null,
      matched_item_id text,
      reason text,
      created_at timestamptz not null default now()
    );

    alter table messages add column if not exists response_source text;
    alter table messages add column if not exists response_confidence numeric(4, 3);
    alter table messages add column if not exists should_escalate boolean;
    alter table messages add column if not exists processing_time_ms integer;
    alter table messages add column if not exists matched_item_id text;
    alter table messages add column if not exists decision_reason text;

    create index if not exists idx_sites_widget_public_key on sites(widget_public_key);
    create index if not exists idx_conversations_prospect on conversations(prospect_id);
    create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at);
    create index if not exists idx_decision_events_conversation_created
      on decision_events(conversation_id, created_at);
    create index if not exists idx_prospects_site_updated on prospects(site_id, updated_at desc);
  `);
}

export async function seedFoundationData(database: Database): Promise<void> {
  await database.query(`
    insert into organizations (id, name, slug)
    values ('00000000-0000-4000-8000-000000000001', 'VISITOR-OS Demo', 'demo')
    on conflict (slug) do nothing;

    insert into sites (id, organization_id, name, domain, widget_public_key, activity)
    values (
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000001',
      'Site demo',
      'localhost',
      'demo-site-key',
      'demo'
    )
    on conflict (widget_public_key) do nothing;
  `);
}
