export type AIProviderName = 'openai' | 'anthropic' | 'mistral' | 'ollama' | 'mock';

export type AIProviderConfiguration = {
  provider: AIProviderName;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeoutMs: number;
  language: string;
  systemPrompt: string;
  enabled: boolean;
  futureCostLimit: number | null;
};

export type AIProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIProviderRequest = {
  organizationId: string;
  siteId: string;
  conversationId: string;
  question: string;
  messages: AIProviderMessage[];
  systemPrompt: string;
  businessContext: {
    brandName: string;
    activity: string;
    rules: string[];
    fallbackMessage: string;
  };
  configuration: AIProviderConfiguration;
  language?: string;
};

export type AIProviderResult = {
  reply: string;
  confidence: number;
  reason: string;
  provider: AIProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCost: number;
  fallbackUsed: boolean;
};

export type AIProvider = {
  providerName: AIProviderName;
  generateReply: (input: AIProviderRequest) => Promise<AIProviderResult>;
  estimateCost: (input: AIProviderRequest, outputTokens?: number) => number;
};

export type AiGenerateReplyInput = AIProviderRequest;
export type AiGenerateReplyResult = AIProviderResult;
export type AiProvider = AIProvider;
