import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { AppConfig } from '../../core/config/env.js';
import type { Database } from '../../database/client.js';
import {
  OrganizationRepository,
  organizationStatuses
} from '../organizations/organization-repository.js';
import { UserRepository, type UserRecord } from '../users/user-repository.js';
import { userRoles, userStatuses, type UserRole } from '../users/user-model.js';
import {
  ProspectRepository,
  prospectStatuses,
  type ProspectRecord,
  type ProspectInput
} from '../prospects/prospect-repository.js';
import {
  ContactHistoryRepository,
  contactChannels,
  contactOutcomes,
  type ContactHistoryInput
} from '../contact-history/contact-history-repository.js';
import {
  MessageTemplateRepository,
  messageTemplateChannels,
  messageTemplatePurposes,
  type MessageTemplateInput
} from '../message-templates/message-template-repository.js';
import { AIQualificationService } from '../ai-qualification/ai-qualification-service.js';
import {
  PublicEnrichmentService,
  enrichmentSourceTypes,
  enrichmentStatuses,
  type EnrichmentListFilters
} from '../public-enrichment/public-enrichment-service.js';
import {
  SalesPipelineService,
  pipelineStages,
  type ForecastConfig,
  type PipelineFilters
} from '../sales-pipeline/sales-pipeline-service.js';
import { hashPassword } from '../auth/password.js';
import { authenticateJwt } from '../auth/jwt-auth-routes.js';
import { hasPermission } from '../auth/rbac.js';
import type { AppCache } from '../../core/cache/app-cache.js';
import type { InMemoryJobQueue } from '../../core/jobs/in-memory-job-queue.js';
import {
  defaultRuntimeSettings,
  featureFlagKeys,
  SettingsService,
  type FeatureFlagKey,
  type RuntimeSettingsUpdate
} from '../settings/settings-service.js';
import { ProductionValidationService } from '../production-validation/production-validation-service.js';
import { AIChatService } from '../ai-chat/ai-chat-service.js';
import {
  ChatbotProductionService,
  leadCaptureTriggers
} from '../chatbot-production/chatbot-production-service.js';
import {
  flowActionTypes,
  flowStepTypes,
  KnowledgeEngineService,
  knowledgeItemStatuses
} from '../knowledge-engine/knowledge-engine-service.js';
import {
  ChatbotStudioService,
  studioBusinessTypes,
  studioGoals
} from '../chatbot-studio/chatbot-studio-service.js';
import { ReasoningEngineService } from '../reasoning/reasoning-engine-service.js';
import { ConversationRepository } from '../conversations/conversation-repository.js';
import {
  assertReviewStatus,
  ChatbotRuntimeCache,
  ChatbotRuntimeService
} from '../chatbot-runtime/chatbot-runtime-service.js';

const organizationPayloadSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().min(2).default('FR'),
  language: z.string().min(2).default('fr'),
  timezone: z.string().min(1).default('Europe/Paris'),
  currency: z.string().min(3).default('EUR'),
  status: z.enum(organizationStatuses).default('active'),
  plan: z.string().optional()
});

const userPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12).optional(),
  role: z.enum(userRoles),
  status: z.enum(userStatuses).default('active')
});

const listQuerySchema = z.object({
  search: z.string().optional()
});

const scoreLabels = ['very_high', 'high', 'medium', 'low', 'ignore'] as const;
const platformFilters = [
  'instagram',
  'twitter_x',
  'mym',
  'onlyfans',
  'website',
  'linktree',
  'allmylinks'
] as const;

const prospectPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  pseudo: z.string().optional(),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  instagram: z.string().optional(),
  twitterX: z.string().optional(),
  mym: z.string().optional(),
  onlyfans: z.string().optional(),
  linktree: z.string().optional(),
  allmylinks: z.string().optional(),
  city: z.string().optional(),
  activity: z.string().optional(),
  description: z.string().optional(),
  sourceUrl: z.string().optional(),
  status: z.enum(prospectStatuses).default('new'),
  notes: z.string().optional()
});

const prospectListQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  status: z.enum(prospectStatuses).optional(),
  city: z.string().optional(),
  scoreLabel: z.enum(scoreLabels).optional(),
  platform: z.enum(platformFilters).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25)
});

const csvImportSchema = z.object({
  organizationId: z.string().uuid().optional(),
  csv: z.string().min(1)
});

const contactHistoryPayloadSchema = z.object({
  contactDate: z.coerce.date().optional(),
  channel: z.enum(contactChannels),
  messageUsed: z.string().optional(),
  response: z.string().optional(),
  outcome: z.enum(contactOutcomes),
  nextAction: z.string().optional(),
  followUpDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional()
});

const followUpQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  upcoming: z.coerce.boolean().optional(),
  city: z.string().optional(),
  scoreLabel: z.enum(scoreLabels).optional(),
  status: z.enum(prospectStatuses).optional()
});

const messageTemplatePayloadSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  channel: z.enum(messageTemplateChannels),
  purpose: z.enum(messageTemplatePurposes),
  content: z.string().min(1),
  isActive: z.boolean().default(true)
});

const messageTemplateListQuerySchema = z.object({
  organizationId: z.string().uuid().optional()
});

const renderTemplatePayloadSchema = z.object({
  prospectId: z.string().uuid().optional(),
  variables: z.record(z.string(), z.string()).default({}),
  recordCopy: z.boolean().default(false)
});

const renderProspectMessageSchema = z.object({
  templateId: z.string().uuid(),
  recordCopy: z.boolean().default(false)
});

const saveRenderedMessageSchema = z.object({
  templateId: z.string().uuid(),
  rendered: z.string().min(1),
  channel: z.enum(contactChannels),
  outcome: z.enum(contactOutcomes),
  followUpDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional()
});

const analyzeBatchSchema = z.object({
  organizationId: z.string().uuid().optional(),
  prospectIds: z.array(z.string().uuid()).optional(),
  all: z.boolean().default(false)
});

const enrichmentListQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  status: z.enum(enrichmentStatuses).optional(),
  sourceType: z.enum(enrichmentSourceTypes).optional(),
  city: z.string().optional(),
  platform: z.string().optional(),
  confidenceMin: z.coerce.number().int().min(0).max(100).optional()
});

const enrichmentBatchSchema = z.object({
  organizationId: z.string().uuid().optional(),
  prospectIds: z.array(z.string().uuid()).optional(),
  mode: z.enum(['not_enriched', 'high_score', 'url_missing_data', 'all']).default('not_enriched')
});

const pipelineQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  city: z.string().optional(),
  scoreLabel: z.enum(scoreLabels).optional(),
  source: z.string().optional(),
  platform: z.enum(platformFilters).optional(),
  userId: z.string().uuid().optional(),
  sort: z.enum(['score', 'follow_up', 'created_at']).default('score')
});

const pipelineStageSchema = z.object({
  stage: z.enum(pipelineStages)
});

const forecastQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  averageDealValue: z.coerce.number().nonnegative().optional(),
  lowConversionRate: z.coerce.number().min(0).max(100).optional(),
  mediumConversionRate: z.coerce.number().min(0).max(100).optional(),
  highConversionRate: z.coerce.number().min(0).max(100).optional()
});

const activityQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  prospectId: z.string().uuid().optional(),
  actionType: z.string().optional(),
  userId: z.string().uuid().optional()
});

const featureFlagsPayloadSchema = z.object(
  Object.fromEntries(featureFlagKeys.map((key) => [key, z.boolean().optional()])) as Record<
    FeatureFlagKey,
    z.ZodOptional<z.ZodBoolean>
  >
);

const runtimeSettingsPayloadSchema: z.ZodType<RuntimeSettingsUpdate> = z
  .object({
    scoring: z
      .object({
        email: z.number().optional(),
        phone: z.number().optional(),
        city: z.number().optional(),
        social: z.number().optional(),
        premiumPlatform: z.number().optional(),
        portfolio: z.number().optional(),
        description: z.number().optional(),
        noContactPenalty: z.number().optional(),
        duplicatePenalty: z.number().optional()
      })
      .optional(),
    pipeline: z
      .object({
        staleDays: z.number().int().positive().optional()
      })
      .optional(),
    forecast: z
      .object({
        averageDealValue: z.number().nonnegative().optional(),
        lowConversionRate: z.number().min(0).max(100).optional(),
        mediumConversionRate: z.number().min(0).max(100).optional(),
        highConversionRate: z.number().min(0).max(100).optional()
      })
      .optional(),
    timeouts: z
      .object({
        enrichmentMs: z.number().int().positive().optional(),
        notificationMs: z.number().int().positive().optional()
      })
      .optional(),
    rateLimits: z
      .object({
        windowMs: z.number().int().positive().optional(),
        maxRequests: z.number().int().positive().optional()
      })
      .optional(),
    batch: z
      .object({
        size: z.number().int().positive().optional()
      })
      .optional(),
    cache: z
      .object({
        ttlMs: z.number().int().nonnegative().optional()
      })
      .optional()
  })
  .partial();

const importIntelligencePayloadSchema = z.object({
  csv: z.string().min(1)
});

const optionalOrganizationQuerySchema = z.object({
  organizationId: z.string().uuid().optional()
});

const siteWidgetSettingsPayloadSchema = z.object({
  allowedDomains: z.array(z.string().min(1)).default([]),
  primaryColor: z.string().min(1).default('#1f6f5b'),
  welcomeMessage: z.string().min(1).default('Bonjour, je peux vous aider.'),
  fallbackMessage: z
    .string()
    .min(1)
    .default("Je n'ai pas encore cette information. Contactez-nous pour une reponse precise."),
  privacyMessage: z
    .string()
    .min(1)
    .default('Vos informations sont utilisees uniquement pour repondre a votre demande.'),
  leadCaptureEnabled: z.boolean().default(false),
  leadCaptureTrigger: z.enum(leadCaptureTriggers).default('after_messages'),
  leadCaptureAfterMessages: z.number().int().positive().max(20).default(3),
  leadCaptureFields: z
    .array(z.enum(['name', 'email', 'phone', 'need']))
    .default(['name', 'email', 'phone', 'need']),
  widgetEnabled: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

const unansweredQuerySchema = z.object({
  status: z.enum(['pending', 'ignored', 'converted']).default('pending')
});

const reviewQueueQuerySchema = z.object({
  status: z.enum(['pending', 'ignored', 'fixed']).default('pending')
});

const reviewResolvePayloadSchema = z.object({
  status: z.enum(['ignored', 'fixed']),
  adminNote: z.string().max(1000).optional()
});

const qaImportPayloadSchema = z.object({
  csv: z.string().min(1)
});

const unansweredConvertPayloadSchema = z.object({
  answer: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).default([])
});

const chatSessionPayloadSchema = z.object({
  organizationId: z.string().uuid().optional(),
  title: z.string().min(1).max(120).optional()
});

const chatMessagePayloadSchema = z.object({
  content: z.string().min(1).max(1500)
});

const chatbotSearchQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  intentId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional()
});

const intentPayloadSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().default('general'),
  examples: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().default(true)
});

const partialIntentPayloadSchema = intentPayloadSchema.partial();

const knowledgePayloadSchema = z.object({
  intentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  mainQuestion: z.string().min(1),
  alternativeQuestions: z.array(z.string()).default([]),
  shortAnswer: z.string().min(1),
  detailedAnswer: z.string().optional(),
  commercialAnswer: z.string().optional(),
  reassuranceAnswer: z.string().optional(),
  links: z.array(z.string()).default([]),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  conditions: z.string().optional(),
  tags: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  status: z.enum(knowledgeItemStatuses).default('draft')
});

const partialKnowledgePayloadSchema = knowledgePayloadSchema.partial();

const suggestionAcceptPayloadSchema = z.object({
  intentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  mainQuestion: z.string().min(1).optional(),
  alternativeQuestions: z.array(z.string()).optional(),
  shortAnswer: z.string().min(1).optional(),
  detailedAnswer: z.string().optional(),
  commercialAnswer: z.string().optional(),
  reassuranceAnswer: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'needs_review']).default('draft')
});

const flowPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerIntentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true)
});

const partialFlowPayloadSchema = flowPayloadSchema.partial();

const flowStepPayloadSchema = z.object({
  stepOrder: z.number().int().min(1),
  stepType: z.enum(flowStepTypes),
  content: z.string().min(1),
  conditions: z.string().optional(),
  nextStepId: z.string().uuid().nullable().optional(),
  actionType: z.enum(flowActionTypes).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

const partialFlowStepPayloadSchema = flowStepPayloadSchema.partial();

const personalityPayloadSchema = z.object({
  tone: z.string().min(1),
  style: z.string().optional(),
  answerLength: z.enum(['short', 'medium', 'detailed']),
  formality: z.enum(['tutoiement', 'vouvoiement']),
  emojiLevel: z.enum(['none', 'low', 'medium']),
  commercialIntensity: z.number().int().min(0).max(100),
  reassuranceLevel: z.number().int().min(0).max(100)
});

const goalPayloadSchema = z.object({
  goalType: z.string().min(1),
  description: z.string().min(1),
  priority: z.number().int().min(0).max(100).default(50),
  successAction: z.string().optional(),
  isActive: z.boolean().default(true)
});

const partialGoalPayloadSchema = goalPayloadSchema.partial();

const studioWizardPayloadSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1),
  domain: z.string().min(1),
  businessType: z.enum(studioBusinessTypes),
  primaryGoal: z.enum(studioGoals),
  tone: z.string().min(1).default('professionnel'),
  templateId: z.string().optional()
});

const studioImportPayloadSchema = z.object({
  organizationId: z.string().uuid().optional(),
  fileName: z.string().min(1),
  fileType: z.enum(['pdf', 'docx', 'markdown', 'txt', 'html']),
  content: z.string().min(1)
});

const studioSimulationPayloadSchema = z.object({
  organizationId: z.string().uuid().optional(),
  message: z.string().min(1).max(1500)
});

const studioRollbackPayloadSchema = z.object({
  organizationId: z.string().uuid().optional(),
  versionNumber: z.number().int().positive()
});

const reasoningTestPayloadSchema = z.object({
  organizationId: z.string().uuid().optional(),
  message: z.string().min(1).max(1500)
});

const reasoningReplayPayloadSchema = z.object({
  message: z.string().min(1).max(1500).optional()
});

export function registerAdminManagementRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
  dependencies?: {
    cache?: AppCache;
    queue?: InMemoryJobQueue;
    readiness?: {
      database: 'disabled' | 'pending' | 'ok' | 'error';
    };
    startedAt?: Date;
  }
): void {
  const organizations = new OrganizationRepository(database);
  const users = new UserRepository(database);
  const prospects = new ProspectRepository(database);
  const contactHistory = new ContactHistoryRepository(database);
  const messageTemplates = new MessageTemplateRepository(database);
  const aiQualification = new AIQualificationService(database);
  const enrichments = new PublicEnrichmentService(database);
  const pipeline = new SalesPipelineService(database);
  const settings = new SettingsService(database);
  const aiChat = new AIChatService(database);
  const chatbotProduction = new ChatbotProductionService(database);
  const knowledgeEngine = new KnowledgeEngineService(database);
  const chatbotStudio = new ChatbotStudioService(database, knowledgeEngine);
  const reasoningEngine = new ReasoningEngineService(database, knowledgeEngine);
  const conversations = new ConversationRepository(database);
  const chatbotRuntime = new ChatbotRuntimeService(database);
  const chatbotRuntimeCache = new ChatbotRuntimeCache(30_000);
  const cache = dependencies?.cache;
  const queue = dependencies?.queue;
  const productionValidation = new ProductionValidationService({
    database,
    config,
    ...(cache ? { cache } : {}),
    ...(queue ? { queue } : {}),
    ...(dependencies?.readiness ? { readiness: dependencies.readiness } : {}),
    ...(dependencies?.startedAt ? { startedAt: dependencies.startedAt } : {})
  });

  app.addHook('onResponse', (request, reply, done) => {
    if (
      request.url.startsWith('/admin-api') &&
      request.method !== 'GET' &&
      reply.statusCode < 400
    ) {
      cache?.invalidateTags(['dashboard', 'pipeline', 'forecast', 'ai-analysis', 'statistics']);
    }
    done();
  });

  app.get('/admin-api/dashboard', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:read');
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;

    return cached(
      cache,
      cacheKey('dashboard', organizationId),
      ['dashboard', 'statistics'],
      async () => {
        const featureFlags = await settings.featureFlags(organizationId);
        const runtimeSettings = await settings.runtimeSettings(organizationId);

        return {
          organizationsCount:
            context.user.role === 'SuperAdmin'
              ? await organizations.count()
              : context.user.organization_id
                ? 1
                : 0,
          usersCount: await users.count(organizationId),
          prospects: await prospects.metrics(organizationId),
          contactHistory: await contactHistory.metrics(organizationId),
          messageTemplates: await messageTemplates.metrics(organizationId),
          aiQualification: featureFlags.ai ? await aiQualification.metrics(organizationId) : null,
          enrichments: featureFlags.enrichment ? await enrichments.metrics(organizationId) : null,
          pipeline: await pipeline.metrics(organizationId),
          forecast: featureFlags.forecast ? await pipeline.forecast(organizationId) : null,
          activity: await pipeline.activity(toActivityFilters({ organizationId })),
          featureFlags,
          settings: runtimeSettings,
          role: context.user.role,
          organizationId: context.user.organization_id
        };
      }
    );
  });

  app.get('/admin-api/onboarding/status', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:read');

    return { onboarding: await productionValidation.firstStartStatus() };
  });

  app.post('/admin-api/demo-project', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');

    return { demo: await productionValidation.createDemoProject() };
  });

  app.get('/admin-api/diagnostics', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'settings:access');

    return { diagnostics: await productionValidation.diagnostics() };
  });

  app.get('/admin-api/about', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'settings:access');

    return { about: productionValidation.about() };
  });

  app.post('/admin-api/import/intelligence', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const body = importIntelligencePayloadSchema.parse(request.body);

    return { intelligence: productionValidation.importIntelligence(body.csv) };
  });

  app.get('/admin-api/data-cleanup/preview', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return { cleanup: await productionValidation.cleanupPreview(organizationId) };
  });

  app.post('/admin-api/data-cleanup/apply', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return { cleanup: await productionValidation.applyCleanup(organizationId) };
  });

  app.get('/admin-api/quality-report', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return { quality: await productionValidation.qualityReport(organizationId) };
  });

  app.get('/admin-api/backup/full', async (request, reply) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'data:export');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireFeature(settings, 'exports', organizationId);
    const backup = await productionValidation.fullBackup(organizationId);

    reply.type('application/zip');
    reply.header('Content-Disposition', `attachment; filename="${backup.filename}"`);

    return backup.content;
  });

  app.post('/chat/sessions', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const body = chatSessionPayloadSchema.parse(request.body ?? {});
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);

    return {
      session: await aiChat.createSession({
        organizationId,
        userId: context.user.id,
        ...(body.title ? { title: body.title } : {})
      })
    };
  });

  app.get('/chat/sessions', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return { sessions: await aiChat.listSessions(organizationId) };
  });

  app.get('/chat/sessions/:sessionId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    const session = await aiChat.getSession(params.sessionId, organizationId);

    if (!session) throw notFound('Chat session not found', 'CHAT_SESSION_NOT_FOUND');

    return session;
  });

  app.post('/chat/sessions/:sessionId/messages', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ sessionId: z.string().uuid() }).parse(request.params);
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    const body = chatMessagePayloadSchema.parse(request.body);
    const answer = await aiChat.sendMessage({
      sessionId: params.sessionId,
      organizationId,
      userId: context.user.id,
      content: body.content
    });

    if (!answer) throw notFound('Chat session not found', 'CHAT_SESSION_NOT_FOUND');

    return answer;
  });

  app.get('/admin-api/feature-flags', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'settings:access');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return { featureFlags: await settings.featureFlags(organizationId) };
  });

  app.patch('/admin-api/feature-flags', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'settings:access');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);
    const body = featureFlagsPayloadSchema.parse(request.body);

    return { featureFlags: await settings.updateFeatureFlags(organizationId, body) };
  });

  app.get('/admin-api/settings', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'settings:access');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return {
      settings: await settings.runtimeSettings(organizationId),
      defaults: defaultRuntimeSettings
    };
  });

  app.patch('/admin-api/settings', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'settings:access');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);
    const body = runtimeSettingsPayloadSchema.parse(request.body);

    return { settings: await settings.updateRuntimeSettings(organizationId, body) };
  });

  app.get('/admin-api/pipeline', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = pipelineQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return await pipeline.list(toPipelineFilters(organizationId, query));
  });

  app.get('/admin-api/pipeline/metrics', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = pipelineQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return {
      metrics: await cached(
        cache,
        cacheKey('pipeline-metrics', organizationId),
        ['pipeline', 'statistics'],
        () => pipeline.metrics(organizationId)
      )
    };
  });

  app.get('/admin-api/pipeline/forecast', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = forecastQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);
    await requireFeature(settings, 'forecast', organizationId);

    return {
      forecast: await cached(
        cache,
        cacheKey('pipeline-forecast', organizationId, JSON.stringify(toForecastConfig(query))),
        ['forecast', 'pipeline'],
        () => pipeline.forecast(organizationId, toForecastConfig(query))
      )
    };
  });

  app.get('/admin-api/pipeline/activity', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = activityQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return {
      activity: await pipeline.activity(
        toActivityFilters({
          organizationId,
          prospectId: query.prospectId,
          actionType: query.actionType,
          userId: query.userId
        })
      )
    };
  });

  app.get('/admin-api/organizations', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:read');
    const query = listQuerySchema.parse(request.query);

    return {
      organizations:
        context.user.role === 'SuperAdmin'
          ? await organizations.list(query.search)
          : optional(await organizations.find(context.user.organization_id)),
      statuses: organizationStatuses
    };
  });

  app.post('/admin-api/organizations', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const body = organizationPayloadSchema.parse(request.body);
    const organization = await organizations.create(toOrganizationInput(body));

    return { organization, statuses: organizationStatuses };
  });

  app.put('/admin-api/organizations/:organizationId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = organizationPayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, params.organizationId);
    const organization = await organizations.update(
      params.organizationId,
      toOrganizationInput(body)
    );

    if (!organization) throw notFound('Organization not found', 'ORGANIZATION_NOT_FOUND');

    return { organization };
  });

  app.patch('/admin-api/organizations/:organizationId/status', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(organizationStatuses) }).parse(request.body);
    requireOrganizationAccess(context.user, params.organizationId);
    const organization = await organizations.updateStatus(params.organizationId, body.status);

    if (!organization) throw notFound('Organization not found', 'ORGANIZATION_NOT_FOUND');

    return { organization };
  });

  app.delete('/admin-api/organizations/:organizationId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    requireOrganizationAccess(context.user, params.organizationId);

    return { deleted: await organizations.delete(params.organizationId) };
  });

  app.get('/admin-api/users', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:read');
    const query = listQuerySchema.parse(request.query);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;

    return {
      users: (await users.list(toUserListInput(organizationId, query.search))).map(toPublicUser),
      roles: userRoles,
      statuses: userStatuses
    };
  });

  app.post('/admin-api/users', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:write');
    const body = userPayloadSchema.required({ password: true }).parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const user = await users.create({
      organizationId: body.organizationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: resolveAssignableRole(context.user, body.role),
      status: body.status
    });

    return { user: toPublicUser(user), roles: userRoles, statuses: userStatuses };
  });

  app.put('/admin-api/users/:userId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:write');
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = userPayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const user = await users.update(params.userId, {
      organizationId: body.organizationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      role: resolveAssignableRole(context.user, body.role),
      status: body.status,
      ...(body.password ? { passwordHash: await hashPassword(body.password) } : {})
    });

    if (!user) throw notFound('User not found', 'USER_NOT_FOUND');

    return { user: toPublicUser(user) };
  });

  app.patch('/admin-api/users/:userId/status', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'users:write');
    const params = z.object({ userId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(userStatuses) }).parse(request.body);
    const target = await users.findById(params.userId);
    if (!target) throw notFound('User not found', 'USER_NOT_FOUND');
    requireOrganizationAccess(context.user, target.organization_id);
    const user = await users.updateStatus(params.userId, body.status);

    return { user: user ? toPublicUser(user) : null };
  });

  app.get('/admin-api/sites', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return {
      sites: await chatbotProduction.listSites(organizationId)
    };
  });

  app.get('/admin-api/sites/:siteId/widget', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    const baseUrl = publicBaseUrl();
    const scriptCode = `<script src="${baseUrl}/widget/${site.widget_public_key}.js"></script>`;

    return {
      site,
      widget: {
        settings: chatbotProduction.widgetSettings(site),
        publicKey: site.widget_public_key,
        scriptUrl: `${baseUrl}/widget/${site.widget_public_key}.js`,
        scriptCode,
        debugScriptCode: `<script src="${baseUrl}/widget/${site.widget_public_key}.js" data-debug="true"></script>`,
        active: site.status === 'active' && site.widget_enabled,
        diagnostics: await chatbotRuntime.diagnostics({
          organizationId: site.organization_id,
          site
        })
      }
    };
  });

  app.get('/admin-api/chatbots/:siteId/widget-diagnostics', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      diagnostics: await chatbotRuntime.diagnostics({
        organizationId: site.organization_id,
        site
      })
    };
  });

  app.patch('/admin-api/sites/:siteId/widget-settings', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const existing = await chatbotProduction.getSiteWidget(params.siteId);
    if (!existing) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, existing.organization_id);
    const body = siteWidgetSettingsPayloadSchema.parse(request.body);
    const site = await chatbotProduction.updateWidgetSettings(
      params.siteId,
      existing.organization_id,
      body
    );
    chatbotRuntimeCache.invalidate([`site:${params.siteId}`, 'site-settings', 'widget-config']);

    return {
      site,
      widget: site
        ? {
            settings: chatbotProduction.widgetSettings(site),
            publicKey: site.widget_public_key,
            active: site.status === 'active' && site.widget_enabled
          }
        : null
    };
  });

  app.post('/admin-api/sites/:siteId/qa/import-csv', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = qaImportPayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      import: await chatbotProduction.importQaCsv({
        organizationId: site.organization_id,
        siteId: site.id,
        siteDomain: site.domain,
        csv: body.csv
      })
    };
  });

  app.get('/admin-api/sites/:siteId/unanswered', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const query = unansweredQuerySchema.parse(request.query);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      unanswered: await chatbotProduction.listUnanswered({
        organizationId: site.organization_id,
        siteId: site.id,
        status: query.status
      })
    };
  });

  app.post('/admin-api/sites/:siteId/unanswered/:unansweredId/ignore', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z
      .object({ siteId: z.string().uuid(), unansweredId: z.string().uuid() })
      .parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      unanswered: await chatbotProduction.ignoreUnanswered({
        organizationId: site.organization_id,
        siteId: site.id,
        unansweredId: params.unansweredId
      })
    };
  });

  app.post('/admin-api/sites/:siteId/unanswered/:unansweredId/convert', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z
      .object({ siteId: z.string().uuid(), unansweredId: z.string().uuid() })
      .parse(request.params);
    const body = unansweredConvertPayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return chatbotProduction.convertUnansweredToQa({
      organizationId: site.organization_id,
      siteId: site.id,
      unansweredId: params.unansweredId,
      answer: body.answer,
      ...(body.category ? { category: body.category } : {}),
      tags: body.tags
    });
  });

  app.get('/admin-api/chatbots/:siteId/review', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const query = reviewQueueQuerySchema.parse(request.query);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      review: await chatbotRuntime.listReviewQueue({
        organizationId: site.organization_id,
        siteId: site.id,
        status: query.status
      })
    };
  });

  app.post('/admin-api/chatbots/:siteId/review/:reviewId/resolve', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z
      .object({ siteId: z.string().uuid(), reviewId: z.string().uuid() })
      .parse(request.params);
    const body = reviewResolvePayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      review: await chatbotRuntime.resolveReview({
        organizationId: site.organization_id,
        siteId: site.id,
        reviewId: params.reviewId,
        status: assertReviewStatus(body.status),
        adminNote: body.adminNote,
        userId: context.user.id
      })
    };
  });

  app.get('/admin-api/chatbot/dashboard', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return {
      metrics: await cached(
        cache,
        cacheKey('chatbot-dashboard', organizationId),
        ['dashboard', 'statistics'],
        () => chatbotProduction.metrics(organizationId)
      )
    };
  });

  app.get('/admin-api/chatbots', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationScope(context.user, query.organizationId);

    return { chatbots: await knowledgeEngine.listChatbots(organizationId) };
  });

  app.get('/admin-api/chatbots/:siteId/overview', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { overview: await knowledgeEngine.getOverview(site.id, site.organization_id) };
  });

  app.get('/admin-api/chatbots/:siteId/intents', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const query = chatbotSearchQuerySchema.parse(request.query);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      intents: await knowledgeEngine.listIntents({
        organizationId: site.organization_id,
        siteId: site.id,
        search: query.search
      })
    };
  });

  app.post('/admin-api/chatbots/:siteId/intents', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = intentPayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { intent: await knowledgeEngine.createIntent(site.organization_id, site.id, body) };
  });

  app.patch('/admin-api/chatbot-intents/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = partialIntentPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user);

    return { intent: await knowledgeEngine.updateIntent(params.id, organizationId, body) };
  });

  app.delete('/admin-api/chatbot-intents/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);
    await knowledgeEngine.deleteIntent(params.id, organizationId);

    return { deleted: true };
  });

  app.get('/admin-api/chatbots/:siteId/knowledge', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const query = chatbotSearchQuerySchema.parse(request.query);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      knowledge: await knowledgeEngine.listKnowledge({
        organizationId: site.organization_id,
        siteId: site.id,
        search: query.search,
        status: query.status,
        intentId: query.intentId
      })
    };
  });

  app.post('/admin-api/chatbots/:siteId/knowledge', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = knowledgePayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      knowledge: await knowledgeEngine.createKnowledge(site.organization_id, site.id, {
        ...body,
        userId: context.user.id
      })
    };
  });

  app.get('/admin-api/knowledge/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return { knowledge: await knowledgeEngine.getKnowledge(params.id, organizationId) };
  });

  app.patch('/admin-api/knowledge/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = partialKnowledgePayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user);

    return {
      knowledge: await knowledgeEngine.updateKnowledge(params.id, organizationId, {
        ...body,
        userId: context.user.id
      })
    };
  });

  app.delete('/admin-api/knowledge/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);
    await knowledgeEngine.deleteKnowledge(params.id, organizationId);

    return { archived: true };
  });

  app.post('/admin-api/knowledge/:id/duplicate', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return {
      knowledge: await knowledgeEngine.duplicateKnowledge(
        params.id,
        organizationId,
        context.user.id
      )
    };
  });

  app.post('/admin-api/knowledge/:id/publish', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return {
      knowledge: await knowledgeEngine.setKnowledgeStatus(
        params.id,
        organizationId,
        'active',
        context.user.id
      )
    };
  });

  app.post('/admin-api/knowledge/:id/archive', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return {
      knowledge: await knowledgeEngine.setKnowledgeStatus(
        params.id,
        organizationId,
        'archived',
        context.user.id
      )
    };
  });

  app.get('/admin-api/chatbots/:siteId/flows', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { flows: await knowledgeEngine.listFlows(site.organization_id, site.id) };
  });

  app.post('/admin-api/chatbots/:siteId/flows', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = flowPayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { flow: await knowledgeEngine.createFlow(site.organization_id, site.id, body) };
  });

  app.get('/admin-api/flows/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return { flow: await knowledgeEngine.getFlow(params.id, organizationId) };
  });

  app.patch('/admin-api/flows/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = partialFlowPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user);

    return { flow: await knowledgeEngine.updateFlow(params.id, organizationId, body) };
  });

  app.delete('/admin-api/flows/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);
    await knowledgeEngine.deleteFlow(params.id, organizationId);

    return { deleted: true };
  });

  app.post('/admin-api/flows/:id/steps', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = flowStepPayloadSchema.parse(request.body);

    return { step: await knowledgeEngine.addFlowStep({ ...body, flowId: params.id }) };
  });

  app.patch('/admin-api/flow-steps/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = partialFlowStepPayloadSchema.parse(request.body);

    return { step: await knowledgeEngine.updateFlowStep(params.id, body) };
  });

  app.delete('/admin-api/flow-steps/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    await knowledgeEngine.deleteFlowStep(params.id);

    return { deleted: true };
  });

  app.get('/admin-api/chatbots/:siteId/personality', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { personality: await knowledgeEngine.getPersonality(site.organization_id, site.id) };
  });

  app.put('/admin-api/chatbots/:siteId/personality', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = personalityPayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return {
      personality: await knowledgeEngine.savePersonality(site.organization_id, site.id, body)
    };
  });

  app.get('/admin-api/chatbots/:siteId/goals', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { goals: await knowledgeEngine.listGoals(site.organization_id, site.id) };
  });

  app.post('/admin-api/chatbots/:siteId/goals', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = goalPayloadSchema.parse(request.body);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { goal: await knowledgeEngine.createGoal(site.organization_id, site.id, body) };
  });

  app.patch('/admin-api/chatbot-goals/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = partialGoalPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user);

    return { goal: await knowledgeEngine.updateGoal(params.id, organizationId, body) };
  });

  app.delete('/admin-api/chatbot-goals/:id', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);
    await knowledgeEngine.deleteGoal(params.id, organizationId);

    return { deleted: true };
  });

  app.get('/admin-api/chatbots/:siteId/suggestions', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await chatbotProduction.getSiteWidget(params.siteId);
    if (!site) throw notFound('Site not found', 'SITE_NOT_FOUND');
    requireOrganizationAccess(context.user, site.organization_id);

    return { suggestions: await knowledgeEngine.listSuggestions(site.organization_id, site.id) };
  });

  app.post('/admin-api/unanswered-questions/:id/generate-suggestion', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return { suggestion: await knowledgeEngine.generateSuggestion(params.id, organizationId) };
  });

  app.post('/admin-api/knowledge-suggestions/:id/accept', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = suggestionAcceptPayloadSchema.parse(request.body ?? {});
    const organizationId = resolveOrganizationFilter(context.user);

    return knowledgeEngine.acceptSuggestion(params.id, organizationId, context.user.id, body);
  });

  app.post('/admin-api/knowledge-suggestions/:id/reject', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);

    return { suggestion: await knowledgeEngine.rejectSuggestion(params.id, organizationId) };
  });

  app.get('/admin-api/conversations/:id/context', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);
    const conversation = await conversations.findConversation(params.id, organizationId);
    if (!conversation) throw notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');

    return { context: await reasoningEngine.getContext(organizationId, conversation.id) };
  });

  app.get('/admin-api/conversations/:id/reasoning-traces', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const organizationId = resolveOrganizationFilter(context.user);
    const conversation = await conversations.findConversation(params.id, organizationId);
    if (!conversation) throw notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');

    return { traces: await reasoningEngine.listTraces(organizationId, conversation.id) };
  });

  app.post('/admin-api/conversations/:id/reasoning/replay', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = reasoningReplayPayloadSchema.parse(request.body ?? {});
    const organizationId = resolveOrganizationFilter(context.user);
    const conversation = await conversations.findConversation(params.id, organizationId);
    if (!conversation) throw notFound('Conversation not found', 'CONVERSATION_NOT_FOUND');
    const messages = await conversations.listMessages(conversation.id, organizationId);
    const lastVisitorMessage = [...messages]
      .reverse()
      .find((message) => message.sender_type === 'visitor')?.content;

    return {
      reasoning: await reasoningEngine.replay({
        organizationId,
        siteId: conversation.site_id,
        visitorId: conversation.visitor_id,
        conversationId: conversation.id,
        message: body.message ?? lastVisitorMessage ?? ''
      })
    };
  });

  app.post('/admin-api/chatbots/:siteId/reasoning/test', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = reasoningTestPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return {
      reasoning: await reasoningEngine.test({
        organizationId,
        siteId: params.siteId,
        message: body.message
      })
    };
  });

  app.get('/admin-api/reasoning/dashboard', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return {
      metrics: {
        ...(await reasoningEngine.metrics(organizationId)),
        runtime: await chatbotRuntime.organizationMetrics(organizationId)
      }
    };
  });

  app.get('/admin-api/studio', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return await chatbotStudio.dashboard(organizationId);
  });

  app.get('/admin-api/studio/templates', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');

    return {
      templates: await chatbotStudio.templates(),
      businessTypes: studioBusinessTypes,
      goals: studioGoals
    };
  });

  app.get('/admin-api/studio/:siteId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return {
      studio: await chatbotStudio.dashboard(organizationId, params.siteId),
      versions: await chatbotStudio.versions(organizationId, params.siteId),
      diff: await chatbotStudio.diff(organizationId, params.siteId)
    };
  });

  app.post('/admin-api/studio/:siteId/wizard', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = studioWizardPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return await chatbotStudio.createFromWizard({
      organizationId,
      siteId: params.siteId,
      name: body.name,
      domain: body.domain,
      businessType: body.businessType,
      primaryGoal: body.primaryGoal,
      tone: body.tone,
      templateId: body.templateId,
      userId: context.user.id
    });
  });

  app.post('/admin-api/studio/:siteId/import-document', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = studioImportPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return {
      proposal: await chatbotStudio.importDocument({
        organizationId,
        siteId: params.siteId,
        fileName: body.fileName,
        fileType: body.fileType,
        content: body.content
      })
    };
  });

  app.post('/admin-api/studio/import-proposals/:proposalId/accept', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ proposalId: z.string().uuid() }).parse(request.params);
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return await chatbotStudio.acceptImportProposal(
      params.proposalId,
      organizationId,
      context.user.id
    );
  });

  app.post('/admin-api/studio/:siteId/simulate', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = studioSimulationPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return await chatbotStudio.simulate({
      organizationId,
      siteId: params.siteId,
      message: body.message
    });
  });

  app.post('/admin-api/studio/:siteId/publish', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const query = optionalOrganizationQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return { version: await chatbotStudio.publish(organizationId, params.siteId, context.user.id) };
  });

  app.post('/admin-api/studio/:siteId/rollback', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = studioRollbackPayloadSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireSiteAccess(database, params.siteId, organizationId);

    return {
      version: await chatbotStudio.rollback(organizationId, params.siteId, body.versionNumber)
    };
  });

  app.get('/admin-api/prospects', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = prospectListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return {
      ...(await prospects.listCore(toProspectFilters(organizationId, query))),
      statuses: coreProspectStatuses(),
      scoreLabels,
      platforms: platformFilters
    };
  });

  app.get('/admin-api/prospects/export-csv', async (request, reply) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'data:export');
    const query = prospectListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireFeature(settings, 'exports', organizationId);
    const csv = await prospects.exportCsv(toProspectFilters(organizationId, query));

    reply.type('text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="visitor-os-prospects.csv"');

    return csv;
  });

  app.post('/admin-api/prospects/import-csv', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const body = csvImportSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);

    return { import: await prospects.importCsv(organizationId, body.csv) };
  });

  app.get('/admin-api/contact-history/follow-ups', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = followUpQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);

    return {
      followUps: await contactHistory.followUps(toContactHistoryFilters(organizationId, query)),
      channels: contactChannels,
      outcomes: contactOutcomes
    };
  });

  app.get('/admin-api/contact-history/export-csv', async (request, reply) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'data:export');
    const query = followUpQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireFeature(settings, 'exports', organizationId);
    const csv = await contactHistory.exportCsv(toContactHistoryFilters(organizationId, query));

    reply.type('text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="visitor-os-contact-history.csv"');

    return csv;
  });

  app.get('/admin-api/enrichments', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = enrichmentListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireFeature(settings, 'enrichment', organizationId);

    return {
      enrichments: await enrichments.list(toEnrichmentFilters(organizationId, query)),
      statuses: enrichmentStatuses,
      sourceTypes: enrichmentSourceTypes
    };
  });

  app.get('/admin-api/enrichments/:enrichmentId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    await requireFeature(settings, 'enrichment', context.user.organization_id);
    const params = z.object({ enrichmentId: z.string().uuid() }).parse(request.params);
    const enrichment = await enrichments.find(
      params.enrichmentId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
    );
    if (!enrichment) throw notFound('Enrichment not found', 'ENRICHMENT_NOT_FOUND');

    return { enrichment };
  });

  app.delete('/admin-api/enrichments/:enrichmentId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    await requireFeature(settings, 'enrichment', context.user.organization_id);
    const params = z.object({ enrichmentId: z.string().uuid() }).parse(request.params);

    return {
      deleted: await enrichments.delete(
        params.enrichmentId,
        context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
      )
    };
  });

  app.get('/admin-api/message-templates', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const query = messageTemplateListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await messageTemplates.ensureDefaults(organizationId, context.user.id);

    return {
      templates: await messageTemplates.list(organizationId),
      channels: messageTemplateChannels,
      purposes: messageTemplatePurposes
    };
  });

  app.get('/admin-api/message-templates/export-csv', async (request, reply) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'data:export');
    const query = messageTemplateListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireFeature(settings, 'exports', organizationId);
    reply.type('text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="visitor-os-message-templates.csv"');

    return messageTemplates.exportTemplatesCsv(organizationId);
  });

  app.get('/admin-api/message-templates/usage-csv', async (request, reply) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'data:export');
    const query = messageTemplateListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    await requireFeature(settings, 'exports', organizationId);
    reply.type('text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="visitor-os-message-usage.csv"');

    return messageTemplates.exportUsageCsv(organizationId);
  });

  app.post('/admin-api/message-templates', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const body = messageTemplatePayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);

    return {
      template: await messageTemplates.create(toMessageTemplateInput(body, context.user.id))
    };
  });

  app.get('/admin-api/message-templates/:templateId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ templateId: z.string().uuid() }).parse(request.params);
    const query = messageTemplateListQuerySchema.parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    const template = await messageTemplates.find(params.templateId, organizationId);
    if (!template) throw notFound('Message template not found', 'MESSAGE_TEMPLATE_NOT_FOUND');

    return { template, channels: messageTemplateChannels, purposes: messageTemplatePurposes };
  });

  app.patch('/admin-api/message-templates/:templateId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ templateId: z.string().uuid() }).parse(request.params);
    const body = messageTemplatePayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const template = await messageTemplates.update(
      params.templateId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id,
      toMessageTemplateInput(body, context.user.id)
    );
    if (!template) throw notFound('Message template not found', 'MESSAGE_TEMPLATE_NOT_FOUND');

    return { template };
  });

  app.delete('/admin-api/message-templates/:templateId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ templateId: z.string().uuid() }).parse(request.params);

    return {
      deleted: await messageTemplates.delete(
        params.templateId,
        context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
      )
    };
  });

  app.post('/admin-api/message-templates/:templateId/render', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ templateId: z.string().uuid() }).parse(request.params);
    const body = renderTemplatePayloadSchema.parse(request.body);
    const template = await messageTemplates.find(
      params.templateId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
    );
    if (!template) throw notFound('Message template not found', 'MESSAGE_TEMPLATE_NOT_FOUND');
    const prospect = body.prospectId
      ? await prospects.findCore(
          body.prospectId,
          context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
        )
      : null;
    const rendered = prospect
      ? await messageTemplates.render(params.templateId, prospect, prospect.organization_id)
      : {
          template,
          variables: body.variables,
          rendered: template.content.replace(
            /\{([a-z_]+)\}/g,
            (_match, variable: string) => body.variables[variable] ?? ''
          )
        };
    if (!rendered) throw notFound('Message template not found', 'MESSAGE_TEMPLATE_NOT_FOUND');
    if (body.recordCopy) {
      await messageTemplates.recordUsage({
        organizationId: template.organization_id,
        templateId: template.id,
        ...(body.prospectId ? { prospectId: body.prospectId } : {}),
        userId: context.user.id,
        action: 'copied',
        renderedContent: rendered.rendered
      });
    }

    return rendered;
  });

  app.post('/admin-api/prospects', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const body = prospectPayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const prospect = await prospects.createCore(toProspectInput(body));
    await pipeline.logActivity({
      organizationId: prospect.organization_id,
      userId: context.user.id,
      prospectId: prospect.id,
      actionType: 'prospect_created',
      newValue: prospect.status,
      metadata: { source: 'admin' }
    });

    return { prospect };
  });

  app.post('/admin-api/prospects/:prospectId/render-message', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = renderProspectMessageSchema.parse(request.body);
    const prospect = await prospects.findCore(
      params.prospectId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
    );
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const rendered = await messageTemplates.render(
      body.templateId,
      prospect,
      prospect.organization_id
    );
    if (!rendered) throw notFound('Message template not found', 'MESSAGE_TEMPLATE_NOT_FOUND');
    if (body.recordCopy) {
      await messageTemplates.recordUsage({
        organizationId: prospect.organization_id,
        templateId: body.templateId,
        prospectId: params.prospectId,
        userId: context.user.id,
        action: 'copied',
        renderedContent: rendered.rendered
      });
    }

    return rendered;
  });

  app.post('/admin-api/prospects/:prospectId/save-rendered-message', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = saveRenderedMessageSchema.parse(request.body);
    const prospect = await prospects.findCore(
      params.prospectId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
    );
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const entry = await contactHistory.create({
      organizationId: prospect.organization_id,
      prospectId: prospect.id,
      userId: context.user.id,
      channel: body.channel,
      outcome: body.outcome,
      messageUsed: body.rendered,
      ...(body.followUpDate ? { followUpDate: body.followUpDate } : {}),
      ...(body.notes ? { notes: body.notes } : {})
    });
    await messageTemplates.recordUsage({
      organizationId: prospect.organization_id,
      templateId: body.templateId,
      prospectId: prospect.id,
      userId: context.user.id,
      action: 'history_saved',
      renderedContent: body.rendered
    });
    await pipeline.logActivity({
      organizationId: prospect.organization_id,
      userId: context.user.id,
      prospectId: prospect.id,
      actionType: 'contact_history_added',
      previousValue: prospect.status,
      newValue: entry.outcome,
      metadata: { channel: body.channel, fromTemplate: true }
    });

    return {
      entry,
      prospect: await prospects.findCore(params.prospectId, prospect.organization_id)
    };
  });

  app.get('/admin-api/prospects/:prospectId/analysis', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return {
      analysis: await cached(
        cache,
        cacheKey('ai-analysis', prospect.organization_id, params.prospectId),
        ['ai-analysis'],
        () => aiQualification.latestForProspect(params.prospectId, prospect.organization_id)
      )
    };
  });

  app.patch('/admin-api/prospects/:prospectId/pipeline-stage', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = pipelineStageSchema.parse(request.body);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await pipeline.moveStage({
      prospectId: params.prospectId,
      stage: body.stage,
      userId: context.user.id,
      ...(organizationId ? { organizationId } : {})
    });
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return { prospect };
  });

  app.post('/admin-api/prospects/:prospectId/analyze', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    await requireFeature(settings, 'ai', organizationId);
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const analysis = await aiQualification.analyzeProspect(prospect);
    await pipeline.logActivity({
      organizationId: prospect.organization_id,
      userId: context.user.id,
      prospectId: prospect.id,
      actionType: 'ai_analysis_recalculated',
      newValue: analysis.priority,
      metadata: { confidence: analysis.confidence }
    });

    return { analysis };
  });

  app.post('/admin-api/prospects/analyze-batch', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const body = analyzeBatchSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireFeature(settings, 'ai', organizationId);
    const selectedProspects = body.prospectIds?.length
      ? (
          await Promise.all(
            body.prospectIds.map((prospectId) => prospects.findCore(prospectId, organizationId))
          )
        ).filter((prospect): prospect is NonNullable<typeof prospect> => Boolean(prospect))
      : body.all
        ? await prospects.listAllCore(organizationId)
        : (await prospects.listCore({ organizationId, page: 1, pageSize: 25 })).prospects;
    const job = aiQualification.createBatchJob(organizationId, selectedProspects.length);
    if (queue) {
      queue.enqueue('ai-qualification-batch', () =>
        aiQualification.runBatch(job.id, selectedProspects)
      );
    } else {
      void aiQualification.runBatch(job.id, selectedProspects);
    }

    return { job };
  });

  app.get('/admin-api/prospects/analyze-batch/:jobId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ jobId: z.string().uuid() }).parse(request.params);
    const job = aiQualification.getBatchJob(params.jobId);
    if (!job) throw notFound('Analysis batch not found', 'AI_ANALYSIS_BATCH_NOT_FOUND');
    requireOrganizationAccess(context.user, job.organizationId);

    return { job };
  });

  app.post('/admin-api/prospects/enrich-batch', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const body = enrichmentBatchSchema.parse(request.body);
    const organizationId = resolveOrganizationFilter(context.user, body.organizationId);
    await requireFeature(settings, 'enrichment', organizationId);
    const baseProspects = body.prospectIds?.length
      ? (
          await Promise.all(
            body.prospectIds.map((prospectId) => prospects.findCore(prospectId, organizationId))
          )
        ).filter((prospect): prospect is NonNullable<typeof prospect> => Boolean(prospect))
      : await prospects.listAllCore(organizationId);
    const selectedProspects = filterProspectsForEnrichmentMode(baseProspects, body.mode);
    const job = enrichments.createBatchJob(organizationId, selectedProspects.length);
    if (queue) {
      queue.enqueue('public-enrichment-batch', () =>
        enrichments.runBatch(job.id, selectedProspects)
      );
    } else {
      void enrichments.runBatch(job.id, selectedProspects);
    }

    return { job };
  });

  app.get('/admin-api/prospects/enrich-batch/:jobId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ jobId: z.string().uuid() }).parse(request.params);
    const job = enrichments.getBatchJob(params.jobId);
    if (!job) throw notFound('Enrichment batch not found', 'ENRICHMENT_BATCH_NOT_FOUND');
    requireOrganizationAccess(context.user, job.organizationId);

    return { job };
  });

  app.post('/admin-api/prospects/:prospectId/enrich', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    await requireFeature(settings, 'enrichment', organizationId);
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const results = await enrichments.enrichProspect(prospect);
    if (results.some((result) => result.status === 'success' || result.status === 'partial')) {
      await pipeline.logActivity({
        organizationId: prospect.organization_id,
        userId: context.user.id,
        prospectId: prospect.id,
        actionType: 'enrichment_succeeded',
        newValue: results.map((result) => result.status).join(','),
        metadata: { sources: results.map((result) => result.source_type) }
      });
    }

    return {
      enrichments: results,
      suggestions: await enrichments.suggestionsForProspect(prospect.id, prospect.organization_id)
    };
  });

  app.get('/admin-api/prospects/:prospectId/enrichments', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    await requireFeature(settings, 'enrichment', organizationId);
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return {
      enrichments: await enrichments.listForProspect(prospect.id, prospect.organization_id),
      suggestions: await enrichments.suggestionsForProspect(prospect.id, prospect.organization_id)
    };
  });

  app.get('/admin-api/prospects/:prospectId/suggestions', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return {
      suggestions: await enrichments.suggestionsForProspect(prospect.id, prospect.organization_id)
    };
  });

  app.post('/admin-api/prospects/:prospectId/suggestions/:suggestionId/accept', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z
      .object({ prospectId: z.string().uuid(), suggestionId: z.string().uuid() })
      .parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const accepted = await enrichments.acceptSuggestion(params.suggestionId, prospect);
    if (!accepted.suggestion) throw notFound('Suggestion not found', 'SUGGESTION_NOT_FOUND');
    await pipeline.logActivity({
      organizationId: prospect.organization_id,
      userId: context.user.id,
      prospectId: prospect.id,
      actionType: 'suggestion_accepted',
      previousValue: accepted.suggestion.current_value,
      newValue: accepted.suggestion.suggested_value,
      metadata: { field: accepted.suggestion.field_name }
    });

    return {
      ...accepted,
      aiAnalysisStale: true,
      message: 'Suggestion accepted. Recalculate AI analysis manually when ready.'
    };
  });

  app.post('/admin-api/prospects/:prospectId/suggestions/:suggestionId/reject', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z
      .object({ prospectId: z.string().uuid(), suggestionId: z.string().uuid() })
      .parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const suggestion = await enrichments.rejectSuggestion(
      params.suggestionId,
      prospect.organization_id
    );
    if (!suggestion) throw notFound('Suggestion not found', 'SUGGESTION_NOT_FOUND');

    return { suggestion };
  });

  app.get('/admin-api/prospects/:prospectId/history', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return {
      history: await contactHistory.listForProspect(params.prospectId, organizationId),
      channels: contactChannels,
      outcomes: contactOutcomes
    };
  });

  app.post('/admin-api/prospects/:prospectId/history', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = contactHistoryPayloadSchema.parse(request.body);
    const organizationId =
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id;
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');
    const entry = await contactHistory.create(
      toContactHistoryInput(prospect.organization_id, params.prospectId, context.user.id, body)
    );
    await pipeline.logActivity({
      organizationId: prospect.organization_id,
      userId: context.user.id,
      prospectId: prospect.id,
      actionType: 'contact_history_added',
      previousValue: prospect.status,
      newValue: entry.outcome,
      metadata: { channel: entry.channel, followUpDate: entry.follow_up_date }
    });

    return {
      entry,
      prospect: await prospects.findCore(params.prospectId, organizationId)
    };
  });

  app.patch('/admin-api/contact-history/:historyId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ historyId: z.string().uuid() }).parse(request.params);
    const body = contactHistoryPayloadSchema
      .extend({ organizationId: z.string().uuid(), prospectId: z.string().uuid() })
      .parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const entry = await contactHistory.update(
      params.historyId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id,
      toContactHistoryInput(body.organizationId, body.prospectId, context.user.id, body)
    );
    if (!entry) throw notFound('Contact history not found', 'CONTACT_HISTORY_NOT_FOUND');

    return { entry };
  });

  app.delete('/admin-api/contact-history/:historyId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ historyId: z.string().uuid() }).parse(request.params);

    return {
      deleted: await contactHistory.delete(
        params.historyId,
        context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
      )
    };
  });

  app.get('/admin-api/prospects/:prospectId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = resolveOrganizationFilter(context.user, query.organizationId);
    const prospect = await prospects.findCore(params.prospectId, organizationId);
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return { prospect, statuses: coreProspectStatuses(), scoreLabels };
  });

  app.patch('/admin-api/prospects/:prospectId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = prospectPayloadSchema.parse(request.body);
    requireOrganizationAccess(context.user, body.organizationId);
    const prospect = await prospects.updateCore(
      params.prospectId,
      context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id,
      toProspectInput(body)
    );
    if (!prospect) throw notFound('Prospect not found', 'PROSPECT_NOT_FOUND');

    return { prospect };
  });

  app.delete('/admin-api/prospects/:prospectId', async (request) => {
    const context = await resolveContext(request, config, users);
    requirePermission(context.user, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);

    return {
      deleted: await prospects.deleteCore(
        params.prospectId,
        context.user.role === 'SuperAdmin' ? undefined : context.user.organization_id
      )
    };
  });
}

async function resolveContext(
  request: FastifyRequest,
  config: AppConfig,
  users: UserRepository
): Promise<{ user: UserRecord }> {
  const jwt = authenticateJwt(request, config);
  const user = await users.findById(jwt.user.sub);
  if (!user || user.status !== 'active') {
    throw new AppError('Invalid token user', { statusCode: 401, code: 'INVALID_TOKEN_USER' });
  }

  return { user };
}

function requirePermission(
  user: UserRecord,
  permission: Parameters<typeof hasPermission>[1]
): void {
  if (!hasPermission(user.role, permission)) {
    throw new AppError('Permission denied', { statusCode: 403, code: 'PERMISSION_DENIED' });
  }
}

function requireOrganizationAccess(user: UserRecord, organizationId: string): void {
  if (user.role !== 'SuperAdmin' && user.organization_id !== organizationId) {
    throw new AppError('Organization access denied', {
      statusCode: 403,
      code: 'ORGANIZATION_ACCESS_DENIED'
    });
  }
}

async function requireSiteAccess(
  database: Database,
  siteId: string,
  organizationId: string
): Promise<void> {
  const result = await database.query<{ id: string }>(
    `select id from sites where id = $1 and organization_id = $2`,
    [siteId, organizationId]
  );
  if (!result.rows[0]) {
    throw new AppError('Site access denied', { statusCode: 404, code: 'SITE_NOT_FOUND' });
  }
}

function resolveOrganizationFilter(user: UserRecord, requestedOrganizationId?: string): string {
  if (user.role === 'SuperAdmin') {
    return requestedOrganizationId ?? user.organization_id;
  }

  if (requestedOrganizationId) requireOrganizationAccess(user, requestedOrganizationId);
  return user.organization_id;
}

function resolveOrganizationScope(
  user: UserRecord,
  requestedOrganizationId?: string
): string | undefined {
  if (user.role === 'SuperAdmin') return requestedOrganizationId;
  if (requestedOrganizationId) requireOrganizationAccess(user, requestedOrganizationId);
  return user.organization_id;
}

function resolveAssignableRole(user: UserRecord, role: UserRole): UserRole {
  if (role === 'SuperAdmin' && user.role !== 'SuperAdmin') {
    throw new AppError('Only SuperAdmin can assign SuperAdmin role', {
      statusCode: 403,
      code: 'ROLE_ASSIGNMENT_DENIED'
    });
  }

  return role;
}

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    organizationId: user.organization_id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function toOrganizationInput(input: z.infer<typeof organizationPayloadSchema>) {
  return {
    name: input.name,
    slug: input.slug,
    country: input.country,
    language: input.language,
    timezone: input.timezone,
    currency: input.currency,
    status: input.status,
    ...(input.description ? { description: input.description } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.plan ? { plan: input.plan } : {})
  };
}

function toUserListInput(
  organizationId?: string,
  search?: string
): { organizationId?: string; search?: string } {
  return {
    ...(organizationId ? { organizationId } : {}),
    ...(search ? { search } : {})
  };
}

function toProspectFilters(organizationId: string, query: z.infer<typeof prospectListQuerySchema>) {
  return {
    organizationId,
    page: query.page,
    pageSize: query.pageSize,
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.scoreLabel ? { scoreLabel: query.scoreLabel } : {}),
    ...(query.platform ? { platform: query.platform } : {})
  };
}

function toContactHistoryFilters(
  organizationId: string,
  query: z.infer<typeof followUpQuerySchema>
) {
  return {
    organizationId,
    ...(query.overdue ? { overdueOnly: query.overdue } : {}),
    ...(query.upcoming ? { upcomingOnly: query.upcoming } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.scoreLabel ? { scoreLabel: query.scoreLabel } : {}),
    ...(query.status ? { status: query.status } : {})
  };
}

function toEnrichmentFilters(
  organizationId: string,
  query: z.infer<typeof enrichmentListQuerySchema>
): EnrichmentListFilters {
  return {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceType ? { sourceType: query.sourceType } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.confidenceMin !== undefined ? { confidenceMin: query.confidenceMin } : {})
  };
}

function toPipelineFilters(
  organizationId: string | undefined,
  query: z.infer<typeof pipelineQuerySchema>
): PipelineFilters {
  return {
    ...(organizationId ? { organizationId } : {}),
    ...(query.city ? { city: query.city } : {}),
    ...(query.scoreLabel ? { scoreLabel: query.scoreLabel } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.platform ? { platform: query.platform } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    sort: query.sort
  };
}

function toForecastConfig(query: z.infer<typeof forecastQuerySchema>): ForecastConfig {
  return {
    ...(query.averageDealValue !== undefined ? { averageDealValue: query.averageDealValue } : {}),
    ...(query.lowConversionRate !== undefined
      ? { lowConversionRate: query.lowConversionRate }
      : {}),
    ...(query.mediumConversionRate !== undefined
      ? { mediumConversionRate: query.mediumConversionRate }
      : {}),
    ...(query.highConversionRate !== undefined
      ? { highConversionRate: query.highConversionRate }
      : {})
  };
}

function toActivityFilters(input: {
  organizationId?: string | undefined;
  prospectId?: string | undefined;
  actionType?: string | undefined;
  userId?: string | undefined;
}) {
  return {
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.prospectId ? { prospectId: input.prospectId } : {}),
    ...(input.actionType ? { actionType: input.actionType } : {}),
    ...(input.userId ? { userId: input.userId } : {})
  };
}

function filterProspectsForEnrichmentMode(
  prospects: ProspectRecord[],
  mode: z.infer<typeof enrichmentBatchSchema>['mode']
) {
  return prospects.filter((prospect) => {
    const hasUrl = Boolean(
      prospect.website ||
      prospect.instagram ||
      prospect.twitter_x ||
      prospect.linktree ||
      prospect.allmylinks ||
      prospect.mym ||
      prospect.onlyfans ||
      prospect.source_url
    );
    if (!hasUrl) return false;
    if (mode === 'all' || mode === 'not_enriched') return true;
    if (mode === 'high_score') return prospect.score >= 60;
    if (mode === 'url_missing_data') return !prospect.email || !prospect.phone || !prospect.city;
    return true;
  });
}

function publicBaseUrl(): string {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) return `https://${railwayDomain}`;

  return 'https://visitor-os-production-3a31.up.railway.app';
}

function optional<T>(value: T | null): T[] {
  return value ? [value] : [];
}

async function requireFeature(
  settings: SettingsService,
  feature: FeatureFlagKey,
  organizationId?: string
): Promise<void> {
  if (await settings.isEnabled(feature, organizationId)) return;

  throw new AppError(`Feature disabled: ${feature}`, {
    statusCode: 403,
    code: 'FEATURE_DISABLED'
  });
}

async function cached<T>(
  cache: AppCache | undefined,
  key: string,
  tags: string[],
  producer: () => Promise<T>
): Promise<T> {
  if (!cache) return producer();

  return cache.getOrSet(key, tags, producer);
}

function cacheKey(...parts: Array<string | number | undefined>): string {
  return parts.map((part) => part ?? 'global').join(':');
}

function coreProspectStatuses() {
  return prospectStatuses.filter((status) => status === status.toLowerCase());
}

function toProspectInput(input: z.infer<typeof prospectPayloadSchema>): ProspectInput {
  return {
    organizationId: input.organizationId,
    status: input.status,
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
    ...(input.pseudo ? { pseudo: input.pseudo } : {}),
    ...(input.company ? { company: input.company } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.website ? { website: input.website } : {}),
    ...(input.instagram ? { instagram: input.instagram } : {}),
    ...(input.twitterX ? { twitterX: input.twitterX } : {}),
    ...(input.mym ? { mym: input.mym } : {}),
    ...(input.onlyfans ? { onlyfans: input.onlyfans } : {}),
    ...(input.linktree ? { linktree: input.linktree } : {}),
    ...(input.allmylinks ? { allmylinks: input.allmylinks } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.activity ? { activity: input.activity } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
    ...(input.notes ? { notes: input.notes } : {})
  };
}

function toContactHistoryInput(
  organizationId: string,
  prospectId: string,
  userId: string,
  input: z.infer<typeof contactHistoryPayloadSchema>
): ContactHistoryInput {
  return {
    organizationId,
    prospectId,
    userId,
    channel: input.channel,
    outcome: input.outcome,
    ...(input.contactDate ? { contactDate: input.contactDate } : {}),
    ...(input.messageUsed ? { messageUsed: input.messageUsed } : {}),
    ...(input.response ? { response: input.response } : {}),
    ...(input.nextAction ? { nextAction: input.nextAction } : {}),
    ...(input.followUpDate ? { followUpDate: input.followUpDate } : {}),
    ...(input.notes ? { notes: input.notes } : {})
  };
}

function toMessageTemplateInput(
  input: z.infer<typeof messageTemplatePayloadSchema>,
  userId: string
): MessageTemplateInput {
  return {
    organizationId: input.organizationId,
    name: input.name,
    channel: input.channel,
    purpose: input.purpose,
    content: input.content,
    isActive: input.isActive,
    createdByUserId: userId
  };
}

function notFound(message: string, code: string): AppError {
  return new AppError(message, { statusCode: 404, code });
}
