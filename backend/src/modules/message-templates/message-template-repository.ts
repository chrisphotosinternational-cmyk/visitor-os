import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { ProspectRecord } from '../prospects/prospect-repository.js';

export type MessageTemplateChannel =
  | 'email'
  | 'phone_script'
  | 'whatsapp_manual'
  | 'instagram_manual'
  | 'x_manual'
  | 'mym_manual'
  | 'onlyfans_manual'
  | 'website_form'
  | 'other';

export const messageTemplateChannels: readonly MessageTemplateChannel[] = [
  'email',
  'phone_script',
  'whatsapp_manual',
  'instagram_manual',
  'x_manual',
  'mym_manual',
  'onlyfans_manual',
  'website_form',
  'other'
] as const;

export type MessageTemplatePurpose =
  | 'first_contact'
  | 'follow_up'
  | 'proposal'
  | 'reactivation'
  | 'thank_you'
  | 'refusal_response'
  | 'custom';

export const messageTemplatePurposes: readonly MessageTemplatePurpose[] = [
  'first_contact',
  'follow_up',
  'proposal',
  'reactivation',
  'thank_you',
  'refusal_response',
  'custom'
] as const;

export const supportedTemplateVariables = [
  'first_name',
  'last_name',
  'pseudo',
  'city',
  'activity',
  'platform',
  'website',
  'instagram',
  'mym',
  'onlyfans',
  'score_label'
] as const;

export type MessageTemplateRecord = {
  id: string;
  organization_id: string;
  name: string;
  channel: MessageTemplateChannel;
  purpose: MessageTemplatePurpose;
  content: string;
  variables: string[];
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type MessageTemplateInput = {
  organizationId: string;
  name: string;
  channel: MessageTemplateChannel;
  purpose: MessageTemplatePurpose;
  content: string;
  isActive?: boolean;
  createdByUserId?: string;
};

export type MessageRenderResult = {
  template: MessageTemplateRecord;
  rendered: string;
  variables: Record<string, string>;
};

export class MessageTemplateRepository {
  constructor(private readonly database: Database) {}

  async ensureDefaults(organizationId: string, userId?: string): Promise<void> {
    const existing = await this.database.query<{ count: string }>(
      `select count(*)::text as count from message_templates where organization_id = $1`,
      [organizationId]
    );
    if (Number(existing.rows[0]?.count ?? 0) > 0) return;

    for (const template of defaultTemplates(organizationId, userId)) {
      await this.create(template);
    }
  }

  async list(organizationId?: string): Promise<MessageTemplateRecord[]> {
    const result = await this.database.query<MessageTemplateRecord>(
      `
      select *
      from message_templates
      where ($1::uuid is null or organization_id = $1)
      order by is_active desc, updated_at desc, name asc
      `,
      [organizationId ?? null]
    );

    return result.rows;
  }

  async find(id: string, organizationId?: string): Promise<MessageTemplateRecord | null> {
    const result = await this.database.query<MessageTemplateRecord>(
      `select * from message_templates where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    return result.rows[0] ?? null;
  }

  async create(input: MessageTemplateInput): Promise<MessageTemplateRecord> {
    const result = await this.database.query<MessageTemplateRecord>(
      `
      insert into message_templates (
        id,
        organization_id,
        name,
        channel,
        purpose,
        content,
        variables,
        is_active,
        created_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.name,
        input.channel,
        input.purpose,
        input.content,
        JSON.stringify(extractVariables(input.content)),
        input.isActive ?? true,
        input.createdByUserId ?? null
      ]
    );

    return requireRow(result.rows[0], 'Message template was not created');
  }

  async update(
    id: string,
    organizationId: string | undefined,
    input: MessageTemplateInput
  ): Promise<MessageTemplateRecord | null> {
    const result = await this.database.query<MessageTemplateRecord>(
      `
      update message_templates
      set
        organization_id = $1,
        name = $2,
        channel = $3,
        purpose = $4,
        content = $5,
        variables = $6::jsonb,
        is_active = $7,
        updated_at = now()
      where id = $8 and ($9::uuid is null or organization_id = $9)
      returning *
      `,
      [
        input.organizationId,
        input.name,
        input.channel,
        input.purpose,
        input.content,
        JSON.stringify(extractVariables(input.content)),
        input.isActive ?? true,
        id,
        organizationId ?? null
      ]
    );

    return result.rows[0] ?? null;
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const result = await this.database.query(
      `delete from message_templates where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async render(
    templateId: string,
    prospect: ProspectRecord,
    organizationId?: string
  ): Promise<MessageRenderResult | null> {
    const template = await this.find(templateId, organizationId);
    if (!template) return null;
    const variables = prospectVariables(prospect);

    return {
      template,
      variables,
      rendered: renderTemplate(template.content, variables)
    };
  }

  async recordUsage(input: {
    organizationId: string;
    templateId: string;
    prospectId?: string;
    userId?: string;
    action: 'copied' | 'history_saved';
    renderedContent: string;
  }): Promise<void> {
    await this.database.query(
      `
      insert into message_template_usage (
        id,
        organization_id,
        template_id,
        prospect_id,
        user_id,
        action,
        rendered_content
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.templateId,
        input.prospectId ?? null,
        input.userId ?? null,
        input.action,
        input.renderedContent
      ]
    );
  }

  async metrics(organizationId?: string): Promise<{
    activeTemplates: number;
    copiedThisWeek: number;
    historySavedThisWeek: number;
    topTemplates: Array<{ templateId: string; name: string; count: number }>;
  }> {
    const [summary, topTemplates] = await Promise.all([
      this.database.query<{
        active_templates: string;
        copied_this_week: string;
        history_saved_this_week: string;
      }>(
        `
        select
          (select count(*)::text from message_templates mt where ($1::uuid is null or mt.organization_id = $1) and mt.is_active = true) as active_templates,
          (select count(*)::text from message_template_usage u where ($1::uuid is null or u.organization_id = $1) and u.action = 'copied' and u.created_at >= now() - interval '7 days') as copied_this_week,
          (select count(*)::text from message_template_usage u where ($1::uuid is null or u.organization_id = $1) and u.action = 'history_saved' and u.created_at >= now() - interval '7 days') as history_saved_this_week
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ template_id: string; name: string; count: string }>(
        `
        select u.template_id, mt.name, count(*)::text as count
        from message_template_usage u
        join message_templates mt on mt.id = u.template_id
        where ($1::uuid is null or u.organization_id = $1)
        group by u.template_id, mt.name
        order by count(*) desc, mt.name asc
        limit 5
        `,
        [organizationId ?? null]
      )
    ]);
    const row = summary.rows[0];

    return {
      activeTemplates: Number(row?.active_templates ?? 0),
      copiedThisWeek: Number(row?.copied_this_week ?? 0),
      historySavedThisWeek: Number(row?.history_saved_this_week ?? 0),
      topTemplates: topTemplates.rows.map((item) => ({
        templateId: item.template_id,
        name: item.name,
        count: Number(item.count)
      }))
    };
  }

  async exportTemplatesCsv(organizationId?: string): Promise<string> {
    const templates = await this.list(organizationId);
    const headers = ['id', 'organization_id', 'name', 'channel', 'purpose', 'is_active', 'content'];
    return [
      headers.join(','),
      ...templates.map((row) =>
        headers
          .map((header) => csvEscape(csvValue((row as unknown as Record<string, unknown>)[header])))
          .join(',')
      )
    ].join('\n');
  }

  async exportUsageCsv(organizationId?: string): Promise<string> {
    const result = await this.database.query<{
      template_id: string;
      template_name: string;
      prospect_id: string | null;
      action: string;
      created_at: Date;
    }>(
      `
      select u.template_id, mt.name as template_name, u.prospect_id, u.action, u.created_at
      from message_template_usage u
      join message_templates mt on mt.id = u.template_id
      where ($1::uuid is null or u.organization_id = $1)
      order by u.created_at desc
      limit 1000
      `,
      [organizationId ?? null]
    );
    const headers = ['template_id', 'template_name', 'prospect_id', 'action', 'created_at'];
    return [
      headers.join(','),
      ...result.rows.map((row) =>
        headers
          .map((header) => csvEscape(csvValue((row as unknown as Record<string, unknown>)[header])))
          .join(',')
      )
    ].join('\n');
  }
}

export function extractVariables(content: string): string[] {
  return [
    ...new Set([...content.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1] ?? ''))
  ].filter((name) =>
    supportedTemplateVariables.includes(name as (typeof supportedTemplateVariables)[number])
  );
}

export function renderTemplate(content: string, variables: Record<string, string>): string {
  return content.replace(/\{([a-z_]+)\}/g, (_match, variable: string) => variables[variable] ?? '');
}

function prospectVariables(prospect: ProspectRecord): Record<string, string> {
  return {
    first_name: prospect.first_name ?? '',
    last_name: prospect.last_name ?? '',
    pseudo: prospect.pseudo ?? '',
    city: prospect.city ?? '',
    activity: prospect.activity ?? '',
    platform: detectPlatform(prospect),
    website: prospect.website ?? prospect.linktree ?? prospect.allmylinks ?? '',
    instagram: prospect.instagram ?? '',
    mym: prospect.mym ?? '',
    onlyfans: prospect.onlyfans ?? '',
    score_label: prospect.score_label ?? ''
  };
}

function detectPlatform(prospect: ProspectRecord): string {
  if (prospect.mym) return 'MYM';
  if (prospect.onlyfans) return 'OnlyFans';
  if (prospect.instagram) return 'Instagram';
  if (prospect.twitter_x) return 'X';
  if (prospect.website) return 'site web';
  return '';
}

function defaultTemplates(organizationId: string, userId?: string): MessageTemplateInput[] {
  const base = {
    organizationId,
    ...(userId ? { createdByUserId: userId } : {})
  };
  return [
    {
      ...base,
      name: 'Premier contact professionnel',
      channel: 'email',
      purpose: 'first_contact',
      content:
        'Bonjour {first_name}{pseudo}, je me permets de vous contacter apres avoir decouvert votre profil. Votre univers a {city} semble interessant pour une collaboration respectueuse et professionnelle.'
    },
    {
      ...base,
      name: 'Relance douce',
      channel: 'instagram_manual',
      purpose: 'follow_up',
      content:
        'Bonjour {first_name}, je me permets une relance rapide au sujet de mon precedent message. Si le moment n est pas adapte, aucun souci.'
    },
    {
      ...base,
      name: 'Proposition shooting creatrice de contenu',
      channel: 'instagram_manual',
      purpose: 'proposal',
      content:
        'Bonjour {pseudo}, je pense qu un shooting court et soigne pourrait bien valoriser votre contenu {platform}. Je peux vous proposer une approche simple, discrete et professionnelle.'
    },
    {
      ...base,
      name: 'Message modele / portrait',
      channel: 'email',
      purpose: 'proposal',
      content:
        'Bonjour {first_name}, votre profil correspond a une recherche portrait / modele. Je serais ravi de vous presenter une proposition claire, sans engagement.'
    },
    {
      ...base,
      name: 'Message collaboration artistique',
      channel: 'instagram_manual',
      purpose: 'first_contact',
      content:
        'Bonjour {pseudo}, votre direction artistique m interesse. Je vous contacte pour envisager une collaboration simple, cadree et respectueuse de votre image.'
    },
    {
      ...base,
      name: 'Message refus poli',
      channel: 'email',
      purpose: 'refusal_response',
      content:
        'Bonjour {first_name}, merci pour votre retour. Je comprends parfaitement et vous souhaite une tres bonne continuation.'
    }
  ];
}

function csvValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return value.toString();
  if (value instanceof Date) return value.toISOString();
  return '';
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);
  return row;
}
