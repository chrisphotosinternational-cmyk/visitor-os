import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ConversationRepository } from '../conversations/conversation-repository.js';
import { ProspectRepository } from '../prospects/prospect-repository.js';
import type { Database } from '../../database/client.js';
import type { DecisionEngine } from '../decision-engine/decision-engine.js';
import { CrmRepository } from '../crm/crm-repository.js';
import type { NotificationEngine } from '../notifications/notification-engine.js';
import { MultiSiteChatbotService } from '../chatbot-multisite/chatbot-multisite-service.js';

const widgetSiteReferenceSchema = z
  .object({
    siteKey: z.string().min(1).optional(),
    siteId: z.string().uuid().optional(),
    siteSlug: z.string().min(1).optional()
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

export function registerWidgetRoutes(
  app: FastifyInstance,
  database: Database,
  decisionEngine: DecisionEngine,
  notificationEngine?: NotificationEngine
): void {
  const conversations = new ConversationRepository(database);
  const prospects = new ProspectRepository(database);
  const crm = new CrmRepository(database);
  const chatbot = new MultiSiteChatbotService({
    conversations,
    prospects,
    crm,
    decisionEngine,
    ...(notificationEngine ? { notificationEngine } : {})
  });

  app.get('/api/widget/config', async (request) => {
    const query = siteKeyQuerySchema.parse(request.query);
    return chatbot.getWidgetConfig(query);
  });

  app.post('/api/widget/conversations', async (request) => {
    const body = startConversationSchema.parse(request.body);
    return chatbot.startConversation(body);
  });

  app.post('/api/widget/conversations/:conversationId/messages', async (request) => {
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = messageSchema.parse(request.body);
    return chatbot.sendMessage({
      conversationId: params.conversationId,
      content: body.content
    });
  });
}
