import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConversationRepository } from '../src/modules/conversations/conversation-repository.js';
import type { CrmRepository } from '../src/modules/crm/crm-repository.js';
import type { DecisionEngine } from '../src/modules/decision-engine/decision-engine.js';
import type { NotificationEngine } from '../src/modules/notifications/notification-engine.js';
import type { ProspectRepository } from '../src/modules/prospects/prospect-repository.js';
import { MultiSiteChatbotService } from '../src/modules/chatbot-multisite/chatbot-multisite-service.js';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const SITE_A = '00000000-0000-4000-8000-000000000101';
const CONVERSATION_A = '00000000-0000-4000-8000-00000000c101';
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
    assert.equal(response.reply, 'Oui, nous avons des disponibilites cette semaine.');
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

  it('rejects inactive or unknown public sites', async () => {
    const fixture = createChatbotFixture({ siteEnabled: false });

    await assert.rejects(
      () => fixture.chatbot.getWidgetConfig({ siteId: SITE_A }),
      /Widget site not found/
    );
  });
});

function createChatbotFixture(options?: { siteEnabled?: boolean }) {
  const site = {
    id: SITE_A,
    organization_id: ORG_A,
    name: 'Demo Site',
    slug: 'demo-site',
    widget_public_key: 'demo-site-key',
    activity: 'demo',
    business_config_id: 'config-site-a',
    status: 'active',
    widget_enabled: options?.siteEnabled ?? true
  };
  const conversation = {
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
  const calls = {
    businessConfigIds: [] as string[],
    visitorOrganizationIds: [] as string[],
    messages: [] as Array<{ senderType: string; content: string }>,
    notifications: [] as Array<{ type: string }>,
    decisions: [] as Array<{ message: string; activity: string }>,
    decisionEvents: [] as Array<{ source: string }>,
    crmProspects: [] as string[],
    linkedProspectId: null as string | null
  };

  const conversations = {
    findSite: async (id: string) => (id === SITE_A ? site : null),
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
        organization_id: ORG_A,
        conversation_id: CONVERSATION_A,
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
    findConversation: async (id: string) => (id === CONVERSATION_A ? conversation : null),
    linkProspect: async (_conversationId: string, prospectId: string) => {
      calls.linkedProspectId = prospectId;
    },
    listMessages: async () => [
      {
        id: '00000000-0000-4000-8000-00000000m001',
        organization_id: ORG_A,
        conversation_id: CONVERSATION_A,
        sender_type: 'visitor',
        content: 'Bonjour',
        response_source: null,
        response_confidence: null,
        should_escalate: null,
        processing_time_ms: null,
        matched_item_id: null,
        decision_reason: null,
        created_at: new Date('2026-07-06T08:01:00Z')
      }
    ],
    addDecisionEvent: async (input: { source: string }) => {
      calls.decisionEvents.push(input);
    },
    addAIEvent: async () => {}
  } as unknown as ConversationRepository;

  const prospects = {
    createFromConversation: async () => ({
      id: PROSPECT_A,
      organization_id: ORG_A,
      site_id: SITE_A,
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
          organization_id: ORG_A,
          site_id: SITE_A,
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
    decide: async (input: { message: string; activity: string }) => {
      calls.decisions.push(input);
      return {
        reply: 'Oui, nous avons des disponibilites cette semaine.',
        source: 'faq',
        confidence: 0.91,
        shouldEscalate: false,
        processingTimeMs: 12,
        matchedItemId: 'faq-1',
        reason: 'faq_keyword_match'
      };
    }
  } as unknown as DecisionEngine;

  const notificationEngine = {
    notify: async (input: { type: string }) => {
      calls.notifications.push(input);
      return { records: [], averageDurationMs: 0 };
    }
  } as unknown as NotificationEngine;

  return {
    calls,
    chatbot: new MultiSiteChatbotService({
      conversations,
      prospects,
      crm,
      decisionEngine,
      notificationEngine
    })
  };
}
