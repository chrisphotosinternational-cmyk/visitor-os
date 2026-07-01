import type { AiProvider } from '../ai/ai-provider.js';
import { createDefaultAiProvider } from '../ai/mock-ai-provider.js';
import {
  type FaqItem,
  getBusinessConversationConfig,
  type KnowledgeItem
} from './business-config.js';

export type DecisionSource = 'faq' | 'knowledge_base' | 'ai' | 'fallback' | 'human_escalation';

export type DecisionEngineInput = {
  conversationId: string;
  siteId: string;
  activity: string;
  message: string;
  recentHistory: Array<{
    senderType: string;
    content: string;
  }>;
  language?: string;
  pageUrl?: string | null;
};

export type DecisionEngineResult = {
  reply: string;
  source: DecisionSource;
  confidence: number;
  shouldEscalate: boolean;
  processingTimeMs: number;
  matchedItemId?: string;
  reason?: string;
};

export type DecisionEngine = {
  decide: (input: DecisionEngineInput) => Promise<DecisionEngineResult>;
};

const FAQ_MIN_CONFIDENCE = 0.7;
const KNOWLEDGE_BASE_MIN_CONFIDENCE = 0.66;
const AI_MIN_CONFIDENCE = 0.35;

export function createDecisionEngine(options?: { aiProvider?: AiProvider }): DecisionEngine {
  const aiProvider = options?.aiProvider ?? createDefaultAiProvider();

  return {
    async decide(input: DecisionEngineInput): Promise<DecisionEngineResult> {
      const startedAt = performance.now();
      const config = getBusinessConversationConfig(input.activity);
      const escalation = detectHumanEscalation(input.message);

      if (escalation) {
        return withProcessingTime(
          {
            reply:
              'Je prefere ne pas vous donner une information approximative. Le plus sur est de nous contacter directement pour une reponse precise.',
            source: 'human_escalation',
            confidence: 0.92,
            shouldEscalate: true,
            reason: escalation
          },
          startedAt
        );
      }

      const faqMatch = findBestFaqMatch(config.faq, input.message);
      if (faqMatch && faqMatch.confidence >= FAQ_MIN_CONFIDENCE) {
        return withProcessingTime(
          {
            reply: faqMatch.item.answer,
            source: 'faq',
            confidence: faqMatch.confidence,
            shouldEscalate: false,
            matchedItemId: faqMatch.item.id,
            reason: 'faq_keyword_match'
          },
          startedAt
        );
      }

      const knowledgeMatch = findBestKnowledgeMatch(config.knowledgeItems, input.message);
      if (knowledgeMatch && knowledgeMatch.confidence >= KNOWLEDGE_BASE_MIN_CONFIDENCE) {
        return withProcessingTime(
          {
            reply: knowledgeMatch.item.content,
            source: 'knowledge_base',
            confidence: knowledgeMatch.confidence,
            shouldEscalate: false,
            matchedItemId: knowledgeMatch.item.id,
            reason: 'knowledge_base_keyword_match'
          },
          startedAt
        );
      }

      const aiInput = {
        question: input.message,
        recentHistory: input.recentHistory,
        businessContext: {
          brandName: config.brandName,
          activity: config.activity,
          rules: config.rules,
          fallbackMessage: config.fallbackMessage
        }
      };

      const aiResult = await aiProvider.generateReply(
        input.language ? { ...aiInput, language: input.language } : aiInput
      );

      if (aiResult.confidence >= AI_MIN_CONFIDENCE) {
        return withProcessingTime(
          {
            reply: aiResult.reply,
            source: 'ai',
            confidence: clampConfidence(aiResult.confidence),
            shouldEscalate: false,
            reason: `${aiProvider.providerName}:${aiResult.reason}`
          },
          startedAt
        );
      }

      return withProcessingTime(
        {
          reply: config.fallbackMessage,
          source: 'fallback',
          confidence: 0.25,
          shouldEscalate: true,
          reason: 'low_confidence_fallback'
        },
        startedAt
      );
    }
  };
}

function findBestFaqMatch(
  items: FaqItem[],
  message: string
): { item: FaqItem; confidence: number } | null {
  return bestMatch(
    items.filter((item) => item.enabled),
    message,
    (item) => [...item.keywords, item.question],
    (item, score) => Math.min(item.confidence, score)
  );
}

function findBestKnowledgeMatch(
  items: KnowledgeItem[],
  message: string
): { item: KnowledgeItem; confidence: number } | null {
  return bestMatch(
    items.filter((item) => item.enabled),
    message,
    (item) => [...item.keywords, item.title],
    (_item, score) => Math.min(0.84, score)
  );
}

function bestMatch<T>(
  items: T[],
  message: string,
  terms: (item: T) => string[],
  confidence: (item: T, score: number) => number
): { item: T; confidence: number } | null {
  const normalizedMessage = normalizeText(message);
  const messageTokens = tokenize(normalizedMessage);
  let best: { item: T; confidence: number } | null = null;

  for (const item of items) {
    const itemTerms = terms(item).map(normalizeText);
    const exactMatches = itemTerms.filter(
      (term) => term.length >= 3 && normalizedMessage.includes(term)
    );
    const keywordTokens = new Set(itemTerms.flatMap((term) => [...tokenize(term)]));
    const tokenMatches = [...keywordTokens].filter((token) => messageTokens.has(token));

    if (exactMatches.length === 0 && tokenMatches.length === 0) {
      continue;
    }

    const rawScore = Math.min(0.98, exactMatches.length * 0.35 + tokenMatches.length * 0.22);
    const scoredConfidence = confidence(item, rawScore);

    if (!best || scoredConfidence > best.confidence) {
      best = { item, confidence: clampConfidence(scoredConfidence) };
    }
  }

  return best;
}

function detectHumanEscalation(message: string): string | null {
  const normalized = normalizeText(message);

  if (/(tarif|prix|combien|cout|co[uû]t|budget|devis)/.test(normalized)) {
    return 'pricing_requires_human_confirmation';
  }

  if (
    /(disponible|disponibilite|demain|ce soir|date precise|chambre disponible)/.test(normalized)
  ) {
    return 'availability_or_booking_requires_human_confirmation';
  }

  if (/(reserver|reservation).*(demain|ce soir|date|pour le|du )/.test(normalized)) {
    return 'specific_booking_requires_human_confirmation';
  }

  if (
    /(reclamation|plainte|remboursement|litige|mecontent|probleme urgent|urgence)/.test(normalized)
  ) {
    return 'complaint_or_urgent_request';
  }

  if (/(juridique|avocat|legal|medecin|medical|sante|urgence medicale)/.test(normalized)) {
    return 'sensitive_legal_or_medical_request';
  }

  return null;
}

function withProcessingTime(
  result: Omit<DecisionEngineResult, 'processingTimeMs'>,
  startedAt: number
): DecisionEngineResult {
  return {
    ...result,
    processingTimeMs: Math.max(0, Math.round(performance.now() - startedAt))
  };
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\u2019']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}
