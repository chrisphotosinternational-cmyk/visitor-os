export type LeadScoringInput = {
  email?: string | null;
  phone?: string | null;
  messages: string[];
  previousConversationCount?: number;
};

export type LeadScoreReason = {
  code: string;
  label: string;
  points: number;
};

export type LeadScoreResult = {
  score: number;
  temperature: 'froide' | 'tiede' | 'chaude';
  reasons: LeadScoreReason[];
};

const COMMERCIAL_INTENT =
  /(reserver|reservation|devis|tarif|prix|disponible|disponibilite|rappel|acheter|commander)/i;

export function calculateLeadScore(input: LeadScoringInput): LeadScoreResult {
  const text = normalize(input.messages.join(' '));
  const reasons: LeadScoreReason[] = [{ code: 'base', label: 'Base prospect widget', points: 25 }];

  addReason(reasons, Boolean(input.email), 'email', 'Email renseigne', 15);
  addReason(reasons, Boolean(input.phone), 'phone', 'Telephone renseigne', 15);
  addReason(
    reasons,
    /tarif|prix|devis|budget/.test(text),
    'pricing_request',
    'Demande de tarif',
    12
  );
  addReason(
    reasons,
    /disponible|disponibilite|creneau|place/.test(text),
    'availability_request',
    'Demande de disponibilite',
    12
  );
  addReason(
    reasons,
    /reserver|reservation|booker/.test(text),
    'booking_request',
    'Demande de reservation',
    18
  );
  addReason(
    reasons,
    /\b(\d{1,2}[/-]\d{1,2}|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|demain|ce soir|week.?end)\b/.test(
      text
    ),
    'date_mentioned',
    'Date mentionnee',
    8
  );
  addReason(reasons, /urgent|vite|rapidement|aujourd hui/.test(text), 'urgency', 'Urgence', 10);
  addReason(reasons, input.messages.length >= 3, 'message_count', 'Conversation active', 8);
  addReason(
    reasons,
    (input.previousConversationCount ?? 0) > 0,
    'returning_visitor',
    'Retour recurrent',
    8
  );
  addReason(
    reasons,
    COMMERCIAL_INTENT.test(text),
    'commercial_intent',
    'Intention commerciale',
    10
  );

  const score = Math.min(
    100,
    Math.max(
      0,
      reasons.reduce((total, reason) => total + reason.points, 0)
    )
  );

  return {
    score,
    temperature: score >= 70 ? 'chaude' : score >= 40 ? 'tiede' : 'froide',
    reasons
  };
}

function addReason(
  reasons: LeadScoreReason[],
  condition: boolean,
  code: string,
  label: string,
  points: number
): void {
  if (condition) {
    reasons.push({ code, label, points });
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\u2019']/g, ' ');
}
