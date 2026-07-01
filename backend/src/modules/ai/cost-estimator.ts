import type { AIProviderConfiguration, AIProviderName, AIProviderRequest } from './ai-provider.js';

type Pricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const PRICING: Partial<Record<AIProviderName, Pricing>> = {
  openai: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  anthropic: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  mistral: { inputPerMillion: 0.2, outputPerMillion: 0.6 },
  ollama: { inputPerMillion: 0, outputPerMillion: 0 },
  mock: { inputPerMillion: 0, outputPerMillion: 0 }
};

export type CostEstimate = {
  requestCost: number;
  conversationCost: number;
  dailyCost: number;
  monthlyCost: number;
};

export function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export function estimateRequestCost(
  provider: AIProviderName,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[provider] ?? { inputPerMillion: 0, outputPerMillion: 0 };

  return roundCost(
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
      (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

export function estimateInputTokens(input: AIProviderRequest): number {
  const messages = input.messages.map((message) => message.content).join('\n');

  return estimateTokens([input.systemPrompt, messages, input.question].join('\n'));
}

export function estimateOutputTokens(value: string | number): number {
  return typeof value === 'number' ? Math.max(1, value) : estimateTokens(value);
}

export function estimateCostFromConfig(
  config: AIProviderConfiguration,
  requestsPerDay: number,
  averageInputTokens = 700,
  averageOutputTokens = 180
): CostEstimate {
  const requestCost = estimateRequestCost(config.provider, averageInputTokens, averageOutputTokens);

  return {
    requestCost,
    conversationCost: roundCost(requestCost * 4),
    dailyCost: roundCost(requestCost * requestsPerDay),
    monthlyCost: roundCost(requestCost * requestsPerDay * 30)
  };
}

function roundCost(value: number): number {
  return Number(value.toFixed(6));
}
