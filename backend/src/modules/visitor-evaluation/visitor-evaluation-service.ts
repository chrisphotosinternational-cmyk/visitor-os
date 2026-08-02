import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { DecisionEngine } from '../decision-engine/decision-engine.js';
import { scoreVisitorAnswer } from './visitor-evaluation-scorer.js';
import type {
  VisitorEvaluationAnswer,
  VisitorEvaluationBreakdown,
  VisitorEvaluationIssue,
  VisitorEvaluationQuestion,
  VisitorEvaluationReport
} from './visitor-evaluation-types.js';

type QuestionRow = {
  id: string;
  organization_id: string;
  site_id: string;
  category: string;
  question: string;
  expected_answer: string;
  required_facts: string[];
  forbidden_facts: string[];
  expected_source_page: string | null;
  importance: number;
};
type ChunkRow = { id: string; document_id: string; source: string; content: string };

export class VisitorEvaluationService {
  constructor(
    private readonly database: Database,
    private readonly decisionEngine: DecisionEngine
  ) {}

  async saveQuestion(
    input: Omit<VisitorEvaluationQuestion, 'id'> & { id?: string }
  ): Promise<VisitorEvaluationQuestion> {
    const id = input.id ?? randomUUID();
    await this.database.query(
      `insert into visitor_evaluation_questions (
        id, organization_id, site_id, category, question, expected_answer, required_facts,
        forbidden_facts, expected_source_page, importance, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,now())
      on conflict (id) do update set category=excluded.category, question=excluded.question,
        expected_answer=excluded.expected_answer, required_facts=excluded.required_facts,
        forbidden_facts=excluded.forbidden_facts, expected_source_page=excluded.expected_source_page,
        importance=excluded.importance, updated_at=now()`,
      [
        id,
        input.organizationId,
        input.siteId,
        input.category,
        input.question,
        input.expectedAnswer,
        JSON.stringify(input.requiredFacts),
        JSON.stringify(input.forbiddenFacts),
        input.expectedSourcePage ?? null,
        input.importance
      ]
    );
    return { id, ...input };
  }

  async listQuestions(input: {
    organizationId: string;
    siteId: string;
  }): Promise<VisitorEvaluationQuestion[]> {
    const result = await this.database.query<QuestionRow>(
      `select id, organization_id, site_id, category, question, expected_answer, required_facts,
        forbidden_facts, expected_source_page, importance
       from visitor_evaluation_questions where organization_id=$1 and site_id=$2 order by category, question`,
      [input.organizationId, input.siteId]
    );
    return result.rows.map(toQuestion);
  }

  async evaluateAndStore(input: {
    organizationId: string;
    siteId: string;
    activity?: string;
  }): Promise<VisitorEvaluationReport> {
    const questions = await this.listQuestions(input);
    const chunks = await this.loadChunks(input);
    const answers: VisitorEvaluationAnswer[] = [];
    for (const question of questions) {
      const startedAt = performance.now();
      const result = await this.decisionEngine.decide({
        organizationId: input.organizationId,
        siteId: input.siteId,
        conversationId: `evaluation-${question.id}`,
        activity: input.activity ?? 'default',
        message: question.question,
        recentHistory: []
      });
      const selected = findSelectedChunk(chunks, result.matchedItemId);
      const expectedWinner = findExpectedWinner(chunks, question.requiredFacts);
      answers.push(
        scoreVisitorAnswer({
          question,
          producedAnswer: result.reply,
          confidence: result.confidence,
          responseTimeMs: Number((performance.now() - startedAt).toFixed(1)),
          selectedChunk: selected?.id ?? null,
          selectedDocument: selected?.document_id ?? result.matchedItemId ?? null,
          selectedPage: selected?.source ?? null,
          expectedWinner: expectedWinner?.id ?? null
        })
      );
    }
    const report = buildReport(input, answers);
    await this.database.query(
      `insert into visitor_evaluation_reports
       (id, organization_id, site_id, report, global_score, question_count, created_at)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
      [
        report.id,
        report.organizationId,
        report.siteId,
        JSON.stringify(report),
        report.globalScore,
        report.questionCount,
        report.generatedAt
      ]
    );
    return report;
  }

  async latest(input: {
    organizationId: string;
    siteId: string;
  }): Promise<VisitorEvaluationReport | null> {
    const result = await this.database.query<{ report: VisitorEvaluationReport }>(
      `select report from visitor_evaluation_reports where organization_id=$1 and site_id=$2
       order by created_at desc limit 1`,
      [input.organizationId, input.siteId]
    );
    return result.rows[0]?.report ?? null;
  }

  private async loadChunks(input: { organizationId: string; siteId: string }): Promise<ChunkRow[]> {
    const result = await this.database.query<ChunkRow>(
      `select c.id, c.document_id, d.source, c.content from knowledge_chunks c
       join knowledge_documents d on d.id=c.document_id
       where d.organization_id=$1 and d.site_id=$2 and d.status='active' order by d.source,c.position`,
      [input.organizationId, input.siteId]
    );
    return result.rows;
  }
}

function toQuestion(row: QuestionRow): VisitorEvaluationQuestion {
  const importance = Math.max(1, Math.min(5, row.importance)) as 1 | 2 | 3 | 4 | 5;
  return {
    id: row.id,
    organizationId: row.organization_id,
    siteId: row.site_id,
    category: row.category,
    question: row.question,
    expectedAnswer: row.expected_answer,
    requiredFacts: row.required_facts,
    forbiddenFacts: row.forbidden_facts,
    expectedSourcePage: row.expected_source_page,
    importance
  };
}
function findSelectedChunk(chunks: ChunkRow[], documentId?: string): ChunkRow | undefined {
  return documentId ? chunks.find((chunk) => chunk.document_id === documentId) : undefined;
}
function findExpectedWinner(chunks: ChunkRow[], facts: string[]): ChunkRow | undefined {
  if (facts.length === 0) return undefined;
  const normalizedFacts = facts.map(normalize);
  return [...chunks].sort(
    (a, b) => factMatches(b.content, normalizedFacts) - factMatches(a.content, normalizedFacts)
  )[0];
}
function factMatches(content: string, facts: string[]): number {
  const normalized = normalize(content);
  return facts.filter((fact) => normalized.includes(fact)).length;
}
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildReport(
  input: { organizationId: string; siteId: string },
  answers: VisitorEvaluationAnswer[]
): VisitorEvaluationReport {
  const weightedTotal = answers.reduce((sum, answer) => sum + answer.score * answer.importance, 0);
  const totalWeight = answers.reduce((sum, answer) => sum + answer.importance, 0);
  const issueCounts = Object.fromEntries(
    [
      'incomplete_answer',
      'wrong_source',
      'contradiction',
      'hallucination',
      'too_vague',
      'wrong_chunk_priority'
    ].map((issue) => [issue, 0])
  ) as Record<VisitorEvaluationIssue, number>;
  for (const answer of answers) for (const issue of answer.issues) issueCounts[issue] += 1;
 const ranked = [...answers].sort((a, b) => b.score - a.score);
  return {
    id: randomUUID(),
    organizationId: input.organizationId,
    siteId: input.siteId,
    generatedAt: new Date().toISOString(),
    globalScore: totalWeight === 0 ? 0 : Number((weightedTotal / totalWeight).toFixed(1)),
    questionCount: answers.length,
   scoresByCategory: breakdown(answers, (answer) => answer.category),
    scoresByPage: breakdown(answers, (answer) => answer.selectedPage ?? 'unknown'),
    scoresByContentType: breakdown(answers, (answer) =>
      detectContentType(answer.selectedChunk, answer.category)
    ),
    issueCounts,
    answers,
    bestAnswers: ranked.slice(0, 20),
    worstAnswers: ranked.reverse().slice(0, 20)
  };
}
function breakdown(
  answers: VisitorEvaluationAnswer[],
  key: (answer: VisitorEvaluationAnswer) => string
): VisitorEvaluationBreakdown[] {
  const groups = new Map<string, VisitorEvaluationAnswer[]>();
  for (const answer of answers)
    groups.set(key(answer), [...(groups.get(key(answer)) ?? []), answer]);
  return Array.from(groups.entries()).map(([category, values]) => ({
    category,
    questionCount: values.length,
    score: Number((values.reduce((sum, value) => sum + value.score, 0) / values.length).toFixed(1))
  }));
}
function detectContentType(_chunkId: string | null | undefined, category: string): string {
  return category || 'unknown';
}
