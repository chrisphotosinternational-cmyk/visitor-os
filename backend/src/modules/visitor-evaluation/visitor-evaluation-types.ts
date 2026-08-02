export type VisitorEvaluationQuestion = {
  id: string;
  organizationId: string;
  siteId: string;
  category: string;
  question: string;
  expectedAnswer: string;
  requiredFacts: string[];
  forbiddenFacts: string[];
  expectedSourcePage?: string | null;
  importance: 1 | 2 | 3 | 4 | 5;
};

export type VisitorEvaluationAnswer = {
  questionId: string;
  category: string;
  question: string;
  expectedAnswer: string;
  producedAnswer: string;
  selectedChunk?: string | null;
  selectedDocument?: string | null;
  selectedPage?: string | null;
  confidence: number;
  responseTimeMs: number;
  score: number;
  issues: VisitorEvaluationIssue[];
  explanation: string[];
  expectedWinner?: string | null;
  suggestedImprovement?: string | null;
  importance: number;
};

export type VisitorEvaluationIssue =
  | 'incomplete_answer'
  | 'wrong_source'
  | 'contradiction'
  | 'hallucination'
  | 'too_vague'
  | 'wrong_chunk_priority';

export type VisitorEvaluationBreakdown = {
  category: string;
  score: number;
  questionCount: number;
};

export type VisitorEvaluationReport = {
  id: string;
  organizationId: string;
  siteId: string;
  generatedAt: string;
  globalScore: number;
  questionCount: number;
  scoresByCategory: VisitorEvaluationBreakdown[];
  scoresByPage: VisitorEvaluationBreakdown[];
  scoresByContentType: VisitorEvaluationBreakdown[];
  issueCounts: Record<VisitorEvaluationIssue, number>;
  answers: VisitorEvaluationAnswer[];
  bestAnswers: VisitorEvaluationAnswer[];
  worstAnswers: VisitorEvaluationAnswer[];
};

export type VisitorEvaluationExecution = {
  reply: string;
  confidence: number;
  matchedItemId?: string;
  reason?: string;
  processingTimeMs: number;
};
