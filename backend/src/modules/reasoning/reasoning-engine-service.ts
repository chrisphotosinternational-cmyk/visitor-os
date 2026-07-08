import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type {
  KnowledgeEngineService,
  KnowledgeAnswer
} from '../knowledge-engine/knowledge-engine-service.js';
import {
  calculateQualityScores,
  type QualityScores
} from '../chatbot-runtime/chatbot-runtime-service.js';

export const nextBestActions = [
  'answer_only',
  'ask_clarifying_question',
  'suggest_cta',
  'capture_lead',
  'propose_phone_call',
  'propose_whatsapp',
  'create_prospect',
  'escalate_to_admin',
  'end_conversation'
] as const;

export type NextBestAction = (typeof nextBestActions)[number];

export type ReasoningInput = {
  siteId: string;
  organizationId: string;
  visitorId: string;
  conversationId: string;
  userMessage: string;
  conversationHistory?: Array<{ senderType: string; content: string }> | undefined;
  detectedIntent?: string | undefined;
  knowledgeAnswer?: KnowledgeAnswer | null | undefined;
  messageId?: string | undefined;
};

export type ReasoningOutput = {
  detected_intent: string;
  intent_confidence: number;
  selected_knowledge_item_id: string | null;
  response_text: string;
  response_type: string;
  next_best_action: NextBestAction;
  lead_capture_recommended: boolean;
  suggested_follow_up_question: string | null;
  reasoning_trace: Record<string, unknown>;
  confidence_score: number;
  lead_readiness_score: number;
  applied_goal: string | null;
  applied_personality: string | null;
  quality_scores: QualityScores;
};

type IntentCandidate = {
  id: string;
  name: string;
  slug: string;
  category: string;
  examples: string[];
  synonyms: string[];
  priority: number;
};

type KnowledgeCandidate = {
  id: string;
  title: string;
  main_question: string;
  alternative_questions: string[];
  short_answer: string;
  detailed_answer: string | null;
  commercial_answer: string | null;
  reassurance_answer: string | null;
  tags: string[];
  priority: number;
  cta_label: string | null;
  intent_name: string | null;
  intent_synonyms: string[] | null;
};

export class ReasoningEngineService {
  constructor(
    private readonly database: Database,
    private readonly knowledgeEngine?: KnowledgeEngineService | undefined
  ) {}

  async reason(input: ReasoningInput): Promise<ReasoningOutput> {
    const startedAt = Date.now();
    const [context, personality, goals, flows, intents, knowledge] = await Promise.all([
      this.getOrCreateContext(input),
      this.getPersonality(input.organizationId, input.siteId),
      this.getGoals(input.organizationId, input.siteId),
      this.getFlows(input.organizationId, input.siteId),
      this.listIntents(input.organizationId, input.siteId),
      this.listKnowledge(input.organizationId, input.siteId)
    ]);

    const detected = detectIntent({
      message: input.userMessage,
      explicitIntent: input.detectedIntent,
      previousIntents: asStringArray(context.previous_intents),
      intents,
      knowledge
    });
    const selectedKnowledge = selectKnowledge(input.userMessage, detected.intent, knowledge);
    const baseAnswer =
      input.knowledgeAnswer ??
      (this.knowledgeEngine
        ? await this.knowledgeEngine.answerQuestion({
            organizationId: input.organizationId,
            siteId: input.siteId,
            question: input.userMessage
          })
        : null);
    const chosenAnswer = buildResponse({
      message: input.userMessage,
      knowledgeAnswer: baseAnswer,
      selectedKnowledge,
      personality,
      goals
    });
    const leadScore = calculateLeadReadiness(
      input.userMessage,
      Number(context.lead_readiness_score ?? 0),
      input.conversationHistory ?? []
    );
    const action = chooseNextBestAction({
      goal: chosenAnswer.appliedGoal,
      confidence: chosenAnswer.confidence,
      leadScore,
      message: input.userMessage
    });
    const confidence = Math.max(
      0.05,
      Math.min(0.99, (chosenAnswer.confidence + detected.confidence) / 2)
    );
    const qualityScores = calculateQualityScores({
      confidenceScore: confidence,
      intentConfidence: detected.confidence,
      knowledgeMatched: Boolean(baseAnswer?.matchedItemId ?? selectedKnowledge?.id),
      goalAligned: Boolean(chosenAnswer.appliedGoal),
      nextBestAction: action,
      leadReadinessScore: leadScore
    });
    const updatedContext = await this.updateContext(input, context, detected.intent, leadScore);
    const output: ReasoningOutput = {
      detected_intent: detected.intent,
      intent_confidence: roundScore(detected.confidence),
      selected_knowledge_item_id: baseAnswer?.matchedItemId ?? selectedKnowledge?.id ?? null,
      response_text: chosenAnswer.text,
      response_type: chosenAnswer.type,
      next_best_action: action,
      lead_capture_recommended: leadScore > 60,
      suggested_follow_up_question: suggestFollowUp(action, chosenAnswer.appliedGoal),
      reasoning_trace: {
        elapsedMs: Date.now() - startedAt,
        intentSignals: detected.signals,
        appliedGoal: chosenAnswer.appliedGoal,
        appliedPersonality: summarizePersonality(personality),
        activeFlows: flows.map((flow) => flow.name),
        leadSignals: detectLeadSignals(input.userMessage),
        previousIntents: updatedContext.previous_intents
      },
      confidence_score: roundScore(confidence),
      lead_readiness_score: leadScore,
      applied_goal: chosenAnswer.appliedGoal,
      applied_personality: summarizePersonality(personality),
      quality_scores: qualityScores
    };

    await this.recordTrace(input, output);
    if (output.confidence_score < 0.45) {
      await this.recordLowConfidence(input, output);
    }

    return output;
  }

  async getContext(
    organizationId: string,
    conversationId: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from visitor_conversation_context where organization_id = $1 and conversation_id = $2`,
      [organizationId, conversationId]
    );
    return result.rows[0] ?? null;
  }

  async listTraces(
    organizationId: string,
    conversationId: string
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select *
      from reasoning_traces
      where organization_id = $1 and conversation_id = $2
      order by created_at desc
      limit 100
      `,
      [organizationId, conversationId]
    );
    return result.rows;
  }

  async replay(input: {
    organizationId: string;
    siteId: string;
    visitorId: string;
    conversationId: string;
    message: string;
  }): Promise<ReasoningOutput> {
    return this.reason({
      organizationId: input.organizationId,
      siteId: input.siteId,
      visitorId: input.visitorId,
      conversationId: input.conversationId,
      userMessage: input.message
    });
  }

  async test(input: {
    organizationId: string;
    siteId: string;
    message: string;
  }): Promise<ReasoningOutput> {
    return this.reason({
      organizationId: input.organizationId,
      siteId: input.siteId,
      visitorId: '00000000-0000-4000-8000-000000000000',
      conversationId: '00000000-0000-4000-8000-000000000000',
      userMessage: input.message
    });
  }

  async metrics(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        count(distinct c.conversation_id) filter (where c.lead_readiness_score > 60)::int as lead_readiness_over_60,
        count(distinct c.conversation_id) filter (where c.lead_readiness_score > 80)::int as lead_readiness_over_80,
        coalesce(round(avg(t.confidence_score)::numeric, 3), 0)::float as average_confidence,
        count(*) filter (where t.next_best_action = 'escalate_to_admin')::int as admin_escalations,
        count(*) filter (where t.confidence_score < 0.45)::int as needs_review
      from visitor_conversation_context c
      left join reasoning_traces t on t.conversation_id = c.conversation_id
      where c.organization_id = $1
      `,
      [organizationId]
    );
    const intents = await this.database.query<Record<string, unknown>>(
      `
      select detected_intent, count(*)::int as count
      from reasoning_traces
      where organization_id = $1
      group by detected_intent
      order by count desc
      limit 10
      `,
      [organizationId]
    );
    const actions = await this.database.query<Record<string, unknown>>(
      `
      select next_best_action, count(*)::int as count
      from reasoning_traces
      where organization_id = $1
      group by next_best_action
      order by count desc
      limit 10
      `,
      [organizationId]
    );

    return {
      ...(result.rows[0] ?? {}),
      top_intents: intents.rows,
      top_next_best_actions: actions.rows
    };
  }

  private async getOrCreateContext(input: ReasoningInput): Promise<Record<string, unknown>> {
    const existing = await this.getContext(input.organizationId, input.conversationId);
    if (existing) return existing;

    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into visitor_conversation_context (
        id, organization_id, site_id, conversation_id, visitor_id, previous_intents, lead_readiness_score
      )
      values ($1, $2, $3, $4, $5, '{}', 0)
      on conflict (conversation_id) do update set updated_at = now()
      returning *
      `,
      [randomUUID(), input.organizationId, input.siteId, input.conversationId, input.visitorId]
    );
    return result.rows[0] ?? { previous_intents: [], lead_readiness_score: 0 };
  }

  private async updateContext(
    input: ReasoningInput,
    context: Record<string, unknown>,
    intent: string,
    leadScore: number
  ): Promise<Record<string, unknown>> {
    const previous = [...asStringArray(context.previous_intents), intent].slice(-12);
    const signals = detectLeadSignals(input.userMessage);
    const result = await this.database.query<Record<string, unknown>>(
      `
      update visitor_conversation_context
      set
        detected_needs = coalesce($3, detected_needs),
        detected_city = coalesce($4, detected_city),
        detected_service = coalesce($5, detected_service),
        detected_budget = coalesce($6, detected_budget),
        detected_urgency = coalesce($7, detected_urgency),
        detected_contact_intent = coalesce($8, detected_contact_intent),
        previous_intents = $9,
        lead_readiness_score = $10,
        updated_at = now()
      where organization_id = $1 and conversation_id = $2
      returning *
      `,
      [
        input.organizationId,
        input.conversationId,
        signals.need,
        signals.city,
        signals.service,
        signals.budget,
        signals.urgency,
        signals.contactIntent,
        previous,
        leadScore
      ]
    );
    return (
      result.rows[0] ?? { ...context, previous_intents: previous, lead_readiness_score: leadScore }
    );
  }

  private async recordTrace(input: ReasoningInput, output: ReasoningOutput): Promise<void> {
    await this.database.query(
      `
      insert into reasoning_traces (
        id, organization_id, site_id, conversation_id, message_id, detected_intent,
        intent_confidence, selected_knowledge_item_id, applied_goal, applied_personality,
        next_best_action, confidence_score, knowledge_match_score, goal_alignment_score,
        lead_action_score, response_quality_score, trace_json
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.conversationId,
        input.messageId ?? null,
        output.detected_intent,
        output.intent_confidence,
        output.selected_knowledge_item_id,
        output.applied_goal,
        output.applied_personality,
        output.next_best_action,
        output.confidence_score,
        output.quality_scores.knowledge_match_score,
        output.quality_scores.goal_alignment_score,
        output.quality_scores.lead_action_score,
        output.quality_scores.response_quality_score,
        JSON.stringify(output.reasoning_trace)
      ]
    );
  }

  private async recordLowConfidence(input: ReasoningInput, output: ReasoningOutput): Promise<void> {
    await this.database.query(
      `update conversations set status = 'in_review', updated_at = now() where id = $1 and organization_id = $2`,
      [input.conversationId, input.organizationId]
    );
    if (!this.knowledgeEngine || input.conversationId === '00000000-0000-4000-8000-000000000000') {
      return;
    }
    const unanswered = await this.knowledgeEngine.enhancedUnanswered({
      organizationId: input.organizationId,
      siteId: input.siteId,
      conversationId: input.conversationId,
      question: input.userMessage,
      detectedIntent: output.detected_intent,
      confidenceScore: output.confidence_score
    });
    await this.knowledgeEngine.generateSuggestion(String(unanswered.id), input.organizationId);
  }

  private async getPersonality(
    organizationId: string,
    siteId: string
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_personality where organization_id = $1 and site_id = $2`,
      [organizationId, siteId]
    );
    return (
      result.rows[0] ?? {
        tone: 'professionnel',
        style: 'clair',
        answer_length: 'medium',
        formality: 'vouvoiement',
        emoji_level: 'none',
        commercial_intensity: 50,
        reassurance_level: 70
      }
    );
  }

  private async getGoals(
    organizationId: string,
    siteId: string
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select * from chatbot_goals
      where organization_id = $1 and site_id = $2 and is_active = true
      order by priority desc, created_at asc
      `,
      [organizationId, siteId]
    );
    return result.rows;
  }

  private async getFlows(
    organizationId: string,
    siteId: string
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from conversation_flows where organization_id = $1 and site_id = $2 and is_active = true`,
      [organizationId, siteId]
    );
    return result.rows;
  }

  private async listIntents(organizationId: string, siteId: string): Promise<IntentCandidate[]> {
    const result = await this.database.query<IntentCandidate>(
      `
      select id, name, slug, category, examples, synonyms, priority
      from chatbot_intents
      where organization_id = $1 and site_id = $2 and is_active = true
      order by priority desc
      `,
      [organizationId, siteId]
    );
    return result.rows;
  }

  private async listKnowledge(
    organizationId: string,
    siteId: string
  ): Promise<KnowledgeCandidate[]> {
    const result = await this.database.query<KnowledgeCandidate>(
      `
      select
        k.id, k.title, k.main_question, k.alternative_questions, k.short_answer,
        k.detailed_answer, k.commercial_answer, k.reassurance_answer, k.tags, k.priority,
        k.cta_label, i.name as intent_name, i.synonyms as intent_synonyms
      from knowledge_items k
      left join chatbot_intents i on i.id = k.intent_id
      where k.organization_id = $1 and k.site_id = $2 and k.status = 'active'
      order by k.priority desc, k.updated_at desc
      limit 200
      `,
      [organizationId, siteId]
    );
    return result.rows;
  }
}

function detectIntent(input: {
  message: string;
  explicitIntent?: string | undefined;
  previousIntents: string[];
  intents: IntentCandidate[];
  knowledge: KnowledgeCandidate[];
}): { intent: string; confidence: number; signals: string[] } {
  const text = normalize(input.message);
  const tokens = tokenize(input.message);
  const scored = input.intents.map((intent) => {
    const words = [
      intent.name,
      intent.slug,
      intent.category,
      ...safeArray(intent.examples),
      ...safeArray(intent.synonyms)
    ];
    const score =
      words.reduce((sum, value) => sum + scorePhrase(text, tokens, value), 0) +
      (input.previousIntents.includes(intent.name) ? 0.05 : 0) +
      Number(intent.priority ?? 0) / 1000;
    return { intent, score };
  });
  for (const item of input.knowledge) {
    const words = [
      item.main_question,
      item.title,
      ...(item.alternative_questions ?? []),
      ...(item.tags ?? []),
      ...(item.intent_synonyms ?? [])
    ];
    scored.push({
      intent: {
        id: item.id,
        name: item.intent_name ?? item.tags?.[0] ?? 'information',
        slug: item.intent_name ?? 'information',
        category: 'knowledge',
        examples: [],
        synonyms: [],
        priority: item.priority
      },
      score: words.reduce((sum, value) => sum + scorePhrase(text, tokens, value), 0)
    });
  }
  const business = businessIntent(text);
  if (business) {
    scored.push({
      intent: {
        id: business,
        name: business,
        slug: business,
        category: 'business',
        examples: [],
        synonyms: [],
        priority: 90
      },
      score: 0.72
    });
  }
  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (input.explicitIntent) {
    return {
      intent: input.explicitIntent,
      confidence: Math.max(0.7, best?.score ?? 0.7),
      signals: ['explicit']
    };
  }
  if (!best || best.score < 0.15) {
    return { intent: 'unknown', confidence: 0.25, signals: ['low_match'] };
  }
  return {
    intent: best.intent.name,
    confidence: Math.min(0.96, Math.max(0.35, best.score)),
    signals: ['intent', best.intent.category]
  };
}

function selectKnowledge(
  message: string,
  intent: string,
  items: KnowledgeCandidate[]
): KnowledgeCandidate | null {
  const text = normalize(message);
  const tokens = tokenize(message);
  return (
    items
      .map((item) => ({
        item,
        score:
          scorePhrase(text, tokens, item.main_question) +
          scorePhrase(text, tokens, item.title) +
          safeArray(item.tags).reduce((sum, tag) => sum + scorePhrase(text, tokens, tag), 0) +
          (item.intent_name === intent ? 0.4 : 0)
      }))
      .sort((a, b) => b.score - a.score)[0]?.item ?? null
  );
}

function buildResponse(input: {
  message: string;
  knowledgeAnswer: KnowledgeAnswer | null;
  selectedKnowledge: KnowledgeCandidate | null;
  personality: Record<string, unknown>;
  goals: Array<Record<string, unknown>>;
}) {
  const goal = chooseGoal(input.goals, input.message);
  const answer =
    input.knowledgeAnswer?.reply ??
    input.selectedKnowledge?.short_answer ??
    "Je n'ai pas encore cette information precise. Je peux vous aider a reformuler ou transmettre la demande.";
  const confidence = input.knowledgeAnswer?.confidence ?? (input.selectedKnowledge ? 0.62 : 0.28);
  const adapted = adaptToGoal(
    adaptToPersonality(answer, input.personality),
    goal,
    input.personality
  );
  return {
    text: adapted,
    confidence,
    type: input.knowledgeAnswer
      ? input.knowledgeAnswer.source
      : input.selectedKnowledge
        ? 'reasoned_knowledge'
        : 'fallback',
    appliedGoal: goal?.goal_type ? asText(goal.goal_type) : null
  };
}

function chooseGoal(goals: Array<Record<string, unknown>>, message: string) {
  if (goals.length === 0) return null;
  const normalized = normalize(message);
  const preferred = goals.find((goal) => {
    const type = asText(goal.goal_type);
    return (
      (type.includes('reservation') && /reserv|dispo|nuit|date/.test(normalized)) ||
      (type.includes('devis') && /devis|tarif|prix|budget/.test(normalized)) ||
      (type.includes('appel') && /appel|telephone|rappel/.test(normalized)) ||
      (type.includes('lead') && /contact|email|coordonne/.test(normalized))
    );
  });
  return preferred ?? goals[0] ?? null;
}

function adaptToPersonality(answer: string, personality: Record<string, unknown>) {
  const answerLength = asText(personality.answer_length) || 'medium';
  const reassurance = Number(personality.reassurance_level ?? 70);
  const formality = asText(personality.formality) || 'vouvoiement';
  let text = answer.trim();
  if (answerLength === 'short' && text.length > 220) {
    text = `${text.slice(0, 217).trim()}...`;
  }
  if (reassurance >= 75 && !/rassur|simple|avec plaisir|bien sur/i.test(text)) {
    text = `${text} Nous vous guidons simplement, et sans engagement.`;
  }
  if (formality === 'tutoiement') {
    text = text.replace(/\bvous\b/gi, 'tu').replace(/\bVotre\b/g, 'Ton');
  }
  return text;
}

function adaptToGoal(
  answer: string,
  goal: Record<string, unknown> | null,
  personality: Record<string, unknown>
) {
  if (!goal) return answer;
  const intensity = Number(personality.commercial_intensity ?? 50);
  if (intensity < 35) return answer;
  const type = asText(goal.goal_type);
  const success = asText(goal.success_action).trim();
  if (type.includes('reservation'))
    return `${answer} Si vous le souhaitez, je peux vous orienter vers une reservation.`;
  if (type.includes('devis'))
    return `${answer} Je peux aussi vous aider a preparer une demande de devis.`;
  if (type.includes('appel')) return `${answer} Un appel rapide peut aussi clarifier votre besoin.`;
  if (type.includes('whatsapp'))
    return `${answer} Vous pouvez poursuivre simplement par WhatsApp si c'est plus pratique.`;
  if (type.includes('lead'))
    return `${answer} Vous pouvez laisser vos coordonnees pour une reponse personnalisee.`;
  return success ? `${answer} ${success}` : answer;
}

function calculateLeadReadiness(
  message: string,
  previousScore: number,
  history: Array<{ senderType: string; content: string }>
) {
  const normalized = normalize(message);
  let score = Math.max(0, Math.min(100, previousScore));
  if (/tarif|prix|combien|budget/.test(normalized)) score += 15;
  if (/dispo|disponibilite|date|quand/.test(normalized)) score += 20;
  if (/reserv|devis|commande|book|rdv|rendez/.test(normalized)) score += 25;
  if (
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(message) ||
    /(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/.test(message)
  )
    score += 30;
  if (/urgent|rapidement|aujourd|demain|vite/.test(normalized)) score += 15;
  if (/info|renseignement|question/.test(normalized)) score += 5;
  if (history.filter((item) => item.senderType === 'visitor').length <= 1 && score < 15) score += 0;
  return Math.max(0, Math.min(100, score));
}

function chooseNextBestAction(input: {
  goal: string | null;
  confidence: number;
  leadScore: number;
  message: string;
}): NextBestAction {
  const normalized = normalize(input.message);
  if (input.confidence < 0.35) return 'escalate_to_admin';
  if (input.confidence < 0.5) return 'ask_clarifying_question';
  if (input.leadScore > 80) return 'create_prospect';
  if (input.leadScore > 60) return 'capture_lead';
  if (input.goal?.includes('appel') || /appel|telephone/.test(normalized))
    return 'propose_phone_call';
  if (input.goal?.includes('whatsapp') || /whatsapp/.test(normalized)) return 'propose_whatsapp';
  if (input.goal && input.goal !== 'information') return 'suggest_cta';
  return 'answer_only';
}

function suggestFollowUp(action: NextBestAction, goal: string | null): string | null {
  if (action === 'ask_clarifying_question') return 'Pouvez-vous preciser votre besoin principal ?';
  if (action === 'capture_lead')
    return 'Souhaitez-vous laisser un email ou un telephone pour une reponse personnalisee ?';
  if (action === 'create_prospect')
    return 'Voulez-vous etre recontacte pour finaliser cette demande ?';
  if (goal?.includes('reservation')) return 'Avez-vous une date ou une periode en tete ?';
  if (goal?.includes('devis')) return 'Quel budget ou quel type de projet souhaitez-vous estimer ?';
  return null;
}

function detectLeadSignals(message: string) {
  const normalized = normalize(message);
  return {
    need: /besoin|cherche|souhaite|voudrais/.test(normalized) ? message.slice(0, 240) : null,
    city: findCity(message),
    service:
      /shooting|chambre|restaurant|deco|seo|photo|reservation|devis/.exec(normalized)?.[0] ?? null,
    budget: /(?:budget|prix|tarif)[^\d]*(\d+)/.exec(normalized)?.[1] ?? null,
    urgency: /urgent|demain|aujourd|vite|rapidement/.test(normalized) ? 'urgent' : null,
    contactIntent: /email|telephone|appeler|contact|whatsapp|rappel/.test(normalized)
      ? 'contact'
      : null
  };
}

function findCity(message: string): string | null {
  const match = /\b(?:a|à|sur|vers)\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ-]{2,})\b/.exec(message);
  return match?.[1] ?? null;
}

function businessIntent(text: string): string | null {
  if (/tarif|prix|combien|budget/.test(text)) return 'tarif';
  if (/dispo|date|quand|creneau/.test(text)) return 'disponibilite';
  if (/reserv|book|rdv|rendez|devis/.test(text)) return 'conversion';
  if (/parking|acces|adresse|venir/.test(text)) return 'acces';
  if (/urgent|rapidement|demain/.test(text)) return 'urgence';
  return null;
}

function scorePhrase(text: string, tokens: string[], value: unknown) {
  const phrase = normalize(asText(value));
  if (!phrase) return 0;
  if (text.includes(phrase)) return 0.5;
  const phraseTokens = tokenize(phrase);
  if (phraseTokens.length === 0) return 0;
  const overlap = phraseTokens.filter((token) => tokens.includes(token)).length;
  return overlap / Math.max(phraseTokens.length, 2);
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function summarizePersonality(personality: Record<string, unknown>) {
  return [personality.tone, personality.style, personality.answer_length, personality.formality]
    .filter(Boolean)
    .map(String)
    .join('/');
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}
