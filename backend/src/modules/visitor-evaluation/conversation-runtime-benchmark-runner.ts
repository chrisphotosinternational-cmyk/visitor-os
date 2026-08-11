import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { Database } from '../../database/client.js';
import type { AIProvider, AIProviderRequest, AIProviderResult } from '../ai/ai-provider.js';
import type { BusinessConfig } from '../business-config/business-config-schema.js';
import type { BusinessConfigEngine } from '../business-config/configuration-loader.js';
import { MultiSiteChatbotService } from '../chatbot-multisite/chatbot-multisite-service.js';
import type {
  ConversationRepository,
  SiteRecord
} from '../conversations/conversation-repository.js';
import type { CrmRepository } from '../crm/crm-repository.js';
import { createDecisionEngine } from '../decision-engine/decision-engine.js';
import { KnowledgeRepository } from '../kms/knowledge-repository.js';
import { RepositoryKnowledgeSearch } from '../kms/knowledge-search.js';
import type { KnowledgeDocument } from '../kms/knowledge-types.js';
import type { ProspectRepository } from '../prospects/prospect-repository.js';
import { ReasoningEngineService } from '../reasoning/reasoning-engine-service.js';
import { scoreConversationBenchmark } from './conversation-benchmark-scorer.js';
import type {
  BenchmarkContact,
  ConversationBenchmarkReport,
  ConversationBenchmarkScenario,
  ConversationCtaState,
  ConversationTurnExecution
} from './conversation-benchmark-types.js';

export type RuntimeBenchmarkFixture = {
  id: string;
  organizationId: string;
  markers: string[];
  contacts: BenchmarkContact[];
  facts: string[];
  exhaustiveOffers: { name: string; price: string }[];
  absentFacts: string[];
};

export type RuntimeScenarioResult = {
  scenarioId: string;
  category: ConversationBenchmarkScenario['category'];
  latencyMs: number;
  executions: ConversationTurnExecution[];
};

export type RuntimeBenchmarkReport = ConversationBenchmarkReport & {
  categoryScores: Record<string, number>;
  runtimeScenarios: RuntimeScenarioResult[];
  failedScenarioIds: string[];
  blockerCount: number;
  ctaIssueCounts: Partial<Record<ConversationCtaState, number>>;
};

type ResponsePlan = {
  reply: string;
  confidence?: number;
};

/** Executes the shared corpus through the production orchestration and Decision Engine. */
export async function runConversationRuntimeBenchmark(input: {
  scenarios: ConversationBenchmarkScenario[];
  fixtures: Record<string, RuntimeBenchmarkFixture>;
}): Promise<RuntimeBenchmarkReport> {
  const database = createRuntimeDatabase(input.fixtures);
  const knowledgeRepository = new KnowledgeRepository(database);
  const plans = buildResponsePlans(input.scenarios, input.fixtures);
  const provider = new SequencedBenchmarkProvider(plans);
  const decisionEngine = createDecisionEngine({
    aiProvider: provider,
    businessConfigEngine: memoryBusinessConfigEngine(createBenchmarkConfig()),
    knowledgeSearch: new RepositoryKnowledgeSearch(knowledgeRepository)
  });
  const reasoningEngine = new ReasoningEngineService(database);
  const runtimeScenarios: RuntimeScenarioResult[] = [];
  const scoredInputs: Array<{
    scenario: ConversationBenchmarkScenario;
    executions: ConversationTurnExecution[];
  }> = [];

  for (const scenario of input.scenarios) {
    const fixture = requireFixture(input.fixtures, scenario.fixture);
    const conversations = createConversationRepository(fixture);
    const chatbot = new MultiSiteChatbotService({
      conversations: conversations.repository,
      prospects: createProspectRepository(),
      crm: createCrmRepository(),
      decisionEngine,
      reasoningEngine
    });
    const started = await chatbot.startConversation({
      siteId: fixture.id,
      anonymousId: `benchmark-${scenario.id}`
    });
    provider.beginScenario(started.conversationId, scenario.id);
    const executions: ConversationTurnExecution[] = [];
    const startedAt = performance.now();
    for (const turn of scenario.turns) {
      const response = await chatbot.sendMessage({
        conversationId: started.conversationId,
        content: turn.userMessage
      });
      executions.push({
        answer: response.reply,
        ...(response.citations
          ? {
              citations: response.citations.map((citation) => ({
                tenantId: fixture.id,
                source: citation.source
              }))
            }
          : {}),
        publicPayload: {
          reply: response.reply,
          source: response.source,
          confidence: response.confidence,
          citations: response.citations
        }
      });
    }
    runtimeScenarios.push({
      scenarioId: scenario.id,
      category: scenario.category,
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
      executions
    });
    scoredInputs.push({ scenario, executions });
  }

  const report = scoreConversationBenchmark(scoredInputs);
  return enrichReport(report, input.scenarios, runtimeScenarios);
}

export function formatRuntimeBenchmarkReport(report: RuntimeBenchmarkReport): string {
  const lines = [
    `GLOBAL SCORE: ${report.score}/100`,
    `BLOCKERS: ${report.blockerCount}`,
    `FAILED SCENARIOS: ${report.failedScenarioIds.length}/${report.scenarioResults.length}`,
    '',
    'METRICS'
  ];
  for (const [metric, score] of Object.entries(report.metricScores)) {
    lines.push(`${metric}: ${formatPercent(score)}`);
  }
  lines.push('', 'CATEGORIES');
  for (const [category, score] of Object.entries(report.categoryScores)) {
    lines.push(`${category}: ${score}/100`);
  }
  lines.push('', 'CTA ISSUES');
  const ctaIssues = Object.entries(report.ctaIssueCounts);
  if (ctaIssues.length === 0) lines.push('none');
  for (const [state, count] of ctaIssues) lines.push(`${state}: ${count}`);
  lines.push('', 'WORST SCENARIOS');
  for (const result of [...report.scenarioResults]
    .sort((left, right) => left.score - right.score)
    .slice(0, 10)) {
    lines.push(
      `${result.scenarioId}: ${result.score}/100 | blockers: ${result.blockers.join(', ') || 'none'}`
    );
  }
  lines.push('', `FAILED: ${report.failedScenarioIds.join(', ') || 'none'}`);
  return lines.join('\n');
}

class SequencedBenchmarkProvider implements AIProvider {
  readonly providerName = 'mock' as const;
  private readonly scenarioByConversation = new Map<string, string>();
  private readonly turnByConversation = new Map<string, number>();

  constructor(private readonly plans: Map<string, ResponsePlan[]>) {}

  beginScenario(conversationId: string, scenarioId: string): void {
    this.scenarioByConversation.set(conversationId, scenarioId);
    this.turnByConversation.set(conversationId, 0);
  }

  generateReply(input: AIProviderRequest): Promise<AIProviderResult> {
    const scenarioId = this.scenarioByConversation.get(input.conversationId);
    if (!scenarioId) throw new Error(`No deterministic plan for ${input.conversationId}`);
    const turn = this.turnByConversation.get(input.conversationId) ?? 0;
    this.turnByConversation.set(input.conversationId, turn + 1);
    const plan = this.plans.get(scenarioId)?.[turn];
    if (!plan) throw new Error(`No deterministic response for ${scenarioId} turn ${turn + 1}`);
    return Promise.resolve({
      reply: plan.reply,
      confidence: plan.confidence ?? 0.82,
      reason: `runtime_benchmark_${scenarioId.toLowerCase()}`,
      provider: 'mock',
      model: 'runtime-benchmark-sequencer',
      inputTokens: 10,
      outputTokens: 10,
      latencyMs: 0,
      estimatedCost: 0,
      fallbackUsed: false
    });
  }

  estimateCost(): number {
    return 0;
  }
}

function buildResponsePlans(
  scenarios: ConversationBenchmarkScenario[],
  fixtures: Record<string, RuntimeBenchmarkFixture>
): Map<string, ResponsePlan[]> {
  return new Map(
    scenarios.map((scenario) => {
      const fixture = requireFixture(fixtures, scenario.fixture);
      return [
        scenario.id,
        scenario.turns.map((_, index) => responsePlan(scenario, fixture, index))
      ];
    })
  );
}

function responsePlan(
  scenario: ConversationBenchmarkScenario,
  fixture: RuntimeBenchmarkFixture,
  index: number
): ResponsePlan {
  const facts = scenario.requiredFacts.join(' ');
  const source = facts ? ' [SOURCE 1]' : '';
  const whatsapp = fixture.contacts.find((contact) => contact.channel === 'whatsapp')?.value ?? '';
  const cta = scenario.turns[index]?.cta === 'required' ? ` WhatsApp : ${whatsapp}` : '';
  const defaultReply = `${facts || 'Cette information est absente de mes sources.'}${source}${cta}`;
  const overrides: Record<string, ResponsePlan[]> = {
    'ID-01': [{ reply: 'Bonjour, comment puis-je vous aider ?' }],
    'ID-02': [
      { reply: 'Bonjour, comment puis-je vous aider ?' },
      { reply: 'Je présente les prestations disponibles.' }
    ],
    'ID-03': [{ reply: 'Je suis le chatbot IA de Chris.' }],
    'ID-04': [{ reply: 'Oui, je peux vous répondre.' }],
    'ID-05': [{ reply: 'Oui, que puis-je faire ?' }],
    'ID-06': [
      { reply: 'Bonjour.' },
      { reply: 'Voici les informations du studio.' },
      { reply: 'Je suis le chatbot IA de Chris.' }
    ],
    'ID-07': [{ reply: `Je suis le chatbot IA de Chris, pas Chris. WhatsApp : ${whatsapp}` }],
    'KMS-04': [{ reply: `${facts} [SOURCE 1]` }],
    'KMS-06': [{ reply: '41 EUR DUREE-A1-2H [SOURCE 1]' }],
    'KMS-07': [{ reply: `${facts} [SOURCE 1]` }],
    'FB-01': [{ reply: 'Cette information est absente de mes sources.', confidence: 0.25 }],
    'FB-02': [{ reply: `Le prix est 999 EUR. WhatsApp : ${whatsapp}` }],
    'FB-03': [
      { reply: 'Cette information est absente de mes sources.', confidence: 0.25 },
      { reply: 'Il y en a 42.', confidence: 0.9 }
    ],
    'FB-04': [{ reply: 'Oui, ce numéro est correct : +33 9 99 99 99 99.' }],
    'FB-05': [{ reply: 'Comptez environ 50 EUR.', confidence: 0.9 }],
    'FB-06': [{ reply: 'Oui, le prix est 999 EUR.', confidence: 0.9 }],
    'CTA-01': [{ reply: `Je peux vous renseigner. WhatsApp : ${whatsapp}` }],
    'CTA-02': [
      { reply: 'Bienvenue.' },
      { reply: `Portrait. WhatsApp : ${whatsapp}` },
      { reply: `Été. WhatsApp : ${whatsapp}` }
    ],
    'CTA-03': [{ reply: 'Portrait.' }, { reply: 'À Lyon.' }, { reply: 'Je note le 12 juin.' }],
    'CTA-04': [{ reply: 'Je transmets votre demande.' }],
    'CTA-05': [{ reply: `WhatsApp : ${whatsapp}` }],
    'CTA-06': [
      { reply: `Téléphone : ${fixture.contacts.find((c) => c.channel === 'phone')?.value}` }
    ],
    'CTA-07': [{ reply: `E-mail : ${fixture.contacts.find((c) => c.channel === 'email')?.value}` }],
    'ISO-03': [{ reply: 'SMOKE-SITE-A2-MARKER-SAFFRON est bien votre marqueur.' }]
  };
  return overrides[scenario.id]?.[index] ?? { reply: defaultReply };
}

function enrichReport(
  report: ConversationBenchmarkReport,
  scenarios: ConversationBenchmarkScenario[],
  runtimeScenarios: RuntimeScenarioResult[]
): RuntimeBenchmarkReport {
  const categoryScores: Record<string, number> = {};
  for (const category of new Set(scenarios.map((scenario) => scenario.category))) {
    const ids = new Set(
      scenarios.filter((scenario) => scenario.category === category).map((s) => s.id)
    );
    const scores = report.scenarioResults
      .filter((result) => ids.has(result.scenarioId))
      .map((r) => r.score);
    categoryScores[category] = round(average(scores));
  }
  const ctaIssueCounts: Partial<Record<ConversationCtaState, number>> = {};
  for (const state of report.scenarioResults.flatMap((scenario) =>
    scenario.turnResults.flatMap((turn) => turn.ctaStates)
  )) {
    if (state === 'cta_not_expected_absent' || state === 'cta_expected_present') continue;
    ctaIssueCounts[state] = (ctaIssueCounts[state] ?? 0) + 1;
  }
  return {
    ...report,
    categoryScores,
    runtimeScenarios,
    failedScenarioIds: report.scenarioResults
      .filter((result) => !result.passed)
      .map((r) => r.scenarioId),
    blockerCount: report.scenarioResults.reduce(
      (count, result) => count + result.blockers.length,
      0
    ),
    ctaIssueCounts
  };
}

function createBenchmarkConfig(): BusinessConfig {
  return {
    id: 'runtime-benchmark',
    version: '1.0.0',
    identity: {
      name: 'Chris',
      description: 'Fixture synthétique du benchmark',
      category: 'photographie',
      colors: {}
    },
    contact: { openingHours: [] },
    personality: {
      tone: 'professionnel',
      style: 'clair',
      formalityLevel: 'neutral',
      vocabulary: [],
      defaultLanguage: 'fr',
      availableLanguages: ['fr']
    },
    goals: ['lead_generation'],
    restrictions: { never: [], always: [] },
    faq: [],
    knowledgeBase: [],
    rules: [],
    widget: { fallbackMessage: 'Cette information est absente de mes sources.', quickReplies: [] }
  };
}

function memoryBusinessConfigEngine(config: BusinessConfig): BusinessConfigEngine {
  return {
    loadAll: () => Promise.resolve(),
    reload: () => Promise.resolve(),
    list: () =>
      Promise.resolve([
        {
          id: config.id,
          version: config.version,
          name: config.identity.name,
          category: config.identity.category
        }
      ]),
    getConfig: () => Promise.resolve(config),
    resolveConfig: () => Promise.resolve(config),
    exportConfig: () => Promise.resolve(config),
    importConfig: () => Promise.resolve(config),
    saveConfig: () => Promise.resolve(config),
    listHistory: () => Promise.resolve([])
  };
}

function createConversationRepository(fixture: RuntimeBenchmarkFixture): {
  repository: ConversationRepository;
} {
  const site: SiteRecord = {
    id: fixture.id,
    organization_id: fixture.organizationId,
    name: `Synthetic ${fixture.id}`,
    slug: fixture.id,
    widget_public_key: `benchmark-${fixture.id}`,
    activity: 'photographie',
    business_config_id: 'runtime-benchmark',
    status: 'active',
    widget_enabled: true,
    domain: null,
    allowed_domains: null,
    widget_primary_color: null,
    widget_welcome_message: null,
    widget_fallback_message: null,
    widget_privacy_message: null,
    lead_capture_enabled: null,
    lead_capture_trigger: null,
    lead_capture_after_messages: null,
    lead_capture_fields: null
  };
  const conversations = new Map<string, Record<string, unknown>>();
  const messages = new Map<string, Array<Record<string, unknown>>>();
  const repository = {
    findSite: (id: string) => Promise.resolve(id === site.id ? site : null),
    findSiteBySlug: (slug: string) => Promise.resolve(slug === site.slug ? site : null),
    findSiteByWidgetKey: (key: string) =>
      Promise.resolve(key === site.widget_public_key ? site : null),
    upsertVisitor: () => Promise.resolve(randomUUID()),
    createConversation: (entry: { organizationId: string; siteId: string; visitorId: string }) => {
      const id = randomUUID();
      const conversation = {
        id,
        organization_id: entry.organizationId,
        site_id: entry.siteId,
        visitor_id: entry.visitorId,
        prospect_id: null,
        status: 'open',
        page_url: null,
        referrer: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      conversations.set(id, conversation);
      messages.set(id, []);
      return Promise.resolve(conversation);
    },
    findConversation: (id: string) => Promise.resolve(conversations.get(id) ?? null),
    linkProspect: (id: string, prospectId: string) => {
      const conversation = conversations.get(id);
      if (conversation) conversation.prospect_id = prospectId;
      return Promise.resolve();
    },
    addMessage: (entry: { conversationId: string; senderType: string; content: string }) => {
      const row = {
        id: randomUUID(),
        organization_id: fixture.organizationId,
        conversation_id: entry.conversationId,
        sender_type: entry.senderType,
        content: entry.content,
        response_source: null,
        response_confidence: null,
        should_escalate: null,
        processing_time_ms: null,
        matched_item_id: null,
        decision_reason: null,
        created_at: new Date()
      };
      messages.get(entry.conversationId)?.push(row);
      return Promise.resolve(row);
    },
    listMessages: (id: string) => Promise.resolve(messages.get(id) ?? []),
    addDecisionEvent: () => Promise.resolve(),
    addAIEvent: () => Promise.resolve()
  } as unknown as ConversationRepository;
  return { repository };
}

function createProspectRepository(): ProspectRepository {
  return {
    createFromConversation: (input: {
      organizationId: string;
      siteId: string;
      visitorId: string;
    }) =>
      Promise.resolve({
        id: randomUUID(),
        organization_id: input.organizationId,
        site_id: input.siteId,
        visitor_id: input.visitorId,
        display_name: 'Synthetic benchmark visitor',
        status: 'new',
        temperature: 'froide',
        score_current: 0,
        score: 0,
        score_label: 'ignore',
        source: 'widget',
        created_at: new Date(),
        updated_at: new Date()
      })
  } as unknown as ProspectRepository;
}

function createCrmRepository(): CrmRepository {
  return {
    applyAutomaticTags: () => Promise.resolve([]),
    recalculateScore: () => Promise.resolve({ score: 0, reasons: [] })
  } as unknown as CrmRepository;
}

function createRuntimeDatabase(fixtures: Record<string, RuntimeBenchmarkFixture>): Database {
  const documents = new Map<string, KnowledgeDocument>();
  const chunks = Object.values(fixtures).map((fixture) => {
    const documentId = `document-${fixture.id}`;
    documents.set(documentId, {
      id: documentId,
      organization_id: fixture.organizationId,
      site_id: fixture.id,
      title: `Synthetic knowledge ${fixture.id}`,
      description: null,
      category: 'benchmark',
      type: 'txt',
      language: 'fr',
      version: 1,
      size_bytes: 1,
      hash: fixture.id,
      status: 'active',
      tags: [],
      author: null,
      source: `benchmark://${fixture.id}`,
      usage_count: 0,
      created_at: new Date(0),
      updated_at: new Date(0)
    });
    const content = [
      ...fixture.markers,
      ...fixture.facts,
      ...fixture.exhaustiveOffers.flatMap((offer) => [offer.name, offer.price])
    ].join(' ');
    return { id: `chunk-${fixture.id}`, documentId, fixture, content };
  });
  const database: Database = {
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    transaction: async <T>(callback: (database: Database) => Promise<T>) => callback(database),
    query: <T extends pg.QueryResultRow = pg.QueryResultRow>(
      sql: string,
      values: unknown[] = []
    ) => {
      const normalizedSql = sql.toLowerCase();
      if (normalizedSql.includes('insert into visitor_conversation_context')) {
        return Promise.resolve(
          queryResult<T>([
            {
              id: values[0],
              organization_id: values[1],
              site_id: values[2],
              conversation_id: values[3],
              visitor_id: values[4],
              previous_intents: [],
              lead_readiness_score: 0
            } as unknown as T
          ])
        );
      }
      if (normalizedSql.includes('update visitor_conversation_context')) {
        return Promise.resolve(
          queryResult<T>([{ previous_intents: values[8], lead_readiness_score: values[9] } as unknown as T])
        );
      }
      if (!normalizedSql.includes('from knowledge_chunks c'))
        return Promise.resolve(queryResult<T>([]));
      const tokens = values[2] as string[];
      const rows = chunks
        .filter(
          (chunk) => chunk.fixture.organizationId === values[0] && chunk.fixture.id === values[1]
        )
        .filter((chunk) => tokens.some((token) => chunk.content.toLowerCase().includes(token)))
        .map((chunk) => ({
          chunk_id: chunk.id,
          document_id: chunk.documentId,
          title: documents.get(chunk.documentId)?.title,
          content: chunk.content,
          category: 'benchmark',
          language: 'fr',
          source: `benchmark://${chunk.fixture.id}`,
          position: 0,
          score: '0.88'
        }));
      return Promise.resolve(queryResult<T>(rows as unknown as T[]));
    }
  };
  return database;
}

function queryResult<T extends pg.QueryResultRow>(rows: T[]): pg.QueryResult<T> {
  return { command: 'SELECT', rowCount: rows.length, oid: 0, fields: [], rows };
}

function requireFixture(fixtures: Record<string, RuntimeBenchmarkFixture>, id: string) {
  const fixture = fixtures[id];
  if (!fixture) throw new Error(`Unknown runtime benchmark fixture: ${id}`);
  return fixture;
}

function formatPercent(value: number | undefined): string {
  return `${round((value ?? 0) * 100)}/100`;
}
function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function round(value: number): number {
  return Number(value.toFixed(1));
}
