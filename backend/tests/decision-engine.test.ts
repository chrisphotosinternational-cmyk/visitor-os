import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AIProvider } from '../src/modules/ai/ai-provider.js';
import type { BusinessConfig } from '../src/modules/business-config/business-config-schema.js';
import type {
  BusinessConfigEngine,
  BusinessConfigSummary
} from '../src/modules/business-config/configuration-loader.js';
import { createDecisionEngine } from '../src/modules/decision-engine/decision-engine.js';

describe('decision engine', () => {
  it('matches the parking FAQ', async () => {
    const result = await createTestDecisionEngine().decide(baseInput('Y a-t-il un parking ?'));

    assert.equal(result.source, 'faq');
    assert.equal(result.matchedItemId, 'parking');
    assert.equal(result.shouldEscalate, false);
    assert.ok(result.confidence >= 0.7);
  });

  it('does not call AI when a reliable FAQ answer exists', async () => {
    let calls = 0;
    const provider: AIProvider = {
      providerName: 'mock',
      async generateReply() {
        calls += 1;
        throw new Error('AI should not be called for FAQ matches');
      },
      estimateCost() {
        return 0;
      }
    };
    const result = await createTestDecisionEngine(provider).decide(
      baseInput('Y a-t-il un parking ?')
    );

    assert.equal(result.source, 'faq');
    assert.equal(calls, 0);
  });

  it('matches the breakfast FAQ', async () => {
    const result = await createTestDecisionEngine().decide(
      baseInput('Le petit-dejeuner est-il inclus ?')
    );

    assert.equal(result.source, 'faq');
    assert.equal(result.matchedItemId, 'petit-dejeuner');
    assert.ok(result.confidence >= 0.7);
  });

  it('escalates pricing questions from configurable business rules', async () => {
    const result = await createTestDecisionEngine().decide(baseInput('Quels sont vos tarifs ?'));

    assert.equal(result.source, 'human_escalation');
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.matchedItemId, 'pricing');
    assert.match(result.reason ?? '', /pricing/);
  });

  it('escalates availability questions from configurable business rules', async () => {
    const result = await createTestDecisionEngine().decide(
      baseInput('Avez-vous un creneau disponible demain ?')
    );

    assert.equal(result.source, 'human_escalation');
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.matchedItemId, 'availability');
  });

  it('uses the mock provider for an unknown safe question', async () => {
    const result = await createTestDecisionEngine().decide(baseInput('Question inconnue simple'));

    assert.equal(result.source, 'ai');
    assert.equal(result.shouldEscalate, false);
    assert.equal(result.confidence, 0.42);
  });

  it('does not crash when no real AI provider is configured', async () => {
    const result = await createTestDecisionEngine().decide(baseInput('Question inconnue simple'));

    assert.ok(result.reply.length > 0);
    assert.ok(result.processingTimeMs >= 0);
  });

  it('falls back and escalates when provider confidence is too low', async () => {
    const lowConfidenceProvider: AIProvider = {
      providerName: 'mock',
      async generateReply() {
        return {
          reply: 'Je ne suis pas certain.',
          confidence: 0.1,
          reason: 'test_low_confidence',
          provider: 'mock',
          model: 'test',
          inputTokens: 10,
          outputTokens: 5,
          latencyMs: 1,
          estimatedCost: 0,
          fallbackUsed: false
        };
      },
      estimateCost() {
        return 0;
      }
    };

    const result = await createTestDecisionEngine(lowConfidenceProvider).decide(
      baseInput('Question inconnue simple')
    );

    assert.equal(result.source, 'fallback');
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.confidence, 0.25);
  });

  it('matches the air conditioning FAQ with normalized accents', async () => {
    const result = await createTestDecisionEngine().decide(
      baseInput('Est-ce qu il y a la climatisation ?')
    );

    assert.equal(result.source, 'faq');
    assert.equal(result.matchedItemId, 'climatisation');
  });
});

function createTestDecisionEngine(aiProvider?: AIProvider) {
  return createDecisionEngine({
    businessConfigEngine: createMemoryBusinessConfigEngine(testConfig),
    ...(aiProvider ? { aiProvider } : {})
  });
}

function baseInput(message: string) {
  return {
    conversationId: '00000000-0000-4000-8000-000000000201',
    organizationId: '00000000-0000-4000-8000-000000000001',
    siteId: '00000000-0000-4000-8000-000000000101',
    activity: 'test-config',
    message,
    recentHistory: []
  };
}

const testConfig: BusinessConfig = {
  id: 'test-config',
  version: '1.0.0',
  identity: {
    name: 'Test Business',
    description: 'Configurable test business',
    category: 'test',
    colors: {}
  },
  contact: {
    openingHours: []
  },
  personality: {
    tone: 'professional',
    style: 'clear',
    formalityLevel: 'neutral',
    vocabulary: [],
    defaultLanguage: 'fr',
    availableLanguages: ['fr']
  },
  goals: ['lead_generation'],
  restrictions: {
    never: ['inventer un tarif', 'inventer une disponibilite'],
    always: ['proposer un contact humain si doute']
  },
  faq: [
    {
      id: 'parking',
      category: 'access',
      question: 'Y a-t-il un parking ?',
      keywords: ['parking', 'stationnement'],
      answer: 'Oui, un parking est disponible.',
      confidence: 0.95,
      order: 10,
      enabled: true
    },
    {
      id: 'petit-dejeuner',
      category: 'service',
      question: 'Le petit-dejeuner est-il inclus ?',
      keywords: ['petit dejeuner', 'petit-dejeuner', 'breakfast'],
      answer: 'Le petit-dejeuner est disponible selon la configuration indiquee.',
      confidence: 0.9,
      order: 20,
      enabled: true
    },
    {
      id: 'climatisation',
      category: 'comfort',
      question: 'Y a-t-il la climatisation ?',
      keywords: ['climatisation', 'clim'],
      answer: 'Oui, la climatisation est disponible.',
      confidence: 0.9,
      order: 30,
      enabled: true
    }
  ],
  knowledgeBase: [],
  rules: [
    {
      id: 'pricing',
      label: 'Pricing',
      enabled: true,
      order: 10,
      when: { contains: ['tarif', 'prix'] },
      then: {
        action: 'human_escalation',
        reason: 'pricing_requires_human_confirmation',
        reply:
          'Je prefere ne pas vous donner une information approximative. Contactez-nous pour un tarif confirme.'
      }
    },
    {
      id: 'availability',
      label: 'Availability',
      enabled: true,
      order: 20,
      when: { contains: ['disponible', 'disponibilite', 'demain'] },
      then: {
        action: 'human_escalation',
        reason: 'availability_requires_human_confirmation'
      }
    }
  ],
  widget: {
    welcomeMessage: 'Bonjour.',
    fallbackMessage: 'Contactez-nous pour une reponse precise.',
    quickReplies: []
  }
};

function createMemoryBusinessConfigEngine(config: BusinessConfig): BusinessConfigEngine {
  return {
    async loadAll() {},
    async reload() {},
    async list(): Promise<BusinessConfigSummary[]> {
      return [
        {
          id: config.id,
          version: config.version,
          name: config.identity.name,
          category: config.identity.category
        }
      ];
    },
    async getConfig() {
      return config;
    },
    async resolveConfig() {
      return config;
    },
    async exportConfig() {
      return config;
    },
    async importConfig() {
      return config;
    },
    async saveConfig() {
      return config;
    },
    async listHistory() {
      return [];
    }
  };
}
