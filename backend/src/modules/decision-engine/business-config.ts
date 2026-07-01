export type FaqItem = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  confidence: number;
  enabled: boolean;
};

export type KnowledgeItem = {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  enabled: boolean;
};

export type BusinessConversationConfig = {
  id: string;
  brandName: string;
  activity: string;
  welcomeMessage: string;
  fallbackMessage: string;
  rules: string[];
  faq: FaqItem[];
  knowledgeItems: KnowledgeItem[];
};

export function getBusinessConversationConfig(activity: string): BusinessConversationConfig {
  if (
    activity === "chambre d'hotes" ||
    activity === 'chambre d_hotes' ||
    activity === 'chambre d hotes'
  ) {
    return chercheMidiConfig;
  }

  return chercheMidiConfig;
}

export const chercheMidiConfig: BusinessConversationConfig = {
  id: 'cherche-midi',
  brandName: 'Le Cherche-Midi',
  activity: "chambre d'hotes",
  welcomeMessage: 'Bonjour, je peux vous aider a preparer votre sejour.',
  fallbackMessage:
    'Le plus sur est de nous contacter directement pour une reponse precise et a jour.',
  rules: [
    'Ne jamais confirmer une reservation sans validation humaine.',
    'Ne jamais inventer de tarifs ou de disponibilites.',
    "Proposer une prise de contact si l'information est incertaine."
  ],
  faq: [
    {
      id: 'parking',
      question: 'Y a-t-il un parking ?',
      keywords: ['parking', 'stationnement', 'voiture', 'garer'],
      answer: 'Oui, un parking prive est disponible pour faciliter votre arrivee.',
      confidence: 0.95,
      enabled: true
    },
    {
      id: 'petit-dejeuner',
      question: 'Le petit-dejeuner est-il disponible ?',
      keywords: ['petit dejeuner', 'petit-dejeuner', 'breakfast', 'cafe', 'matin'],
      answer:
        'Le petit-dejeuner peut etre prepare selon les informations confirmees directement avec l etablissement.',
      confidence: 0.88,
      enabled: true
    },
    {
      id: 'television',
      question: 'Y a-t-il une television ?',
      keywords: ['television', 'tv', 'televiseur'],
      answer: 'Oui, la chambre dispose d une television.',
      confidence: 0.9,
      enabled: true
    },
    {
      id: 'climatisation',
      question: 'Y a-t-il la climatisation ?',
      keywords: ['climatisation', 'clim', 'air conditionne', 'chaud'],
      answer: 'Oui, la climatisation est disponible.',
      confidence: 0.9,
      enabled: true
    },
    {
      id: 'cuisine',
      question: 'Y a-t-il une cuisine ?',
      keywords: ['cuisine', 'kitchen', 'repas', 'cuisiner'],
      answer: 'Une cuisine ou un espace repas peut etre indique selon la configuration confirmee.',
      confidence: 0.8,
      enabled: true
    },
    {
      id: 'salle-de-bain',
      question: 'La salle de bain est-elle privative ?',
      keywords: ['salle de bain', 'douche', 'bain', 'toilettes', 'wc'],
      answer:
        'La chambre dispose d un espace salle de bain. Pour une confirmation precise, contactez directement l etablissement.',
      confidence: 0.82,
      enabled: true
    },
    {
      id: 'day-use',
      question: 'Proposez-vous du Day Use ?',
      keywords: ['day use', 'journee', 'quelques heures'],
      answer:
        'Pour une demande de Day Use, le plus fiable est de contacter directement l etablissement afin de verifier les conditions.',
      confidence: 0.82,
      enabled: true
    },
    {
      id: 'pause-guitare',
      question: 'Est-ce pratique pour le festival Pause Guitare ?',
      keywords: ['pause guitare', 'festival', 'concert'],
      answer:
        'Le Cherche-Midi peut convenir pour un sejour lie a Pause Guitare. Verifiez les disponibilites directement avant de reserver.',
      confidence: 0.84,
      enabled: true
    },
    {
      id: 'centre-historique',
      question: 'Comment acceder au centre historique ?',
      keywords: ['centre historique', 'albi', 'cathedrale', 'centre ville', 'acces'],
      answer:
        'Le centre historique d Albi est accessible depuis l etablissement. Demandez l itineraire exact lors de votre contact.',
      confidence: 0.82,
      enabled: true
    },
    {
      id: 'paiement',
      question: 'Quels moyens de paiement acceptez-vous ?',
      keywords: ['paiement', 'payer', 'carte bancaire', 'especes', 'virement'],
      answer:
        'Les moyens de paiement doivent etre confirmes directement avec l etablissement avant votre sejour.',
      confidence: 0.78,
      enabled: true
    },
    {
      id: 'reservation-directe',
      question: 'Peut-on reserver directement ?',
      keywords: ['reservation directe', 'reserver directement', 'reservation', 'booker'],
      answer:
        'Oui, vous pouvez preparer une demande de reservation directe, mais elle doit toujours etre confirmee par l etablissement.',
      confidence: 0.82,
      enabled: true
    }
  ],
  knowledgeItems: [
    {
      id: 'about-cherche-midi',
      title: 'Presentation du Cherche-Midi',
      content:
        "Le Cherche-Midi est une chambre d'hotes a Albi pensee pour accueillir les visiteurs avec une information claire, prudente et humaine.",
      keywords: ['presentation', 'maison', "chambre d'hotes", 'albi', 'sejour'],
      enabled: true
    },
    {
      id: 'booking-principles',
      title: 'Reservations et informations sensibles',
      content:
        'Les tarifs, disponibilites et reservations doivent etre confirmes directement par une personne afin d eviter toute information approximative.',
      keywords: ['reservation', 'tarif', 'disponibilite', 'confirmer'],
      enabled: true
    }
  ]
};
