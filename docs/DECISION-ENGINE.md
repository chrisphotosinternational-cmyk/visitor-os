# VISITOR-OS Decision Engine

Version cible : v0.2.0-dev.

## Objectif

Le Decision Engine choisit la source de reponse la plus fiable pour chaque message visiteur. Il privilegie les informations locales, controlables et peu couteuses avant toute IA.

## Ordre de decision

1. Escalade immediate pour les demandes sensibles : tarifs, disponibilites, reservation datee, reclamation, urgence, juridique, medical.
2. Recherche FAQ locale.
3. Recherche dans la base de connaissance simple.
4. Provider IA abstrait.
5. Fallback propre si la confiance reste trop faible.

## Resultat retourne

```json
{
  "reply": "Reponse envoyee au visiteur",
  "source": "faq",
  "confidence": 0.95,
  "shouldEscalate": false,
  "processingTimeMs": 3,
  "matchedItemId": "parking",
  "reason": "faq_keyword_match"
}
```

## Sources possibles

- `faq` : reponse courte, locale et fiable.
- `knowledge_base` : contenu metier plus long.
- `ai` : provider IA abstrait. En v0.2.0-dev, le provider par defaut est un mock.
- `fallback` : aucune reponse fiable.
- `human_escalation` : demande a traiter par une personne.

## Regles de prudence

Le moteur ne doit jamais inventer un tarif, une disponibilite, une confirmation de reservation, un conseil juridique ou medical, ni une decision commerciale engageante.

## Persistance

Chaque reponse assistant peut enregistrer la source, la confiance, l'escalade, le temps de traitement, l'item matche et la raison de decision.

Un evenement est aussi ajoute dans `decision_events` pour preparer des metriques futures sans creer d'analytics avancees.

## OpenAI plus tard

Le module `backend/src/modules/ai/` expose une interface `AiProvider`. Un provider OpenAI pourra implementer `generateReply()`, `estimateCost()` et `providerName`.

Si `OPENAI_API_KEY` est absente, l'application utilise le provider mock et ne plante pas.

