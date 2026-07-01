import type { AppConfig } from '../../core/config/env.js';
import type { AIConfigurationRepository } from './ai-configuration-repository.js';
import { defaultAIConfiguration, normalizeAIConfiguration } from './ai-config.js';
import type {
  AIProvider,
  AIProviderConfiguration,
  AIProviderName,
  AIProviderRequest,
  AIProviderResult
} from './ai-provider.js';
import { MockAIProvider } from './mock-ai-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { PreparedProvider } from './prepared-provider.js';

export class ProviderFactory {
  constructor(
    private readonly config: AppConfig,
    private readonly aiConfigurations?: AIConfigurationRepository
  ) {}

  createProvider(): AIProvider {
    return new RoutingAIProvider(this);
  }

  async resolveConfiguration(organizationId?: string): Promise<AIProviderConfiguration> {
    if (!organizationId || !this.aiConfigurations) {
      return defaultAIConfiguration;
    }

    return normalizeAIConfiguration(
      await this.aiConfigurations.findByOrganizationId(organizationId)
    );
  }

  createProviderFor(configuration: AIProviderConfiguration): AIProvider {
    const primary = this.createRawProvider(configuration.provider);

    if (configuration.provider === 'mock') {
      return primary;
    }

    return new FallbackAIProvider(primary, new MockAIProvider());
  }

  private createRawProvider(provider: AIProviderName): AIProvider {
    switch (provider) {
      case 'openai':
        return new OpenAIProvider(this.config.ai.openAiApiKey);
      case 'anthropic':
      case 'mistral':
      case 'ollama':
        return new PreparedProvider(provider);
      case 'mock':
        return new MockAIProvider();
    }
  }
}

class RoutingAIProvider implements AIProvider {
  readonly providerName = 'mock';

  constructor(private readonly factory: ProviderFactory) {}

  async generateReply(input: AIProviderRequest): Promise<AIProviderResult> {
    const configuration = await this.factory.resolveConfiguration(input.organizationId);
    const provider = this.factory.createProviderFor(configuration);

    return provider.generateReply({ ...input, configuration });
  }

  estimateCost(input: AIProviderRequest): number {
    const provider = this.factory.createProviderFor(input.configuration);

    return provider.estimateCost(input);
  }
}

class FallbackAIProvider implements AIProvider {
  readonly providerName: AIProviderName;

  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: MockAIProvider
  ) {
    this.providerName = primary.providerName;
  }

  async generateReply(input: AIProviderRequest): Promise<AIProviderResult> {
    try {
      return await this.primary.generateReply(input);
    } catch {
      const result = await this.fallback.generateReply(input);

      return { ...result, fallbackUsed: true };
    }
  }

  estimateCost(input: AIProviderRequest, outputTokens?: number): number {
    return this.primary.estimateCost(input, outputTokens);
  }
}
