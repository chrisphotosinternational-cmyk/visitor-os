import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import { ConversationRepository } from '../conversations/conversation-repository.js';
import { ProspectRepository } from '../prospects/prospect-repository.js';
import type { Database } from '../../database/client.js';
import type { DecisionEngine } from '../decision-engine/decision-engine.js';
import { CrmRepository } from '../crm/crm-repository.js';
import type { NotificationEngine } from '../notifications/notification-engine.js';

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

  app.get('/api/widget/config', async (request) => {
    const query = siteKeyQuerySchema.parse(request.query);
    const site = await resolveWidgetSite(conversations, query);

    const businessConfig = await decisionEngine.getBusinessConfig(site.business_config_id);

    return {
      siteKey: site.widget_public_key,
      siteId: site.id,
      siteSlug: site.slug,
      brandName: businessConfig.identity.name,
      activity: businessConfig.identity.category,
      welcomeMessage: businessConfig.widget.welcomeMessage ?? 'Bonjour, je peux vous aider.',
      fallbackMessage:
        businessConfig.widget.fallbackMessage ??
        "Je n'ai pas encore cette information. Contactez-nous pour une reponse precise.",
      quickReplies: businessConfig.widget.quickReplies,
      primaryColor: businessConfig.identity.colors.primary ?? '#1f6f5b'
    };
  });

  app.post('/api/widget/conversations', async (request) => {
    const body = startConversationSchema.parse(request.body);
    const site = await resolveWidgetSite(conversations, body);

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

    await notificationEngine?.notify({
      type: 'new_conversation',
      organizationId: site.organization_id,
      siteId: site.id,
      variables: {
        site: site.name,
        createdAt: new Date().toISOString(),
        conversationUrl: `/admin/conversations/${conversation.id}`
      }
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
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      siteId: conversation.site_id,
      activity: site?.business_config_id ?? 'default',
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

    if (decision.aiEvent) {
      await conversations.addAIEvent({
        organizationId: conversation.organization_id,
        siteId: conversation.site_id,
        conversationId: conversation.id,
        ...decision.aiEvent
      });
    }

    const prospectId = prospect?.id ?? conversation.prospect_id;
    if (prospectId) {
      const scoringMessages = [...recentHistory.map((message) => message.content), decision.reply];
      const appliedTags = await crm.applyAutomaticTags({
        organizationId: conversation.organization_id,
        prospectId,
        conversationId: conversation.id,
        messages: scoringMessages
      });
      const scoring = await crm.recalculateScore({
        organizationId: conversation.organization_id,
        prospectId
      });

      if (scoring.score >= 70) {
        await notificationEngine?.notify({
          type: 'hot_prospect',
          organizationId: conversation.organization_id,
          siteId: conversation.site_id,
          variables: {
            site: site?.name ?? conversation.site_id,
            conversationUrl: `/admin/conversations/${conversation.id}`,
            score: scoring.score,
            tags: appliedTags.map((tag) => tag.label).join(', ')
          }
        });
      }

      if (appliedTags.some((tag) => tag.slug === 'reservation')) {
        await notificationEngine?.notify({
          type: 'potential_booking',
          organizationId: conversation.organization_id,
          siteId: conversation.site_id,
          variables: {
            site: site?.name ?? conversation.site_id,
            conversationUrl: `/admin/conversations/${conversation.id}`,
            score: scoring.score,
            tags: appliedTags.map((tag) => tag.label).join(', ')
          }
        });
      }
    }

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

async function resolveWidgetSite(
  conversations: ConversationRepository,
  input: {
    siteKey?: string | undefined;
    siteId?: string | undefined;
    siteSlug?: string | undefined;
  }
) {
  if (input.siteId) {
    const site = await conversations.findSite(input.siteId);

    if (site?.status === 'active' && site.widget_enabled) {
      return site;
    }
  }

  if (input.siteSlug) {
    const site = await conversations.findSiteBySlug(input.siteSlug);

    if (site) {
      return site;
    }
  }

  if (input.siteKey) {
    const site = await conversations.findSiteByWidgetKey(input.siteKey);

    if (site) {
      return site;
    }
  }

  throw new AppError('Widget site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
}
