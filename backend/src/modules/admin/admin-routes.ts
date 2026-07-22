import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import type { Database } from '../../database/client.js';
import {
  ConversationRepository,
  conversationStatuses
} from '../conversations/conversation-repository.js';
import { ProspectRepository, prospectStatuses } from '../prospects/prospect-repository.js';
import {
  businessConfigImportPayloadSchema,
  type BusinessConfigEngine
} from '../business-config/configuration-loader.js';
import { buildSystemPrompt } from '../business-config/prompt-builder.js';
import type { AIConfigurationRepository } from '../ai/ai-configuration-repository.js';
import { aiConfigurationSchema, defaultModelForProvider } from '../ai/ai-config.js';
import { estimateCostFromConfig } from '../ai/cost-estimator.js';
import type { ProviderFactory } from '../ai/provider-factory.js';
import { CrmRepository } from '../crm/crm-repository.js';
import { toCsv, toSpreadsheetXml } from '../crm/csv-export.js';
import {
  OrganizationRepository,
  organizationStatuses
} from '../organizations/organization-repository.js';
import { SiteRepository, siteStatuses } from '../sites/site-repository.js';
import { userRoles } from '../users/user-model.js';
import type { AuthContext, AuthService } from '../auth/auth-service.js';
import { permissionsForRole } from '../auth/rbac.js';
import type { NotificationEngine } from '../notifications/notification-engine.js';
import type { NotificationRepository } from '../notifications/notification-repository.js';
import { notificationStatuses, notificationTypes } from '../notifications/notification-types.js';
import { AnalyticsRepository } from '../analytics/analytics-repository.js';
import { analyticsPeriodPresets } from '../analytics/analytics-types.js';
import { resolveAnalyticsPeriod } from '../analytics/analytics-period.js';
import type { KnowledgeRepository } from '../kms/knowledge-repository.js';
import { KnowledgeImporter } from '../kms/knowledge-importer.js';
import { KnowledgeIndexingQueue } from '../kms/indexing-queue.js';
import { RepositoryKnowledgeSearch } from '../kms/knowledge-search.js';
import { KnowledgeStatisticsService } from '../kms/knowledge-statistics.js';
import { knowledgeDocumentTypes, knowledgeStatuses } from '../kms/knowledge-types.js';

const organizationInputSchema = z.object({
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

const siteInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  domain: z.string().optional(),
  widgetPublicKey: z.string().optional(),
  businessConfigId: z.string().min(1),
  language: z.string().min(2).default('fr'),
  status: z.enum(siteStatuses).default('active'),
  widgetEnabled: z.boolean().default(true)
});

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().optional()
});

const aiConfigPayloadSchema = aiConfigurationSchema.extend({
  organizationId: z.string().uuid().optional()
});

const prospectFilterSchema = z.object({
  organizationId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  status: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  scoreMin: z.coerce.number().int().min(0).max(100).optional(),
  scoreMax: z.coerce.number().int().min(0).max(100).optional(),
  periodFrom: z.string().datetime().optional(),
  periodTo: z.string().datetime().optional(),
  followUp: z.enum(['today', 'overdue', 'pending', 'completed']).optional()
});

const noteBodySchema = z.object({
  prospectId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1).max(5000)
});

const followUpBodySchema = z.object({
  prospectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  dueAt: z.string().datetime(),
  reason: z.string().min(1).max(1000)
});

const notificationSettingsSchema = z.object({
  organizationId: z.string().uuid().optional(),
  adminEmails: z.array(z.string().email()).default([]),
  notificationsEnabled: z.boolean().default(true),
  frequency: z.enum(['instant', 'daily', 'disabled']).default('instant'),
  language: z.string().min(2).default('fr'),
  preferredProvider: z.enum(['mock', 'resend']).default('mock'),
  webhookUrl: z.string().url().nullable().optional(),
  webhookHeaders: z.record(z.string(), z.string()).default({}),
  webhookSecret: z.string().nullable().optional(),
  retryAttempts: z.number().int().min(0).max(5).default(2),
  timeoutMs: z.number().int().positive().max(30_000).default(5000)
});

const analyticsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  preset: z.enum(analyticsPeriodPresets).default('7d'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

const analyticsExportQuerySchema = analyticsQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).default('csv')
});

const analyticsSnapshotSchema = analyticsQuerySchema.extend({
  periodType: z.enum(['daily', 'weekly', 'monthly']).default('daily')
});

const knowledgeImportBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  siteId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1).default('general'),
  type: z.enum(knowledgeDocumentTypes),
  language: z.string().min(2).default('fr'),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  author: z.string().optional(),
  source: z.string().default('manual')
});

const knowledgeFileImportBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  siteId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).default('general'),
  type: z.enum(knowledgeDocumentTypes).optional(),
  language: z.string().min(2).default('fr'),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().max(180).optional(),
  dataBase64: z.string().min(1),
  tags: z.array(z.string()).default([]),
  author: z.string().optional(),
  chunking: z
    .object({
      maxCharacters: z.number().int().min(200).max(6000).optional(),
      overlapCharacters: z.number().int().min(0).max(2000).optional(),
      splitByParagraph: z.boolean().optional()
    })
    .optional()
});

const knowledgeQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  siteId: z.string().uuid(),
  search: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(knowledgeStatuses).optional()
});

export function registerAdminRoutes(
  app: FastifyInstance,
  database: Database,
  businessConfigEngine: BusinessConfigEngine,
  auth: AuthService,
  aiConfigurations?: AIConfigurationRepository,
  providerFactory?: ProviderFactory,
  notificationEngine?: NotificationEngine,
  notificationRepository?: NotificationRepository,
  knowledgeRepository?: KnowledgeRepository
): void {
  const prospects = new ProspectRepository(database);
  const crm = new CrmRepository(database);
  const conversations = new ConversationRepository(database);
  const organizations = new OrganizationRepository(database);
  const sites = new SiteRepository(database);
  const analytics = new AnalyticsRepository(database);
  const knowledge = knowledgeRepository;
  const knowledgeImporter = knowledge ? new KnowledgeImporter(knowledge) : null;
  const knowledgeQueue = knowledgeImporter ? new KnowledgeIndexingQueue(knowledgeImporter) : null;
  const knowledgeSearch = knowledge ? new RepositoryKnowledgeSearch(knowledge) : null;
  const knowledgeStatistics = knowledge ? new KnowledgeStatisticsService(knowledge) : null;
  const authContexts = new WeakMap<object, AuthContext>();

  app.post('/api/admin/auth/login', async (request, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1)
      })
      .parse(request.body);
    const user = await auth.login({ ...body, reply });

    return { user, permissions: permissionsForRole(user.role) };
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/api/admin')) return;
    if (request.url.startsWith('/api/admin/auth/login')) return;

    authContexts.set(request, await auth.authenticate(request, reply));
  });

  app.post('/api/admin/auth/logout', async (request, reply) => {
    await auth.logout(request, reply);

    return { ok: true };
  });

  app.get('/api/admin/auth/me', (request) => {
    const context = getAuthContext(authContexts, request);

    return { user: context.user, permissions: permissionsForRole(context.user.role) };
  });

  app.get('/api/admin/ai/config', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId =
      auth.requireOrganizationAccess(context, query.organizationId) ?? context.user.organizationId;
    const configuration =
      (await aiConfigurations?.getByOrganizationId(organizationId)) ??
      aiConfigurationSchema.parse({ provider: 'mock' });

    return {
      organizationId,
      configuration,
      estimates: estimateCostFromConfig(configuration, 100),
      providers: ['mock', 'openai', 'anthropic', 'mistral', 'ollama']
    };
  });

  app.put('/api/admin/ai/config', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = aiConfigPayloadSchema.parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;
    const provider = body.provider;
    const configuration = {
      ...body,
      model: body.model || defaultModelForProvider(provider),
      systemPrompt: body.systemPrompt
    };
    const saved =
      (await aiConfigurations?.save(organizationId, configuration)) ??
      aiConfigurationSchema.parse(configuration);

    return {
      organizationId,
      configuration: saved,
      estimates: estimateCostFromConfig(saved, 100)
    };
  });

  app.post('/api/admin/ai/test', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = z
      .object({
        organizationId: z.string().uuid().optional(),
        configId: z.string().min(1).optional(),
        question: z.string().min(1).default('Bonjour, pouvez-vous aider un visiteur ?')
      })
      .parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;
    const businessConfig = await businessConfigEngine.resolveConfig(body.configId);
    const configuration =
      (await aiConfigurations?.getByOrganizationId(organizationId)) ??
      aiConfigurationSchema.parse({ provider: 'mock' });
    const provider = providerFactory?.createProviderFor(configuration);

    if (!provider) {
      await notificationEngine?.notify({
        type: 'ai_provider_unavailable',
        organizationId,
        variables: { organization: organizationId },
        channels: ['internal', 'email']
      });
      throw new AppError('AI provider factory is not available', {
        statusCode: 503,
        code: 'AI_PROVIDER_UNAVAILABLE'
      });
    }

    const result = await provider.generateReply({
      organizationId,
      siteId: '00000000-0000-4000-8000-000000000000',
      conversationId: '00000000-0000-4000-8000-000000000000',
      question: body.question,
      messages: [],
      systemPrompt: configuration.systemPrompt || buildSystemPrompt(businessConfig),
      businessContext: {
        brandName: businessConfig.identity.name,
        activity: businessConfig.identity.category,
        rules: [...businessConfig.restrictions.never, ...businessConfig.restrictions.always],
        fallbackMessage:
          businessConfig.widget.fallbackMessage ??
          "Je n'ai pas encore cette information. Contactez-nous pour une reponse precise."
      },
      configuration
    });

    return {
      result,
      prompt: configuration.systemPrompt || buildSystemPrompt(businessConfig),
      estimates: estimateCostFromConfig(configuration, 100)
    };
  });

  app.get('/api/admin/notifications', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const query = z
      .object({
        organizationId: z.string().uuid().optional(),
        type: z.enum(notificationTypes).optional(),
        status: z.enum(notificationStatuses).optional(),
        provider: z.string().optional()
      })
      .parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      notifications:
        (await notificationRepository?.list({
          ...(organizationId ? { organizationId } : {}),
          ...(query.type ? { type: query.type } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.provider ? { provider: query.provider } : {})
        })) ?? [],
      types: notificationTypes,
      statuses: notificationStatuses
    };
  });

  app.get('/api/admin/notifications/settings', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId =
      auth.requireOrganizationAccess(context, query.organizationId) ?? context.user.organizationId;

    return {
      settings: await notificationRepository?.getSettings(organizationId)
    };
  });

  app.put('/api/admin/notifications/settings', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = notificationSettingsSchema.parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;

    return {
      settings: await notificationRepository?.saveSettings({
        organizationId,
        adminEmails: body.adminEmails,
        notificationsEnabled: body.notificationsEnabled,
        frequency: body.frequency,
        language: body.language,
        preferredProvider: body.preferredProvider,
        webhookUrl: body.webhookUrl ?? null,
        webhookHeaders: body.webhookHeaders,
        webhookSecret: body.webhookSecret ?? null,
        retryAttempts: body.retryAttempts,
        timeoutMs: body.timeoutMs
      })
    };
  });

  app.post('/api/admin/notifications/test', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = z.object({ organizationId: z.string().uuid().optional() }).parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;

    return {
      result: await notificationEngine?.notify({
        type: 'system_error',
        organizationId,
        variables: { organization: organizationId }
      })
    };
  });

  app.get('/api/admin/analytics', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:read');
    const query = analyticsQuerySchema.parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      analytics: await analytics.getDashboard(
        resolveAnalyticsPeriod({
          preset: query.preset,
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
          ...(organizationId ? { organizationId } : {}),
          ...(query.siteId ? { siteId: query.siteId } : {})
        })
      )
    };
  });

  app.get('/api/admin/analytics/export', async (request, reply) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'data:export');
    const query = analyticsExportQuerySchema.parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);
    const rows = await analytics.exportRows(
      resolveAnalyticsPeriod({
        preset: query.preset,
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
        ...(organizationId ? { organizationId } : {}),
        ...(query.siteId ? { siteId: query.siteId } : {})
      })
    );

    if (query.format === 'xlsx') {
      reply.type('application/vnd.ms-excel');
      reply.header('Content-Disposition', 'attachment; filename="visitor-os-analytics.xls"');

      return toSpreadsheetXml(rows);
    }

    reply.type('text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="visitor-os-analytics.csv"');

    return toCsv(rows);
  });

  app.post('/api/admin/analytics/snapshots', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = analyticsSnapshotSchema.parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;
    const filters = resolveAnalyticsPeriod({
      preset: body.preset,
      ...(body.from ? { from: body.from } : {}),
      ...(body.to ? { to: body.to } : {}),
      organizationId,
      ...(body.siteId ? { siteId: body.siteId } : {})
    });
    const dashboard = await analytics.getDashboard(filters);

    await analytics.createSnapshot({
      organizationId,
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
      periodType: body.periodType,
      periodStart: filters.from,
      periodEnd: filters.to,
      metrics: dashboard
    });

    return {
      ok: true,
      snapshots: await analytics.countSnapshots(organizationId)
    };
  });

  app.get('/api/admin/knowledge', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const query = knowledgeQuerySchema.parse(request.query);
    const organizationId =
      auth.requireOrganizationAccess(context, query.organizationId) ?? context.user.organizationId;

    if (!knowledge) {
      throw new AppError('Knowledge repository is not available', {
        statusCode: 503,
        code: 'KNOWLEDGE_UNAVAILABLE'
      });
    }

    return {
      documents: await knowledge.list({
        organizationId,
        siteId: query.siteId,
        ...(query.search ? { search: query.search } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {})
      }),
      types: knowledgeDocumentTypes,
      statuses: knowledgeStatuses,
      indexingJobs: knowledgeQueue?.list(organizationId, query.siteId) ?? [],
      statistics: await knowledgeStatistics?.get(organizationId, query.siteId)
    };
  });

  app.post('/api/admin/knowledge/import', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = knowledgeImportBodySchema.parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;

    if (!knowledgeImporter) {
      throw new AppError('Knowledge importer is not available', {
        statusCode: 503,
        code: 'KNOWLEDGE_UNAVAILABLE'
      });
    }

    return {
      document: await knowledgeImporter.import({
        organizationId,
        siteId: body.siteId,
        title: body.title,
        ...(body.description ? { description: body.description } : {}),
        category: body.category,
        type: body.type,
        language: body.language,
        content: body.content,
        tags: body.tags,
        ...(body.author ? { author: body.author } : {}),
        source: body.source
      })
    };
  });

  app.post('/api/admin/knowledge/import-file', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = knowledgeFileImportBodySchema.parse(request.body);
    const organizationId =
      auth.requireOrganizationAccess(context, body.organizationId) ?? context.user.organizationId;

    if (!knowledgeQueue) {
      throw new AppError('Knowledge importer is not available', {
        statusCode: 503,
        code: 'KNOWLEDGE_UNAVAILABLE'
      });
    }

    const data = Buffer.from(body.dataBase64, 'base64');
    if (data.byteLength === 0) {
      throw new AppError('Uploaded knowledge file is empty', {
        statusCode: 400,
        code: 'KNOWLEDGE_FILE_EMPTY'
      });
    }

    return knowledgeQueue.enqueueFileImport({
      organizationId,
      siteId: body.siteId,
      ...(body.title ? { title: body.title } : {}),
      ...(body.description ? { description: body.description } : {}),
      category: body.category,
      ...(body.type ? { type: body.type } : {}),
      language: body.language,
      fileName: body.fileName,
      ...(body.mimeType ? { mimeType: body.mimeType } : {}),
      data,
      tags: body.tags,
      ...(body.author ? { author: body.author } : {}),
      ...(body.chunking ? { chunking: body.chunking } : {})
    });
  });

  app.get('/api/admin/knowledge/search', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const query = z
      .object({
        organizationId: z.string().uuid().optional(),
        siteId: z.string().uuid(),
        q: z.string().min(1),
        category: z.string().optional(),
        tags: z.string().optional(),
        language: z.string().min(2).optional()
      })
      .parse(request.query);
    const organizationId =
      auth.requireOrganizationAccess(context, query.organizationId) ?? context.user.organizationId;

    return {
      results:
        (await knowledgeSearch?.search({
          organizationId,
          siteId: query.siteId,
          query: query.q,
          ...(query.category ? { category: query.category } : {}),
          ...(query.tags
            ? {
                tags: query.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              }
            : {}),
          ...(query.language ? { language: query.language } : {}),
          limit: 10
        })) ?? []
    };
  });

  app.get('/api/admin/knowledge/:documentId/versions', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ documentId: z.string().uuid() }).parse(request.params);
    const organizationId = auth.requireOrganizationAccess(context) ?? context.user.organizationId;

    return {
      versions: (await knowledge?.versions(params.documentId, organizationId)) ?? []
    };
  });

  app.patch('/api/admin/knowledge/:documentId/archive', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ documentId: z.string().uuid() }).parse(request.params);
    const organizationId = auth.requireOrganizationAccess(context) ?? context.user.organizationId;
    const document = await knowledge?.archive(params.documentId, organizationId);

    if (!document) {
      throw new AppError('Knowledge document not found', {
        statusCode: 404,
        code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND'
      });
    }

    return { document };
  });

  app.delete('/api/admin/knowledge/:documentId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ documentId: z.string().uuid() }).parse(request.params);
    const organizationId = auth.requireOrganizationAccess(context) ?? context.user.organizationId;

    return {
      deleted: (await knowledge?.delete(params.documentId, organizationId)) ?? false
    };
  });

  app.get('/api/admin/conversations', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:read');
    const query = organizationQuerySchema.parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      conversations: await conversations.listAdminConversations({
        ...(organizationId ? { organizationId } : {}),
        ...(query.search ? { search: query.search } : {})
      }),
      statuses: conversationStatuses
    };
  });

  app.get('/api/admin/conversations/:conversationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:read');
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);
    const conversation = await conversations.findAdminConversation(
      params.conversationId,
      organizationId
    );

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    return { conversation, statuses: conversationStatuses };
  });

  app.patch('/api/admin/conversations/:conversationId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'conversations:write');
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(conversationStatuses) }).parse(request.body);
    const existing = await conversations.findConversation(params.conversationId);
    if (!existing) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    auth.requireOrganizationAccess(context, existing.organization_id);
    const conversation = await conversations.updateStatus(params.conversationId, body.status);

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    return { conversation };
  });

  app.get('/api/admin/prospects', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:read');
    const query = prospectFilterSchema.parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      prospects: await prospects.list({
        ...query,
        ...(organizationId ? { organizationId } : {})
      }),
      statuses: prospectStatuses,
      tags: organizationId ? await crm.listTags(organizationId) : []
    };
  });

  app.get('/api/admin/organizations', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:read');

    return {
      organizations:
        context.user.role === 'SuperAdmin'
          ? await organizations.list()
          : optionalArray(await organizations.find(context.user.organizationId)),
      statuses: organizationStatuses,
      roles: userRoles
    };
  });

  app.post('/api/admin/organizations', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const body = organizationInputSchema.parse(request.body);
    const organization = await organizations.create(toOrganizationInput(body));

    await notificationEngine?.notify({
      type: 'new_organization',
      organizationId: organization.id,
      variables: { organization: organization.name },
      channels: ['internal']
    });

    return {
      organization,
      statuses: organizationStatuses
    };
  });

  app.get('/api/admin/organizations/:organizationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:read');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    auth.requireOrganizationAccess(context, params.organizationId);
    const organization = await organizations.find(params.organizationId);

    if (!organization) {
      throw new AppError('Organization not found', {
        statusCode: 404,
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return { organization, export: { organization } };
  });

  app.put('/api/admin/organizations/:organizationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = organizationInputSchema.parse(request.body);
    const organization = await organizations.update(
      params.organizationId,
      toOrganizationInput(body)
    );

    if (!organization) {
      throw new AppError('Organization not found', {
        statusCode: 404,
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return { organization };
  });

  app.patch('/api/admin/organizations/:organizationId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(organizationStatuses) }).parse(request.body);
    const organization = await organizations.updateStatus(params.organizationId, body.status);

    if (!organization) {
      throw new AppError('Organization not found', {
        statusCode: 404,
        code: 'ORGANIZATION_NOT_FOUND'
      });
    }

    return { organization };
  });

  app.delete('/api/admin/organizations/:organizationId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'organizations:write');
    const params = z.object({ organizationId: z.string().uuid() }).parse(request.params);

    return { deleted: await organizations.delete(params.organizationId) };
  });

  app.get('/api/admin/sites', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:read');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);

    return {
      sites: await sites.list(organizationId),
      statuses: siteStatuses
    };
  });

  app.post('/api/admin/sites', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const body = siteInputSchema.parse(request.body);
    auth.requireOrganizationAccess(context, body.organizationId);
    const site = await sites.create(toSiteInput(body));

    await notificationEngine?.notify({
      type: 'new_site',
      organizationId: site.organization_id,
      siteId: site.id,
      variables: { site: site.name, organization: site.organization_id },
      channels: ['internal']
    });

    return {
      site,
      statuses: siteStatuses
    };
  });

  app.get('/api/admin/sites/:siteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:read');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await sites.find(params.siteId);

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }
    auth.requireOrganizationAccess(context, site.organization_id);

    const config = await businessConfigEngine.resolveConfig(site.business_config_id);

    return { site, config, export: { site, config } };
  });

  app.put('/api/admin/sites/:siteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = siteInputSchema.parse(request.body);
    auth.requireOrganizationAccess(context, body.organizationId);
    const site = await sites.update(params.siteId, toSiteInput(body));

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return { site };
  });

  app.patch('/api/admin/sites/:siteId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(siteStatuses) }).parse(request.body);
    const existing = await sites.find(params.siteId);
    if (!existing) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }
    auth.requireOrganizationAccess(context, existing.organization_id);
    const site = await sites.updateStatus(params.siteId, body.status);

    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return { site };
  });

  app.delete('/api/admin/sites/:siteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'sites:write');
    const params = z.object({ siteId: z.string().uuid() }).parse(request.params);
    const site = await sites.find(params.siteId);
    if (!site) {
      throw new AppError('Site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }
    auth.requireOrganizationAccess(context, site.organization_id);

    return { deleted: await sites.delete(params.siteId) };
  });

  app.get('/api/admin/crm/tags', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:read');
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId =
      auth.requireOrganizationAccess(context, query.organizationId) ?? context.user.organizationId;

    return { tags: await crm.listTags(organizationId) };
  });

  app.post('/api/admin/prospects/:prospectId/tags', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = z.object({ tagId: z.string().uuid() }).parse(request.body);
    const prospect = await prospects.findDetail(
      params.prospectId,
      auth.requireOrganizationAccess(context)
    );
    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }
    await crm.addProspectTag(params.prospectId, body.tagId, 'manual');

    return { prospect: await prospects.findDetail(params.prospectId, prospect.organization_id) };
  });

  app.delete('/api/admin/prospects/:prospectId/tags/:tagId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z
      .object({ prospectId: z.string().uuid(), tagId: z.string().uuid() })
      .parse(request.params);
    const prospect = await prospects.findDetail(
      params.prospectId,
      auth.requireOrganizationAccess(context)
    );
    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }
    await crm.removeProspectTag(params.prospectId, params.tagId);

    return { prospect: await prospects.findDetail(params.prospectId, prospect.organization_id) };
  });

  app.post('/api/admin/crm/notes', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const body = noteBodySchema.parse(request.body);
    const organizationId = auth.requireOrganizationAccess(context) ?? context.user.organizationId;

    return {
      note: await crm.createNote({
        organizationId,
        authorUserId: context.user.id,
        content: body.content,
        ...(body.prospectId ? { prospectId: body.prospectId } : {}),
        ...(body.conversationId ? { conversationId: body.conversationId } : {})
      })
    };
  });

  app.put('/api/admin/crm/notes/:noteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ noteId: z.string().uuid() }).parse(request.params);
    const body = z.object({ content: z.string().min(1).max(5000) }).parse(request.body);
    const note = await crm.updateNote(
      params.noteId,
      auth.requireOrganizationAccess(context) ?? context.user.organizationId,
      body.content
    );

    if (!note) {
      throw new AppError('Note not found', { statusCode: 404, code: 'NOTE_NOT_FOUND' });
    }

    return { note };
  });

  app.delete('/api/admin/crm/notes/:noteId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ noteId: z.string().uuid() }).parse(request.params);

    return {
      deleted: await crm.deleteNote(
        params.noteId,
        auth.requireOrganizationAccess(context) ?? context.user.organizationId
      )
    };
  });

  app.get('/api/admin/crm/follow-ups', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:read');
    const query = z
      .object({ mode: z.enum(['today', 'overdue', 'pending', 'completed']).optional() })
      .parse(request.query);

    return {
      followUps: await crm.listFollowUps(
        auth.requireOrganizationAccess(context) ?? context.user.organizationId,
        query.mode
      )
    };
  });

  app.post('/api/admin/crm/follow-ups', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const body = followUpBodySchema.parse(request.body);
    const organizationId = auth.requireOrganizationAccess(context) ?? context.user.organizationId;
    const followUp = await crm.createFollowUp({
      organizationId,
      prospectId: body.prospectId,
      authorUserId: context.user.id,
      dueAt: body.dueAt,
      reason: body.reason,
      ...(body.conversationId ? { conversationId: body.conversationId } : {})
    });
    const dueAt = new Date(body.dueAt);
    const today = new Date();
    const sameDay =
      dueAt.getFullYear() === today.getFullYear() &&
      dueAt.getMonth() === today.getMonth() &&
      dueAt.getDate() === today.getDate();

    if (sameDay || dueAt.getTime() < Date.now()) {
      await notificationEngine?.notify({
        type: dueAt.getTime() < Date.now() ? 'follow_up_overdue' : 'follow_up_today',
        organizationId,
        variables: {
          createdAt: followUp.created_at.toISOString(),
          status: followUp.status
        },
        channels: ['internal', 'email']
      });
    }

    return {
      followUp
    };
  });

  app.patch('/api/admin/crm/follow-ups/:followUpId/complete', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ followUpId: z.string().uuid() }).parse(request.params);
    const followUp = await crm.completeFollowUp(
      params.followUpId,
      auth.requireOrganizationAccess(context) ?? context.user.organizationId
    );

    if (!followUp) {
      throw new AppError('Follow-up not found', { statusCode: 404, code: 'FOLLOW_UP_NOT_FOUND' });
    }

    return { followUp };
  });

  app.get('/api/admin/prospects/export', async (request, reply) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'data:export');
    const query = prospectFilterSchema
      .extend({ format: z.enum(['csv', 'xlsx']).default('csv') })
      .parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);
    const rows = await crm.exportProspects({
      ...query,
      ...(organizationId ? { organizationId } : {})
    });
    const exportOrganizationId = organizationId ?? context.user.organizationId;

    await notificationEngine?.notify({
      type: 'export_completed',
      organizationId: exportOrganizationId,
      variables: {
        organization: exportOrganizationId,
        status: `${rows.length} lignes`,
        createdAt: new Date().toISOString()
      },
      channels: ['internal', 'email']
    });

    if (query.format === 'xlsx') {
      reply.type('application/vnd.ms-excel');
      reply.header('Content-Disposition', 'attachment; filename="visitor-os-prospects.xls"');

      return toSpreadsheetXml(rows);
    }

    reply.type('text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="visitor-os-prospects.csv"');

    return toCsv(rows);
  });

  app.post('/api/admin/prospects/:prospectId/recalculate-score', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const organizationId = auth.requireOrganizationAccess(context) ?? context.user.organizationId;
    const prospect = await prospects.findDetail(params.prospectId, organizationId);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    const scoring = await crm.recalculateScore({
      organizationId,
      prospectId: params.prospectId,
      previousScore: prospect.score_current
    });

    return {
      scoring,
      prospect: await prospects.findDetail(params.prospectId, organizationId)
    };
  });

  app.get('/api/admin/prospects/:prospectId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:read');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const query = z.object({ organizationId: z.string().uuid().optional() }).parse(request.query);
    const organizationId = auth.requireOrganizationAccess(context, query.organizationId);
    const prospect = await prospects.findDetail(params.prospectId, organizationId);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    return { prospect, statuses: prospectStatuses };
  });

  app.patch('/api/admin/prospects/:prospectId/status', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'prospects:write');
    const params = z.object({ prospectId: z.string().uuid() }).parse(request.params);
    const body = z.object({ status: z.enum(prospectStatuses) }).parse(request.body);
    const existing = await prospects.findDetail(
      params.prospectId,
      auth.requireOrganizationAccess(context)
    );
    if (!existing) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }
    const prospect = await prospects.updateStatus(params.prospectId, body.status);

    if (!prospect) {
      throw new AppError('Prospect not found', { statusCode: 404, code: 'PROSPECT_NOT_FOUND' });
    }

    return { prospect };
  });

  app.get('/api/admin/configs', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');

    return { configs: await businessConfigEngine.list() };
  });

  app.get('/api/admin/configs/:configId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);
    const config = await businessConfigEngine.getConfig(params.configId);

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(params.configId)
    };
  });

  app.put('/api/admin/configs/:configId', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);
    const body = businessConfigImportPayloadSchema.parse(request.body);
    const config = await businessConfigEngine.saveConfig({
      id: params.configId,
      config: body.config,
      ...(body.author ? { author: body.author } : {}),
      ...(body.comment ? { comment: body.comment } : {})
    });

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(params.configId)
    };
  });

  app.post('/api/admin/configs/import', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');
    const body = businessConfigImportPayloadSchema.parse(request.body);
    const config = await businessConfigEngine.importConfig({
      config: body.config,
      ...(body.author ? { author: body.author } : {}),
      ...(body.comment ? { comment: body.comment } : {})
    });

    return {
      config,
      prompt: buildSystemPrompt(config),
      history: await businessConfigEngine.listHistory(config.id)
    };
  });

  app.post('/api/admin/configs/reload', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'settings:access');

    await businessConfigEngine.reload();

    return {
      configs: await businessConfigEngine.list()
    };
  });

  app.get('/api/admin/configs/:configId/export', async (request) => {
    const context = getAuthContext(authContexts, request);
    auth.requirePermission(context, 'data:export');
    const params = z.object({ configId: z.string().min(1) }).parse(request.params);

    return {
      config: await businessConfigEngine.exportConfig(params.configId)
    };
  });
}

function getAuthContext(contexts: WeakMap<object, AuthContext>, request: object): AuthContext {
  const context = contexts.get(request);
  if (!context) {
    throw new AppError('Authentication required', { statusCode: 401, code: 'AUTH_REQUIRED' });
  }

  return context;
}

function optionalArray<T>(value: T | null): T[] {
  return value ? [value] : [];
}

function toOrganizationInput(input: z.infer<typeof organizationInputSchema>) {
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

function toSiteInput(input: z.infer<typeof siteInputSchema>) {
  return {
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    businessConfigId: input.businessConfigId,
    language: input.language,
    status: input.status,
    widgetEnabled: input.widgetEnabled,
    ...(input.domain ? { domain: input.domain } : {}),
    ...(input.widgetPublicKey ? { widgetPublicKey: input.widgetPublicKey } : {})
  };
}
