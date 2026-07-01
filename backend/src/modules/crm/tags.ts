export type CrmTagDefinition = {
  label: string;
  slug: string;
  keywords: RegExp;
};

export const crmTagDefinitions: readonly CrmTagDefinition[] = [
  { label: 'Reservation', slug: 'reservation', keywords: /reserver|reservation|booker/i },
  { label: 'Tarif', slug: 'tarif', keywords: /tarif|prix|devis|budget/i },
  { label: 'Disponibilite', slug: 'disponibilite', keywords: /disponible|disponibilite|creneau/i },
  { label: 'Day Use', slug: 'day-use', keywords: /day use|journee|quelques heures/i },
  { label: 'Week-end', slug: 'week-end', keywords: /week.?end|samedi|dimanche/i },
  { label: 'Teletravail', slug: 'teletravail', keywords: /teletravail|travail|wifi|bureau/i },
  { label: 'Festival', slug: 'festival', keywords: /festival|concert|evenement/i },
  { label: 'Parking', slug: 'parking', keywords: /parking|stationnement|garer/i },
  { label: 'Petit-dejeuner', slug: 'petit-dejeuner', keywords: /petit.?dejeuner|breakfast/i },
  { label: 'Acces', slug: 'acces', keywords: /acces|adresse|venir|transport|gare/i },
  {
    label: 'Decoration murale',
    slug: 'decoration-murale',
    keywords: /decoration|murale|papier peint|tableau/i
  },
  { label: 'Shooting photo', slug: 'shooting-photo', keywords: /shooting|photo|portrait|seance/i },
  { label: 'Studio photo', slug: 'studio-photo', keywords: /studio|fond|flash|eclairage/i },
  { label: 'Urgent', slug: 'urgent', keywords: /urgent|vite|rapidement|aujourd hui/i },
  { label: 'Autre', slug: 'autre', keywords: /.^/i }
];

export function detectAutomaticTags(messages: string[]): CrmTagDefinition[] {
  const text = normalize(messages.join(' '));
  const tags = crmTagDefinitions.filter(
    (definition) => definition.slug !== 'autre' && definition.keywords.test(text)
  );

  const fallback = crmTagDefinitions.find((definition) => definition.slug === 'autre');

  return tags.length > 0 ? tags : fallback ? [fallback] : [];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\u2019']/g, ' ');
}
