export type AiGenerateReplyInput = {
  question: string;
  recentHistory: Array<{
    senderType: string;
    content: string;
  }>;
  businessContext: {
    brandName: string;
    activity: string;
    rules: string[];
    fallbackMessage: string;
  };
  language?: string;
};

export type AiGenerateReplyResult = {
  reply: string;
  confidence: number;
  reason: string;
};

export type AiProvider = {
  providerName: string;
  generateReply: (input: AiGenerateReplyInput) => Promise<AiGenerateReplyResult>;
  estimateCost: (input: AiGenerateReplyInput) => number;
};
