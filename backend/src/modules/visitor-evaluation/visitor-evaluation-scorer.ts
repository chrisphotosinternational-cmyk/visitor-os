import type {
  VisitorEvaluationAnswer,
  VisitorEvaluationIssue,
  VisitorEvaluationQuestion
} from './visitor-evaluation-types.js';

const vagueAnswers = [
  /je ne sais pas/i,
  /contactez[- ]nous/i,
  /cela d[ée]pend/i,
  /plus d'informations/i
];

export function scoreVisitorAnswer(input: {
  question: VisitorEvaluationQuestion;
  producedAnswer: string;
  confidence: number;
  responseTimeMs: number;
  selectedChunk?: string | null;
  selectedDocument?: string | null;
  selectedPage?: string | null;
  expectedWinner?: string | null;
}): VisitorEvaluationAnswer {
  const expected = normalize(input.question.expectedAnswer);
  const produced = normalize(input.producedAnswer);
  const requiredFacts = input.question.requiredFacts.map(normalize);
  const forbiddenFacts = input.question.forbiddenFacts.map(normalize);
  const issues: VisitorEvaluationIssue[] = [];
  const explanation: string[] = [];
  const missingFacts = requiredFacts.filter((fact) => fact && !produced.includes(fact));
  const forbiddenMatches = forbiddenFacts.filter((fact) => fact && produced.includes(fact));
  const expectedTokens = tokens(expected);
  const overlap = ratio(
    expectedTokens.filter((token) => produced.includes(token)).length,
    expectedTokens.length
  );

  if (missingFacts.length > 0) {
    issues.push('incomplete_answer');
    explanation.push(`Faits obligatoires absents: ${missingFacts.join(', ')}`);
  }
  if (
    input.question.expectedSourcePage &&
    !normalize(input.selectedPage ?? '').includes(normalize(input.question.expectedSourcePage))
  ) {
    issues.push('wrong_source');
    explanation.push(`Page attendue non retenue: ${input.question.expectedSourcePage}`);
  }
  if (forbiddenMatches.length > 0) {
    issues.push('contradiction');
    explanation.push(`Faits interdits présents: ${forbiddenMatches.join(', ')}`);
  }
  if (produced.length > 0 && overlap < 0.12 && missingFacts.length > 0) {
    issues.push('hallucination');
    explanation.push('La réponse produite est faiblement étayée par la réponse attendue.');
  }
  if (produced.length < 45 || vagueAnswers.some((pattern) => pattern.test(input.producedAnswer))) {
    issues.push('too_vague');
    explanation.push('La réponse est trop courte ou générique.');
  }
  if (input.expectedWinner && input.selectedChunk !== input.expectedWinner) {
    issues.push('wrong_chunk_priority');
    explanation.push('Un chunk contenant davantage de faits obligatoires était disponible.');
  }

  const factScore =
    requiredFacts.length === 0 ? overlap : 1 - missingFacts.length / requiredFacts.length;
  const sourceScore = issues.includes('wrong_source') ? 0 : 1;
  const contradictionScore = issues.includes('contradiction') ? 0 : 1;
  const specificityScore = issues.includes('too_vague') ? 0.35 : 1;
  const score = roundPercent(
    100 *
      (factScore * 0.5 +
        sourceScore * 0.15 +
        contradictionScore * 0.15 +
        overlap * 0.1 +
        specificityScore * 0.1)
  );

  return {
    questionId: input.question.id,
    category: input.question.category,
    question: input.question.question,
    expectedAnswer: input.question.expectedAnswer,
    producedAnswer: input.producedAnswer,
    ...(input.selectedChunk !== undefined ? { selectedChunk: input.selectedChunk } : {}),
    ...(input.selectedDocument !== undefined ? { selectedDocument: input.selectedDocument } : {}),
    ...(input.selectedPage !== undefined ? { selectedPage: input.selectedPage } : {}),
    confidence: input.confidence,
    responseTimeMs: input.responseTimeMs,
    score,
    issues: [...new Set(issues)],
    explanation,
    ...(input.expectedWinner !== undefined ? { expectedWinner: input.expectedWinner } : {}),
    suggestedImprovement: suggestImprovement(issues),
    importance: input.question.importance
  };
}

function suggestImprovement(issues: VisitorEvaluationIssue[]): string | null {
  if (issues.includes('wrong_chunk_priority'))
    return 'Renforcer la priorité du chunk qui contient les faits obligatoires.';
  if (issues.includes('wrong_source'))
    return 'Renforcer la correspondance entre intention et page source.';
  if (issues.includes('incomplete_answer'))
    return 'Conserver davantage de contexte factuel dans le passage sélectionné.';
  if (issues.includes('hallucination'))
    return 'Exiger une preuve issue du contenu indexé avant de répondre.';
  if (issues.includes('too_vague'))
    return 'Préférer une réponse factuelle complète au fallback générique.';
  return null;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function tokens(value: string): string[] {
  return [...new Set(value.split(/[^a-z0-9]+/).filter((token) => token.length > 2))];
}
function ratio(value: number, total: number): number {
  return total === 0 ? 1 : value / total;
}
function roundPercent(value: number): number {
  return Number(Math.max(0, Math.min(100, value)).toFixed(1));
}
