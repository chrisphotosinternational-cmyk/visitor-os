import type { NotificationType, NotificationVariables } from './notification-types.js';

export type NotificationTemplate = {
  title: string;
  subject: string;
  content: string;
};

const templates: Record<NotificationType, NotificationTemplate> = {
  hot_prospect: {
    title: 'Prospect chaud',
    subject: 'Prospect chaud detecte',
    content:
      '{{firstName}} {{lastName}} atteint un score de {{score}} pour {{site}}. Conversation: {{conversationUrl}}'
  },
  new_conversation: {
    title: 'Nouvelle conversation',
    subject: 'Nouvelle conversation sur {{site}}',
    content: 'Une nouvelle conversation a demarre sur {{site}} le {{createdAt}}.'
  },
  potential_booking: {
    title: 'Reservation potentielle',
    subject: 'Reservation potentielle sur {{site}}',
    content: 'Un visiteur montre une intention de reservation. Score: {{score}}. Tags: {{tags}}.'
  },
  follow_up_today: {
    title: 'Relance du jour',
    subject: 'Relance a traiter aujourd hui',
    content: 'Une relance est prevue aujourd hui pour {{firstName}} {{lastName}}.'
  },
  follow_up_overdue: {
    title: 'Relance en retard',
    subject: 'Relance en retard',
    content: 'Une relance est en retard pour {{firstName}} {{lastName}}.'
  },
  system_error: {
    title: 'Erreur systeme',
    subject: 'Erreur systeme VISITOR-OS',
    content: 'Une erreur systeme a ete detectee pour {{organization}}.'
  },
  ai_provider_unavailable: {
    title: 'Provider IA indisponible',
    subject: 'Provider IA indisponible',
    content: 'Le provider IA configure est indisponible pour {{organization}}.'
  },
  export_completed: {
    title: 'Export termine',
    subject: 'Export VISITOR-OS termine',
    content: 'Votre export est termine pour {{organization}}.'
  },
  new_organization: {
    title: 'Nouvelle organisation',
    subject: 'Nouvelle organisation creee',
    content: 'Organisation creee: {{organization}}.'
  },
  new_site: {
    title: 'Nouveau site',
    subject: 'Nouveau site cree',
    content: 'Site cree: {{site}} pour {{organization}}.'
  }
};

export function getNotificationTemplate(type: NotificationType): NotificationTemplate {
  return templates[type];
}

export function renderNotificationTemplate(
  template: NotificationTemplate,
  variables: NotificationVariables = {}
): NotificationTemplate {
  return {
    title: renderText(template.title, variables),
    subject: renderText(template.subject, variables),
    content: renderText(template.content, variables)
  };
}

function renderText(text: string, variables: NotificationVariables): string {
  return text.replace(/\{\{(\w+)}}/g, (_, key: string) => {
    const value = variables[key];

    return value === undefined || value === null || value === '' ? '-' : String(value);
  });
}
