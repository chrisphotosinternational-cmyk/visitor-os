import type { AIProvider, AIProviderConfiguration, AIProviderResult } from '../ai/ai-provider.js';
import { defaultAIConfiguration } from '../ai/ai-config.js';
import { createDefaultAiProvider } from '../ai/mock-ai-provider.js';
import { type BusinessConfigEngine } from '../business-config/configuration-loader.js';
import { buildSystemPrompt } from '../business-config/prompt-builder.js';
import type {
  BusinessConfig,
  BusinessFaq,
  BusinessRule,
  KnowledgeBaseItem
} from '../business-config/business-config-schema.js';
import type { KnowledgeSearch } from '../kms/knowledge-search.js';
import type { KnowledgeSearchResult } from '../kms/knowledge-types.js';
import { detectRetrievalIntent } from '../intelligent-retrieval/intent-detector.js';
import type {
  IntelligentRetrievalTrace,
  RankedRetrievalCandidate
} from '../intelligent-retrieval/intelligent-retrieval-types.js';

export type DecisionSource =
  'faq' | 'knowledge_search' | 'knowledge_base' | 'ai' | 'fallback' | 'human_escalation';

export type DecisionEngineInput = {
  organizationId: string;
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
  debug?: boolean;
};

export type ChatbotDebugTrace = {
  totalTimeMs: number;
  intent: string;
  chunksBeforeReranking: IntelligentRetrievalTrace['candidatesBeforeReranking'];
  chunksAfterReranking: RankedRetrievalCandidate[];
  prompt: { system: string; messages: Array<{ role: string; content: string }> } | null;
  rawLlmResponse: AIProviderResult | null;
  injectedChunks: KmsPromptSource[];
  kmsContext: string;
  contextCharacters: number;
  contextTokens: number;
  droppedChunks: Array<{ chunkId: string; documentId: string; title: string; reason: string }>;
  citedChunkIds: string[];
  unsupportedInformationAlert: string | null;
  timings: {
    kmsSearchMs: number;
    rerankingMs: number;
    promptConstructionMs: number;
    llmCallMs: number;
    totalMs: number;
  };
  tokens: { prompt: number; response: number; total: number };
  retainedSources: Array<{
    documentId: string;
    document: string;
    chunk: string;
    rank: number;
    reason: string;
  }>;
  weakAnswer: { weak: boolean; explanation: string; suggestion: string | null };
};

export type KmsPromptSource = {
  sourceNumber: number;
  chunkId: string;
  documentId: string;
  title: string;
  category: string;
  source: string;
  score: number;
  position?: number;
  content: string;
};

export type DecisionCitation = {
  sourceNumber: number;
  chunkId: string;
  documentId: string;
  title: string;
  source: string;
};

export type DecisionEngineResult = {
  reply: string;
  source: DecisionSource;
  confidence: number;
  shouldEscalate: boolean;
  processingTimeMs: number;
  matchedItemId?: string;
  reason?: string;
  aiEvent?: {
    provider: string;
    model: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    fallbackUsed: boolean;
  };
  debug?: ChatbotDebugTrace;
  usedChunkIds?: string[];
  usedDocumentIds?: string[];
  sources?: DecisionCitation[];
  citations?: DecisionCitation[];
};

export type DecisionEngine = {
  decide: (input: DecisionEngineInput) => Promise<DecisionEngineResult>;
  getBusinessConfig: (configId?: string | null) => Promise<BusinessConfig>;
};

const FAQ_MIN_CONFIDENCE = 0.7;
const KNOWLEDGE_BASE_MIN_CONFIDENCE = 0.66;
const AI_MIN_CONFIDENCE = 0.35;
const MAX_KMS_PROMPT_CHUNKS = 5;
const MAX_KMS_CONTEXT_CHARACTERS = 12_000;

export function createDecisionEngine(options: {
  aiProvider?: AIProvider;
  businessConfigEngine: BusinessConfigEngine;
  knowledgeSearch?: KnowledgeSearch & {
    inspect?: (
      input: Parameters<KnowledgeSearch['search']>[0]
    ) => Promise<IntelligentRetrievalTrace>;
  };
}): DecisionEngine {
  const aiProvider = options?.aiProvider ?? createDefaultAiProvider();
  const businessConfigEngine = options.businessConfigEngine;
  const knowledgeSearch = options.knowledgeSearch;

  return {
    getBusinessConfig(configId?: string | null): Promise<BusinessConfig> {
      return businessConfigEngine.resolveConfig(configId);
    },

    async decide(input: DecisionEngineInput): Promise<DecisionEngineResult> {
      const startedAt = performance.now();
      const debugState = createDebugState(input.message);
      const config = await businessConfigEngine.resolveConfig(input.activity);
      const ruleMatch = findMatchingRule(config.rules, input.message);

      if (ruleMatch) {
        return withDebug(
          withProcessingTime(
            {
              reply: ruleMatch.then.reply ?? buildEscalationReply(config),
              source: ruleMatch.then.action,
              confidence: 0.92,
              shouldEscalate: ruleMatch.then.action === 'human_escalation',
              matchedItemId: ruleMatch.id,
              reason: ruleMatch.then.reason
            },
            startedAt
          ),
          input,
          debugState,
          startedAt
        );
      }

      const faqMatch = findBestFaqMatch(config.faq, input.message);
      if (faqMatch && faqMatch.confidence >= FAQ_MIN_CONFIDENCE) {
        return withDebug(
          withProcessingTime(
            {
              reply: faqMatch.item.answer,
              source: 'faq',
              confidence: faqMatch.confidence,
              shouldEscalate: false,
              matchedItemId: faqMatch.item.id,
              reason: 'faq_keyword_match'
            },
            startedAt
          ),
          input,
          debugState,
          startedAt
        );
      }

      const retrievalInput = {
        organizationId: input.organizationId,
        siteId: input.siteId,
        query: input.message,
        ...(input.language ? { language: input.language } : {}),
        limit: input.debug ? 10 : 5
      };
      const retrievalTrace =
        input.debug && knowledgeSearch?.inspect
          ? await knowledgeSearch.inspect(retrievalInput)
          : null;
      const documentMatches = retrievalTrace
        ? retrievalTrace.candidates
        : await knowledgeSearch?.search(retrievalInput);
      if (retrievalTrace) applyRetrievalDebug(debugState, retrievalTrace);
      const kmsPromptContext = buildKmsPromptContext(documentMatches ?? []);
      applyKmsContextDebug(debugState, kmsPromptContext);

      const knowledgeMatch = findBestKnowledgeMatch(config.knowledgeBase, input.message);
      if (knowledgeMatch && knowledgeMatch.confidence >= KNOWLEDGE_BASE_MIN_CONFIDENCE) {
        return withDebug(
          withProcessingTime(
            {
              reply: knowledgeMatch.item.content,
              source: 'knowledge_base',
              confidence: knowledgeMatch.confidence,
              shouldEscalate: false,
              matchedItemId: knowledgeMatch.item.id,
              reason: 'knowledge_base_keyword_match'
            },
            startedAt
          ),
          input,
          debugState,
          startedAt
        );
      }

      const aiConfiguration = resolveAIConfiguration(config);
      const promptStartedAt = performance.now();
      const systemPrompt = [
        aiConfiguration.systemPrompt || buildSystemPrompt(config),
        buildGroundingInstructions(Boolean(kmsPromptContext.sources.length)),
        kmsPromptContext.text
      ].join('\n\n');
      const aiInput = {
        organizationId: input.organizationId,
        siteId: input.siteId,
        conversationId: input.conversationId,
        question: input.message,
        messages: input.recentHistory.map((message) => ({
          role: message.senderType === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: message.content
        })),
        systemPrompt,
        businessContext: {
          brandName: config.identity.name,
          activity: config.identity.category,
          rules: [...config.restrictions.never, ...config.restrictions.always],
          fallbackMessage: config.widget.fallbackMessage ?? buildEscalationReply(config)
        },
        configuration: aiConfiguration
      };
      debugState.timings.promptConstructionMs = elapsed(promptStartedAt);
      debugState.prompt = {
        system: aiInput.systemPrompt,
        messages: [
          { role: 'system', content: aiInput.systemPrompt },
          ...aiInput.messages,
          { role: 'user', content: input.message }
        ]
      };

      const llmStartedAt = performance.now();
      const aiResult: AIProviderResult = await aiProvider.generateReply(
        input.language ? { ...aiInput, language: input.language } : aiInput
      );
      debugState.timings.llmCallMs = elapsed(llmStartedAt);
      debugState.rawLlmResponse = aiResult;
      debugState.tokens = {
        prompt: aiResult.inputTokens,
        response: aiResult.outputTokens,
        total: aiResult.inputTokens + aiResult.outputTokens
      };
      const citations = extractCitations(aiResult.reply, kmsPromptContext.sources);
      const usedChunkIds = unique(citations.map((citation) => citation.chunkId));
      const usedDocumentIds = unique(citations.map((citation) => citation.documentId));
      debugState.citedChunkIds = usedChunkIds;
      debugState.unsupportedInformationAlert = detectUnsupportedInformation(
        aiResult.reply,
        kmsPromptContext.text,
        citations,
        kmsPromptContext.sources.length
      );
      const fidelityCheckFailed = debugState.unsupportedInformationAlert !== null;

      if (aiResult.confidence >= AI_MIN_CONFIDENCE && !fidelityCheckFailed) {
        return withDebug(
          withProcessingTime(
            {
              reply: aiResult.reply,
              source: 'ai',
              confidence: clampConfidence(aiResult.confidence),
              shouldEscalate: false,
              reason: `${aiResult.provider}:${aiResult.reason}`,
              aiEvent: toAIEvent(aiResult),
              usedChunkIds,
              usedDocumentIds,
              sources: citations,
              citations
            },
            startedAt
          ),
          input,
          debugState,
          startedAt
        );
      }

      return withDebug(
        withProcessingTime(
          {
            reply: config.widget.fallbackMessage ?? buildEscalationReply(config),
            source: 'fallback',
            confidence: 0.25,
            shouldEscalate: true,
            reason: fidelityCheckFailed
              ? 'grounding_fidelity_fallback'
              : 'low_confidence_fallback',
            aiEvent: toAIEvent(aiResult),
            usedChunkIds,
            usedDocumentIds,
            sources: citations,
            citations
          },
          startedAt
        ),
        input,
        debugState,
        startedAt
      );
    }
  };
}

function createDebugState(message: string): Omit<ChatbotDebugTrace, 'totalTimeMs'> {
  return {
    intent: detectRetrievalIntent(message),
    chunksBeforeReranking: [],
    chunksAfterReranking: [],
    prompt: null,
    rawLlmResponse: null,
    injectedChunks: [],
    kmsContext: '',
    contextCharacters: 0,
    contextTokens: 0,
    droppedChunks: [],
    citedChunkIds: [],
    unsupportedInformationAlert: null,
    timings: { kmsSearchMs: 0, rerankingMs: 0, promptConstructionMs: 0, llmCallMs: 0, totalMs: 0 },
    tokens: { prompt: 0, response: 0, total: 0 },
    retainedSources: [],
    weakAnswer: { weak: false, explanation: '', suggestion: null }
  };
}

function applyRetrievalDebug(
  state: Omit<ChatbotDebugTrace, 'totalTimeMs'>,
  trace: IntelligentRetrievalTrace
): void {
  state.intent = trace.intent;
  state.chunksBeforeReranking = trace.candidatesBeforeReranking.slice(0, 10);
  state.chunksAfterReranking = trace.candidates.slice(0, 10);
  state.timings.kmsSearchMs = trace.timings.searchMs;
  state.timings.rerankingMs = trace.timings.rerankingMs;
  state.retainedSources = trace.candidates.slice(0, 3).map((candidate) => ({
    documentId: candidate.documentId,
    document: candidate.title,
    chunk: candidate.content,
    rank: candidate.rank,
    reason: candidate.justification
  }));
}

function withDebug(
  result: DecisionEngineResult,
  input: DecisionEngineInput,
  state: Omit<ChatbotDebugTrace, 'totalTimeMs'>,
  startedAt: number
): DecisionEngineResult {
  if (!input.debug) return result;
  const totalTimeMs = elapsed(startedAt);
  state.timings.totalMs = totalTimeMs;
  state.weakAnswer = explainWeakAnswer(result, state);
  return { ...result, debug: { ...state, totalTimeMs } };
}

function explainWeakAnswer(
  result: DecisionEngineResult,
  state: Omit<ChatbotDebugTrace, 'totalTimeMs'>
): ChatbotDebugTrace['weakAnswer'] {
  if (result.confidence >= 0.58 && !result.shouldEscalate) {
    return {
      weak: false,
      explanation: 'La réponse dépasse le seuil de confiance.',
      suggestion: null
    };
  }
  const intentCandidate = state.chunksAfterReranking.find((candidate) =>
    candidate.bonusesApplied.some((bonus) => bonus.category === state.intent)
  );
  if (intentCandidate && intentCandidate.rank > 3) {
    return {
      weak: true,
      explanation: `Le chunk « ${intentCandidate.title} » est arrivé seulement en position ${intentCandidate.rank}.`,
      suggestion: `Augmenter le bonus lié à l’intention « ${state.intent} ».`
    };
  }
  if (state.chunksAfterReranking.length === 0) {
    return {
      weak: true,
      explanation: 'Aucune information pertinente n’a été trouvée dans le KMS.',
      suggestion: 'Ajouter ou réindexer une source correspondant à cette question.'
    };
  }
  return {
    weak: true,
    explanation: `La confiance finale (${result.confidence.toFixed(2)}) est sous le seuil attendu.`,
    suggestion: `Vérifier les chunks retenus et les bonus de l’intention « ${state.intent} ».`
  };
}

function elapsed(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

type KmsPromptContext = {
  text: string;
  sources: KmsPromptSource[];
  dropped: ChatbotDebugTrace['droppedChunks'];
  characters: number;
  tokens: number;
};

function buildKmsPromptContext(candidates: KnowledgeSearchResult[]): KmsPromptContext {
  const sources: KmsPromptSource[] = [];
  const dropped: ChatbotDebugTrace['droppedChunks'] = [];
  const seenContent = new Set<string>();
  let text = 'KMS CONTEXT';

  candidates.forEach((candidate, index) => {
    const chunkId = candidate.chunkId ?? `${candidate.documentId}:${candidate.position ?? index}`;
    const droppedChunk = (reason: string): void => {
      dropped.push({ chunkId, documentId: candidate.documentId, title: candidate.title, reason });
    };
    const content = candidate.content.trim();
    if (!content) {
      droppedChunk('empty_content');
      return;
    }
    const contentKey = content.replace(/\s+/g, ' ').toLowerCase();
    if (seenContent.has(contentKey)) {
      droppedChunk('duplicate_content');
      return;
    }
    if (sources.length >= MAX_KMS_PROMPT_CHUNKS) {
      droppedChunk('maximum_5_chunks');
      return;
    }

    const sourceNumber = sources.length + 1;
    const header = [
      `[SOURCE ${sourceNumber}]`,
      `chunkId: ${chunkId}`,
      `documentId: ${candidate.documentId}`,
      `title: ${candidate.title}`,
      `category: ${candidate.category}`,
      `source: ${candidate.source}`,
      `score: ${candidate.score}`,
      ...(candidate.position === undefined ? [] : [`position: ${candidate.position}`]),
      'content:'
    ].join('\n');
    const available = MAX_KMS_CONTEXT_CHARACTERS - text.length - header.length - 4;
    if (available < 80) {
      droppedChunk('context_character_budget');
      return;
    }
    const selectedContent = content.slice(0, available);
    const source: KmsPromptSource = {
      sourceNumber,
      chunkId,
      documentId: candidate.documentId,
      title: candidate.title,
      category: candidate.category,
      source: candidate.source,
      score: candidate.score,
      ...(candidate.position === undefined ? {} : { position: candidate.position }),
      content: selectedContent
    };
    seenContent.add(contentKey);
    sources.push(source);
    text += `\n\n${header}\n${selectedContent}`;
    if (selectedContent.length < content.length) droppedChunk('content_truncated_to_budget');
  });

  if (sources.length === 0) text += '\n\nNo relevant KMS source was found.';
  return {
    text,
    sources,
    dropped,
    characters: text.length,
    tokens: Math.ceil(text.length / 4)
  };
}

function buildGroundingInstructions(hasKmsContext: boolean): string {
  return [
    'STRICT GROUNDED ANSWER RULES',
    '- Réponds uniquement avec les informations du KMS CONTEXT et de la configuration métier autorisée.',
    '- N’invente jamais une information absente. Si le contexte est insuffisant, indique-le clairement.',
    '- Réponds à chaque élément de la question et associe chaque fait à sa source avec [SOURCE N].',
    '- Préserve exactement les montants, durées, quantités, conditions et inclusions.',
    '- N’omets aucune offre pertinente présente dans les sources retenues.',
    '- Pour une question tarifaire, présente toutes les offres pertinentes, avec leur prestation, prix, durée, inclusions et conditions disponibles.',
    '- Ne fusionne jamais deux offres distinctes et n’invente aucun tarif.',
    hasKmsContext
      ? '- Chaque affirmation issue du KMS doit contenir au moins une citation [SOURCE N].'
      : '- Aucun contexte KMS pertinent n’est disponible : signale toute information manquante au lieu de la deviner.'
  ].join('\n');
}

function applyKmsContextDebug(
  state: Omit<ChatbotDebugTrace, 'totalTimeMs'>,
  context: KmsPromptContext
): void {
  state.injectedChunks = context.sources;
  state.kmsContext = context.text;
  state.contextCharacters = context.characters;
  state.contextTokens = context.tokens;
  state.droppedChunks = context.dropped;
  state.retainedSources = context.sources.map((source) => ({
    documentId: source.documentId,
    document: source.title,
    chunk: source.content,
    rank: source.sourceNumber,
    reason: 'Retenu dans l’ordre du reranking, contenu unique et budget disponible.'
  }));
}

function extractCitations(reply: string, sources: KmsPromptSource[]): DecisionCitation[] {
  const citedNumbers = unique(
    [...reply.matchAll(/\[SOURCE\s+(\d+)\]/gi)].map((match) => Number(match[1]))
  );
  return citedNumbers.flatMap((sourceNumber) => {
    const source = sources.find((candidate) => candidate.sourceNumber === sourceNumber);
    return source
      ? [
          {
            sourceNumber,
            chunkId: source.chunkId,
            documentId: source.documentId,
            title: source.title,
            source: source.source
          }
        ]
      : [];
  });
}

function detectUnsupportedInformation(
  reply: string,
  context: string,
  citations: DecisionCitation[],
  sourceCount: number
): string | null {
  if (sourceCount > 0 && citations.length === 0) {
    return 'La réponse ne cite aucun des chunks injectés : son ancrage KMS ne peut pas être vérifié.';
  }
  const contextFacts = new Set(context.match(/\b\d+(?:[.,]\d+)?\b|€/g) ?? []);
  const unsupportedFacts = unique(reply.match(/\b\d+(?:[.,]\d+)?\b|€/g) ?? []).filter(
    (fact) => !contextFacts.has(fact)
  );
  return unsupportedFacts.length > 0
    ? `Information chiffrée absente du contexte KMS : ${unsupportedFacts.join(', ')}.`
    : null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function resolveAIConfiguration(config: BusinessConfig): AIProviderConfiguration {
  return {
    ...defaultAIConfiguration,
    language: config.personality.defaultLanguage,
    systemPrompt: buildSystemPrompt(config)
  };
}

function toAIEvent(result: AIProviderResult): NonNullable<DecisionEngineResult['aiEvent']> {
  return {
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCost: result.estimatedCost,
    fallbackUsed: result.fallbackUsed
  };
}

function findBestFaqMatch(
  items: BusinessFaq[],
  message: string
): { item: BusinessFaq; confidence: number } | null {
  return bestMatch(
    items.filter((item) => item.enabled),
    message,
    (item) => [...item.keywords, item.question],
    (item, score) => Math.min(item.confidence, score)
  );
}

function findBestKnowledgeMatch(
  items: KnowledgeBaseItem[],
  message: string
): { item: KnowledgeBaseItem; confidence: number } | null {
  return bestMatch(
    items.filter((item) => item.enabled),
    message,
    (item) => [...item.keywords, ...item.tags, item.title],
    (_item, score) => Math.min(0.84, score)
  );
}

function findMatchingRule(rules: BusinessRule[], message: string): BusinessRule | null {
  const normalizedMessage = normalizeText(message);

  return (
    rules
      .filter((rule) => rule.enabled)
      .sort((first, second) => first.order - second.order)
      .find((rule) =>
        rule.when.contains.some((keyword) => normalizedMessage.includes(normalizeText(keyword)))
      ) ?? null
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

function buildEscalationReply(config: BusinessConfig): string {
  return (
    config.widget.fallbackMessage ??
    'Je prefere ne pas vous donner une information approximative. Le plus sur est de nous contacter directement pour une reponse precise.'
  );
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
