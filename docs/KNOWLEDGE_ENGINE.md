# Knowledge Engine

Le Knowledge Engine administre l'intelligence des chatbots multi-sites sans remplacer le CRM ni le système Q/A historique.

## Rôle

- Centraliser les intentions par site.
- Structurer les réponses dans des knowledge items versionnés.
- Prioriser les réponses documentées avant l'ancien système Q/A.
- Transformer les questions inconnues en suggestions exploitables.
- Préparer les parcours conversationnels, la personnalité et les objectifs par site.

## Ordre de réponse widget

1. `knowledge_items` actifs.
2. Q/A historiques `site_qa_items`.
3. Decision Engine existant et fallback.
4. Enregistrement amélioré des questions inconnues.

## Entités

- `chatbot_intents`
- `knowledge_items`
- `chatbot_unanswered_questions` enrichies
- `conversation_flows`
- `conversation_flow_steps`
- `chatbot_personality`
- `chatbot_goals`
- `knowledge_suggestions`

## Garanties

- Isolation par organisation.
- Aucun envoi automatique.
- Aucune suppression de l'ancien système Q/A.
- Fonctionne sans API IA externe.
