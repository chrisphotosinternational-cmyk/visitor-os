import { randomUUID } from 'node:crypto';
import { AppError } from '../../core/errors/app-error.js';
import type {
  ConversationRepository,
  SiteRecord
} from '../conversations/conversation-repository.js';
import type { ProspectRepository } from '../prospects/prospect-repository.js';
import type { CrmRepository } from '../crm/crm-repository.js';
import type {
  DecisionCitation,
  DecisionEngine,
  DecisionEngineResult
} from '../decision-engine/decision-engine.js';
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
  usedChunkIds?: string[];
  usedDocumentIds?: string[];
  sources?: DecisionCitation[];
  citations?: DecisionCitation[];
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
    const commercialIntent = hasStrongCommercialIntent(
      input.content,
      recentHistory.map((message) => ({
        senderType: message.sender_type,
        content: message.content
      }))
    );
    const decisionMessage = commercialIntent
      ? recentHistory
          .filter((message) => message.sender_type === 'visitor')
          .map((message) => message.content)
          .join(' ')
      : input.content;
    const knowledgeStartedAt = Date.now();
    const baseDecision = await this.dependencies.decisionEngine.decide({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      siteId: conversation.site_id,
      activity: site?.business_config_id ?? 'default',
      message: decisionMessage,
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
          shouldEscalate:
            baseDecision.shouldEscalate || reasoning.next_best_action === 'escalate_to_admin',
          matchedItemId: baseDecision.matchedItemId,
          reason: baseDecision.reason
        }
      : baseDecision;
    const businessConfig = await this.dependencies.decisionEngine.getBusinessConfig(
      site?.business_config_id
    );
    const replyWithConversionCta = appendConversionCta({
      reply: decision.reply,
      visitorMessage: input.content,
      history: recentHistory.map((message) => ({
        senderType: message.sender_type,
        content: message.content
      })),
      brandName: businessConfig.identity.name,
      contact: businessConfig.contact
    });
    const publicReply = clarifyPublicAssistantIdentity({
      reply: replyWithConversionCta,
      visitorMessage: input.content,
      brandName: businessConfig.identity.name,
      isFirstAssistantReply: !recentHistory.some((message) => message.sender_type === 'assistant')
    });

    const assistantMessage = await this.dependencies.conversations.addMessage({
      organizationId: conversation.organization_id,
      conversationId: conversation.id,
      senderType: 'assistant',
      content: publicReply,
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
      const scoringMessages = [...recentHistory.map((message) => message.content), publicReply];
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
      reply: publicReply,
      source: decision.source,
      confidence: decision.confidence,
      shouldEscalate: decision.shouldEscalate,
      processingTimeMs: decision.processingTimeMs,
      matchedItemId: decision.matchedItemId,
      reason: decision.reason,
      ...(decision.usedChunkIds ? { usedChunkIds: decision.usedChunkIds } : {}),
      ...(decision.usedDocumentIds ? { usedDocumentIds: decision.usedDocumentIds } : {}),
      ...(decision.sources ? { sources: decision.sources } : {}),
      ...(decision.citations ? { citations: decision.citations } : {}),
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

function appendConversionCta(input: {
  reply: string;
  visitorMessage: string;
  history: Array<{ senderType: string; content: string }>;
  brandName: string;
  contact: {
    whatsapp?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
  };
}): string {
  if (!hasStrongCommercialIntent(input.visitorMessage, input.history)) return input.reply;
  if (
    input.history.some(
      (message) => message.senderType === 'assistant' && hasContactCta(message.content)
    )
  ) {
    return input.reply;
  }
  if (hasContactCta(input.reply)) return input.reply;
  if (isUninformativeReply(input.reply)) return input.reply;

  const channel = input.contact.whatsapp
    ? ` sur WhatsApp : ${input.contact.whatsapp}`
    : input.contact.phone
      ? ` par téléphone : ${input.contact.phone}`
      : input.contact.email
        ? ` par e-mail : ${input.contact.email}`
        : '';
  return `${input.reply.trim()} Si vous souhaitez avancer, vous pouvez contacter directement ${input.brandName}${channel}.`;
}

function hasStrongCommercialIntent(
  visitorMessage: string,
  history: Array<{ senderType: string; content: string }>
): boolean {
  const current = normalizeIdentityText(visitorMessage);
  const asksHowToBook = /\b(?:comment|comment faire pour) (?:reserv\w*|prendre rendez vous)\b/.test(
    current
  );
  if (
    !asksHowToBook &&
    /\b(?:je veux reserv\w*|souhaite reserv\w*|book\w*|prendre rendez vous|rdv|devis|disponib\w*|parler a|contacter|contact direct|appeler|telephone|whatsapp|e mail|email|pret a avancer|souhaite avancer|veux avancer)\b/.test(
      current
    )
  ) {
    return true;
  }
  if (/\b(?:projet concret|projet (?:photo|video)|shooting (?:photo|video))\b/.test(current)) {
    return true;
  }

  const visitorTurns = history
    .filter((message) => message.senderType === 'visitor')
    .map((message) => normalizeIdentityText(message.content));
  const combined = [...visitorTurns, current].join(' ');
  const hasProject = /\b(?:portrait|shooting|studio|photo|video|projet)\b/.test(combined);
  const hasTravel = /\b(?:deplac\w*|venir|intervenir)\b/.test(combined);
  const hasPlace =
    /\b(?:a|sur|vers) [a-z]{3,}\b/.test(current) ||
    /\b(?:lyon|paris|ville|deplacement)\b/.test(combined);
  const hasDate =
    /\b(?:janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2})\b/.test(
      combined
    );
  return (hasProject || hasTravel) && visitorTurns.length >= 2 && (hasPlace || hasDate);
}

function hasContactCta(value: string): boolean {
  return /(?:contacter|parler (?:directement )?a|whatsapp|telephone|e-mail|email)/i.test(
    normalizeIdentityText(value)
  );
}

function isUninformativeReply(value: string): boolean {
  return /(?:information (?:est |reste )?(?:absente|indisponible)|(?:n ai|n avons|ne dispose|ne disposons|pas encore) (?:pas )?(?:encore )?(?:de )?(?:cette |l )?information)/i.test(
    normalizeIdentityText(value)
  );
}

function clarifyPublicAssistantIdentity(input: {
  reply: string;
  visitorMessage: string;
  brandName: string;
  isFirstAssistantReply: boolean;
}): string {
  const visitor = normalizeIdentityText(input.visitorMessage);
  const brand = normalizeIdentityText(input.brandName);
  const asksWho =
    /\b(?:qui es tu|tu es qui|est ce (?:que )?c est|je parle a|tu es)\b/.test(visitor) ||
    /\b(?:who are you|is this|am i (?:speaking|talking) to|are you)\b/.test(visitor);
  const asksAboutBrandIdentity =
    brand.length > 0 &&
    new RegExp(
      `\\b(?:est ce|c est|je parle a|tu es|is this|are you) ${escapeRegExp(brand)}\\b`
    ).test(visitor);
  const addressesBrand =
    brand.length > 0 &&
    (visitor.startsWith(`${brand} `) || visitor === brand || visitor.includes(`tu es ${brand}`));
  const asksPersonalAnswer =
    brand.length > 0 &&
    (new RegExp(`\\b(?:demande a|que pense|avis (?:personnel )?de) ${escapeRegExp(brand)}\\b`).test(
      visitor
    ) ||
      new RegExp(
        `\\b(?:ask|what does|personal (?:answer|opinion) (?:from|of)) ${escapeRegExp(brand)}\\b`
      ).test(visitor));
  const needsClarification =
    input.isFirstAssistantReply ||
    asksWho ||
    asksAboutBrandIdentity ||
    addressesBrand ||
    asksPersonalAnswer;

  if (!needsClarification || hasUnambiguousAiIdentity(input.reply, input.brandName)) {
    return input.reply;
  }

  const english = /\b(?:who|is this|am i|are you|ask|what does|you|your)\b/.test(visitor);
  const introduction = english
    ? `I'm ${input.brandName}'s AI chatbot, not ${input.brandName} personally.`
    : `Je suis le chatbot IA de ${input.brandName}, pas ${input.brandName} lui-même.`;
  const personalBoundary = asksPersonalAnswer
    ? english
      ? ` I can share the available information, but I cannot speak for ${input.brandName}'s personal opinion or decision.`
      : ` Je peux partager les informations disponibles, mais pas inventer l'avis ou la décision personnelle de ${input.brandName}.`
    : '';

  return `${introduction}${personalBoundary} ${input.reply}`.trim();
}

function hasUnambiguousAiIdentity(reply: string, brandName: string): boolean {
  const normalized = normalizeIdentityText(reply);
  const brand = escapeRegExp(normalizeIdentityText(brandName));
  return (
    /\b(?:chatbot|assistant)\b/.test(normalized) &&
    /\b(?:ia|ai|intelligence artificielle)\b/.test(normalized) &&
    new RegExp(`\\b(?:pas|not) ${brand}\\b`).test(normalized)
  );
}

function normalizeIdentityText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
