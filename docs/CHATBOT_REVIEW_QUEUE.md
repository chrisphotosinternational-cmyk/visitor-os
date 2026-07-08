# VISITOR-OS — Chatbot Review Queue

La review queue liste les conversations/messages qui meritent une verification humaine.

## Signaux de revue

- confiance faible ;
- fallback utilise ;
- escalade admin ;
- lead chaud sans capture ;
- absence de knowledge item ;
- score qualite faible.

## Actions admin

Depuis `/chatbots/:siteId/review`, un administrateur peut :

- voir la question ;
- voir la raison de revue ;
- voir la confiance, le lead readiness et la next best action ;
- marquer comme corrige ;
- ignorer.

La creation d'intention ou de knowledge item reste geree par les ecrans Knowledge Engine existants. La review queue ne remplace pas ces modules.

## Objectif

Identifier vite les lacunes de connaissance ou de raisonnement sans casser le flux public ni polluer le CRM.
