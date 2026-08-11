import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConversationRepository } from '../src/modules/conversations/conversation-repository.js';
import type { CrmRepository } from '../src/modules/crm/crm-repository.js';
import type {
  DecisionEngine,
  DecisionEngineResult
} from '../src/modules/decision-engine/decision-engine.js';
import type { NotificationEngine } from '../src/modules/notifications/notification-engine.js';
import type { ProspectRepository } from '../src/modules/prospects/prospect-repository.js';
import { MultiSiteChatbotService } from '../src/modules/chatbot-multisite/chatbot-multisite-service.js';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const SITE_A = '00000000-0000-4000-8000-000000000101';
const SITE_B = '00000000-0000-4000-8000-000000000102';
const CONVERSATION_A = '00000000-0000-4000-8000-00000000c101';
const CONVERSATION_B = '00000000-0000-4000-8000-00000000c102';
const VISITOR_A = '00000000-0000-4000-8000-00000000v101';
const PROSPECT_A = '00000000-0000-4000-8000-00000000p101';

describe('Multi-site chatbot service', () => {
  it('resolves the widget configuration for a public site slug', async () => {
    const fixture = createChatbotFixture();
    const config = await fixture.chatbot.getWidgetConfig({ siteSlug: 'demo-site' });

    assert.equal(config.siteId, SITE_A);
    assert.equal(config.siteKey, 'demo-site-key');
    assert.equal(config.brandName, 'VISITOR DEMO');
    assert.deepEqual(config.quickReplies, ['Tarifs', 'Disponibilites']);
    assert.equal(fixture.calls.businessConfigIds[0], 'config-site-a');
  });

  it('starts a public conversation without touching existing CRM modules directly', async () => {
    const fixture = createChatbotFixture();
    const started = await fixture.chatbot.startConversation({
      siteKey: 'demo-site-key',
      anonymousId: 'visitor-public',
      pageUrl: 'https://example.com/demo'
    });

    assert.equal(started.conversationId, CONVERSATION_A);
    assert.equal(started.visitorId, VISITOR_A);
    assert.equal(fixture.calls.visitorOrganizationIds[0], ORG_A);
    assert.equal(fixture.calls.messages[0]?.senderType, 'system');
    assert.deepEqual(
      fixture.calls.notifications.map((item) => item.type),
      ['new_conversation']
    );
  });

  it('turns a visitor message into a CRM prospect, decision event and notifications', async () => {
    const fixture = createChatbotFixture();
    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Bonjour, avez-vous des disponibilites pour reserver ?'
    });

    assert.equal(response.conversationId, CONVERSATION_A);
    assert.equal(response.prospectId, PROSPECT_A);
    assert.equal(response.source, 'faq');
    assert.equal(
      response.reply,
      'Oui, nous avons des disponibilites cette semaine. Si vous souhaitez avancer, vous pouvez contacter directement VISITOR DEMO.'
    );
    assert.equal(fixture.calls.linkedProspectId, PROSPECT_A);
    assert.deepEqual(
      fixture.calls.messages.map((message) => message.senderType),
      ['visitor', 'assistant']
    );
    assert.equal(fixture.calls.decisionEvents.length, 1);
    assert.deepEqual(fixture.calls.crmProspects, [PROSPECT_A]);
    assert.deepEqual(
      fixture.calls.notifications.map((item) => item.type),
      ['hot_prospect', 'potential_booking']
    );
  });

  it('uses crawled KMS knowledge for the current public widget site when reasoning is enabled', async () => {
    const fixture = createChatbotFixture({
      decisionResult: {
        reply: 'Après une séance, 25 photos retouchées en haute définition sont livrées.',
        source: 'knowledge_search',
        confidence: 0.82,
        shouldEscalate: false,
        processingTimeMs: 4,
        matchedItemId: 'kms-document-site-a',
        reason: 'knowledge_document:Séance boudoir Albi'
      },
      withReasoning: true
    });

    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Combien de photos sont livrées après une séance ?'
    });

    assert.equal(response.source, 'knowledge_search');
    assert.match(response.reply, /25 photos retouchées/);
    assert.equal(response.matchedItemId, 'kms-document-site-a');
    assert.deepEqual(fixture.calls.decisionScopes, [{ organizationId: ORG_A, siteId: SITE_A }]);
  });

  it('does not use site A crawled knowledge for site B', async () => {
    const fixture = createChatbotFixture({
      site: { id: SITE_B, organization_id: ORG_A, slug: 'site-b', widget_public_key: 'site-b-key' },
      conversation: { id: CONVERSATION_B, organization_id: ORG_A, site_id: SITE_B },
      decisionResult: {
        reply: 'Je transmets votre demande.',
        source: 'fallback',
        confidence: 0.25,
        shouldEscalate: true,
        processingTimeMs: 3,
        reason: 'low_confidence_fallback'
      }
    });

    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_B,
      content: 'Combien de photos sont livrées après une séance ?'
    });

    assert.equal(response.source, 'fallback');
    assert.equal(response.reply, 'Je transmets votre demande.');
    assert.deepEqual(fixture.calls.decisionScopes, [{ organizationId: ORG_A, siteId: SITE_B }]);
  });

  it('preserves a grounded AI answer and citations without exposing debug context', async () => {
    const citation = {
      sourceNumber: 1,
      chunkId: 'site-a-price',
      documentId: 'site-a-document',
      title: 'Tarifs',
      source: '/tarifs'
    };
    const fixture = createChatbotFixture({
      decisionResult: {
        reply: 'La formule coûte 190 €. [SOURCE 1]',
        source: 'ai',
        confidence: 0.8,
        shouldEscalate: false,
        processingTimeMs: 5,
        reason: 'mock:grounded',
        usedChunkIds: ['site-a-price'],
        usedDocumentIds: ['site-a-document'],
        sources: [citation],
        citations: [citation],
        debug: {
          totalTimeMs: 5,
          intent: 'pricing',
          chunksBeforeReranking: [],
          chunksAfterReranking: [],
          prompt: { system: 'secret', messages: [] },
          rawLlmResponse: null,
          injectedChunks: [],
          kmsContext: 'secret KMS context',
          contextCharacters: 18,
          contextTokens: 5,
          droppedChunks: [],
          citedChunkIds: ['site-a-price'],
          unsupportedInformationAlert: null,
          timings: {
            kmsSearchMs: 1,
            rerankingMs: 1,
            promptConstructionMs: 1,
            llmCallMs: 2,
            totalMs: 5
          },
          tokens: { prompt: 20, response: 8, total: 28 },
          retainedSources: [],
          weakAnswer: { weak: false, explanation: 'ok', suggestion: null }
        }
      },
      withReasoning: true
    });

    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Quel est le prix ?'
    });

    assert.equal(response.source, 'ai');
    assert.match(response.reply, /190 €/);
    assert.deepEqual(response.usedChunkIds, ['site-a-price']);
    assert.deepEqual(response.citations, [citation]);
    assert.equal('debug' in response, false);
    assert.equal('kmsContext' in response, false);
    assert.equal('prompt' in response, false);
  });

  it('keeps KMS lookup scoped to the conversation organization', async () => {
    const fixture = createChatbotFixture({
      site: { id: SITE_B, organization_id: ORG_B, slug: 'site-b', widget_public_key: 'site-b-key' },
      conversation: { id: CONVERSATION_B, organization_id: ORG_B, site_id: SITE_B },
      decisionResult: {
        reply: 'Je transmets votre demande.',
        source: 'fallback',
        confidence: 0.25,
        shouldEscalate: true,
        processingTimeMs: 3,
        reason: 'low_confidence_fallback'
      }
    });

    await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_B,
      content: 'Combien de photos sont livrées après une séance ?'
    });

    assert.deepEqual(fixture.calls.decisionScopes, [{ organizationId: ORG_B, siteId: SITE_B }]);
  });

  it('keeps the fallback when no KMS document matches the public widget question', async () => {
    const fixture = createChatbotFixture({
      decisionResult: {
        reply: 'Je transmets votre demande.',
        source: 'fallback',
        confidence: 0.25,
        shouldEscalate: true,
        processingTimeMs: 3,
        reason: 'low_confidence_fallback'
      }
    });

    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Question absente du contenu importé'
    });

    assert.equal(response.source, 'fallback');
    assert.equal(response.reply, 'Je transmets votre demande.');
  });

  it('always uses the Decision Engine instead of legacy direct KMS or site QA answers', async () => {
    const fixture = createChatbotFixture({
      decisionResult: {
        reply: 'Réponse grounded du Decision Engine. [SOURCE 1]',
        source: 'ai',
        confidence: 0.82,
        shouldEscalate: false,
        processingTimeMs: 4,
        reason: 'mock:grounded'
      },
      legacyKnowledgeReply: 'Ancienne réponse KMS directe.',
      legacyQaReply: 'Ancienne réponse QA directe.'
    });

    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Question couverte par plusieurs anciens chemins'
    });

    assert.equal(response.reply, 'Réponse grounded du Decision Engine. [SOURCE 1]');
    assert.equal(response.source, 'ai');
    assert.equal(fixture.calls.legacyKnowledgeCalls, 0);
    assert.equal(fixture.calls.legacyQaCalls, 0);
    assert.equal(fixture.calls.decisionScopes.length, 1);
  });

  it('never lets the Reasoning Engine replace a valid grounded decision', async () => {
    const fixture = createChatbotFixture({
      decisionResult: {
        reply: 'Les offres grounded sont à 190 € et 390 €. [SOURCE 1] [SOURCE 2]',
        source: 'ai',
        confidence: 0.84,
        shouldEscalate: false,
        processingTimeMs: 5,
        reason: 'mock:grounded'
      },
      withReasoning: true,
      reasoningReply: 'Réponse Reasoning incorrecte à 999 €.'
    });

    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Quels sont tous les tarifs ?'
    });

    assert.match(response.reply, /190 €/);
    assert.match(response.reply, /390 €/);
    assert.doesNotMatch(response.reply, /999/);
    assert.equal(response.source, 'ai');
  });

  describe('public AI identity transparency', () => {
    it('introduces itself as the brand AI chatbot on the first useful response', async () => {
      const fixture = createChatbotFixture({
        history: [{ senderType: 'visitor', content: 'Bonjour' }],
        decisionResult: {
          reply: 'Les portraits sont réalisés en studio.',
          source: 'knowledge_search',
          confidence: 0.9,
          shouldEscalate: false,
          processingTimeMs: 3,
          matchedItemId: 'portrait',
          reason: 'grounded'
        }
      });

      const response = await fixture.chatbot.sendMessage({
        conversationId: CONVERSATION_A,
        content: 'Quels portraits proposez-vous ?'
      });

      assert.match(response.reply, /chatbot IA de VISITOR DEMO/);
      assert.match(response.reply, /pas VISITOR DEMO lui-même/);
      assert.match(response.reply, /portraits sont réalisés en studio/);
      assert.equal(response.matchedItemId, 'portrait');
    });

    for (const question of ['Qui es-tu ?', 'Est-ce VISITOR DEMO ?', 'VISITOR DEMO, réponds-moi']) {
      it(`removes human identity ambiguity for: ${question}`, async () => {
        const fixture = createChatbotFixture({
          decisionResult: {
            reply: 'Oui, je peux vous renseigner sur les séances.',
            source: 'ai',
            confidence: 0.85,
            shouldEscalate: false,
            processingTimeMs: 3,
            reason: 'identity'
          }
        });

        const response = await fixture.chatbot.sendMessage({
          conversationId: CONVERSATION_A,
          content: question
        });

        assert.match(response.reply, /chatbot IA de VISITOR DEMO/);
        assert.match(response.reply, /pas VISITOR DEMO lui-même/);
        assert.match(response.reply, /séances/);
      });
    }

    it('keeps the identity clarification explicit in English', async () => {
      const fixture = createChatbotFixture({
        decisionResult: {
          reply: 'I can help with the available services.',
          source: 'ai',
          confidence: 0.85,
          shouldEscalate: false,
          processingTimeMs: 3,
          reason: 'identity'
        }
      });

      const response = await fixture.chatbot.sendMessage({
        conversationId: CONVERSATION_A,
        content: 'Are you VISITOR DEMO?'
      });

      assert.match(response.reply, /VISITOR DEMO's AI chatbot/);
      assert.match(response.reply, /not VISITOR DEMO personally/);
      assert.match(response.reply, /available services/);
    });

    it('keeps a personal answer attributed to the human and preserves existing contact details', async () => {
      const fixture = createChatbotFixture({
        decisionResult: {
          reply: 'WhatsApp : +33 6 12 34 56 78.',
          source: 'fallback',
          confidence: 0.35,
          shouldEscalate: true,
          processingTimeMs: 3,
          reason: 'personal_answer'
        }
      });

      const response = await fixture.chatbot.sendMessage({
        conversationId: CONVERSATION_A,
        content: "Quel est l'avis personnel de VISITOR DEMO ?"
      });

      assert.match(response.reply, /pas inventer l'avis ou la décision personnelle/);
      assert.match(response.reply, /WhatsApp : \+33 6 12 34 56 78/);
    });

    it('clarifies a late identity question without exposing internal response data', async () => {
      const fixture = createChatbotFixture({
        history: [
          { senderType: 'visitor', content: 'Bonjour' },
          { senderType: 'assistant', content: 'Bienvenue.' },
          { senderType: 'visitor', content: 'Parlez-moi du studio.' },
          { senderType: 'assistant', content: 'Le studio réalise des portraits.' }
        ],
        decisionResult: {
          reply: 'Je peux continuer à vous renseigner.',
          source: 'ai',
          confidence: 0.85,
          shouldEscalate: false,
          processingTimeMs: 3,
          reason: 'identity'
        }
      });

      const response = await fixture.chatbot.sendMessage({
        conversationId: CONVERSATION_A,
        content: 'Et qui es-tu ?'
      });

      assert.match(response.reply, /chatbot IA/);
      assert.equal('debug' in response, false);
      assert.equal('systemPrompt' in response, false);
    });

    it('does not repeat the introduction after identity is clear without new ambiguity', async () => {
      const fixture = createChatbotFixture({
        decisionResult: {
          reply: 'La séance dure une heure. [SOURCE 1]',
          source: 'ai',
          confidence: 0.9,
          shouldEscalate: false,
          processingTimeMs: 3,
          reason: 'grounded'
        }
      });

      const response = await fixture.chatbot.sendMessage({
        conversationId: CONVERSATION_A,
        content: 'Combien de temps dure la séance ?'
      });

      assert.equal(response.reply, 'La séance dure une heure. [SOURCE 1]');
    });
  });

  it('rejects inactive or unknown public sites', async () => {
    const fixture = createChatbotFixture({ siteEnabled: false });

    await assert.rejects(
      () => fixture.chatbot.getWidgetConfig({ siteId: SITE_A }),
      /Widget site not found/
    );
  });

  it('adds the trusted WhatsApp CTA after the useful answer for booking intent', async () => {
    const fixture = createChatbotFixture({
      businessContact: { whatsapp: '+33 6 12 34 56 78', phone: '+33 1 23 45 67 89' },
      decisionResult: {
        reply: 'Le studio est équipé de flashes professionnels. [SOURCE 1]',
        source: 'ai',
        confidence: 0.9,
        shouldEscalate: false,
        processingTimeMs: 3
      }
    });
    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Je veux réserver le studio'
    });
    assert.match(response.reply, /flashes professionnels.*WhatsApp.*\+33 6 12 34 56 78/);
    assert.doesNotMatch(response.reply, /\+33 1 23 45 67 89/);
  });

  it('does not add a premature CTA to an informational question', async () => {
    const fixture = createChatbotFixture({ businessContact: { phone: '+33 1 23 45 67 89' } });
    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Quel équipement avez-vous ?'
    });
    assert.doesNotMatch(response.reply, /contacter directement/);
  });

  it('does not add a CTA to a pure fallback or republish an older assistant answer', async () => {
    const fixture = createChatbotFixture({
      businessContact: { whatsapp: '+33 6 12 34 56 78' },
      history: [
        { senderType: 'visitor', content: 'Parlez-moi du studio' },
        { senderType: 'assistant', content: 'ANCIENNE-REPONSE-STUDIO [SOURCE 1]' }
      ],
      decisionResult: {
        reply: 'Cette information est absente de mes sources.',
        source: 'fallback',
        confidence: 0.25,
        shouldEscalate: true,
        processingTimeMs: 3
      }
    });
    const response = await fixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Je veux réserver'
    });

    assert.equal(response.reply, 'Cette information est absente de mes sources.');
    assert.doesNotMatch(response.reply, /ANCIENNE-REPONSE-STUDIO|contacter directement|WhatsApp/);
  });

  it('falls back from WhatsApp to phone then email without inventing a channel', async () => {
    const phoneFixture = createChatbotFixture({
      businessContact: { phone: '+33 1 23 45 67 89', email: 'chris@example.test' }
    });
    const phoneResponse = await phoneFixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Je veux réserver'
    });
    assert.match(phoneResponse.reply, /disponibilites.*téléphone : \+33 1 23 45 67 89/);
    assert.doesNotMatch(phoneResponse.reply, /chris@example\.test|WhatsApp/);

    const emailFixture = createChatbotFixture({
      businessContact: { email: 'chris@example.test' }
    });
    const emailResponse = await emailFixture.chatbot.sendMessage({
      conversationId: CONVERSATION_A,
      content: 'Je veux réserver'
    });
    assert.match(emailResponse.reply, /disponibilites.*e-mail : chris@example\.test/);
    assert.doesNotMatch(emailResponse.reply, /WhatsApp|téléphone|\+33/);
  });
});

type DecisionResultFixture = Omit<DecisionEngineResult, 'source'> & {
  source: DecisionEngineResult['source'];
};

const defaultSite = {
  id: SITE_A,
  organization_id: ORG_A,
  name: 'Demo Site',
  slug: 'demo-site',
  widget_public_key: 'demo-site-key',
  activity: 'demo',
  business_config_id: 'config-site-a',
  status: 'active',
  widget_enabled: true
};

const defaultConversation = {
  id: CONVERSATION_A,
  organization_id: ORG_A,
  site_id: SITE_A,
  visitor_id: VISITOR_A,
  prospect_id: null,
  status: 'open',
  page_url: 'https://example.com/demo',
  referrer: null,
  created_at: new Date('2026-07-06T08:00:00Z'),
  updated_at: new Date('2026-07-06T08:00:00Z')
};

function createChatbotFixture(options?: {
  siteEnabled?: boolean;
  site?: Partial<typeof defaultSite>;
  conversation?: Partial<typeof defaultConversation>;
  decisionResult?: DecisionResultFixture;
  withReasoning?: boolean;
  reasoningReply?: string;
  legacyKnowledgeReply?: string;
  legacyQaReply?: string;
  history?: Array<{ senderType: 'visitor' | 'assistant'; content: string }>;
  businessContact?: { whatsapp?: string; phone?: string; email?: string };
}) {
  const site = {
    ...defaultSite,
    ...(options?.site ?? {}),
    widget_enabled:
      options?.siteEnabled ?? options?.site?.widget_enabled ?? defaultSite.widget_enabled
  };
  const conversation = {
    ...defaultConversation,
    organization_id: site.organization_id,
    site_id: site.id,
    ...(options?.conversation ?? {})
  };
  const calls = {
    businessConfigIds: [] as string[],
    visitorOrganizationIds: [] as string[],
    messages: [] as Array<{ senderType: string; content: string }>,
    notifications: [] as Array<{ type: string }>,
    decisions: [] as Array<{ message: string; activity: string }>,
    decisionScopes: [] as Array<{ organizationId: string; siteId: string }>,
    decisionEvents: [] as Array<{ source: string }>,
    crmProspects: [] as string[],
    linkedProspectId: null as string | null,
    legacyKnowledgeCalls: 0,
    legacyQaCalls: 0
  };

  const conversations = {
    findSite: async (id: string) => (id === site.id ? site : null),
    findSiteBySlug: async (slug: string) =>
      slug === site.slug && site.widget_enabled ? site : null,
    findSiteByWidgetKey: async (key: string) =>
      key === site.widget_public_key && site.widget_enabled ? site : null,
    upsertVisitor: async (input: { organizationId: string }) => {
      calls.visitorOrganizationIds.push(input.organizationId);
      return VISITOR_A;
    },
    createConversation: async () => conversation,
    addMessage: async (input: { senderType: string; content: string }) => {
      calls.messages.push(input);
      return {
        id: `00000000-0000-4000-8000-00000000m10${calls.messages.length}`,
        organization_id: conversation.organization_id,
        conversation_id: conversation.id,
        sender_type: input.senderType,
        content: input.content,
        response_source: null,
        response_confidence: null,
        should_escalate: null,
        processing_time_ms: null,
        matched_item_id: null,
        decision_reason: null,
        created_at: new Date('2026-07-06T08:01:00Z')
      };
    },
    findConversation: async (id: string) => (id === conversation.id ? conversation : null),
    linkProspect: async (_conversationId: string, prospectId: string) => {
      calls.linkedProspectId = prospectId;
    },
    listMessages: async () =>
      (
        options?.history ?? [
          { senderType: 'visitor' as const, content: 'Bonjour' },
          { senderType: 'assistant' as const, content: 'Bienvenue.' }
        ]
      ).map((message, index) => ({
        id: '00000000-0000-4000-8000-00000000m001',
        organization_id: conversation.organization_id,
        conversation_id: conversation.id,
        sender_type: message.senderType,
        content: message.content,
        response_source: null,
        response_confidence: null,
        should_escalate: null,
        processing_time_ms: null,
        matched_item_id: null,
        decision_reason: null,
        created_at: new Date(`2026-07-06T08:0${index + 1}:00Z`)
      })),
    addDecisionEvent: async (input: { source: string }) => {
      calls.decisionEvents.push(input);
    },
    addAIEvent: async () => {}
  } as unknown as ConversationRepository;

  const prospects = {
    createFromConversation: async () => ({
      id: PROSPECT_A,
      organization_id: conversation.organization_id,
      site_id: conversation.site_id,
      visitor_id: VISITOR_A,
      first_name: null,
      last_name: null,
      pseudo: null,
      company: null,
      display_name: 'Prospect widget',
      email: null,
      phone: null,
      website: null,
      instagram: null,
      twitter_x: null,
      mym: null,
      onlyfans: null,
      linktree: null,
      allmylinks: null,
      city: null,
      activity: null,
      description: null,
      source_url: null,
      status: 'new',
      temperature: 'froide',
      score_current: 0,
      score: 0,
      score_label: 'ignore',
      notes: null,
      source: 'widget',
      created_at: new Date('2026-07-06T08:02:00Z'),
      updated_at: new Date('2026-07-06T08:02:00Z')
    })
  } as unknown as ProspectRepository;

  const crm = {
    applyAutomaticTags: async (input: { prospectId: string }) => {
      calls.crmProspects.push(input.prospectId);
      return [
        {
          id: '00000000-0000-4000-8000-00000000t001',
          organization_id: conversation.organization_id,
          site_id: conversation.site_id,
          label: 'Reservation',
          slug: 'reservation',
          color: null,
          created_at: new Date('2026-07-06T08:03:00Z')
        }
      ];
    },
    recalculateScore: async () => ({ score: 82, reasons: [] })
  } as unknown as CrmRepository;

  const decisionEngine = {
    getBusinessConfig: async (configId?: string | null) => {
      calls.businessConfigIds.push(configId ?? 'default');
      return {
        identity: {
          name: 'VISITOR DEMO',
          category: 'demo',
          tone: 'professionnel',
          language: 'fr',
          colors: { primary: '#145c4b', secondary: '#f5f5f5' }
        },
        contact: { openingHours: [], ...options?.businessContact },
        widget: {
          welcomeMessage: 'Bonjour',
          fallbackMessage: 'Je transmets votre demande.',
          quickReplies: ['Tarifs', 'Disponibilites']
        },
        faq: [],
        knowledgeBase: [],
        rules: [],
        restrictions: { never: [], always: [] },
        escalation: { enabled: true, triggers: [] }
      };
    },
    decide: async (input: {
      message: string;
      activity: string;
      organizationId: string;
      siteId: string;
    }) => {
      calls.decisions.push(input);
      calls.decisionScopes.push({ organizationId: input.organizationId, siteId: input.siteId });
      return (
        options?.decisionResult ?? {
          reply: 'Oui, nous avons des disponibilites cette semaine.',
          source: 'faq',
          confidence: 0.91,
          shouldEscalate: false,
          processingTimeMs: 12,
          matchedItemId: 'faq-1',
          reason: 'faq_keyword_match'
        }
      );
    }
  } as unknown as DecisionEngine;

  const notificationEngine = {
    notify: async (input: { type: string }) => {
      calls.notifications.push(input);
      return { records: [], averageDurationMs: 0 };
    }
  } as unknown as NotificationEngine;

  const reasoningEngine = options?.withReasoning
    ? {
        reason: async (input: {
          knowledgeAnswer?: {
            reply: string;
            source: string;
            confidence: number;
            matchedItemId?: string;
            reason: string;
          } | null;
        }) => ({
          detected_intent: input.knowledgeAnswer?.reason ?? 'unknown',
          intent_confidence: 0.8,
          selected_knowledge_item_id: input.knowledgeAnswer?.matchedItemId ?? null,
          response_text:
            options?.reasoningReply ??
            input.knowledgeAnswer?.reply ??
            "Je n'ai pas encore cette information precise. Je peux vous aider a reformuler ou transmettre la demande.",
          response_type: input.knowledgeAnswer?.source ?? 'fallback',
          next_best_action: 'answer_only',
          lead_capture_recommended: false,
          suggested_follow_up_question: null,
          reasoning_trace: {},
          confidence_score: input.knowledgeAnswer?.confidence ?? 0.28,
          lead_readiness_score: 0,
          applied_goal: null,
          applied_personality: null,
          quality_scores: {
            knowledge_match_score: input.knowledgeAnswer ? 1 : 0,
            goal_alignment_score: 0,
            lead_action_score: 0,
            response_quality_score: input.knowledgeAnswer ? 0.9 : 0.2
          }
        })
      }
    : undefined;

  return {
    calls,
    chatbot: new MultiSiteChatbotService({
      conversations,
      prospects,
      crm,
      decisionEngine,
      notificationEngine,
      knowledgeEngine: {
        answerQuestion: async () => {
          calls.legacyKnowledgeCalls += 1;
          return options?.legacyKnowledgeReply
            ? {
                reply: options.legacyKnowledgeReply,
                source: 'knowledge_engine',
                confidence: 0.99,
                matchedItemId: 'legacy-kms',
                reason: 'legacy_kms'
              }
            : null;
        },
        enhancedUnanswered: async () => undefined
      } as never,
      production: {
        assertDomainAllowed: () => undefined,
        widgetSettings: () => undefined,
        shouldPromptLeadCapture: async () => false,
        findQaAnswer: async () => {
          calls.legacyQaCalls += 1;
          return options?.legacyQaReply
            ? { id: 'legacy-qa', answer: options.legacyQaReply, priority: 100, category: 'legacy' }
            : null;
        }
      } as never,
      ...(reasoningEngine ? { reasoningEngine: reasoningEngine as never } : {})
    })
  };
}
