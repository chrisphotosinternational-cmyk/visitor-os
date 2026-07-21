import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { AppError } from '../../core/errors/app-error.js';
import type { ConversationRecord, SiteRecord } from '../conversations/conversation-repository.js';

export const leadCaptureTriggers = [
  'after_messages',
  'repeated_fallback',
  'commercial_intent',
  'manual'
] as const;

export type LeadCaptureTrigger = (typeof leadCaptureTriggers)[number];

export type SiteWidgetSettings = {
  allowedDomains: string[];
  primaryColor: string;
  welcomeMessage: string;
  fallbackMessage: string;
  privacyMessage: string;
  leadCaptureEnabled: boolean;
  leadCaptureTrigger: LeadCaptureTrigger;
  leadCaptureAfterMessages: number;
  leadCaptureFields: string[];
};

export type SiteWidgetAdmin = SiteRecord & {
  allowed_domains: string[] | null;
  widget_primary_color: string | null;
  widget_welcome_message: string | null;
  widget_fallback_message: string | null;
  widget_privacy_message: string | null;
  lead_capture_enabled: boolean | null;
  lead_capture_trigger: LeadCaptureTrigger | null;
  lead_capture_after_messages: number | null;
  lead_capture_fields: string[] | null;
};

type WidgetSettingsSource = {
  allowed_domains?: string[] | null;
  widget_primary_color?: string | null;
  widget_welcome_message?: string | null;
  widget_fallback_message?: string | null;
  widget_privacy_message?: string | null;
  lead_capture_enabled?: boolean | null;
  lead_capture_trigger?: string | null;
  lead_capture_after_messages?: number | null;
  lead_capture_fields?: string[] | null;
};

export type SiteCreateInput = {
  organizationId: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive';
  widgetEnabled: boolean;
};

type WidgetSettingsUpdate = {
  name?: string | undefined;
  domain?: string | undefined;
  allowedDomains?: string[] | undefined;
  primaryColor?: string | undefined;
  welcomeMessage?: string | undefined;
  fallbackMessage?: string | undefined;
  privacyMessage?: string | undefined;
  leadCaptureEnabled?: boolean | undefined;
  leadCaptureTrigger?: LeadCaptureTrigger | undefined;
  leadCaptureAfterMessages?: number | undefined;
  leadCaptureFields?: string[] | undefined;
  widgetEnabled?: boolean | undefined;
  status?: string | undefined;
};

export type QaItemRecord = {
  id: string;
  organization_id: string;
  site_id: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  priority: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type UnansweredQuestionRecord = {
  id: string;
  organization_id: string;
  site_id: string;
  conversation_id: string | null;
  question: string;
  status: 'pending' | 'ignored' | 'converted';
  suggested_answer: string | null;
  category: string | null;
  tags: string[];
  created_at: Date;
  updated_at: Date;
};

export type ChatbotMetrics = {
  conversationsBySite: Array<{ siteId: string; site: string; conversations: number }>;
  fallbackRate: number;
  unansweredQuestions: number;
  leadsCaptured: number;
  conversionRate: number;
  topQuestions: Array<{ question: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  activeSites: Array<{ siteId: string; site: string; conversations: number }>;
};

export type LeadCaptureSubmission = {
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  need?: string | undefined;
};

export class ChatbotProductionService {
  constructor(private readonly database: Database) {}

  async getSiteWidget(siteId: string, organizationId?: string): Promise<SiteWidgetAdmin | null> {
    const result = await this.database.query<SiteWidgetAdmin>(
      `select * from sites where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [siteId, organizationId ?? null]
    );

    return result.rows[0] ?? null;
  }

  async listSites(organizationId?: string): Promise<SiteWidgetAdmin[]> {
    const result = await this.database.query<SiteWidgetAdmin>(
      `
      select *
      from sites
      where ($1::uuid is null or organization_id = $1)
      order by created_at desc, name asc
      limit 100
      `,
      [organizationId ?? null]
    );

    return result.rows;
  }

  async createSite(input: SiteCreateInput): Promise<SiteWidgetAdmin> {
    const domain = normalizeDomain(input.domain);
    await this.assertDomainUnique(domain);
    const siteId = randomUUID();
    const publicKey = `site_${siteId.replaceAll('-', '')}`;
    const result = await this.database.query<SiteWidgetAdmin>(
      `
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
        widget_enabled,
        allowed_domains
      )
      values ($1, $2, $3, $4, $5, $6, 'default', 'default', 'fr', $7, $8, $9)
      returning *
      `,
      [
        siteId,
        input.organizationId,
        input.name.trim(),
        slugify(input.name),
        domain,
        publicKey,
        input.status,
        input.widgetEnabled,
        domain ? [domain] : []
      ]
    );

    return requireRow(result.rows[0], 'Site was not created');
  }

  async assertDomainUnique(domain: string, excludeSiteId?: string): Promise<void> {
    if (!domain) return;
    const result = await this.database.query<{ id: string }>(
      `select id from sites where lower(domain) = $1 and ($2::uuid is null or id <> $2) limit 1`,
      [domain, excludeSiteId ?? null]
    );

    if (result.rows[0]) {
      throw new AppError('Site domain already exists', {
        statusCode: 409,
        code: 'SITE_DOMAIN_ALREADY_EXISTS'
      });
    }
  }

  async updateWidgetSettings(
    siteId: string,
    organizationId: string,
    settings: WidgetSettingsUpdate
  ): Promise<SiteWidgetAdmin | null> {
    const result = await this.database.query<SiteWidgetAdmin>(
      `
      update sites
      set
        name = coalesce($14, name),
        domain = coalesce($15, domain),
        allowed_domains = coalesce($1, allowed_domains),
        widget_primary_color = coalesce($2, widget_primary_color),
        widget_welcome_message = coalesce($3, widget_welcome_message),
        widget_fallback_message = coalesce($4, widget_fallback_message),
        widget_privacy_message = coalesce($5, widget_privacy_message),
        lead_capture_enabled = coalesce($6, lead_capture_enabled),
        lead_capture_trigger = coalesce($7, lead_capture_trigger),
        lead_capture_after_messages = coalesce($8, lead_capture_after_messages),
        lead_capture_fields = coalesce($9, lead_capture_fields),
        widget_enabled = coalesce($10, widget_enabled),
        status = coalesce($11, status)
      where id = $12 and organization_id = $13
      returning *
      `,
      [
        settings.allowedDomains ?? null,
        settings.primaryColor ?? null,
        settings.welcomeMessage ?? null,
        settings.fallbackMessage ?? null,
        settings.privacyMessage ?? null,
        settings.leadCaptureEnabled ?? null,
        settings.leadCaptureTrigger ?? null,
        settings.leadCaptureAfterMessages ?? null,
        settings.leadCaptureFields ?? null,
        settings.widgetEnabled ?? null,
        settings.status ?? null,
        siteId,
        organizationId,
        settings.name?.trim() || null,
        settings.domain === undefined ? null : normalizeDomain(settings.domain)
      ]
    );

    return result.rows[0] ?? null;
  }

  widgetSettings(site: WidgetSettingsSource): SiteWidgetSettings {
    return {
      allowedDomains: normalizeDomains(site.allowed_domains ?? []),
      primaryColor: site.widget_primary_color ?? '#1f6f5b',
      welcomeMessage: site.widget_welcome_message ?? 'Bonjour, je peux vous aider.',
      fallbackMessage:
        site.widget_fallback_message ??
        "Je n'ai pas encore cette information. Contactez-nous pour une reponse precise.",
      privacyMessage:
        site.widget_privacy_message ??
        'Vos informations sont utilisees uniquement pour repondre a votre demande.',
      leadCaptureEnabled: site.lead_capture_enabled ?? false,
      leadCaptureTrigger: parseLeadCaptureTrigger(site.lead_capture_trigger),
      leadCaptureAfterMessages: site.lead_capture_after_messages ?? 3,
      leadCaptureFields: site.lead_capture_fields ?? ['name', 'email', 'phone', 'need']
    };
  }

  assertDomainAllowed(site: WidgetSettingsSource, sourceUrl?: string | null): void {
    const allowedDomains = normalizeDomains(site.allowed_domains ?? []);
    if (allowedDomains.length === 0 || !sourceUrl) return;
    const hostname = hostnameFromUrl(sourceUrl);
    if (!hostname) return;

    if (!allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      throw new AppError('Widget domain is not allowed for this site', {
        statusCode: 403,
        code: 'WIDGET_DOMAIN_FORBIDDEN'
      });
    }
  }

  async findQaAnswer(input: {
    organizationId: string;
    siteId: string;
    question: string;
  }): Promise<QaItemRecord | null> {
    const tokens = tokenize(input.question);
    const result = await this.database.query<QaItemRecord>(
      `
      select *
      from site_qa_items
      where organization_id = $1
        and site_id = $2
        and is_active = true
        and (
          lower(question) = lower($3)
          or lower(question) ilike $4
          or exists (
            select 1
            from unnest(tags) as tag
            where lower(tag) = any($5::text[])
          )
        )
      order by priority desc, updated_at desc
      limit 1
      `,
      [input.organizationId, input.siteId, input.question, `%${input.question}%`, tokens]
    );

    return result.rows[0] ?? null;
  }

  async recordUnanswered(input: {
    organizationId: string;
    siteId: string;
    conversationId: string;
    question: string;
  }): Promise<UnansweredQuestionRecord> {
    const result = await this.database.query<UnansweredQuestionRecord>(
      `
      insert into chatbot_unanswered_questions (
        id,
        organization_id,
        site_id,
        conversation_id,
        question
      )
      values ($1, $2, $3, $4, $5)
      returning *
      `,
      [randomUUID(), input.organizationId, input.siteId, input.conversationId, input.question]
    );

    return requireRow(result.rows[0], 'Unanswered question was not recorded');
  }

  async listUnanswered(input: {
    organizationId: string;
    siteId: string;
    status?: 'pending' | 'ignored' | 'converted' | undefined;
  }): Promise<UnansweredQuestionRecord[]> {
    const result = await this.database.query<UnansweredQuestionRecord>(
      `
      select *
      from chatbot_unanswered_questions
      where organization_id = $1
        and site_id = $2
        and ($3::text is null or status = $3)
      order by created_at desc
      limit 200
      `,
      [input.organizationId, input.siteId, input.status ?? null]
    );

    return result.rows;
  }

  async ignoreUnanswered(input: {
    organizationId: string;
    siteId: string;
    unansweredId: string;
  }): Promise<UnansweredQuestionRecord | null> {
    const result = await this.database.query<UnansweredQuestionRecord>(
      `
      update chatbot_unanswered_questions
      set status = 'ignored', updated_at = now()
      where id = $1 and organization_id = $2 and site_id = $3
      returning *
      `,
      [input.unansweredId, input.organizationId, input.siteId]
    );

    return result.rows[0] ?? null;
  }

  async convertUnansweredToQa(input: {
    organizationId: string;
    siteId: string;
    unansweredId: string;
    answer: string;
    category?: string | undefined;
    tags?: string[] | undefined;
  }): Promise<{ unanswered: UnansweredQuestionRecord; qa: QaItemRecord }> {
    const unansweredResult = await this.database.query<UnansweredQuestionRecord>(
      `
      select *
      from chatbot_unanswered_questions
      where id = $1 and organization_id = $2 and site_id = $3
      `,
      [input.unansweredId, input.organizationId, input.siteId]
    );
    const unanswered = unansweredResult.rows[0];
    if (!unanswered) {
      throw new AppError('Unanswered question not found', {
        statusCode: 404,
        code: 'UNANSWERED_NOT_FOUND'
      });
    }

    const qa = await this.createQaItem({
      organizationId: input.organizationId,
      siteId: input.siteId,
      category: input.category ?? unanswered.category ?? 'general',
      question: unanswered.question,
      answer: input.answer,
      tags: input.tags ?? unanswered.tags,
      priority: 50,
      isActive: true
    });

    const updatedResult = await this.database.query<UnansweredQuestionRecord>(
      `
      update chatbot_unanswered_questions
      set status = 'converted',
          suggested_answer = $1,
          category = $2,
          tags = $3,
          updated_at = now()
      where id = $4
      returning *
      `,
      [input.answer, input.category ?? null, input.tags ?? [], input.unansweredId]
    );

    return { unanswered: requireRow(updatedResult.rows[0], 'Question was not converted'), qa };
  }

  async importQaCsv(input: {
    organizationId: string;
    siteId: string;
    siteDomain: string | null;
    csv: string;
  }): Promise<{ rows: number; imported: number; skipped: number; errors: string[] }> {
    const rows = parseCsv(input.csv);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const domain = row.site_domain?.trim();
      if (
        domain &&
        input.siteDomain &&
        normalizeDomain(domain) !== normalizeDomain(input.siteDomain)
      ) {
        skipped += 1;
        continue;
      }

      if (!row.question || !row.answer) {
        skipped += 1;
        if (errors.length < 20) errors.push(`Line ${index + 2}: question and answer are required`);
        continue;
      }

      await this.createQaItem({
        organizationId: input.organizationId,
        siteId: input.siteId,
        category: row.category || 'general',
        question: row.question,
        answer: row.answer,
        tags: splitList(row.tags),
        priority: Number(row.priority || 50),
        isActive: row.is_active ? row.is_active.toLowerCase() !== 'false' : true
      });
      imported += 1;
    }

    return { rows: rows.length, imported, skipped, errors };
  }

  async shouldPromptLeadCapture(input: {
    site: WidgetSettingsSource;
    conversationId: string;
    lastDecisionSource: string;
    lastMessage: string;
  }): Promise<boolean> {
    const settings = this.widgetSettings(input.site);
    if (!settings.leadCaptureEnabled) return false;

    if (settings.leadCaptureTrigger === 'manual') return false;
    if (settings.leadCaptureTrigger === 'commercial_intent') {
      return /tarif|prix|devis|reserver|réserver|disponibilite|disponibilité|contact/i.test(
        input.lastMessage
      );
    }
    if (settings.leadCaptureTrigger === 'repeated_fallback') {
      const result = await this.database.query<{ count: string }>(
        `
        select count(*)::text as count
        from decision_events
        where conversation_id = $1
          and source in ('fallback', 'human_escalation')
        `,
        [input.conversationId]
      );

      return Number(result.rows[0]?.count ?? 0) >= 2 || input.lastDecisionSource === 'fallback';
    }

    const result = await this.database.query<{ count: string }>(
      `
      select count(*)::text as count
      from messages
      where conversation_id = $1 and sender_type = 'visitor'
      `,
      [input.conversationId]
    );

    return Number(result.rows[0]?.count ?? 0) >= settings.leadCaptureAfterMessages;
  }

  async captureLead(input: {
    site: SiteRecord;
    conversation: ConversationRecord;
    payload: LeadCaptureSubmission;
  }): Promise<{ prospectId: string; deduplicated: boolean }> {
    const email = emptyToNull(input.payload.email);
    const phone = emptyToNull(input.payload.phone);
    const existing =
      email || phone
        ? await this.database.query<{ id: string }>(
            `
            select id
            from prospects
            where organization_id = $1
              and (
                ($2::text is not null and lower(email) = lower($2))
                or ($3::text is not null and regexp_replace(phone, '[^0-9+]', '', 'g') = $3)
              )
            order by updated_at desc
            limit 1
            `,
            [input.conversation.organization_id, email, normalizedPhone(phone)]
          )
        : { rows: [] };
    const existingId = existing.rows[0]?.id;
    const note = buildLeadNote(input.payload);

    if (existingId) {
      await this.database.query(
        `
        update prospects
        set
          first_name = coalesce(first_name, $1),
          email = coalesce(email, $2),
          phone = coalesce(phone, $3),
          source_url = coalesce(source_url, $4),
          notes = concat_ws(E'\\n\\n', nullif(notes, ''), $5),
          updated_at = now()
        where id = $6 and organization_id = $7
        `,
        [
          emptyToNull(input.payload.name),
          email,
          phone,
          sourceUrlForSite(input.site),
          note,
          existingId,
          input.conversation.organization_id
        ]
      );
      await this.database.query(
        `update conversations set prospect_id = $1, updated_at = now() where id = $2`,
        [existingId, input.conversation.id]
      );

      return { prospectId: existingId, deduplicated: true };
    }

    const prospectId = randomUUID();
    await this.database.query(
      `
      insert into prospects (
        id,
        organization_id,
        site_id,
        visitor_id,
        display_name,
        first_name,
        email,
        phone,
        description,
        source_url,
        status,
        temperature,
        score_current,
        score,
        score_label,
        notes,
        source
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'to_qualify', 'tiede', 50, 50, 'medium', $11, 'chatbot')
      `,
      [
        prospectId,
        input.conversation.organization_id,
        input.conversation.site_id,
        input.conversation.visitor_id,
        emptyToNull(input.payload.name) ?? 'Lead chatbot',
        emptyToNull(input.payload.name),
        email,
        phone,
        emptyToNull(input.payload.need),
        sourceUrlForSite(input.site),
        note
      ]
    );
    await this.database.query(
      `update conversations set prospect_id = $1, updated_at = now() where id = $2`,
      [prospectId, input.conversation.id]
    );

    return { prospectId, deduplicated: false };
  }

  async metrics(organizationId?: string): Promise<ChatbotMetrics> {
    const [sites, fallback, unanswered, leads, topQuestions, categories] = await Promise.all([
      this.database.query<{ site_id: string; site: string; conversations: string }>(
        `
        select s.id as site_id, s.name as site, count(c.id)::text as conversations
        from sites s
        left join conversations c on c.site_id = s.id
        where ($1::uuid is null or s.organization_id = $1)
        group by s.id, s.name
        order by count(c.id) desc, s.name asc
        limit 10
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ total: string; fallback: string }>(
        `
        select
          count(*)::text as total,
          count(*) filter (where source in ('fallback', 'human_escalation'))::text as fallback
        from decision_events
        where ($1::uuid is null or organization_id = $1)
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ count: string }>(
        `select count(*)::text as count from chatbot_unanswered_questions where ($1::uuid is null or organization_id = $1) and status = 'pending'`,
        [organizationId ?? null]
      ),
      this.database.query<{ leads: string; conversations: string }>(
        `
        select
          count(distinct p.id)::text as leads,
          count(distinct c.id)::text as conversations
        from conversations c
        left join prospects p on p.id = c.prospect_id
        where ($1::uuid is null or c.organization_id = $1)
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ question: string; count: string }>(
        `
        select question, count(*)::text as count
        from chatbot_unanswered_questions
        where ($1::uuid is null or organization_id = $1)
        group by question
        order by count(*) desc
        limit 10
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ category: string; count: string }>(
        `
        select category, count(*)::text as count
        from site_qa_items
        where ($1::uuid is null or organization_id = $1)
        group by category
        order by count(*) desc, category asc
        limit 10
        `,
        [organizationId ?? null]
      )
    ]);
    const fallbackRow = fallback.rows[0];
    const leadRow = leads.rows[0];
    const totalDecisions = Number(fallbackRow?.total ?? 0);
    const totalConversations = Number(leadRow?.conversations ?? 0);

    return {
      conversationsBySite: sites.rows.map((site) => ({
        siteId: site.site_id,
        site: site.site,
        conversations: Number(site.conversations)
      })),
      fallbackRate: totalDecisions === 0 ? 0 : Number(fallbackRow?.fallback ?? 0) / totalDecisions,
      unansweredQuestions: Number(unanswered.rows[0]?.count ?? 0),
      leadsCaptured: Number(leadRow?.leads ?? 0),
      conversionRate:
        totalConversations === 0 ? 0 : Number(leadRow?.leads ?? 0) / totalConversations,
      topQuestions: topQuestions.rows.map((row) => ({
        question: row.question,
        count: Number(row.count)
      })),
      topCategories: categories.rows.map((row) => ({
        category: row.category,
        count: Number(row.count)
      })),
      activeSites: sites.rows
        .filter((site) => Number(site.conversations) > 0)
        .map((site) => ({
          siteId: site.site_id,
          site: site.site,
          conversations: Number(site.conversations)
        }))
    };
  }

  private async createQaItem(input: {
    organizationId: string;
    siteId: string;
    category: string;
    question: string;
    answer: string;
    tags: string[];
    priority: number;
    isActive: boolean;
  }): Promise<QaItemRecord> {
    const result = await this.database.query<QaItemRecord>(
      `
      insert into site_qa_items (
        id,
        organization_id,
        site_id,
        category,
        question,
        answer,
        tags,
        priority,
        is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (site_id, question)
      do update set
        category = excluded.category,
        answer = excluded.answer,
        tags = excluded.tags,
        priority = excluded.priority,
        is_active = excluded.is_active,
        updated_at = now()
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.category,
        input.question,
        input.answer,
        input.tags,
        input.priority,
        input.isActive
      ]
    );

    return requireRow(result.rows[0], 'Q/A item was not created');
  }
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'site'
  );
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0] ?? '').map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function splitList(value?: string): string[] {
  return (value ?? '')
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3)
    .slice(0, 20);
}

function hostnameFromUrl(value: string): string | null {
  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return normalizeDomain(value);
  }
}

function normalizeDomains(domains: string[]): string[] {
  return domains.map(normalizeDomain).filter(Boolean);
}

function parseLeadCaptureTrigger(value?: string | null): LeadCaptureTrigger {
  return leadCaptureTriggers.includes(value as LeadCaptureTrigger)
    ? (value as LeadCaptureTrigger)
    : 'after_messages';
}

export function normalizeDomain(domain?: string | null): string {
  const raw = (domain ?? '').trim().toLowerCase();
  if (!raw) return '';
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return (
      raw
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        ?.split(':')[0] ?? raw
    );
  }
}

function emptyToNull(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizedPhone(value?: string | null): string | null {
  const normalized = value?.replace(/[^0-9+]/g, '');
  return normalized ? normalized : null;
}

function sourceUrlForSite(site: SiteRecord): string | null {
  if (!site.domain) return null;
  return site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;
}

function buildLeadNote(payload: LeadCaptureSubmission): string {
  return [
    'Lead capturé via chatbot',
    payload.need ? `Besoin: ${payload.need}` : '',
    payload.email ? `Email: ${payload.email}` : '',
    payload.phone ? `Telephone: ${payload.phone}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
