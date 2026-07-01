import type { Database } from './client.js';

export async function initializeSchema(database: Database): Promise<void> {
  await database.query(`
    create table if not exists organizations (
      id uuid primary key,
      name text not null,
      slug text not null unique,
      description text,
      email text,
      phone text,
      country text not null default 'FR',
      language text not null default 'fr',
      timezone text not null default 'Europe/Paris',
      currency text not null default 'EUR',
      status text not null default 'active',
      subscription_status text,
      ai_quota integer,
      conversation_quota integer,
      storage_quota_mb integer,
      plan text,
      created_at timestamptz not null default now()
    );

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

    create table if not exists admin_sessions (
      id uuid primary key,
      user_id uuid not null references users(id),
      organization_id uuid not null references organizations(id),
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      renewed_at timestamptz not null default now(),
      revoked_at timestamptz
    );

    create table if not exists sites (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      name text not null,
      slug text,
      domain text,
      widget_public_key text not null unique,
      activity text not null,
      business_config_id text not null default 'default',
      language text not null default 'fr',
      status text not null default 'active',
      widget_enabled boolean not null default true,
      created_at timestamptz not null default now()
    );

    alter table organizations add column if not exists description text;
    alter table organizations add column if not exists email text;
    alter table organizations add column if not exists phone text;
    alter table organizations add column if not exists country text not null default 'FR';
    alter table organizations add column if not exists language text not null default 'fr';
    alter table organizations add column if not exists timezone text not null default 'Europe/Paris';
    alter table organizations add column if not exists currency text not null default 'EUR';
    alter table organizations add column if not exists status text not null default 'active';
    alter table organizations add column if not exists subscription_status text;
    alter table organizations add column if not exists ai_quota integer;
    alter table organizations add column if not exists conversation_quota integer;
    alter table organizations add column if not exists storage_quota_mb integer;
    alter table organizations add column if not exists plan text;

    alter table sites add column if not exists slug text;
    alter table sites add column if not exists business_config_id text not null default 'default';
    alter table sites add column if not exists language text not null default 'fr';
    alter table sites add column if not exists status text not null default 'active';
    alter table sites add column if not exists widget_enabled boolean not null default true;

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

    create table if not exists ai_configurations (
      organization_id uuid primary key references organizations(id),
      provider text not null default 'mock',
      model text not null default 'mock-conversational-v1',
      temperature numeric(3, 2) not null default 0.20,
      max_tokens integer not null default 600,
      top_p numeric(3, 2) not null default 1.00,
      timeout_ms integer not null default 8000,
      language text not null default 'fr',
      system_prompt text not null default '',
      enabled boolean not null default true,
      future_cost_limit numeric(12, 6),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ai_events (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid not null references sites(id),
      conversation_id uuid not null references conversations(id),
      provider text not null,
      model text not null,
      latency_ms integer not null,
      input_tokens integer not null,
      output_tokens integer not null,
      estimated_cost numeric(12, 6) not null,
      fallback_used boolean not null default false,
      created_at timestamptz not null default now()
    );

    alter table messages add column if not exists response_source text;
    alter table messages add column if not exists response_confidence numeric(4, 3);
    alter table messages add column if not exists should_escalate boolean;
    alter table messages add column if not exists processing_time_ms integer;
    alter table messages add column if not exists matched_item_id text;
    alter table messages add column if not exists decision_reason text;

    create index if not exists idx_sites_widget_public_key on sites(widget_public_key);
    create index if not exists idx_users_email on users(email);
    create index if not exists idx_admin_sessions_token_hash on admin_sessions(token_hash);
    create index if not exists idx_admin_sessions_user on admin_sessions(user_id);
    create unique index if not exists idx_sites_organization_slug on sites(organization_id, slug);
    create index if not exists idx_sites_organization on sites(organization_id);
    create index if not exists idx_conversations_prospect on conversations(prospect_id);
    create index if not exists idx_conversations_organization_site on conversations(organization_id, site_id);
    create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at);
    create index if not exists idx_decision_events_conversation_created
      on decision_events(conversation_id, created_at);
    create index if not exists idx_ai_events_organization_created
      on ai_events(organization_id, created_at desc);
    create index if not exists idx_ai_events_conversation_created
      on ai_events(conversation_id, created_at);
    create index if not exists idx_prospects_site_updated on prospects(site_id, updated_at desc);
  `);
}

export async function seedFoundationData(database: Database): Promise<void> {
  await database.query(`
    insert into organizations (
      id,
      name,
      slug,
      description,
      email,
      phone,
      country,
      language,
      timezone,
      currency,
      status,
      plan
    )
    values (
      '00000000-0000-4000-8000-000000000001',
      'VISITOR-OS Demo',
      'demo',
      'Organisation de demonstration',
      'contact@example.com',
      '+33000000000',
      'FR',
      'fr',
      'Europe/Paris',
      'EUR',
      'active',
      'dev'
    )
    on conflict (slug) do nothing;

    insert into sites (
      id,
      organization_id,
      name,
      slug,
      domain,
      widget_public_key,
      activity,
      business_config_id,
      language,
      status,
      widget_enabled
    )
    values (
      '00000000-0000-4000-8000-000000000101',
      '00000000-0000-4000-8000-000000000001',
      'Site demo',
      'demo-site',
      'localhost',
      'demo-site-key',
      'default',
      'default',
      'fr',
      'active',
      true
    )
    on conflict (widget_public_key) do nothing;
  `);
}
