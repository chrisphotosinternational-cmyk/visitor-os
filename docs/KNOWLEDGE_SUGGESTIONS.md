# Knowledge Suggestions

Les suggestions transforment les questions inconnues en connaissances administrables.

## Sources

- `unanswered_question`
- `conversation_cluster`
- `admin_manual`

## Cycle

1. Une question inconnue est enregistrée.
2. L'administrateur génère une suggestion.
3. La suggestion peut être acceptée ou rejetée.
4. Une suggestion acceptée crée un `knowledge_item` actif.

## Statuts

- `pending`
- `accepted`
- `rejected`

## Limites

Le sprint 18 ne génère pas de réponse par IA externe. Les suggestions restent simples et contrôlées par l'administrateur.
