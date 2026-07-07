import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ConversationRepository } from '../conversations/conversation-repository.js';
import { ProspectRepository } from '../prospects/prospect-repository.js';
import type { Database } from '../../database/client.js';
import type { DecisionEngine } from '../decision-engine/decision-engine.js';
import { CrmRepository } from '../crm/crm-repository.js';
import type { NotificationEngine } from '../notifications/notification-engine.js';
import { MultiSiteChatbotService } from '../chatbot-multisite/chatbot-multisite-service.js';
import { ChatbotProductionService } from '../chatbot-production/chatbot-production-service.js';
import { KnowledgeEngineService } from '../knowledge-engine/knowledge-engine-service.js';
import { publicWidgetJs } from '../../core/static/public-widget-assets.js';

const widgetSiteReferenceSchema = z
  .object({
    siteKey: z.string().min(1).optional(),
    siteId: z.string().uuid().optional(),
    siteSlug: z.string().min(1).optional(),
    sourceUrl: z.string().url().optional()
  })
  .refine((value) => Boolean(value.siteKey || value.siteId || value.siteSlug), {
    message: 'siteKey, siteId or siteSlug is required'
  });

const siteKeyQuerySchema = widgetSiteReferenceSchema;

const startConversationSchema = widgetSiteReferenceSchema.extend({
  anonymousId: z.string().min(1).optional(),
  pageUrl: z.string().url().optional(),
  referrer: z.string().optional()
});

const messageSchema = z.object({
  content: z.string().min(1).max(2000)
});

const leadCaptureSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(60).optional(),
  need: z.string().max(1000).optional()
});

export function registerWidgetRoutes(
  app: FastifyInstance,
  database: Database,
  decisionEngine: DecisionEngine,
  notificationEngine?: NotificationEngine
): void {
  const conversations = new ConversationRepository(database);
  const prospects = new ProspectRepository(database);
  const crm = new CrmRepository(database);
  const production = new ChatbotProductionService(database);
  const knowledgeEngine = new KnowledgeEngineService(database);
  const chatbot = new MultiSiteChatbotService({
    conversations,
    prospects,
    crm,
    decisionEngine,
    ...(notificationEngine ? { notificationEngine } : {}),
    production,
    knowledgeEngine
  });

  app.get('/widget/:siteKey.js', (request, reply) => {
    z.object({ siteKey: z.string().min(1) }).parse(request.params);
    reply.type('application/javascript; charset=utf-8');
    return publicWidgetJs;
  });

  app.get('/api/widget/config', async (request) => {
    const query = siteKeyQuerySchema.parse(request.query);
    return chatbot.getWidgetConfig({
      ...query,
      sourceUrl: query.sourceUrl ?? sourceUrlFromRequest(request)
    });
  });

  app.post('/api/widget/conversations', async (request) => {
    const body = startConversationSchema.parse(request.body);
    return chatbot.startConversation({
      ...body,
      sourceUrl: body.sourceUrl ?? sourceUrlFromRequest(request)
    });
  });

  app.post('/api/widget/conversations/:conversationId/messages', async (request) => {
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = messageSchema.parse(request.body);
    return chatbot.sendMessage({
      conversationId: params.conversationId,
      content: body.content,
      sourceUrl: sourceUrlFromRequest(request)
    });
  });

  app.post('/api/widget/conversations/:conversationId/lead', async (request) => {
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = leadCaptureSchema.parse(request.body);
    return chatbot.captureLead({
      conversationId: params.conversationId,
      sourceUrl: sourceUrlFromRequest(request),
      payload: body
    });
  });
}

function sourceUrlFromRequest(request: { headers: Record<string, string | string[] | undefined> }) {
  const origin = headerValue(request.headers.origin);
  if (origin) return origin;
  const referer = headerValue(request.headers.referer);
  return referer;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
