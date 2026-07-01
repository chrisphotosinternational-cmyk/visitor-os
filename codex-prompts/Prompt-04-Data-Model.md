# VISITOR-OS
## PROMPT 04 — v1.0
## MODÈLE MÉTIER & MODÈLE DE DONNÉES — SANS CODE APPLICATIF

Tu agis comme CTO, Software Architect Senior, Data Architect, Product Manager SaaS et Lead Developer.

Le dépôt VISITOR-OS est déjà initialisé.
Le commit initial existe :
388ff87 Initialize VISITOR-OS repository structure

Ta mission :
Concevoir le modèle métier et le modèle de données complet de VISITOR-OS.

Important :
Ne développe aucune fonctionnalité applicative.
Ne crée pas encore l’API.
Ne crée pas encore le chatbot.
Ne crée pas encore le CRM frontend.
Ne crée pas encore de logique OpenAI.
Ne crée pas de serveur fonctionnel.

Tu peux uniquement créer ou modifier des fichiers de documentation dans :
/database
/docs
/codex-prompts

Objectif :
Produire une conception complète, durable et évolutive du modèle de données.

VISITOR-OS doit être pensé comme une plateforme SaaS modulaire utilisée par plusieurs métiers :
- chambre d’hôtes ;
- photographe ;
- décoration murale ;
- studio photo ;
- hôtel ;
- restaurant ;
- artisan ;
- avocat ;
- commerce ;
- agence ;
- profession libérale.

Le modèle ne doit jamais être spécifique à une seule activité.

Toutes les spécificités métier devront être gérées par configuration, tags, champs personnalisés ou modules activables.

---

# 1. Livrables attendus

Créer ou compléter les fichiers suivants :

/database/DATA-MODEL.md
/database/ENTITY-RELATIONSHIPS.md
/database/DATA-RULES.md
/database/FUTURE-MIGRATIONS.md
/docs/DATA-ARCHITECTURE.md
/codex-prompts/Prompt-04-Data-Model.md

Ne pas créer encore de migrations SQL.
Ne pas générer Prisma.
Ne pas générer Drizzle.
Ne pas générer de schéma PostgreSQL exécutable.
Cette étape est conceptuelle et doit rester validable avant code.

---

# 2. Vision du modèle de données

Le modèle doit pouvoir supporter :

- multi-sites ;
- multi-activités ;
- multi-utilisateurs plus tard ;
- multi-entreprises plus tard ;
- visiteurs anonymes ;
- prospects identifiés ;
- clients ;
- conversations ;
- messages ;
- scores ;
- tags ;
- intentions ;
- notes internes ;
- relances ;
- notifications ;
- exports ;
- logs ;
- paramètres ;
- configurations métier ;
- FAQ locale ;
- base de connaissances ;
- consentement RGPD ;
- suppression RGPD ;
- historique complet ;
- modules futurs : réservation, paiement, devis, facture, calendrier, documents.

---

# 3. Entités à concevoir

Proposer les entités principales et leurs relations.

Inclure au minimum :

## Core SaaS
- organizations
- users
- roles
- permissions
- sites
- site_configs
- modules
- module_settings

## Visitor & CRM
- visitors
- prospects
- customers
- conversations
- messages
- conversation_events
- lead_scores
- intent_tags
- prospect_tags
- internal_notes
- follow_ups
- contact_attempts

## AI & Knowledge
- knowledge_bases
- knowledge_items
- faqs
- prompt_templates
- ai_events
- fallback_events

## Tracking & Analytics
- page_views
- traffic_sources
- utm_events
- conversion_events
- analytics_snapshots

## Notifications
- notification_events
- email_events

## Exports
- export_jobs
- export_files

## RGPD / Privacy
- consents
- data_export_requests
- deletion_requests
- privacy_audit_logs

## System
- app_settings
- audit_logs
- error_logs
- webhooks

## Future modules
Prévoir sans développer :
- bookings
- payments
- invoices
- quotes
- documents
- calendar_events
- automations

---

# 4. Pour chaque entité

Décrire précisément :

- rôle ;
- utilité métier ;
- champs principaux ;
- relations ;
- cardinalités ;
- règles d’intégrité ;
- index recommandés ;
- données sensibles ou non ;
- durée de conservation recommandée ;
- risques ;
- évolutions futures.

Exemple de niveau attendu :

## prospects

Rôle :
Représente un contact commercial qualifié ou semi-qualifié.

Champs potentiels :
- id
- organization_id
- site_id
- visitor_id
- first_name
- last_name
- email
- phone
- status
- lifecycle_stage
- source
- score_current
- consent_status
- created_at
- updated_at
- archived_at

Relations :
- un prospect peut avoir plusieurs conversations ;
- un prospect peut avoir plusieurs notes ;
- un prospect peut avoir plusieurs relances ;
- un prospect peut avoir plusieurs tags ;
- un prospect peut devenir customer.

Règles :
- email non obligatoire au départ ;
- téléphone optionnel ;
- consentement requis avant utilisation commerciale ;
- ne jamais supprimer physiquement sans journal RGPD, sauf politique explicitement définie.

---

# 5. Règles métier CRM

Décrire clairement :

- différence entre visitor, prospect et customer ;
- quand un visitor devient prospect ;
- quand un prospect devient customer ;
- comment gérer les doublons ;
- comment fusionner deux prospects ;
- comment gérer un prospect sans email ;
- comment gérer plusieurs conversations pour une même personne ;
- comment gérer plusieurs sites pour une même personne ;
- comment gérer le score actuel et l’historique des scores ;
- comment gérer les statuts.

Statuts minimum :
- Nouveau
- À qualifier
- Intéressé
- À rappeler
- Réservation probable
- Devis demandé
- Client
- Perdu
- Archivé

---

# 6. Scoring

Concevoir un modèle de scoring 0 à 100.

Inclure :
- score actuel ;
- historique du score ;
- critères de score ;
- pondération ;
- recalcul ;
- justification du score.

Facteurs à prendre en compte :
- email renseigné ;
- téléphone renseigné ;
- demande de tarif ;
- demande de disponibilité ;
- demande de réservation ;
- date mentionnée ;
- budget mentionné ;
- urgence ;
- nombre de messages ;
- retour récurrent ;
- intention forte ;
- abandon de conversation.

---

# 7. Tags et intentions

Prévoir un modèle flexible.

Tags minimum :
- Réservation
- Tarif
- Disponibilité
- Day Use
- Week-end
- Télétravail
- Festival
- Parking
- Petit-déjeuner
- Accès
- Décoration murale
- Shooting photo
- Studio photo
- Autre

Le modèle doit permettre :
- tags automatiques ;
- tags manuels ;
- tags système ;
- tags personnalisés par organisation ;
- tags par site ;
- tags par conversation ;
- tags par prospect.

---

# 8. Conversations et messages

Concevoir un modèle durable pour stocker :

- conversation complète ;
- messages utilisateur ;
- réponses chatbot ;
- messages système ;
- événements ;
- erreurs ;
- fallback ;
- collecte de coordonnées ;
- consentement ;
- page d’origine ;
- referrer ;
- UTM ;
- config utilisée ;
- langue ;
- appareil ;
- navigateur si disponible.

Prévoir :
- conversations anonymes ;
- rattachement ultérieur à un prospect ;
- plusieurs conversations par prospect ;
- suppression ou anonymisation RGPD.

---

# 9. Configurations métier

Le moteur VISITOR-OS doit rester générique.

Décrire comment les configurations métier doivent être modélisées :

- site_configs ;
- fichiers JSON ;
- version de configuration ;
- couleur ;
- marque ;
- messages d’accueil ;
- quick replies ;
- business facts ;
- règles métier ;
- liens ;
- contact ;
- fallback ;
- FAQ ;
- modules activés.

Prévoir :
- versioning ;
- historique ;
- rollback ;
- validation JSON ;
- configuration par site.

---

# 10. RGPD

Concevoir les tables et règles pour :

- consentement ;
- finalité ;
- date ;
- source ;
- preuve de consentement ;
- export des données ;
- suppression ;
- anonymisation ;
- durée de conservation ;
- journal d’audit privacy.

Important :
La suppression RGPD ne doit pas casser les statistiques globales.
Prévoir anonymisation lorsque nécessaire.

---

# 11. Analytics

Prévoir un modèle permettant de mesurer :

- conversations par jour ;
- prospects créés ;
- taux de conversion ;
- tags fréquents ;
- score moyen ;
- sites performants ;
- questions fréquentes ;
- fallbacks ;
- coût IA estimé ;
- notifications envoyées ;
- relances en retard.

Ne pas créer une analytics trop lourde en V1.
Mais prévoir une architecture qui puisse évoluer.

---

# 12. Exports

Concevoir le modèle pour :

- export CSV ;
- export XLSX ;
- export filtré ;
- historique des exports ;
- utilisateur ayant lancé l’export ;
- filtres appliqués ;
- statut de l’export ;
- fichier généré ;
- expiration éventuelle du fichier.

Colonnes minimales à prévoir :
- Date
- Site
- Activité
- Prénom
- Nom
- Email
- Téléphone
- Statut
- Score
- Tags
- Dernière question
- Dernière réponse
- Conversation complète
- Notes internes
- Date de relance
- Source
- UTM

---

# 13. Notifications

Prévoir le modèle pour :

- notification email admin ;
- notification prospect chaud ;
- notification relance ;
- notification erreur ;
- historique d’envoi ;
- statut envoyé/échoué ;
- provider utilisé ;
- payload minimal ;
- erreur éventuelle.

---

# 14. Logs et audit

Prévoir :

- logs applicatifs ;
- logs sécurité ;
- logs admin ;
- logs IA ;
- logs RGPD ;
- logs erreurs ;
- logs exports.

Différencier :
- audit_logs
- error_logs
- privacy_audit_logs
- ai_events

---

# 15. Multi-tenant futur

Même si la V1 peut être mono-organisation, le modèle doit permettre une migration vers multi-tenant.

Décrire :
- organization_id partout où nécessaire ;
- isolation des données ;
- rôles ;
- permissions ;
- limites par organisation ;
- plan d’abonnement futur.

---

# 16. Documentation attendue

/database/DATA-MODEL.md doit contenir :
- liste complète des entités ;
- description de chaque entité ;
- champs principaux ;
- relations ;
- règles métier.

/database/ENTITY-RELATIONSHIPS.md doit contenir :
- relations entre entités ;
- cardinalités ;
- diagramme textuel lisible.

/database/DATA-RULES.md doit contenir :
- règles d’intégrité ;
- règles CRM ;
- règles RGPD ;
- règles scoring ;
- règles de conservation.

/database/FUTURE-MIGRATIONS.md doit contenir :
- stratégie de migration V1 → V2 ;
- passage éventuel mono-organisation vers multi-tenant ;
- modules futurs ;
- passage vers modèle plus avancé.

/docs/DATA-ARCHITECTURE.md doit synthétiser :
- vision data ;
- principes ;
- choix ;
- risques ;
- recommandations.

/codex-prompts/Prompt-04-Data-Model.md doit contenir ce prompt exact.

---

# 17. Niveau de qualité attendu

Le livrable doit être :
- structuré ;
- clair ;
- professionnel ;
- exploitable par un développeur ;
- suffisamment détaillé pour générer ensuite le schéma PostgreSQL ;
- suffisamment générique pour durer plusieurs années.

Ne pas surcomplexifier inutilement.
Mais ne pas concevoir un modèle trop pauvre.

---

# 18. Commit attendu

Créer un commit propre avec le message :

Prompt 04: define VISITOR-OS data model

---

# 19. Interdiction

Ne pas coder l’application.
Ne pas installer de dépendances.
Ne pas créer de serveur.
Ne pas créer de frontend.
Ne pas créer de migration SQL exécutable.
Ne pas appeler OpenAI.
Ne pas intégrer de secret.

Fin de mission :
Produire uniquement la documentation complète du modèle métier et du modèle de données.