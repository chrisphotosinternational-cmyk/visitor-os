import {
  estimateInputTokens,
  estimateOutputTokens,
  estimateRequestCost
} from './cost-estimator.js';
import type { AIProvider, AIProviderRequest, AIProviderResult } from './ai-provider.js';

export class MockAIProvider implements AIProvider {
  readonly providerName = 'mock';

  generateReply(input: AIProviderRequest): Promise<AIProviderResult> {
    const startedAt = performance.now();
    const reply = buildMockReply(input);
    const inputTokens = estimateInputTokens(input);
    const outputTokens = estimateOutputTokens(reply);

    return Promise.resolve({
      reply,
      confidence: 0.42,
      reason: 'mock_ai_provider_without_external_call',
      provider: 'mock',
      model: input.configuration.model || 'mock-conversational-v1',
      inputTokens,
      outputTokens,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      estimatedCost: estimateRequestCost('mock', inputTokens, outputTokens),
      fallbackUsed: input.configuration.provider !== 'mock'
    });
  }

  estimateCost(): number {
    return 0;
  }
}

export class MockAiProvider extends MockAIProvider {}

export function createDefaultAiProvider(openAiApiKey?: string): AIProvider {
  void openAiApiKey;

  return new MockAIProvider();
}

function buildMockReply(input: AIProviderRequest): string {
  const normalizedQuestion = input.question.toLowerCase();
  const brand = input.businessContext.brandName;

  if (normalizedQuestion.includes('contact')) {
    return `Pour ${brand}, le plus simple est de laisser vos coordonnees ou d'utiliser le contact indique sur le site.`;
  }

  if (normalizedQuestion.includes('horaire') || normalizedQuestion.includes('ouvert')) {
    return `Je n'ai pas encore une certitude locale sur les horaires de ${brand}. ${input.businessContext.fallbackMessage}`;
  }

  return [
    `Je n'ai pas encore une reponse locale certaine pour ${brand}.`,
    input.businessContext.fallbackMessage
  ].join(' ');
}
