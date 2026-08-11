export const conversationBenchmarkMetrics = [
  'factualGrounding',
  'citationCorrectness',
  'hallucinationResistance',
  'answerCompleteness',
  'multipartCoverage',
  'conversationContinuity',
  'identityTransparency',
  'humanIdentityConfusion',
  'contactAccuracy',
  'conversionTiming',
  'ctaRelevance',
  'siteIsolation',
  'organizationIsolation',
  'fallbackCorrectness',
  'publicDataSafety'
] as const;
export type ConversationBenchmarkMetric = (typeof conversationBenchmarkMetrics)[number];
export type ConversationMetricScore = 0 | 0.25 | 0.5 | 0.75 | 1;

export const conversationBenchmarkBlockers = [
  'hallucinated_price',
  'hallucinated_number',
  'hallucinated_phone',
  'hallucinated_email',
  'hallucinated_whatsapp',
  'wrong_site_contact',
  'wrong_organization_contact',
  'wrong_site_knowledge',
  'wrong_organization_knowledge',
  'human_identity_impersonation',
  'human_identity_ambiguity',
  'ungrounded_certainty',
  'invalid_citation',
  'wrong_tenant_citation',
  'public_debug_leak',
  'public_prompt_leak',
  'public_kms_context_leak',
  'public_secret_leak',
  'cta_replaces_answer'
] as const;
export type ConversationBenchmarkBlocker = (typeof conversationBenchmarkBlockers)[number];

export type ConversationCtaExpectation = 'forbidden' | 'optional' | 'required';
export type ConversationCtaState =
  | 'cta_not_expected_absent'
  | 'cta_expected_present'
  | 'cta_missing'
  | 'cta_too_early'
  | 'cta_too_late'
  | 'cta_repetitive'
  | 'cta_wrong_channel'
  | 'cta_untrusted_contact'
  | 'cta_wrong_tenant'
  | 'cta_before_answer';
export type ConversationIdentityExpectation =
  'introduce_ai' | 'clarify_not_chris' | 'remain_ai' | 'not_applicable';
export type BenchmarkContact = {
  channel: 'whatsapp' | 'phone' | 'email';
  value: string;
  siteId?: string;
  organizationId?: string;
};
export type BenchmarkCitation = { tenantId: string; source: string };

export type ConversationBenchmarkTurn = {
  userMessage: string;
  requiredFacts?: string[];
  forbiddenFacts?: string[];
  cta: ConversationCtaExpectation;
};
export type ConversationBenchmarkExpectation = {
  expectedIntent: string;
  requiredFacts: string[];
  forbiddenFacts: string[];
  allowedMarkers: string[];
  forbiddenMarkers: string[];
  allowedContacts: BenchmarkContact[];
  forbiddenContacts: BenchmarkContact[];
  ctaExpectation: ConversationCtaExpectation;
  expectedFirstCtaTurn?: number;
  identityExpectation: ConversationIdentityExpectation;
  applicableMetrics: ConversationBenchmarkMetric[];
};
export type ConversationBenchmarkScenario = ConversationBenchmarkExpectation & {
  id: string;
  category: 'identity' | 'knowledge' | 'fallback' | 'continuity' | 'cta' | 'isolation';
  fixture: string;
  criticality: 'blocking' | 'standard';
  turns: ConversationBenchmarkTurn[];
};
export type ConversationTurnExecution = {
  answer: string;
  citations?: BenchmarkCitation[];
  publicPayload?: Record<string, unknown>;
};
export type ConversationTurnResult = {
  turn: number;
  metricScores: Partial<Record<ConversationBenchmarkMetric, ConversationMetricScore>>;
  blockers: ConversationBenchmarkBlocker[];
  ctaStates: ConversationCtaState[];
  missingFacts: string[];
};
export type ConversationBenchmarkResult = {
  scenarioId: string;
  score: number;
  metricScores: Partial<Record<ConversationBenchmarkMetric, number>>;
  blockers: ConversationBenchmarkBlocker[];
  passed: boolean;
  turnResults: ConversationTurnResult[];
};
export type ConversationBenchmarkReport = {
  score: number;
  metricScores: Partial<Record<ConversationBenchmarkMetric, number>>;
  blockers: ConversationBenchmarkBlocker[];
  passed: boolean;
  scenarioResults: ConversationBenchmarkResult[];
};
