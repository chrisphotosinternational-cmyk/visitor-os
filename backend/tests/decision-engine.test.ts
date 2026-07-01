import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AiProvider } from '../src/modules/ai/ai-provider.js';
import { createDecisionEngine } from '../src/modules/decision-engine/decision-engine.js';

describe('decision engine', () => {
  it('matches the parking FAQ', async () => {
    const result = await createDecisionEngine().decide(baseInput('Y a-t-il un parking ?'));

    assert.equal(result.source, 'faq');
    assert.equal(result.matchedItemId, 'parking');
    assert.equal(result.shouldEscalate, false);
    assert.ok(result.confidence >= 0.7);
  });

  it('matches the breakfast FAQ', async () => {
    const result = await createDecisionEngine().decide(
      baseInput('Le petit-dejeuner est-il inclus ?')
    );

    assert.equal(result.source, 'faq');
    assert.equal(result.matchedItemId, 'petit-dejeuner');
    assert.ok(result.confidence >= 0.7);
  });

  it('escalates pricing questions instead of inventing a price', async () => {
    const result = await createDecisionEngine().decide(baseInput('Quels sont vos tarifs ?'));

    assert.equal(result.source, 'human_escalation');
    assert.equal(result.shouldEscalate, true);
    assert.match(result.reason ?? '', /pricing/);
  });

  it('escalates availability questions', async () => {
    const result = await createDecisionEngine().decide(
      baseInput('Avez-vous une chambre disponible demain ?')
    );

    assert.equal(result.source, 'human_escalation');
    assert.equal(result.shouldEscalate, true);
    assert.match(result.reason ?? '', /availability/);
  });

  it('uses the mock provider for an unknown safe question', async () => {
    const result = await createDecisionEngine().decide(baseInput('Quelle est votre ambiance ?'));

    assert.equal(result.source, 'ai');
    assert.equal(result.shouldEscalate, false);
    assert.equal(result.confidence, 0.42);
  });

  it('does not crash when no real AI provider is configured', async () => {
    const result = await createDecisionEngine().decide(baseInput('Question inconnue simple'));

    assert.ok(result.reply.length > 0);
    assert.ok(result.processingTimeMs >= 0);
  });

  it('falls back and escalates when provider confidence is too low', async () => {
    const lowConfidenceProvider: AiProvider = {
      providerName: 'low-confidence',
      async generateReply() {
        return {
          reply: 'Je ne suis pas certain.',
          confidence: 0.1,
          reason: 'test_low_confidence'
        };
      },
      estimateCost() {
        return 0;
      }
    };

    const result = await createDecisionEngine({ aiProvider: lowConfidenceProvider }).decide(
      baseInput('Question inconnue simple')
    );

    assert.equal(result.source, 'fallback');
    assert.equal(result.shouldEscalate, true);
    assert.equal(result.confidence, 0.25);
  });

  it('matches the air conditioning FAQ with normalized accents', async () => {
    const result = await createDecisionEngine().decide(
      baseInput('Est-ce qu il y a la climatisation ?')
    );

    assert.equal(result.source, 'faq');
    assert.equal(result.matchedItemId, 'climatisation');
  });
});

function baseInput(message: string) {
  return {
    conversationId: '00000000-0000-4000-8000-000000000201',
    siteId: '00000000-0000-4000-8000-000000000101',
    activity: 'demo',
    message,
    recentHistory: []
  };
}
