import type { AIProvider, AIProviderRequest, AIProviderResult } from './ai-provider.js';
import {
  estimateInputTokens,
  estimateOutputTokens,
  estimateRequestCost
} from './cost-estimator.js';
import { AIProviderError } from './provider-error.js';

type FetchLike = typeof fetch;

export class OpenAIProvider implements AIProvider {
  readonly providerName = 'openai';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetcher: FetchLike = fetch
  ) {}

  async generateReply(input: AIProviderRequest): Promise<AIProviderResult> {
    if (!input.configuration.enabled) {
      throw new AIProviderError('OpenAI provider is disabled', 'PROVIDER_DISABLED');
    }

    if (!this.apiKey) {
      throw new AIProviderError('OPENAI_API_KEY is not configured', 'MISSING_API_KEY');
    }

    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.configuration.timeoutMs);

    try {
      const response = await this.fetcher('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: input.configuration.model,
          temperature: input.configuration.temperature,
          max_tokens: input.configuration.maxTokens,
          top_p: input.configuration.topP,
          messages: [
            { role: 'system', content: input.systemPrompt },
            ...input.messages,
            { role: 'user', content: input.question }
          ]
        })
      });

      if (!response.ok) {
        throw new AIProviderError(
          `OpenAI returned HTTP ${response.status}`,
          'PROVIDER_UNAVAILABLE'
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const reply = payload.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        throw new AIProviderError('OpenAI response did not contain content', 'INVALID_RESPONSE');
      }

      const inputTokens = payload.usage?.prompt_tokens ?? estimateInputTokens(input);
      const outputTokens = payload.usage?.completion_tokens ?? estimateOutputTokens(reply);

      return {
        reply,
        confidence: 0.74,
        reason: 'openai_chat_completion',
        provider: 'openai',
        model: input.configuration.model,
        inputTokens,
        outputTokens,
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        estimatedCost: estimateRequestCost('openai', inputTokens, outputTokens),
        fallbackUsed: false
      };
    } catch (error) {
      if (error instanceof AIProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIProviderError('OpenAI request timed out', 'TIMEOUT');
      }

      throw new AIProviderError('OpenAI request failed', 'PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  estimateCost(input: AIProviderRequest, outputTokens = 180): number {
    return estimateRequestCost('openai', estimateInputTokens(input), outputTokens);
  }
}
