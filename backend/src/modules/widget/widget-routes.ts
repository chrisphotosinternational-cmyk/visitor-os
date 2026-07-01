import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import { ConversationRepository } from '../conversations/conversation-repository.js';
import { ProspectRepository } from '../prospects/prospect-repository.js';
import type { Database } from '../../database/client.js';
import type { DecisionEngine } from '../decision-engine/decision-engine.js';

const siteKeyQuerySchema = z.object({
  siteKey: z.string().min(1)
});

const startConversationSchema = z.object({
  siteKey: z.string().min(1),
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
  decisionEngine: DecisionEngine
): void {
  const conversations = new ConversationRepository(database);
  const prospects = new ProspectRepository(database);

  app.get('/api/widget/config', async (request) => {
    const query = siteKeyQuerySchema.parse(request.query);
    const site = await conversations.findSiteByWidgetKey(query.siteKey);

    if (!site) {
      throw new AppError('Widget site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    return {
      siteKey: query.siteKey,
      brandName: site.name,
      activity: site.activity,
      welcomeMessage: 'Bonjour, je peux vous aider. Posez-moi votre question.',
      fallbackMessage:
        "Je n'ai pas encore cette information. Laissez vos coordonnees et nous vous repondrons rapidement.",
      quickReplies: ['Tarifs', 'Disponibilites', 'Reserver', 'Contact'],
      primaryColor: '#1f6f5b'
    };
  });

  app.post('/api/widget/conversations', async (request) => {
    const body = startConversationSchema.parse(request.body);
    const site = await conversations.findSiteByWidgetKey(body.siteKey);

    if (!site) {
      throw new AppError('Widget site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    const visitorId = await conversations.upsertVisitor({
      organizationId: site.organization_id,
      siteId: site.id,
      anonymousId: body.anonymousId ?? randomUUID()
    });
    const conversationInput: {
      organizationId: string;
      siteId: string;
      visitorId: string;
      pageUrl?: string;
      referrer?: string;
    } = {
      organizationId: site.organization_id,
      siteId: site.id,
      visitorId
    };

    if (body.pageUrl) {
      conversationInput.pageUrl = body.pageUrl;
    }

    if (body.referrer) {
      conversationInput.referrer = body.referrer;
    }

    const conversation = await conversations.createConversation(conversationInput);

    await conversations.addMessage({
      organizationId: site.organization_id,
      conversationId: conversation.id,
      senderType: 'system',
      content: 'Conversation demarree depuis le widget.'
    });

    return {
      conversationId: conversation.id,
      visitorId,
      message: 'Conversation demarree.'
    };
  });

  app.post('/api/widget/conversations/:conversationId/messages', async (request) => {
    const params = z.object({ conversationId: z.string().uuid() }).parse(request.params);
    const body = messageSchema.parse(request.body);
    const conversation = await conversations.findConversation(params.conversationId);

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    const site = await conversations.findSite(conversation.site_id);

    await conversations.addMessage({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      senderType: 'visitor',
      content: body.content
    });

    const prospect =
      conversation.prospect_id === null
        ? await prospects.createFromConversation({
            organizationId: conversation.organization_id,
            siteId: conversation.site_id,
            visitorId: conversation.visitor_id,
            question: body.content
          })
        : null;

    if (prospect) {
      await conversations.linkProspect(conversation.id, prospect.id);
    }

    const recentHistory = await conversations.listMessages(conversation.id);
    const decision = await decisionEngine.decide({
      conversationId: conversation.id,
      siteId: conversation.site_id,
      activity: site?.activity ?? 'demo',
      message: body.content,
      recentHistory: recentHistory.map((message) => ({
        senderType: message.sender_type,
        content: message.content
      })),
      pageUrl: conversation.page_url
    });

    const decisionMetadata = {
      responseSource: decision.source,
      responseConfidence: decision.confidence,
      shouldEscalate: decision.shouldEscalate,
      processingTimeMs: decision.processingTimeMs,
      ...(decision.matchedItemId ? { matchedItemId: decision.matchedItemId } : {}),
      ...(decision.reason ? { decisionReason: decision.reason } : {})
    };

    const assistantMessage = await conversations.addMessage({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      senderType: 'assistant',
      content: decision.reply,
      decision: decisionMetadata
    });

    await conversations.addDecisionEvent({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      source: decision.source,
      confidence: decision.confidence,
      shouldEscalate: decision.shouldEscalate,
      processingTimeMs: decision.processingTimeMs,
      ...(decision.matchedItemId ? { matchedItemId: decision.matchedItemId } : {}),
      ...(decision.reason ? { reason: decision.reason } : {})
    });

    return {
      conversationId: conversation.id,
      prospectId: prospect?.id ?? conversation.prospect_id,
      reply: decision.reply,
      source: decision.source,
      confidence: decision.confidence,
      shouldEscalate: decision.shouldEscalate,
      processingTimeMs: decision.processingTimeMs,
      matchedItemId: decision.matchedItemId,
      reason: decision.reason
    };
  });
}
