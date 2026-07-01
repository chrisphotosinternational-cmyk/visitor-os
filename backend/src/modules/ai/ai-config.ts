import { z } from 'zod';
import type { AIProviderConfiguration, AIProviderName } from './ai-provider.js';

export const aiProviderNames = ['openai', 'anthropic', 'mistral', 'ollama', 'mock'] as const;

export const aiConfigurationSchema = z.object({
  provider: z.enum(aiProviderNames).default('mock'),
  model: z.string().trim().min(1).default('mock-conversational-v1'),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().min(1).max(4000).default(600),
  topP: z.number().min(0).max(1).default(1),
  timeoutMs: z.number().int().min(250).max(60_000).default(8000),
  language: z.string().trim().min(2).default('fr'),
  systemPrompt: z.string().default(''),
  enabled: z.boolean().default(true),
  futureCostLimit: z.number().min(0).nullable().default(null)
});

export const defaultAIConfiguration: AIProviderConfiguration = {
  provider: 'mock',
  model: 'mock-conversational-v1',
  temperature: 0.2,
  maxTokens: 600,
  topP: 1,
  timeoutMs: 8000,
  language: 'fr',
  systemPrompt: '',
  enabled: true,
  futureCostLimit: null
};

export function normalizeAIConfiguration(
  value: Partial<AIProviderConfiguration> | null | undefined
): AIProviderConfiguration {
  return aiConfigurationSchema.parse({ ...defaultAIConfiguration, ...value });
}

export function defaultModelForProvider(provider: AIProviderName): string {
  return (
    {
      openai: 'gpt-4o-mini',
      anthropic: 'claude-3-5-haiku-latest',
      mistral: 'mistral-small-latest',
      ollama: 'llama3.1',
      mock: 'mock-conversational-v1'
    } satisfies Record<AIProviderName, string>
  )[provider];
}
