import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AIProvider } from '../src/modules/ai/ai-provider.js';
import type { KnowledgeSearchResult } from '../src/modules/kms/knowledge-types.js';
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

  it('extracts only the relevant answer from a crawled multi-FAQ KMS chunk', async () => {
    let aiCalls = 0;
    const engine = createDecisionEngine({
      businessConfigEngine: createMemoryBusinessConfigEngine(testConfig),
      knowledgeSearch: {
        async search(input) {
          assert.equal(input.organizationId, '00000000-0000-4000-8000-000000000001');
          assert.equal(input.siteId, '00000000-0000-4000-8000-000000000101');
          assert.equal(input.limit, 5);
          return [
            {
              documentId: 'kms-albi-faq',
              title: 'FAQ séance boudoir Albi',
              content: `FAQ Question: Puis-je dormir à l'hôtel après la séance ?
FAQ Answer: Les hôtels partenaires sont listés dans le guide d'accueil.
FAQ Question: Combien de photos sont livrées après une séance ?
FAQ Answer: Après la séance, 12 photos retouchées en haute définition sont livrées dans une galerie privée sous 3 semaines.
FAQ Question: Est-ce que les vidéos sont incluses ?
FAQ Answer: Les vidéos ne sont pas incluses dans la formule photo.
FAQ Question: Est-ce que les fichiers originaux sont remis ?
FAQ Answer: Les fichiers originaux ne sont pas remis.`,
              category: 'website',
              language: 'fr',
              score: 0.72,
              relevance: 'high',
              source: 'https://photographe-boudoir-albi.ovh/faq'
            }
          ];
        }
      },
      aiProvider: {
        providerName: 'mock',
        async generateReply(input) {
          aiCalls += 1;
          assert.match(input.systemPrompt, /12 photos retouchées/);
          return {
            reply:
              'Après la séance, 12 photos retouchées en haute définition sont livrées dans une galerie privée sous 3 semaines. [SOURCE 1]',
            confidence: 0.74,
            reason: 'grounded_test',
            provider: 'mock',
            model: 'test',
            inputTokens: 40,
            outputTokens: 16,
            latencyMs: 1,
            estimatedCost: 0,
            fallbackUsed: false
          };
        },
        estimateCost() {
          return 0;
        }
      }
    });

    const result = await engine.decide(
      baseInput('Combien de photos sont livrées après une séance ?')
    );

    assert.equal(result.source, 'ai');
    assert.match(result.reply, /12 photos retouchées/);
    assert.match(result.reply, /galerie privée/);
    assert.doesNotMatch(result.reply, /hôtel/i);
    assert.doesNotMatch(result.reply, /vidéos/i);
    assert.doesNotMatch(result.reply, /originaux/i);
    assert.equal(aiCalls, 1);
    assert.deepEqual(result.usedChunkIds, ['kms-albi-faq:0']);
  });

  it('uses the mock provider for an unknown safe question', async () => {
    const result = await createTestDecisionEngine().decide(baseInput('Question inconnue simple'));

    assert.equal(result.source, 'ai');
    assert.equal(result.shouldEscalate, false);
    assert.equal(result.confidence, 0.42);
  });

  it('returns a complete diagnostic trace only when admin debug is requested', async () => {
    const candidate = {
      documentId: 'pricing-document',
      title: 'Tarifs',
      content: 'La séance découverte coûte 190 euros.',
      category: 'website',
      language: 'fr',
      score: 0.4,
      relevance: 'low' as const,
      source: '/tarifs',
      position: 2
    };
    const engine = createDecisionEngine({
      businessConfigEngine: createMemoryBusinessConfigEngine(testConfig),
      knowledgeSearch: {
        async search() {
          return [candidate];
        },
        async inspect() {
          return {
            intent: 'general' as const,
            categories: [],
            preferredPageTypes: [],
            enabled: true,
            timings: { searchMs: 2, rerankingMs: 1, totalMs: 3 },
            candidatesBeforeReranking: [candidate],
            candidates: [
              {
                ...candidate,
                originalRank: 1,
                rank: 1,
                scoreBeforeBonus: 0.4,
                scoreAfterBonus: 0.4,
                bonusesApplied: [],
                bonusesRefused: [],
                justification: 'Aucun bonus.'
              }
            ]
          };
        }
      },
      aiProvider: {
        providerName: 'mock',
        async generateReply() {
          return {
            reply: 'Réponse brute de test.',
            confidence: 0.42,
            reason: 'debug_test',
            provider: 'mock',
            model: 'debug-model',
            inputTokens: 20,
            outputTokens: 8,
            latencyMs: 3,
            estimatedCost: 0,
            fallbackUsed: false
          };
        },
        estimateCost() {
          return 0;
        }
      }
    });

    const result = await engine.decide({ ...baseInput('Question inconnue simple'), debug: true });

    assert.equal(result.debug?.chunksBeforeReranking[0]?.position, 2);
    assert.equal(result.debug?.chunksAfterReranking[0]?.scoreBeforeBonus, 0.4);
    assert.equal(result.debug?.rawLlmResponse?.reply, 'Réponse brute de test.');
    assert.equal(result.debug?.tokens.total, 28);
    assert.ok((result.debug?.prompt?.system.length ?? 0) > 0);
    assert.ok((result.debug?.totalTimeMs ?? -1) >= 0);
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

describe('grounded KMS generation', () => {
  it('injects and cites every relevant offer for a pricing question', async () => {
    const candidates = [
      kmsCandidate(
        'offer-discovery',
        'Formule découverte',
        'La formule découverte coûte 190 € et comprend 5 photos.',
        0.91
      ),
      kmsCandidate(
        'offer-premium',
        'Formule premium',
        'La formule premium coûte 390 € et comprend 15 photos et un album.',
        0.88
      )
    ];
    const engine = groundedEngine(candidates, (input) => {
      assert.match(input.systemPrompt, /chunkId: offer-discovery/);
      assert.match(input.systemPrompt, /chunkId: offer-premium/);
      return 'La formule découverte coûte 190 € avec 5 photos [SOURCE 1]. La formule premium coûte 390 € avec 15 photos et un album [SOURCE 2].';
    });

    const result = await engine.decide({
      ...baseInput('Combien coûtent toutes les séances ?'),
      debug: true
    });

    assert.match(result.reply, /190 €/);
    assert.match(result.reply, /390 €/);
    assert.deepEqual(result.usedChunkIds, ['offer-discovery', 'offer-premium']);
    assert.deepEqual(result.usedDocumentIds, [
      'document-offer-discovery',
      'document-offer-premium'
    ]);
    assert.equal(result.debug?.injectedChunks.length, 2);
  });

  it('grounds a simple answer only on the injected chunk', async () => {
    const engine = groundedEngine(
      [kmsCandidate('parking', 'Accès', 'Le parking privé est gratuit sur réservation.', 0.86)],
      (input) => {
        assert.match(input.systemPrompt, /Le parking privé est gratuit/);
        assert.doesNotMatch(input.systemPrompt, /390 €/);
        return 'Le parking privé est gratuit sur réservation. [SOURCE 1]';
      }
    );

    const result = await engine.decide({
      ...baseInput('Le parking est-il gratuit ?'),
      debug: true
    });

    assert.deepEqual(result.usedChunkIds, ['parking']);
    assert.equal(result.debug?.unsupportedInformationAlert, null);
  });

  it('requires the model to report missing information instead of inventing it', async () => {
    const engine = groundedEngine([], (input) => {
      assert.match(input.systemPrompt, /No relevant KMS source was found/);
      return 'Cette information n’est pas disponible dans les sources fournies.';
    });

    const result = await engine.decide({
      ...baseInput('Quel est le tarif vidéo drone ?'),
      debug: true
    });

    assert.doesNotMatch(result.reply, /\d+\s*€/);
    assert.deepEqual(result.usedChunkIds, []);
    assert.equal(result.debug?.injectedChunks.length, 0);
  });

  it('covers every part of a multi-part question with separate cited chunks', async () => {
    const engine = groundedEngine(
      [
        kmsCandidate('duration', 'Déroulement', 'La séance dure deux heures.', 0.84),
        kmsCandidate(
          'delivery',
          'Livraison',
          'Douze photos sont livrées sous trois semaines.',
          0.82
        )
      ],
      () =>
        'La séance dure deux heures [SOURCE 1]. Douze photos sont livrées sous trois semaines [SOURCE 2].'
    );

    const result = await engine.decide({
      ...baseInput('Combien de temps dure la séance et combien de photos sont livrées ?'),
      debug: true
    });

    assert.match(result.reply, /deux heures/);
    assert.match(result.reply, /Douze photos/);
    assert.equal(result.citations?.length, 2);
  });

  it('keeps KMS retrieval isolated to the requested organization and site', async () => {
    const candidate = kmsCandidate('site-a', 'Site A', 'Contenu réservé au site A.', 0.8);
    const engine = createDecisionEngine({
      businessConfigEngine: createMemoryBusinessConfigEngine(groundedConfig()),
      knowledgeSearch: {
        async search(input) {
          assert.equal(input.organizationId, baseInput('').organizationId);
          assert.equal(input.siteId, baseInput('').siteId);
          return [candidate];
        }
      },
      aiProvider: groundedProvider(() => 'Contenu réservé au site A. [SOURCE 1]')
    });

    const result = await engine.decide({ ...baseInput('Que contient le site ?'), debug: true });

    assert.deepEqual(result.usedChunkIds, ['site-a']);
    assert.doesNotMatch(result.debug?.kmsContext ?? '', /autre site/i);
  });

  it('never exposes prompts or KMS context when debug mode is disabled', async () => {
    const engine = groundedEngine(
      [kmsCandidate('private-context', 'Privé', 'Contexte interne.', 0.8)],
      () => 'Réponse publique. [SOURCE 1]'
    );

    const result = await engine.decide(baseInput('Question publique'));

    assert.equal(result.debug, undefined);
    assert.equal('prompt' in result, false);
    assert.equal('kmsContext' in result, false);
  });

  it('deduplicates prompt content and keeps at most five reranked chunks', async () => {
    const candidates = Array.from({ length: 7 }, (_, index) =>
      kmsCandidate(
        `chunk-${index + 1}`,
        `Document ${index + 1}`,
        index === 1 ? 'Contenu unique 0' : `Contenu unique ${index}`,
        0.9 - index / 100
      )
    );
    const engine = groundedEngine(candidates, () => 'Réponse fondée. [SOURCE 1]');

    const result = await engine.decide({ ...baseInput('Question de synthèse'), debug: true });

    assert.equal(result.debug?.injectedChunks.length, 5);
    assert.ok(result.debug?.droppedChunks.some((chunk) => chunk.reason === 'duplicate_content'));
    assert.ok(result.debug?.droppedChunks.some((chunk) => chunk.reason === 'maximum_5_chunks'));
  });
});

function groundedEngine(
  candidates: KnowledgeSearchResult[],
  reply: (input: Parameters<AIProvider['generateReply']>[0]) => string
) {
  return createDecisionEngine({
    businessConfigEngine: createMemoryBusinessConfigEngine(groundedConfig()),
    knowledgeSearch: {
      async search() {
        return candidates;
      }
    },
    aiProvider: groundedProvider(reply)
  });
}

function groundedProvider(
  reply: (input: Parameters<AIProvider['generateReply']>[0]) => string
): AIProvider {
  return {
    providerName: 'mock',
    async generateReply(input) {
      const content = reply(input);
      return {
        reply: content,
        confidence: 0.8,
        reason: 'grounded_test',
        provider: 'mock',
        model: 'grounded-test',
        inputTokens: 100,
        outputTokens: 30,
        latencyMs: 1,
        estimatedCost: 0,
        fallbackUsed: false
      };
    },
    estimateCost() {
      return 0;
    }
  };
}

function kmsCandidate(
  chunkId: string,
  title: string,
  content: string,
  score: number
): KnowledgeSearchResult {
  return {
    chunkId,
    documentId: `document-${chunkId}`,
    title,
    content,
    category: 'website',
    language: 'fr',
    score,
    relevance: score >= 0.7 ? 'high' : 'medium',
    source: `https://example.test/${chunkId}`,
    position: 0
  };
}

function groundedConfig(): BusinessConfig {
  return { ...testConfig, rules: [], faq: [], knowledgeBase: [] };
}

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
