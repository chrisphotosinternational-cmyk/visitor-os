# Technical Principles

Ces principes sont non négociables pour VISITOR-OS.

## 1. Maintenable par une seule personne

Chaque choix technique doit être évalué avec cette question :

```text
Puis-je maintenir ceci seul dans 2 ans ?
```

Si la réponse est non, le choix est probablement trop complexe.

## 2. Monolithe modulaire avant microservices

VISITOR-OS doit rester un monolithe modulaire tant que les contraintes réelles ne justifient pas autre chose.

Les modules doivent être découplés par interfaces et responsabilités, pas par infrastructure prématurée.

## 3. PostgreSQL comme source de vérité

PostgreSQL reste la base principale.

Ajouter Redis, une queue, une vector database ou un moteur analytique externe doit être justifié par un besoin mesuré.

## 4. Pas de logique métier codée en dur

Le code ne doit pas contenir de logique spécifique à une activité comme hôtel, studio photo ou décoration.

Ces variations doivent passer par :

- Business Configuration ;
- KMS ;
- règles ;
- modules optionnels.

## 5. Validation systématique

Toute entrée externe doit être validée.

Zod reste l'outil par défaut côté backend.

## 6. Isolation multi-tenant obligatoire

Chaque requête admin ou widget doit respecter :

- `organizationId` ;
- `siteId` quand applicable ;
- RBAC ;
- permissions ;
- accès organisation.

Aucune fuite inter-tenant n'est acceptable.

## 7. Observabilité simple

Logs, erreurs, événements métier et historiques doivent être suffisants pour comprendre un incident sans ajouter une pile complexe.

Sentry ou équivalent peut compléter plus tard, mais ne remplace pas les journaux métier.

## 8. IA découplée

Le Decision Engine ne doit pas dépendre directement d'un provider IA.

Les providers, embeddings et vector databases doivent rester derrière des interfaces.

## 9. Dépendances limitées

Chaque dépendance doit être justifiée.

Avant d'ajouter une dépendance :

- vérifier si la plateforme actuelle suffit ;
- évaluer maintenance et sécurité ;
- vérifier la taille et la stabilité ;
- documenter la raison.

## 10. Tests sur les fonctions critiques

Les tests doivent couvrir :

- sécurité ;
- RBAC ;
- isolation tenant ;
- décisions conversationnelles ;
- imports ;
- scoring ;
- notifications ;
- analytics ;
- KMS.

## 11. Migration future préparée, pas implémentée trop tôt

VISITOR-OS doit prévoir les extensions futures sans les activer avant besoin réel.

Exemple :

- interfaces RAG maintenant ;
- embeddings plus tard ;
- vector database après validation du besoin.
