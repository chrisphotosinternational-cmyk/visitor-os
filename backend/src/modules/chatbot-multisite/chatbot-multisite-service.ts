import { randomUUID } from 'node:crypto';
import { AppError } from '../../core/errors/app-error.js';
import type {
  ConversationRepository,
  SiteRecord
} from '../conversations/conversation-repository.js';
import type { ProspectRepository } from '../prospects/prospect-repository.js';
import type { CrmRepository } from '../crm/crm-repository.js';
import type { DecisionEngine, DecisionEngineResult } from '../decision-engine/decision-engine.js';
import type { NotificationEngine } from '../notifications/notification-engine.js';
import type { ChatbotProductionService } from '../chatbot-production/chatbot-production-service.js';
import type { KnowledgeEngineService } from '../knowledge-engine/knowledge-engine-service.js';

export type ChatbotSiteReference = {
  siteKey?: string | undefined;
  siteId?: string | undefined;
  siteSlug?: string | undefined;
  sourceUrl?: string | undefined;
};

export type StartChatbotConversationInput = ChatbotSiteReference & {
  anonymousId?: string | undefined;
  pageUrl?: string | undefined;
  referrer?: string | undefined;
};

export type SendChatbotMessageInput = {
  conversationId: string;
  content: string;
  sourceUrl?: string | undefined;
};

export type ChatbotWidgetConfig = {
  siteKey: string;
  siteId: string;
  siteSlug: string | null;
  brandName: string;
  activity: string;
  welcomeMessage: string;
  fallbackMessage: string;
  quickReplies: string[];
  primaryColor: string;
  privacyMessage: string;
  leadCapture: {
    enabled: boolean;
    trigger: string;
    fields: string[];
  };
};

export type ChatbotConversationStarted = {
  conversationId: string;
  visitorId: string;
  message: string;
};

export type ChatbotMessageResponse = {
  conversationId: string;
  prospectId: string | null;
  reply: string;
  source: string;
  confidence: number;
  shouldEscalate: boolean;
  processingTimeMs: number;
  matchedItemId: string | undefined;
  reason: string | undefined;
  leadCapture:
    | {
        enabled: true;
        fields: string[];
        privacyMessage: string;
      }
    | undefined;
};

type NotificationRequest = Parameters<NotificationEngine['notify']>[0];

export class MultiSiteChatbotService {
  constructor(
    private readonly dependencies: {
      conversations: ConversationRepository;
      prospects: ProspectRepository;
      crm: CrmRepository;
      decisionEngine: DecisionEngine;
      notificationEngine?: { notify(input: NotificationRequest): Promise<unknown> } | undefined;
      production?: ChatbotProductionService | undefined;
      knowledgeEngine?: KnowledgeEngineService | undefined;
    }
  ) {}

  async getWidgetConfig(input: ChatbotSiteReference): Promise<ChatbotWidgetConfig> {
    const site = await this.resolveSite(input);
    this.dependencies.production?.assertDomainAllowed(site, input.sourceUrl);
    const businessConfig = await this.dependencies.decisionEngine.getBusinessConfig(
      site.business_config_id
    );
    const widgetSettings = this.dependencies.production?.widgetSettings(site);

    return {
      siteKey: site.widget_public_key,
      siteId: site.id,
      siteSlug: site.slug,
      brandName: businessConfig.identity.name,
      activity: businessConfig.identity.category,
      welcomeMessage:
        widgetSettings?.welcomeMessage ??
        businessConfig.widget.welcomeMessage ??
        'Bonjour, je peux vous aider.',
      fallbackMessage:
        widgetSettings?.fallbackMessage ??
        businessConfig.widget.fallbackMessage ??
        "Je n'ai pas encore cette information. Contactez-nous pour une reponse precise.",
      quickReplies: businessConfig.widget.quickReplies,
      primaryColor:
        widgetSettings?.primaryColor ?? businessConfig.identity.colors.primary ?? '#1f6f5b',
      privacyMessage:
        widgetSettings?.privacyMessage ??
        'Vos informations sont utilisees uniquement pour repondre a votre demande.',
      leadCapture: {
        enabled: widgetSettings?.leadCaptureEnabled ?? false,
        trigger: widgetSettings?.leadCaptureTrigger ?? 'after_messages',
        fields: widgetSettings?.leadCaptureFields ?? ['name', 'email', 'phone', 'need']
      }
    };
  }

  async startConversation(
    input: StartChatbotConversationInput
  ): Promise<ChatbotConversationStarted> {
    const site = await this.resolveSite(input);
    this.dependencies.production?.assertDomainAllowed(site, input.sourceUrl ?? input.pageUrl);
    const visitorId = await this.dependencies.conversations.upsertVisitor({
      organizationId: site.organization_id,
      siteId: site.id,
      anonymousId: input.anonymousId ?? randomUUID()
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

    if (input.pageUrl) {
      conversationInput.pageUrl = input.pageUrl;
    }

    if (input.referrer) {
      conversationInput.referrer = input.referrer;
    }

    const conversation =
      await this.dependencies.conversations.createConversation(conversationInput);

    await this.dependencies.conversations.addMessage({
      organizationId: site.organization_id,
      conversationId: conversation.id,
      senderType: 'system',
      content: 'Conversation demarree depuis le widget.'
    });

    await this.dependencies.notificationEngine?.notify({
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
  }

  async sendMessage(input: SendChatbotMessageInput): Promise<ChatbotMessageResponse> {
    const conversation = await this.dependencies.conversations.findConversation(
      input.conversationId
    );

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }

    const site = await this.dependencies.conversations.findSite(conversation.site_id);
    this.dependencies.production?.assertDomainAllowed(site ?? {}, input.sourceUrl);

    await this.dependencies.conversations.addMessage({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      senderType: 'visitor',
      content: input.content
    });

    const prospect =
      conversation.prospect_id === null
        ? await this.dependencies.prospects.createFromConversation({
            organizationId: conversation.organization_id,
            siteId: conversation.site_id,
            visitorId: conversation.visitor_id,
            question: input.content
          })
        : null;

    if (prospect) {
      await this.dependencies.conversations.linkProspect(conversation.id, prospect.id);
    }

    const recentHistory = await this.dependencies.conversations.listMessages(conversation.id);
    const decision = await this.decideWithSiteKnowledge({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      siteId: conversation.site_id,
      activity: site?.business_config_id ?? 'default',
      message: input.content,
      recentHistory: recentHistory.map((message) => ({
        senderType: message.sender_type,
        content: message.content
      })),
      pageUrl: conversation.page_url
    });

    const assistantMessage = await this.dependencies.conversations.addMessage({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      senderType: 'assistant',
      content: decision.reply,
      decision: {
        responseSource: decision.source,
        responseConfidence: decision.confidence,
        shouldEscalate: decision.shouldEscalate,
        processingTimeMs: decision.processingTimeMs,
        ...(decision.matchedItemId ? { matchedItemId: decision.matchedItemId } : {}),
        ...(decision.reason ? { decisionReason: decision.reason } : {})
      }
    });

    await this.dependencies.conversations.addDecisionEvent({
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
      await this.dependencies.conversations.addAIEvent({
        organizationId: conversation.organization_id,
        siteId: conversation.site_id,
        conversationId: conversation.id,
        ...decision.aiEvent
      });
    }

    if (['fallback', 'human_escalation'].includes(decision.source) || decision.confidence < 0.4) {
      if (this.dependencies.knowledgeEngine) {
        await this.dependencies.knowledgeEngine.enhancedUnanswered({
          organizationId: conversation.organization_id,
          siteId: conversation.site_id,
          conversationId: conversation.id,
          question: input.content,
          detectedIntent: decision.reason,
          confidenceScore: decision.confidence
        });
      } else {
        await this.dependencies.production?.recordUnanswered({
          organizationId: conversation.organization_id,
          siteId: conversation.site_id,
          conversationId: conversation.id,
          question: input.content
        });
      }
    }

    const prospectId = prospect?.id ?? conversation.prospect_id;
    if (prospectId) {
      const scoringMessages = [...recentHistory.map((message) => message.content), decision.reply];
      const appliedTags = await this.dependencies.crm.applyAutomaticTags({
        organizationId: conversation.organization_id,
        prospectId,
        conversationId: conversation.id,
        messages: scoringMessages
      });
      const scoring = await this.dependencies.crm.recalculateScore({
        organizationId: conversation.organization_id,
        prospectId
      });

      if (scoring.score >= 70) {
        await this.dependencies.notificationEngine?.notify({
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
        await this.dependencies.notificationEngine?.notify({
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

    const shouldCaptureLead =
      site &&
      (await this.dependencies.production?.shouldPromptLeadCapture({
        site,
        conversationId: conversation.id,
        lastDecisionSource: decision.source,
        lastMessage: input.content
      }));
    const leadSettings = site ? this.dependencies.production?.widgetSettings(site) : undefined;

    return {
      conversationId: conversation.id,
      prospectId,
      reply: decision.reply,
      source: decision.source,
      confidence: decision.confidence,
      shouldEscalate: decision.shouldEscalate,
      processingTimeMs: decision.processingTimeMs,
      matchedItemId: decision.matchedItemId,
      reason: decision.reason,
      leadCapture:
        shouldCaptureLead && leadSettings
          ? {
              enabled: true,
              fields: leadSettings.leadCaptureFields,
              privacyMessage: leadSettings.privacyMessage
            }
          : undefined
    };
  }

  async captureLead(input: {
    conversationId: string;
    sourceUrl?: string | undefined;
    payload: {
      name?: string | undefined;
      email?: string | undefined;
      phone?: string | undefined;
      need?: string | undefined;
    };
  }): Promise<{ prospectId: string; deduplicated: boolean; message: string }> {
    const conversation = await this.dependencies.conversations.findConversation(
      input.conversationId
    );

    if (!conversation) {
      throw new AppError('Conversation not found', {
        statusCode: 404,
        code: 'CONVERSATION_NOT_FOUND'
      });
    }
    const site = await this.dependencies.conversations.findSite(conversation.site_id);
    if (!site) {
      throw new AppError('Widget site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
    }

    this.dependencies.production?.assertDomainAllowed(site, input.sourceUrl);
    const captured = await this.dependencies.production?.captureLead({
      site,
      conversation,
      payload: input.payload
    });

    if (!captured) {
      throw new AppError('Lead capture is not available', {
        statusCode: 503,
        code: 'LEAD_CAPTURE_UNAVAILABLE'
      });
    }

    await this.dependencies.conversations.addMessage({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      senderType: 'system',
      content: 'Coordonnees prospect capturees via le chatbot.'
    });

    return {
      ...captured,
      message: 'Merci, vos coordonnees ont bien ete transmises.'
    };
  }

  private async decideWithSiteKnowledge(
    input: Parameters<DecisionEngine['decide']>[0]
  ): Promise<DecisionEngineResult> {
    const knowledge = await this.dependencies.knowledgeEngine?.answerQuestion({
      organizationId: input.organizationId,
      siteId: input.siteId,
      question: input.message
    });

    if (knowledge) {
      return {
        reply: knowledge.reply,
        source: 'knowledge_base',
        confidence: knowledge.confidence,
        shouldEscalate: false,
        processingTimeMs: 1,
        ...(knowledge.matchedItemId ? { matchedItemId: knowledge.matchedItemId } : {}),
        reason: knowledge.reason
      };
    }

    const qa = await this.dependencies.production?.findQaAnswer({
      organizationId: input.organizationId,
      siteId: input.siteId,
      question: input.message
    });

    if (qa) {
      return {
        reply: qa.answer,
        source: 'faq',
        confidence: Math.min(0.99, 0.78 + qa.priority / 500),
        shouldEscalate: false,
        processingTimeMs: 1,
        matchedItemId: qa.id,
        reason: `site_qa:${qa.category}`
      };
    }

    return this.dependencies.decisionEngine.decide(input);
  }

  private async resolveSite(input: ChatbotSiteReference): Promise<SiteRecord> {
    if (input.siteId) {
      const site = await this.dependencies.conversations.findSite(input.siteId);

      if (site?.status === 'active' && site.widget_enabled) {
        return site;
      }
    }

    if (input.siteSlug) {
      const site = await this.dependencies.conversations.findSiteBySlug(input.siteSlug);

      if (site) {
        return site;
      }
    }

    if (input.siteKey) {
      const site = await this.dependencies.conversations.findSiteByWidgetKey(input.siteKey);

      if (site) {
        return site;
      }
    }

    throw new AppError('Widget site not found', { statusCode: 404, code: 'SITE_NOT_FOUND' });
  }
}
