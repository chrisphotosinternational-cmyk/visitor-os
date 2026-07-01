# VISITOR-OS
## PROMPT 07 — v1.0
## FOUNDATION
## INITIALISATION TECHNIQUE DU BACKEND

Le dépôt VISITOR-OS est entièrement conçu.

Les documents suivants sont validés :

- SAD
- PRD
- Data Model
- UX/UI

La phase de conception est terminée.

Nous commençons maintenant le développement.

IMPORTANT

Développer uniquement le socle technique.

Ne développer aucun module métier.

Ne développer ni chatbot, ni CRM, ni IA.

Objectif :

Obtenir une application qui démarre correctement.

Le projet doit pouvoir être cloné par un développeur.

Installation. Configuration. Compilation. Tests. Lancement.

Tout doit fonctionner. Aucune fonctionnalité métier.

Créer :

- Backend TypeScript
- Configuration du projet
- Configuration ESLint
- Configuration Prettier
- Configuration des scripts npm
- Configuration PostgreSQL
- Variables d'environnement
- Configuration des logs
- Configuration des erreurs
- Configuration du système de configuration
- Configuration des tests
- Configuration Docker uniquement si réellement retenu dans l'architecture validée

Créer une architecture propre :

- `src/core`
- `src/config`
- `src/database`
- `src/common`
- `src/middlewares`
- `src/modules`
- `src/shared`
- `src/utils`
- `src/types`

Créer les scripts npm nécessaires.

Créer `.env.example`.

Créer le système de lecture sécurisé des variables d'environnement.

Créer la connexion PostgreSQL.

La connexion doit être testée au démarrage.

Créer le système global de logs.

Créer le système global de gestion d'erreurs.

Créer les tests permettant de vérifier :

- compilation
- démarrage
- connexion base
- configuration

Créer la documentation `/backend/README.md`.

Créer un CHANGELOG.

Ne créer :

- aucun endpoint métier
- aucun chatbot
- aucun CRM
- aucune logique IA
- aucune authentification
- aucune API métier

Objectif final :

- compiler
- démarrer
- se connecter à PostgreSQL
- passer les tests
- s'arrêter proprement

Commit attendu :

`Prompt 07: initialize backend foundation`
