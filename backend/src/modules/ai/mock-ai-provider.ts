import type { AiGenerateReplyInput, AiGenerateReplyResult, AiProvider } from './ai-provider.js';

export class MockAiProvider implements AiProvider {
  readonly providerName = 'mock';

  generateReply(input: AiGenerateReplyInput): Promise<AiGenerateReplyResult> {
    return Promise.resolve({
      reply: [
        `Je n'ai pas encore une reponse locale certaine pour ${input.businessContext.brandName}.`,
        input.businessContext.fallbackMessage
      ].join(' '),
      confidence: 0.42,
      reason: 'mock_ai_provider_without_external_call'
    });
  }

  estimateCost(): number {
    return 0;
  }
}

export function createDefaultAiProvider(openAiApiKey?: string): AiProvider {
  void openAiApiKey;

  return new MockAiProvider();
}
