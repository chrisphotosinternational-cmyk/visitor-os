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

    create table if not exists notification_settings (
      organization_id uuid primary key references organizations(id),
      admin_emails text[] not null default '{}',
      notifications_enabled boolean not null default true,
      frequency text not null default 'instant',
      language text not null default 'fr',
      preferred_provider text not null default 'mock',
      webhook_url text,
      webhook_headers jsonb not null default '{}'::jsonb,
      webhook_secret text,
      retry_attempts integer not null default 2,
      timeout_ms integer not null default 5000,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists notification_events (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid references sites(id),
      type text not null,
      title text not null,
      subject text not null,
      content_preview text,
      recipient text,
      provider text not null,
      status text not null,
      error_message text,
      attempt_count integer not null default 0,
      sent_at timestamptz,
      created_at timestamptz not null default now()
    );

    create table if not exists analytics_snapshots (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid references sites(id),
      period_type text not null,
      period_start date not null,
      period_end date not null,
      metrics jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      unique (organization_id, site_id, period_type, period_start)
    );

    create table if not exists knowledge_documents (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid references sites(id),
      title text not null,
      description text,
      category text not null,
      type text not null,
      language text not null default 'fr',
      version integer not null default 1,
      size_bytes integer not null default 0,
      hash text not null,
      status text not null default 'active',
      tags text[] not null default '{}',
      author text,
      source text not null default 'manual',
      usage_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists knowledge_versions (
      id uuid primary key,
      document_id uuid not null references knowledge_documents(id) on delete cascade,
      organization_id uuid not null references organizations(id),
      version integer not null,
      title text not null,
      content text not null,
      hash text not null,
      author text,
      created_at timestamptz not null default now(),
      unique (document_id, version)
    );

    create table if not exists knowledge_chunks (
      id text primary key,
      document_id uuid not null references knowledge_documents(id) on delete cascade,
      organization_id uuid not null references organizations(id),
      site_id uuid references sites(id),
      content text not null,
      position integer not null,
      tokens text[] not null default '{}',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists knowledge_search_events (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid references sites(id),
      query text not null,
      result_count integer not null default 0,
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
      first_name text,
      last_name text,
      pseudo text,
      company text,
      display_name text not null,
      email text,
      phone text,
      website text,
      instagram text,
      twitter_x text,
      mym text,
      onlyfans text,
      linktree text,
      allmylinks text,
      city text,
      activity text,
      description text,
      source_url text,
      status text not null default 'Nouveau',
      temperature text not null default 'tiede',
      score_current integer not null default 40,
      score integer not null default 40,
      score_label text not null default 'medium',
      notes text,
      source text not null default 'widget',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table prospects add column if not exists first_name text;
    alter table prospects add column if not exists last_name text;
    alter table prospects add column if not exists pseudo text;
    alter table prospects add column if not exists company text;
    alter table prospects add column if not exists website text;
    alter table prospects add column if not exists instagram text;
    alter table prospects add column if not exists twitter_x text;
    alter table prospects add column if not exists mym text;
    alter table prospects add column if not exists onlyfans text;
    alter table prospects add column if not exists linktree text;
    alter table prospects add column if not exists allmylinks text;
    alter table prospects add column if not exists city text;
    alter table prospects add column if not exists activity text;
    alter table prospects add column if not exists description text;
    alter table prospects add column if not exists source_url text;
    alter table prospects add column if not exists score integer not null default 40;
    alter table prospects add column if not exists score_label text not null default 'medium';
    alter table prospects add column if not exists notes text;

    create table if not exists lead_score_history (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      prospect_id uuid not null references prospects(id),
      score integer not null,
      previous_score integer,
      reasons jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists crm_tags (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      site_id uuid references sites(id),
      label text not null,
      slug text not null,
      color text,
      created_at timestamptz not null default now(),
      unique (organization_id, slug)
    );

    create table if not exists prospect_tags (
      prospect_id uuid not null references prospects(id) on delete cascade,
      tag_id uuid not null references crm_tags(id) on delete cascade,
      source text not null default 'manual',
      created_at timestamptz not null default now(),
      primary key (prospect_id, tag_id)
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

    create table if not exists conversation_tags (
      conversation_id uuid not null references conversations(id) on delete cascade,
      tag_id uuid not null references crm_tags(id) on delete cascade,
      source text not null default 'manual',
      created_at timestamptz not null default now(),
      primary key (conversation_id, tag_id)
    );

    create table if not exists internal_notes (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      prospect_id uuid references prospects(id) on delete cascade,
      conversation_id uuid references conversations(id) on delete cascade,
      author_user_id uuid references users(id),
      content text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      check (prospect_id is not null or conversation_id is not null)
    );

    create table if not exists follow_ups (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      prospect_id uuid not null references prospects(id) on delete cascade,
      conversation_id uuid references conversations(id) on delete set null,
      author_user_id uuid references users(id),
      due_at timestamptz not null,
      reason text not null,
      status text not null default 'pending',
      completed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists contact_history (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      prospect_id uuid not null references prospects(id) on delete cascade,
      user_id uuid references users(id),
      contact_date timestamptz not null default now(),
      channel text not null,
      message_used text,
      response text,
      outcome text not null,
      next_action text,
      follow_up_date timestamptz,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists message_templates (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      name text not null,
      channel text not null,
      purpose text not null,
      content text not null,
      variables jsonb not null default '[]'::jsonb,
      is_active boolean not null default true,
      created_by_user_id uuid references users(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists message_template_usage (
      id uuid primary key,
      organization_id uuid not null references organizations(id),
      template_id uuid not null references message_templates(id) on delete cascade,
      prospect_id uuid references prospects(id) on delete set null,
      user_id uuid references users(id),
      action text not null,
      rendered_content text not null,
      created_at timestamptz not null default now()
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
    create index if not exists idx_notification_events_organization_created
      on notification_events(organization_id, created_at desc);
    create index if not exists idx_notification_events_status
      on notification_events(organization_id, status, created_at desc);
    create index if not exists idx_analytics_snapshots_period
      on analytics_snapshots(organization_id, period_type, period_start desc);
    create index if not exists idx_knowledge_documents_organization_status
      on knowledge_documents(organization_id, status, updated_at desc);
    create index if not exists idx_knowledge_documents_site
      on knowledge_documents(site_id, status, updated_at desc);
    create index if not exists idx_knowledge_chunks_document
      on knowledge_chunks(document_id, position);
    create index if not exists idx_knowledge_chunks_tokens
      on knowledge_chunks using gin(tokens);
    create index if not exists idx_knowledge_search_events_organization
      on knowledge_search_events(organization_id, created_at desc);
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
    create index if not exists idx_prospects_organization_score on prospects(organization_id, score_current desc);
    create index if not exists idx_lead_score_history_prospect_created
      on lead_score_history(prospect_id, created_at desc);
    create index if not exists idx_crm_tags_organization_slug on crm_tags(organization_id, slug);
    create index if not exists idx_prospect_tags_tag on prospect_tags(tag_id);
    create index if not exists idx_internal_notes_prospect_created
      on internal_notes(prospect_id, created_at desc);
    create index if not exists idx_follow_ups_due on follow_ups(organization_id, status, due_at);
    create index if not exists idx_contact_history_prospect_date
      on contact_history(prospect_id, contact_date desc);
    create index if not exists idx_contact_history_organization_followup
      on contact_history(organization_id, follow_up_date);
    create index if not exists idx_contact_history_organization_outcome
      on contact_history(organization_id, outcome);
    create index if not exists idx_message_templates_organization_active
      on message_templates(organization_id, is_active);
    create index if not exists idx_message_template_usage_organization_created
      on message_template_usage(organization_id, created_at desc);
    create index if not exists idx_message_template_usage_template
      on message_template_usage(template_id, created_at desc);
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
