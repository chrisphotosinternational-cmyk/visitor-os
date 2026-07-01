# VISITOR-OS
## PROMPT 08 — v1.0
## PREMIER SPRINT FONCTIONNEL (MVP)

Objectif : construire le premier MVP fonctionnel de VISITOR-OS avec le minimum nécessaire.

Scénario attendu :

1. Le widget est intégré dans une page HTML de démonstration.
2. Le visiteur ouvre le widget.
3. Il envoie un message.
4. Le backend reçoit le message.
5. Le message est enregistré dans PostgreSQL.
6. Une réponse simple est renvoyée, sans OpenAI.
7. La conversation apparaît immédiatement dans l'administration.
8. L'administrateur peut voir la conversation, la date, le statut, et modifier le statut.

Modules nécessaires uniquement :

- Widget
- Conversation
- Messages
- Prospects
- Dashboard minimal

Dashboard minimal :

- Conversations
- Prospects
- Conversation ouverte
- Statut
- Recherche simple

Contraintes :

- widget responsive ;
- endpoints backend strictement nécessaires ;
- tests ;
- documentation ;
- page demo sans Moto CMS.

Commit attendu :

`Prompt 08: first working MVP`
