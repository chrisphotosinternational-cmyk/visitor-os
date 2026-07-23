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
import type {
  ReasoningEngineService,
  ReasoningOutput
} from '../reasoning/reasoning-engine-service.js';
import type {
  ChatbotRuntimeCache,
  ChatbotRuntimeService
} from '../chatbot-runtime/chatbot-runtime-service.js';

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
      reasoningEngine?: ReasoningEngineService | undefined;
      runtime?: ChatbotRuntimeService | undefined;
      runtimeCache?: ChatbotRuntimeCache | undefined;
    }
  ) {}

  async getWidgetConfig(input: ChatbotSiteReference): Promise<ChatbotWidgetConfig> {
    const site = await this.resolveSite(input);
    this.dependencies.production?.assertDomainAllowed(site, input.sourceUrl);
    const businessConfig =
      (await this.dependencies.runtimeCache?.getOrSet(
        `business-config:${site.organization_id}:${site.id}:${site.business_config_id}`,
        [`site:${site.id}`, 'business-config', 'widget-config'],
        () => this.dependencies.decisionEngine.getBusinessConfig(site.business_config_id)
      )) ?? (await this.dependencies.decisionEngine.getBusinessConfig(site.business_config_id));
    const widgetSettings =
      (await this.dependencies.runtimeCache?.getOrSet(
        `widget-settings:${site.organization_id}:${site.id}`,
        [`site:${site.id}`, 'site-settings', 'widget-config'],
        () => Promise.resolve(this.dependencies.production?.widgetSettings(site))
      )) ?? this.dependencies.production?.widgetSettings(site);

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
    await this.dependencies.runtime?.recordWidgetEvent({
      organizationId: site.organization_id,
      siteId: site.id,
      conversationId: conversation.id,
      eventType: 'conversation_started',
      publicKey: site.widget_public_key,
      sourceUrl: input.sourceUrl ?? input.pageUrl,
      metadata: { referrer: input.referrer ?? null }
    });

    return {
      conversationId: conversation.id,
      visitorId,
      message: 'Conversation demarree.'
    };
  }

  async sendMessage(input: SendChatbotMessageInput): Promise<ChatbotMessageResponse> {
    const startedAt = Date.now();
    const payloadBytes = byteLength(input.content);
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

    const visitorMessage = await this.dependencies.conversations.addMessage({
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
    const knowledgeStartedAt = Date.now();
    const baseDecision = await this.decideWithSiteKnowledge({
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
    const knowledgeTimeMs = Date.now() - knowledgeStartedAt;
    const reasoningStartedAt = Date.now();
    const reasoning = this.dependencies.reasoningEngine
      ? await this.dependencies.reasoningEngine.reason({
          organizationId: conversation.organization_id,
          siteId: conversation.site_id,
          visitorId: conversation.visitor_id,
          conversationId: conversation.id,
          messageId: visitorMessage.id,
          userMessage: input.content,
          conversationHistory: recentHistory.map((message) => ({
            senderType: message.sender_type,
            content: message.content
          })),
          detectedIntent: baseDecision.reason,
          knowledgeAnswer: knowledgeAnswerFromDecision(baseDecision)
        })
      : null;
    const reasoningTimeMs = Date.now() - reasoningStartedAt;
    const decision = reasoning
      ? {
          ...baseDecision,
          reply:
            baseDecision.source === 'human_escalation'
              ? baseDecision.reply
              : reasoning.response_text,
          source:
            baseDecision.source === 'human_escalation' && reasoning.response_type === 'fallback'
              ? baseDecision.source
              : reasoning.response_type,
          confidence: reasoning.confidence_score,
          shouldEscalate:
            baseDecision.shouldEscalate || reasoning.next_best_action === 'escalate_to_admin',
          matchedItemId: reasoning.selected_knowledge_item_id ?? baseDecision.matchedItemId,
          reason: reasoning.detected_intent
        }
      : baseDecision;

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
        ...(decision.reason ? { decisionReason: decision.reason } : {}),
        ...(reasoning?.quality_scores.response_quality_score
          ? { responseQualityScore: reasoning.quality_scores.response_quality_score }
          : {})
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

    await this.recordRuntimeReview({
      organizationId: conversation.organization_id,
      siteId: conversation.site_id,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      question: input.content,
      source: decision.source,
      confidence: decision.confidence,
      matchedItemId: decision.matchedItemId,
      reasoning
    });

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
      reasoning?.lead_capture_recommended ||
      (site &&
        (await this.dependencies.production?.shouldPromptLeadCapture({
          site,
          conversationId: conversation.id,
          lastDecisionSource: decision.source,
          lastMessage: input.content
        })));
    const leadSettings = site ? this.dependencies.production?.widgetSettings(site) : undefined;

    const response: ChatbotMessageResponse = {
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
              enabled: true as const,
              fields: leadSettings.leadCaptureFields,
              privacyMessage: leadSettings.privacyMessage
            }
          : undefined
    };
    await this.dependencies.runtime?.recordMetrics({
      organizationId: conversation.organization_id,
      siteId: conversation.site_id,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      totalTimeMs: Date.now() - startedAt,
      knowledgeTimeMs,
      reasoningTimeMs,
      payloadBytes,
      responseBytes: byteLength(JSON.stringify(response)),
      cache: this.dependencies.runtimeCache?.snapshot()
    });
    await this.dependencies.runtime?.recordWidgetEvent({
      organizationId: conversation.organization_id,
      siteId: conversation.site_id,
      conversationId: conversation.id,
      eventType: 'message_sent',
      sourceUrl: input.sourceUrl,
      message: 'Widget message processed',
      metadata: {
        responseSource: decision.source,
        confidence: decision.confidence,
        nextBestAction: reasoning?.next_best_action ?? null
      }
    });
    return response;
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
    await this.dependencies.runtime?.recordWidgetEvent({
      organizationId: conversation.organization_id,
      siteId: conversation.site_id,
      conversationId: conversation.id,
      eventType: 'lead_sent',
      sourceUrl: input.sourceUrl,
      message: 'Lead capture submitted',
      metadata: { deduplicated: captured.deduplicated }
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

  private async recordRuntimeReview(input: {
    organizationId: string;
    siteId: string;
    conversationId: string;
    messageId: string;
    question: string;
    source: string;
    confidence: number;
    matchedItemId?: string | undefined;
    reasoning: ReasoningOutput | null;
  }): Promise<void> {
    const reasons: string[] = [];
    if (input.confidence < 0.45) reasons.push('low_confidence');
    if (input.source === 'fallback' || input.source === 'human_escalation') {
      reasons.push('fallback_used');
    }
    if (!input.matchedItemId) reasons.push('missing_knowledge_item');
    if (
      (input.reasoning?.lead_readiness_score ?? 0) >= 70 &&
      input.reasoning?.next_best_action !== 'create_prospect'
    ) {
      reasons.push('hot_lead_without_capture');
    }
    if (input.reasoning?.next_best_action === 'escalate_to_admin') {
      reasons.push('admin_escalation');
    }
    if ((input.reasoning?.quality_scores.response_quality_score ?? 1) < 0.5) {
      reasons.push('low_quality_score');
    }
    if (reasons.length === 0) return;

    await this.dependencies.runtime?.enqueueReview({
      organizationId: input.organizationId,
      siteId: input.siteId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      reason: reasons.join(','),
      confidenceScore: input.reasoning?.confidence_score ?? input.confidence,
      leadReadinessScore: input.reasoning?.lead_readiness_score ?? null,
      nextBestAction: input.reasoning?.next_best_action ?? null,
      question: input.question
    });
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


function knowledgeAnswerFromDecision(decision: DecisionEngineResult) {
  if (!['knowledge_base', 'knowledge_search', 'faq'].includes(decision.source)) return null;

  return {
    reply: decision.reply,
    source: decision.source === 'faq' ? ('site_qa' as const) : ('knowledge_engine' as const),
    confidence: decision.confidence,
    matchedItemId: decision.matchedItemId,
    detectedIntent: decision.reason,
    reason: decision.reason ?? decision.source
  };
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}
