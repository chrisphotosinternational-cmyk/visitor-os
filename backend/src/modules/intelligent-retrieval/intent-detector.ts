import type { RetrievalIntent } from './intelligent-retrieval-types.js';

const INTENT_TERMS: Array<[RetrievalIntent, RegExp]> = [
  ['pricing', /\b(prix|tarif|cout|coût|combien|euro|€)\b/i],
  ['reservation', /\b(reserv|réserv|rendez[- ]?vous|disponib)/i],
  ['preparation', /\b(prepar|prépar|tenue|apporter|avant la seance)/i],
  ['deplacement', /\b(deplac|déplac|domicile|distance|kilomet)/i],
  ['confidentialite', /\b(confident|priv[ée]|diffusion|droit.+image)/i],
  ['paiement', /\b(paiement|payer|acompte|carte|virement|especes|espèces)/i],
  ['contact', /\b(contact|telephone|téléphone|email|mail|joindre|horaires?)/i],
  ['portfolio', /\b(portfolio|galerie|photos?|images?|realisations?|réalisations?)/i],
  ['FAQ', /\b(faq|questions? frequentes?|questions? fréquentes?)/i],
  ['studio', /\b(studio|adresse|local|equipement|équipement)/i],
  ['video', /\b(video|vidéo|film|reel)/i],
  ['avis', /\b(avis|temoignage|témoignage|clients? disent)/i],
  ['prestation', /\b(prestation|seance|séance|offre|formule|service|shooting)/i]
];

export function detectRetrievalIntent(question: string): RetrievalIntent {
  return INTENT_TERMS.find(([, pattern]) => pattern.test(question))?.[0] ?? 'general';
}
