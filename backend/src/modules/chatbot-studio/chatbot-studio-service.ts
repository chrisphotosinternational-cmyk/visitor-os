import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { AppError } from '../../core/errors/app-error.js';
import type { KnowledgeEngineService } from '../knowledge-engine/knowledge-engine-service.js';

export const studioBusinessTypes = [
  'chambre_hotes',
  'photographe',
  'restaurant',
  'hotel',
  'immobilier',
  'artisan',
  'commerce',
  'profession_liberale',
  'decoration',
  'seo',
  'coach',
  'autre'
] as const;

export const studioGoals = [
  'reservation',
  'devis',
  'appel',
  'whatsapp',
  'lead',
  'information'
] as const;
export const studioVersionStatuses = [
  'draft',
  'preproduction',
  'published',
  'rolled_back'
] as const;
export const studioImportStatuses = ['pending', 'accepted', 'rejected'] as const;

export type StudioWizardInput = {
  organizationId: string;
  siteId: string;
  name: string;
  domain: string;
  businessType: (typeof studioBusinessTypes)[number];
  primaryGoal: (typeof studioGoals)[number];
  tone: string;
  templateId?: string | undefined;
  userId?: string | undefined;
};

export type DocumentImportInput = {
  organizationId: string;
  siteId: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'markdown' | 'txt' | 'html';
  content: string;
};

export type SimulationInput = {
  organizationId: string;
  siteId: string;
  message: string;
};

type ImportedKnowledgeProposal = {
  title: string;
  question: string;
  answer: string;
  tags: string[];
  links: string[];
};

export class ChatbotStudioService {
  constructor(
    private readonly database: Database,
    private readonly knowledgeEngine: KnowledgeEngineService
  ) {}

  async dashboard(organizationId: string, siteId?: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        s.id as site_id,
        s.organization_id,
        s.name,
        s.domain,
        s.status,
        s.widget_enabled,
        coalesce(st.current_stage, 'draft') as current_stage,
        coalesce(st.draft_version, 0)::int as draft_version,
        coalesce(st.published_version, 0)::int as published_version,
        st.last_published_at,
        count(distinct i.id) filter (where i.is_active = true)::int as intents,
        count(distinct k.id) filter (where k.status = 'active')::int as knowledge_items,
        count(distinct c.id) filter (where c.created_at::date = current_date)::int as conversations_today,
        count(distinct u.id) filter (where coalesce(u.action_status, u.status) = 'pending')::int as unknown_questions,
        count(distinct p.id)::int as leads_generated,
        case
          when count(distinct c.id) = 0 then 100
          else greatest(0, round(100 - (
            count(distinct u.id) filter (where coalesce(u.action_status, u.status) = 'pending')::numeric
            / greatest(count(distinct c.id), 1)
          ) * 100))::int
        end as answer_rate
      from sites s
      left join chatbot_studios st on st.site_id = s.id
      left join chatbot_intents i on i.site_id = s.id
      left join knowledge_items k on k.site_id = s.id
      left join conversations c on c.site_id = s.id
      left join chatbot_unanswered_questions u on u.site_id = s.id
      left join prospects p on p.site_id = s.id
      where s.organization_id = $1 and ($2::uuid is null or s.id = $2)
      group by s.id, st.current_stage, st.draft_version, st.published_version, st.last_published_at
      order by s.name asc
      `,
      [organizationId, siteId ?? null]
    );

    return siteId ? requireRow(result.rows[0], 'Studio not found') : { studios: result.rows };
  }

  async templates(): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_template_library where is_active = true order by business_type asc, name asc`
    );
    return result.rows.length > 0 ? result.rows : defaultTemplates();
  }

  async createFromWizard(input: StudioWizardInput): Promise<Record<string, unknown>> {
    await this.ensureStudio(input.organizationId, input.siteId, input);
    const template = this.findTemplate(input.templateId, input.businessType);

    for (const intent of template.intents) {
      const created = await this.knowledgeEngine.createIntent(input.organizationId, input.siteId, {
        name: intent.name,
        category: intent.category,
        examples: intent.examples,
        synonyms: intent.synonyms,
        priority: intent.priority
      });
      for (const item of intent.knowledge) {
        await this.knowledgeEngine.createKnowledge(input.organizationId, input.siteId, {
          intentId: String(created.id),
          title: item.title,
          mainQuestion: item.question,
          alternativeQuestions: item.alternatives,
          shortAnswer: item.answer,
          commercialAnswer: item.commercialAnswer,
          tags: item.tags,
          ctaLabel: template.cta.label,
          ctaUrl: template.cta.url,
          status: 'draft',
          priority: item.priority,
          userId: input.userId
        });
      }
    }

    await this.knowledgeEngine.savePersonality(input.organizationId, input.siteId, {
      tone: input.tone,
      style: template.personality.style,
      answerLength: template.personality.answerLength,
      formality: template.personality.formality,
      emojiLevel: template.personality.emojiLevel,
      commercialIntensity: template.personality.commercialIntensity,
      reassuranceLevel: template.personality.reassuranceLevel
    });

    await this.knowledgeEngine.createGoal(input.organizationId, input.siteId, {
      goalType: input.primaryGoal,
      description: template.goalDescription,
      priority: 80,
      successAction: template.cta.label
    });

    const version = await this.createVersion(input.organizationId, input.siteId, 'draft', {
      source: 'wizard',
      businessType: input.businessType,
      primaryGoal: input.primaryGoal,
      template: template.id
    });

    return {
      studio: await this.dashboard(input.organizationId, input.siteId),
      template,
      version
    };
  }

  async importDocument(input: DocumentImportInput): Promise<Record<string, unknown>> {
    const extracted = extractKnowledgeCandidates(input.content, input.fileName);
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into chatbot_import_proposals (
        id, organization_id, site_id, file_name, file_type, extracted_questions, extracted_links,
        proposed_knowledge, status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.fileName,
        input.fileType,
        extracted.questions,
        extracted.links,
        JSON.stringify(extracted.knowledge)
      ]
    );

    return requireRow(result.rows[0], 'Import proposal was not created');
  }

  async acceptImportProposal(
    id: string,
    organizationId: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    const proposal = await this.findImportProposal(id, organizationId);
    const items = normalizeImportedKnowledge(proposal.proposed_knowledge);

    for (const item of items) {
      await this.knowledgeEngine.createKnowledge(organizationId, String(proposal.site_id), {
        title: item.title,
        mainQuestion: item.question,
        shortAnswer: item.answer,
        tags: item.tags ?? [],
        links: item.links ?? [],
        status: 'draft',
        userId
      });
    }

    const updated = await this.database.query<Record<string, unknown>>(
      `update chatbot_import_proposals set status = 'accepted', updated_at = now() where id = $1 and organization_id = $2 returning *`,
      [id, organizationId]
    );
    await this.createVersion(organizationId, String(proposal.site_id), 'draft', {
      source: 'document_import',
      proposalId: id
    });

    return {
      proposal: requireRow(updated.rows[0], 'Import proposal not found'),
      created: items.length
    };
  }

  async simulate(input: SimulationInput): Promise<Record<string, unknown>> {
    const answer = await this.knowledgeEngine.answerQuestion({
      organizationId: input.organizationId,
      siteId: input.siteId,
      question: input.message
    });
    const result = {
      reply:
        answer?.reply ??
        "Je n'ai pas encore cette information. Cette question serait ajoutee aux inconnues.",
      intent: answer?.detectedIntent ?? null,
      knowledgeItemId: answer?.matchedItemId ?? null,
      confidence: answer?.confidence ?? 0,
      fallback: !answer,
      actions: answer ? ['answer_from_knowledge'] : ['record_unanswered']
    };

    await this.database.query(
      `
      insert into chatbot_simulations (
        id, organization_id, site_id, message, detected_intent, knowledge_item_id, confidence_score,
        reply, fallback, actions
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.message,
        result.intent,
        result.knowledgeItemId,
        result.confidence,
        result.reply,
        result.fallback,
        result.actions
      ]
    );

    return result;
  }

  async publish(
    organizationId: string,
    siteId: string,
    userId?: string
  ): Promise<Record<string, unknown>> {
    await this.database.query(
      `
      update knowledge_items
      set status = 'active', updated_by_user_id = coalesce($3::uuid, updated_by_user_id), updated_at = now()
      where organization_id = $1 and site_id = $2 and status in ('draft', 'needs_review')
      `,
      [organizationId, siteId, userId ?? null]
    );
    const version = await this.createVersion(organizationId, siteId, 'published', {
      source: 'publish',
      userId
    });
    await this.database.query(
      `
      insert into chatbot_studios (id, organization_id, site_id, current_stage, draft_version, published_version, last_published_at)
      values ($1, $2, $3, 'published', $4, $4, now())
      on conflict (site_id) do update set
        current_stage = 'published',
        published_version = excluded.published_version,
        last_published_at = now(),
        updated_at = now()
      `,
      [randomUUID(), organizationId, siteId, version.version_number]
    );

    return version;
  }

  async rollback(
    organizationId: string,
    siteId: string,
    versionNumber: number
  ): Promise<Record<string, unknown>> {
    const version = await this.database.query<Record<string, unknown>>(
      `
      update chatbot_studio_versions
      set status = 'published', published_at = now()
      where organization_id = $1 and site_id = $2 and version_number = $3
      returning *
      `,
      [organizationId, siteId, versionNumber]
    );
    const row = requireRow(version.rows[0], 'Version not found');
    await this.database.query(
      `
      update chatbot_studios
      set current_stage = 'published', published_version = $3, last_published_at = now(), updated_at = now()
      where organization_id = $1 and site_id = $2
      `,
      [organizationId, siteId, versionNumber]
    );
    return row;
  }

  async versions(organizationId: string, siteId: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_studio_versions where organization_id = $1 and site_id = $2 order by version_number desc`,
      [organizationId, siteId]
    );
    return result.rows;
  }

  async diff(organizationId: string, siteId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        count(*) filter (where status = 'draft')::int as draft_items,
        count(*) filter (where status = 'active')::int as published_items,
        count(*) filter (where status = 'needs_review')::int as needs_review,
        count(*) filter (where status = 'archived')::int as archived_items
      from knowledge_items
      where organization_id = $1 and site_id = $2
      `,
      [organizationId, siteId]
    );
    return requireRow(result.rows[0], 'Diff unavailable');
  }

  private async ensureStudio(
    organizationId: string,
    siteId: string,
    input: Pick<StudioWizardInput, 'name' | 'domain' | 'businessType' | 'primaryGoal' | 'tone'>
  ): Promise<void> {
    await this.database.query(
      `
      insert into chatbot_studios (
        id, organization_id, site_id, name, domain, business_type, primary_goal, tone, current_stage
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
      on conflict (site_id) do update set
        name = excluded.name,
        domain = excluded.domain,
        business_type = excluded.business_type,
        primary_goal = excluded.primary_goal,
        tone = excluded.tone,
        current_stage = 'draft',
        draft_version = chatbot_studios.draft_version + 1,
        updated_at = now()
      `,
      [
        randomUUID(),
        organizationId,
        siteId,
        input.name,
        input.domain,
        input.businessType,
        input.primaryGoal,
        input.tone
      ]
    );
  }

  private async createVersion(
    organizationId: string,
    siteId: string,
    status: (typeof studioVersionStatuses)[number],
    snapshot: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const next = await this.database.query<Record<string, unknown>>(
      `select coalesce(max(version_number), 0) + 1 as version_number from chatbot_studio_versions where organization_id = $1 and site_id = $2`,
      [organizationId, siteId]
    );
    const versionNumber = Number(next.rows[0]?.version_number ?? 1);
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into chatbot_studio_versions (
        id, organization_id, site_id, version_number, status, snapshot, published_at
      )
      values ($1, $2, $3, $4, $5, $6, case when $5 = 'published' then now() else null end)
      returning *
      `,
      [randomUUID(), organizationId, siteId, versionNumber, status, JSON.stringify(snapshot)]
    );
    await this.database.query(
      `
      update chatbot_studios
      set current_stage = $3, draft_version = greatest(draft_version, $4), updated_at = now()
      where organization_id = $1 and site_id = $2
      `,
      [organizationId, siteId, status, versionNumber]
    );
    return requireRow(result.rows[0], 'Studio version was not created');
  }

  private async findImportProposal(
    id: string,
    organizationId: string
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_import_proposals where id = $1 and organization_id = $2`,
      [id, organizationId]
    );
    return requireRow(result.rows[0], 'Import proposal not found');
  }

  private findTemplate(
    templateId: string | undefined,
    businessType: StudioWizardInput['businessType']
  ) {
    const templates = defaultTemplates();
    const template =
      templates.find((item) => item.id === templateId) ??
      templates.find((item) => item.businessType === businessType) ??
      templates[0];
    if (!template) {
      throw new AppError('No chatbot studio template available', {
        statusCode: 500,
        code: 'STUDIO_TEMPLATE_UNAVAILABLE'
      });
    }
    return template;
  }
}

function extractKnowledgeCandidates(content: string, fileName: string) {
  const links = Array.from(content.matchAll(/https?:\/\/[^\s)]+/gi)).map((match) => match[0]);
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const questions = lines.filter((line) => line.includes('?')).slice(0, 20);
  const knowledge = questions.slice(0, 12).map((question, index) => ({
    title: question.replace(/[?]/g, '').slice(0, 80) || `${fileName} ${index + 1}`,
    question,
    answer: findFollowingAnswer(lines, question) ?? 'Reponse a completer avant publication.',
    tags: inferTags(question),
    links
  }));

  return {
    questions,
    links,
    knowledge:
      knowledge.length > 0
        ? knowledge
        : [
            {
              title: fileName,
              question: `Que faut-il savoir sur ${fileName} ?`,
              answer: lines.slice(0, 4).join(' ') || 'Contenu a verifier.',
              tags: ['import'],
              links
            }
          ]
  };
}

function findFollowingAnswer(lines: string[], question: string): string | undefined {
  const index = lines.indexOf(question);
  if (index < 0) return undefined;
  return (
    lines
      .slice(index + 1, index + 4)
      .filter((line) => !line.includes('?'))
      .join(' ')
      .slice(0, 500) || undefined
  );
}

function inferTags(text: string): string[] {
  const tags = new Set<string>();
  if (/prix|tarif|devis/i.test(text)) tags.add('tarif');
  if (/reserve|disponible|date/i.test(text)) tags.add('reservation');
  if (/parking|acces|adresse/i.test(text)) tags.add('acces');
  if (/contact|appel|telephone/i.test(text)) tags.add('contact');
  tags.add('import');
  return [...tags];
}

function normalizeImportedKnowledge(value: unknown): ImportedKnowledgeProposal[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (JSON.parse(value) as unknown)
      : [];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      title: safeText(item.title, 'Connaissance importee'),
      question: safeText(item.question, 'Question importee'),
      answer: safeText(item.answer, 'Reponse a completer avant publication.'),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      links: Array.isArray(item.links) ? item.links.map(String) : []
    }));
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : fallback;
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new AppError(message, { statusCode: 404, code: 'NOT_FOUND' });
  return row;
}

function defaultTemplates() {
  return [
    businessTemplate('chambre_hotes', "Chambre d'hotes", 'reservation', 'Voir les disponibilites'),
    businessTemplate('photographe', 'Photographe', 'devis', 'Demander un devis'),
    businessTemplate('decoration', 'Decoration murale', 'lead', 'Parler du projet'),
    businessTemplate('seo', 'SEO', 'appel', 'Planifier un audit'),
    businessTemplate('restaurant', 'Restaurant', 'reservation', 'Reserver une table'),
    businessTemplate('coach', 'Coach', 'appel', 'Demander un appel')
  ];
}

function businessTemplate(
  businessType: TemplateBusinessType,
  name: string,
  goal: string,
  ctaLabel: string
) {
  return {
    id: businessType,
    name,
    businessType,
    goalDescription: `Aider le visiteur a obtenir une information claire puis declencher l'objectif ${goal}.`,
    cta: { label: ctaLabel, url: '' },
    personality: {
      style: 'clair, rassurant, professionnel',
      answerLength: 'medium' as const,
      formality: 'vouvoiement' as const,
      emojiLevel: 'none' as const,
      commercialIntensity: 55,
      reassuranceLevel: 80
    },
    intents: [
      {
        name: 'Tarifs',
        category: 'commerce',
        examples: ['Quels sont vos tarifs ?', 'Combien cela coute ?'],
        synonyms: ['prix', 'devis', 'budget'],
        priority: 80,
        knowledge: [
          {
            title: 'Tarifs',
            question: 'Quels sont vos tarifs ?',
            alternatives: ['Combien cela coute ?', 'Pouvez-vous me donner un prix ?'],
            answer:
              'Les tarifs dependent du besoin. Le plus simple est de preciser votre demande pour recevoir une reponse adaptee.',
            commercialAnswer: ctaLabel,
            tags: ['tarif', 'devis'],
            priority: 80
          }
        ]
      },
      {
        name: 'Disponibilites',
        category: 'conversion',
        examples: ['Etes-vous disponible ?', 'Peut-on reserver ?'],
        synonyms: ['reservation', 'date', 'creneau'],
        priority: 90,
        knowledge: [
          {
            title: 'Disponibilites',
            question: 'Comment verifier les disponibilites ?',
            alternatives: ['Etes-vous disponible ?', 'Peut-on reserver ?'],
            answer:
              "Indiquez la date ou la periode souhaitee, puis l'equipe confirmera les disponibilites.",
            commercialAnswer: ctaLabel,
            tags: ['reservation', 'disponibilite'],
            priority: 90
          }
        ]
      },
      {
        name: 'Contact',
        category: 'support',
        examples: ['Comment vous contacter ?', 'Puis-je etre rappele ?'],
        synonyms: ['contact', 'telephone', 'email'],
        priority: 70,
        knowledge: [
          {
            title: 'Contact',
            question: 'Comment vous contacter ?',
            alternatives: ['Puis-je etre rappele ?', 'Quel est votre contact ?'],
            answer:
              'Laissez vos coordonnees et votre besoin : l’equipe pourra revenir vers vous avec les bonnes informations.',
            commercialAnswer: ctaLabel,
            tags: ['contact', 'lead'],
            priority: 70
          }
        ]
      }
    ]
  };
}

type TemplateBusinessType = (typeof studioBusinessTypes)[number];
