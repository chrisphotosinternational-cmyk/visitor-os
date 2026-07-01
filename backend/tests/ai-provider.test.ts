import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppConfig } from '../src/core/config/env.js';
import { defaultAIConfiguration } from '../src/modules/ai/ai-config.js';
import { estimateCostFromConfig, estimateTokens } from '../src/modules/ai/cost-estimator.js';
import { MockAIProvider } from '../src/modules/ai/mock-ai-provider.js';
import { OpenAIProvider } from '../src/modules/ai/openai-provider.js';
import { ProviderFactory } from '../src/modules/ai/provider-factory.js';
import { buildSystemPrompt } from '../src/modules/business-config/prompt-builder.js';
import type { BusinessConfig } from '../src/modules/business-config/business-config-schema.js';

describe('AI Provider Engine', () => {
  it('uses the mock provider without external cost', async () => {
    const provider = new MockAIProvider();
    const result = await provider.generateReply(baseRequest());

    assert.equal(result.provider, 'mock');
    assert.equal(result.estimatedCost, 0);
    assert.ok(result.inputTokens > 0);
    assert.ok(result.outputTokens > 0);
  });

  it('calls the OpenAI provider through its abstraction', async () => {
    const provider = new OpenAIProvider(
      'test-key',
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Reponse OpenAI simulee.' } }],
            usage: { prompt_tokens: 120, completion_tokens: 24 }
          }),
          { status: 200 }
        )
    );
    const result = await provider.generateReply({
      ...baseRequest(),
      configuration: { ...defaultAIConfiguration, provider: 'openai', model: 'gpt-4o-mini' }
    });

    assert.equal(result.provider, 'openai');
    assert.equal(result.model, 'gpt-4o-mini');
    assert.equal(result.inputTokens, 120);
    assert.equal(result.outputTokens, 24);
    assert.ok(result.estimatedCost > 0);
  });

  it('falls back to mock when OPENAI_API_KEY is absent', async () => {
    const factory = new ProviderFactory(baseAppConfig());
    const provider = factory.createProviderFor({
      ...defaultAIConfiguration,
      provider: 'openai',
      model: 'gpt-4o-mini'
    });
    const result = await provider.generateReply(baseRequest());

    assert.equal(result.provider, 'mock');
    assert.equal(result.fallbackUsed, true);
  });

  it('falls back for prepared providers that are unavailable', async () => {
    const factory = new ProviderFactory(baseAppConfig());
    const provider = factory.createProviderFor({
      ...defaultAIConfiguration,
      provider: 'anthropic',
      model: 'claude-3-5-haiku-latest'
    });
    const result = await provider.generateReply(baseRequest());

    assert.equal(result.provider, 'mock');
    assert.equal(result.fallbackUsed, true);
  });

  it('estimates request and monthly costs', () => {
    const estimate = estimateCostFromConfig(
      { ...defaultAIConfiguration, provider: 'openai', model: 'gpt-4o-mini' },
      100
    );

    assert.ok(estimate.requestCost > 0);
    assert.ok(estimate.monthlyCost > estimate.dailyCost);
    assert.ok(estimateTokens('Bonjour') > 0);
  });

  it('builds the system prompt outside providers', () => {
    const prompt = buildSystemPrompt(testConfig);

    assert.match(prompt, /FAQ:/);
    assert.match(prompt, /Knowledge base:/);
    assert.match(prompt, /Business rules:/);
  });
});

function baseRequest() {
  return {
    organizationId: '00000000-0000-4000-8000-000000000001',
    siteId: '00000000-0000-4000-8000-000000000101',
    conversationId: '00000000-0000-4000-8000-000000000201',
    question: 'Bonjour, pouvez-vous aider ?',
    messages: [],
    systemPrompt: buildSystemPrompt(testConfig),
    businessContext: {
      brandName: testConfig.identity.name,
      activity: testConfig.identity.category,
      rules: [...testConfig.restrictions.never, ...testConfig.restrictions.always],
      fallbackMessage: testConfig.widget.fallbackMessage ?? 'Contactez-nous.'
    },
    configuration: defaultAIConfiguration
  };
}

function baseAppConfig(): AppConfig {
  return {
    app: { name: 'VISITOR-OS', environment: 'test' },
    server: { host: '127.0.0.1', port: 3000, shutdownTimeoutMs: 1000 },
    logger: { level: 'silent' },
    database: {
      url: 'postgresql://user:password@localhost:5432/visitor_os',
      ssl: false,
      connectionTimeoutMs: 1000
    },
    security: { allowedOrigins: [], rateLimitWindowMs: 60_000, rateLimitMaxRequests: 120 },
    ai: {},
    businessConfig: { directory: '../configs' },
    auth: {
      sessionSecret: 'dev-only-session-secret-change-before-production',
      sessionTtlMs: 1,
      sessionRenewalMs: 1
    }
  };
}

const testConfig: BusinessConfig = {
  id: 'test-business',
  version: '1.0.0',
  identity: {
    name: 'Test Business',
    description: 'Configurable test business',
    category: 'test',
    colors: {}
  },
  contact: { openingHours: [] },
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
    never: ['inventer'],
    always: ['rester prudent']
  },
  faq: [
    {
      id: 'contact',
      category: 'general',
      question: 'Comment vous contacter ?',
      keywords: ['contact'],
      answer: 'Contactez-nous via le site.',
      confidence: 0.9,
      order: 10,
      enabled: true
    }
  ],
  knowledgeBase: [
    {
      id: 'about',
      title: 'A propos',
      content: 'Information metier.',
      category: 'general',
      tags: ['about'],
      keywords: ['about'],
      enabled: true
    }
  ],
  rules: [
    {
      id: 'pricing',
      label: 'Prix',
      enabled: true,
      order: 10,
      when: { contains: ['prix'] },
      then: { action: 'human_escalation', reason: 'pricing_requires_human_confirmation' }
    }
  ],
  widget: {
    welcomeMessage: 'Bonjour.',
    fallbackMessage: 'Contactez-nous pour une reponse precise.',
    quickReplies: []
  }
};
