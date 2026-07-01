import type { AIProvider, AIProviderName, AIProviderResult } from './ai-provider.js';
import { AIProviderError } from './provider-error.js';

export class PreparedProvider implements AIProvider {
  constructor(readonly providerName: Exclude<AIProviderName, 'openai' | 'mock'>) {}

  generateReply(): Promise<AIProviderResult> {
    return Promise.reject(
      new AIProviderError(
        `${this.providerName} provider is prepared but not implemented`,
        'PROVIDER_UNAVAILABLE'
      )
    );
  }

  estimateCost(): number {
    return 0;
  }
}
