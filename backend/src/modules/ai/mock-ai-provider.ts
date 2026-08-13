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
  const groundedSources = selectGroundedSources(input.systemPrompt, input.question);
  if (groundedSources.length > 0) {
    return groundedSources
      .map((source) => `${source.content} [SOURCE ${source.number}]`)
      .join('\n');
  }

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

type GroundedSource = { number: number; content: string; score: number };

const retrievalStopWords = new Set([
  'alors',
  'avec',
  'cette',
  'dans',
  'des',
  'est',
  'les',
  'leur',
  'pour',
  'quel',
  'quelle',
  'quels',
  'quelles',
  'sont',
  'sur',
  'une',
  'votre',
  'vous',
  'what',
  'which',
  'with',
  'your'
]);

function selectGroundedSources(systemPrompt: string, question: string): GroundedSource[] {
  const sources = parseKmsSources(systemPrompt);
  const questionTokens = meaningfulTokens(question);
  if (questionTokens.size === 0) return [];

  return sources.filter((source) => {
    const contentTokens = meaningfulTokens(source.content);
    const matchedQuestionTokens = [...questionTokens].filter((questionToken) =>
      [...contentTokens].some((contentToken) => tokensMatch(questionToken, contentToken))
    );
    return (
      matchedQuestionTokens.length >= 2 ||
      (matchedQuestionTokens.length === 1 && source.score >= 0.45)
    );
  });
}

function tokensMatch(left: string, right: string): boolean {
  return (
    left === right ||
    (Math.min(left.length, right.length) >= 4 && (left.startsWith(right) || right.startsWith(left)))
  );
}

function parseKmsSources(systemPrompt: string): GroundedSource[] {
  const contextStart = systemPrompt.lastIndexOf('KMS CONTEXT');
  if (contextStart < 0) return [];
  const context = systemPrompt.slice(contextStart);
  if (context.includes('No relevant KMS source was found.')) return [];

  return [
    ...context.matchAll(/\[SOURCE\s+(\d+)\]\n([\s\S]*?)(?=\n\n\[SOURCE\s+\d+\]|$)/gi)
  ].flatMap((match) => {
    const contentMarker = match[2]?.indexOf('content:\n') ?? -1;
    const content = contentMarker < 0 ? '' : match[2]!.slice(contentMarker + 9).trim();
    const score = Number(match[2]?.match(/^score:\s*([0-9.]+)$/m)?.[1] ?? 0);
    return content ? [{ number: Number(match[1]), content, score }] : [];
  });
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((token) => token.length >= 3 && !retrievalStopWords.has(token))
  );
}
