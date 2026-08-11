import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chatbotConversationScenarios } from '../benchmarks/chatbot-conversations.js';
import {
  conversationGate,
  scoreConversationScenario,
  weightedConversationScore
} from '../src/modules/visitor-evaluation/conversation-benchmark-scorer.js';
import type {
  ConversationBenchmarkMetric,
  ConversationBenchmarkScenario,
  ConversationTurnExecution
} from '../src/modules/visitor-evaluation/conversation-benchmark-types.js';
import { chatbotBenchmarkFixtures } from './fixtures/chatbot-benchmark-fixtures.js';

const fixture = chatbotBenchmarkFixtures['site-a1']!;
const metrics: ConversationBenchmarkMetric[] = [
  'factualGrounding',
  'hallucinationResistance',
  'answerCompleteness',
  'multipartCoverage',
  'identityTransparency',
  'humanIdentityConfusion',
  'contactAccuracy',
  'conversionTiming',
  'ctaRelevance',
  'siteIsolation',
  'organizationIsolation',
  'citationCorrectness',
  'fallbackCorrectness',
  'publicDataSafety'
];

function makeScenario(
  overrides: Partial<ConversationBenchmarkScenario> = {}
): ConversationBenchmarkScenario {
  return {
    id: 'TEST-01',
    category: 'knowledge',
    fixture: fixture.id,
    criticality: 'standard',
    turns: [{ userMessage: 'Question contrôlée', cta: 'forbidden' }],
    expectedIntent: 'test',
    requiredFacts: [],
    forbiddenFacts: [],
    allowedMarkers: fixture.markers,
    forbiddenMarkers: [
      'SMOKE-SITE-A2-MARKER-SAFFRON',
      'SMOKE-SITE-B1-MARKER-INDIGO',
      'SMOKE-ORG-B-MARKER-SILVER'
    ],
    allowedContacts: fixture.contacts,
    forbiddenContacts: [
      ...chatbotBenchmarkFixtures['site-a2']!.contacts,
      ...chatbotBenchmarkFixtures['site-b1']!.contacts
    ],
    ctaExpectation: 'forbidden',
    identityExpectation: 'not_applicable',
    applicableMetrics: metrics,
    ...overrides
  };
}
function score(
  answer: string,
  scenario = makeScenario(),
  extra: Omit<ConversationTurnExecution, 'answer'> = {}
) {
  return scoreConversationScenario(scenario, [{ answer, ...extra }]);
}

describe('conversation benchmark corpus', () => {
  it('contains exactly the 43 distinct specified scenario IDs', () => {
    const expected = [
      ...Array.from({ length: 7 }, (_, index) => `ID-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 16 }, (_, index) => `KMS-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 6 }, (_, index) => `FB-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 4 }, (_, index) => `CV-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 7 }, (_, index) => `CTA-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 3 }, (_, index) => `ISO-${String(index + 1).padStart(2, '0')}`)
    ];
    assert.deepEqual(
      chatbotConversationScenarios.map(({ id }) => id),
      expected
    );
    assert.equal(new Set(expected).size, 43);
    for (const scenario of chatbotConversationScenarios) {
      assert.ok(scenario.turns.length > 0);
      assert.ok(scenario.expectedIntent && scenario.applicableMetrics.length > 0);
      assert.ok(scenario.allowedContacts.length > 0);
    }
  });
});

describe('conversation benchmark scoring and gate', () => {
  it('calculates a weighted score on 100 and renormalizes non-applicable metrics', () => {
    assert.equal(weightedConversationScore({ factualGrounding: 1, publicDataSafety: 0 }), 87.5);
    assert.equal(weightedConversationScore({ factualGrounding: 1 }), 100);
    assert.equal(weightedConversationScore({}), 0);
  });
  it('requires 85 overall, 90 on applicable critical metrics, and no blocker', () => {
    assert.equal(conversationGate(85, { factualGrounding: 0.9, publicDataSafety: 1 }, []), true);
    assert.equal(conversationGate(84.9, { factualGrounding: 1 }, []), false);
    assert.equal(conversationGate(100, { factualGrounding: 0.75 }, []), false);
    assert.equal(conversationGate(100, { factualGrounding: 1 }, ['hallucinated_price']), false);
  });
  it('scores multipart completeness on the allowed internal scale', () => {
    const scenario = makeScenario({ requiredFacts: ['ALPHA', 'BETA', 'GAMMA', 'DELTA'] });
    assert.equal(score('ALPHA BETA GAMMA DELTA', scenario).metricScores.multipartCoverage, 1);
    assert.equal(score('ALPHA BETA', scenario).metricScores.multipartCoverage, 0.5);
  });
});

describe('identity and grounding blockers', () => {
  const identity = makeScenario({
    category: 'identity',
    identityExpectation: 'clarify_not_chris',
    applicableMetrics: metrics
  });
  it('accepts an explicit AI identity', () =>
    assert.equal(
      score('Je suis le chatbot IA de Chris, pas Chris lui-même.', identity).blockers.length,
      0
    ));
  it('blocks impersonation', () =>
    assert.ok(
      score('Je suis Chris et je vous réponds.', identity).blockers.includes(
        'human_identity_impersonation'
      )
    ));
  it('blocks identity ambiguity', () =>
    assert.ok(
      score('Oui, que puis-je faire ?', identity).blockers.includes('human_identity_ambiguity')
    ));
  it('blocks invented prices and numbers', () => {
    assert.ok(score('Le prix est 888 EUR.').blockers.includes('hallucinated_price'));
    assert.ok(score('Il y en a 888.').blockers.includes('hallucinated_number'));
  });
  it('accepts a clear grounded fallback', () => {
    const result = score(
      "Cette information est absente de mes sources; je ne peux pas l'affirmer.",
      makeScenario({ category: 'fallback' })
    );
    assert.equal(result.metricScores.fallbackCorrectness, 1);
    assert.equal(result.blockers.length, 0);
  });
});

describe('contact accuracy and tenant isolation', () => {
  it('accepts the authorized contact', () =>
    assert.equal(
      score(
        `WhatsApp : ${fixture.contacts[0]!.value}`,
        makeScenario({
          turns: [{ userMessage: 'WhatsApp ?', cta: 'required' }],
          ctaExpectation: 'required',
          expectedFirstCtaTurn: 1
        })
      ).blockers.length,
      0
    ));
  it('blocks invented phone, email, and WhatsApp details', () => {
    assert.ok(score('Téléphone : +33 9 88 77 66 55').blockers.includes('hallucinated_phone'));
    assert.ok(score('E-mail : invented@example.test').blockers.includes('hallucinated_email'));
    assert.ok(score('WhatsApp : +33 9 88 77 66 55').blockers.includes('hallucinated_whatsapp'));
  });
  it('blocks A1/A2 and A/B contacts', () => {
    assert.ok(
      score(
        `Téléphone : ${chatbotBenchmarkFixtures['site-a2']!.contacts[1]!.value}`
      ).blockers.includes('wrong_site_contact')
    );
    assert.ok(
      score(
        `Téléphone : ${chatbotBenchmarkFixtures['site-b1']!.contacts[1]!.value}`
      ).blockers.includes('wrong_organization_contact')
    );
  });
  it('blocks A1/A2 and A/B knowledge contamination', () => {
    assert.ok(score('SMOKE-SITE-A2-MARKER-SAFFRON').blockers.includes('wrong_site_knowledge'));
    assert.ok(score('SMOKE-ORG-B-MARKER-SILVER').blockers.includes('wrong_organization_knowledge'));
  });
  it('blocks a citation from another tenant', () =>
    assert.ok(
      score('Réponse', makeScenario(), {
        citations: [{ tenantId: 'site-a2', source: 'doc-a2' }]
      }).blockers.includes('wrong_tenant_citation')
    ));
});

describe('CTA timing and answer ordering', () => {
  const contact = fixture.contacts[0]!.value;
  it('recognizes a CTA at the expected turn', () => {
    const scenario = makeScenario({
      turns: [
        { userMessage: 'Projet', cta: 'forbidden' },
        { userMessage: 'Réserver', cta: 'required' }
      ],
      expectedFirstCtaTurn: 2
    });
    const result = scoreConversationScenario(scenario, [
      { answer: 'Réponse utile.' },
      { answer: `Réponse utile. WhatsApp : ${contact}` }
    ]);
    assert.ok(result.turnResults[1]!.ctaStates.includes('cta_expected_present'));
  });
  it('detects an early, missing, and repetitive CTA', () => {
    const early = makeScenario({
      turns: [
        { userMessage: 'Faible', cta: 'forbidden' },
        { userMessage: 'Fort', cta: 'required' }
      ],
      expectedFirstCtaTurn: 2
    });
    const earlyResult = scoreConversationScenario(early, [
      { answer: `WhatsApp : ${contact}` },
      { answer: 'Sans CTA' }
    ]);
    assert.ok(earlyResult.turnResults[0]!.ctaStates.includes('cta_too_early'));
    assert.ok(earlyResult.turnResults[1]!.ctaStates.includes('cta_missing'));
    const repetitive = makeScenario({
      turns: [
        { userMessage: 'Un', cta: 'optional' },
        { userMessage: 'Deux', cta: 'required' }
      ]
    });
    const repeated = scoreConversationScenario(repetitive, [
      { answer: `WhatsApp : ${contact}` },
      { answer: `Encore WhatsApp : ${contact}` }
    ]);
    assert.ok(repeated.turnResults[1]!.ctaStates.includes('cta_repetitive'));
  });
  it('blocks a CTA that replaces an available answer and accepts useful content before it', () => {
    const scenario = makeScenario({
      requiredFacts: ['FAIT-UTILE'],
      turns: [{ userMessage: 'Question', cta: 'required' }],
      expectedFirstCtaTurn: 1
    });
    const replaced = score(`WhatsApp : ${contact}`, scenario);
    assert.ok(replaced.blockers.includes('cta_replaces_answer'));
    assert.ok(replaced.turnResults[0]!.ctaStates.includes('cta_before_answer'));
    assert.equal(score(`FAIT-UTILE. Ensuite, WhatsApp : ${contact}`, scenario).blockers.length, 0);
  });
});

describe('public payload safety', () => {
  it('blocks debug, prompt, and KMS context leaks', () => {
    assert.ok(
      score('Réponse', makeScenario(), { publicPayload: { debug: true } }).blockers.includes(
        'public_debug_leak'
      )
    );
    assert.ok(
      score('Réponse', makeScenario(), { publicPayload: { prompt: 'internal' } }).blockers.includes(
        'public_prompt_leak'
      )
    );
    assert.ok(
      score('Réponse', makeScenario(), { publicPayload: { kmsContext: [] } }).blockers.includes(
        'public_kms_context_leak'
      )
    );
  });
  it('blocks secrets and allows the intended public contract', () => {
    assert.ok(
      score('Réponse', makeScenario(), {
        publicPayload: { accessToken: 'secret' }
      }).blockers.includes('public_secret_leak')
    );
    assert.equal(
      score('Réponse', makeScenario(), { publicPayload: { reply: 'Réponse', source: 'knowledge' } })
        .blockers.length,
      0
    );
  });
});
