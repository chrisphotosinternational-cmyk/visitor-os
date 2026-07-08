# VISITOR-OS Product Requirements

## 1. Presentation

### Mission Du Produit

VISITOR-OS est une plateforme conversationnelle no-code permettant de creer, administrer, deployer, faire evoluer et optimiser des chatbots metier specialises.

Le CRM est un module officiel, permanent et compatible, mais il n'est pas le coeur produit.

Le coeur produit est le chatbot metier :

- Chatbot Studio ;
- Knowledge Engine ;
- Reasoning Engine ;
- Widget Public ;
- apprentissage supervise ;
- capture de leads ;
- transmission au CRM.

### Objectifs

VISITOR-OS doit permettre a une organisation de :

- creer un chatbot metier en moins de 30 minutes ;
- connecter ce chatbot a un site existant via une ligne JavaScript ;
- importer et administrer des connaissances sans code ;
- definir des objectifs conversationnels par site ;
- repondre aux visiteurs avec des informations fiables ;
- qualifier les visiteurs sans agressivite ;
- capturer des leads utiles ;
- alimenter le CRM automatiquement ;
- analyser les conversations ;
- ameliorer progressivement le chatbot.

### Valeur Ajoutee

VISITOR-OS apporte :

- une administration no-code des chatbots metier ;
- une separation claire entre connaissance, raisonnement, widget et CRM ;
- une compatibilite avec Moto CMS et les sites vitrines existants ;
- une architecture SaaS multi-tenant ;
- une logique de connaissance explicable ;
- une amelioration continue sous validation humaine ;
- un CRM integre pour exploiter les opportunites ;
- une base technique evolutive sans verrou fournisseur.

### Public Cible

Les premiers utilisateurs cibles sont :

- chambres d'hotes ;
- hotels independants ;
- photographes ;
- restaurants ;
- artisans ;
- commerces locaux ;
- agences ;
- professions liberales ;
- petites equipes commerciales ;
- independants premium ;
- sites vitrines avec demandes entrantes.

### Cas D'utilisation

VISITOR-OS doit couvrir notamment :

- creation d'un chatbot depuis un template metier ;
- import d'une documentation existante ;
- publication d'un widget sur Moto CMS ;
- reponse a des questions visiteurs ;
- detection d'une intention commerciale ;
- capture progressive d'un lead ;
- conversion conversation vers prospect CRM ;
- consultation du pipeline ;
- revue des conversations faibles ;
- creation de nouvelles connaissances depuis les questions inconnues ;
- optimisation continue du chatbot.

## 2. Modules

Chaque module doit rester independant, testable, documente et compatible avec les autres modules existants.

### Authentification

**Role**

Securiser l'acces a l'administration VISITOR-OS.

**Responsabilites**

- identifier un utilisateur ;
- verifier le mot de passe ;
- emettre un token JWT ;
- proteger les routes admin ;
- exposer l'utilisateur connecte ;
- permettre la deconnexion.

**Fonctionnalites**

- login ;
- logout ;
- session JWT ;
- route `GET /me` ;
- expiration de token ;
- erreurs lisibles ;
- protection des routes sensibles.

**Donnees Manipulees**

- email ;
- mot de passe hashe ;
- role ;
- statut utilisateur ;
- organisation rattachee ;
- dates de creation et modification.

**Dependances**

- Users ;
- Organizations ;
- RBAC ;
- JWT ;
- variables d'environnement.

**APIs**

- `POST /login`
- `POST /logout`
- `GET /me`

**Interfaces**

- page login ;
- bouton logout ;
- affichage utilisateur connecte.

**Limites**

- pas d'authentification sociale obligatoire ;
- pas de SSO enterprise dans le coeur initial ;
- pas d'exposition du hash ou de secrets.

### Organisations

**Role**

Representer un tenant VISITOR-OS.

**Responsabilites**

- isoler les donnees ;
- rattacher les sites ;
- rattacher les utilisateurs ;
- porter les parametres globaux.

**Fonctionnalites**

- liste ;
- creation ;
- modification ;
- desactivation ;
- suppression logique ;
- recherche ;
- statut.

**Donnees Manipulees**

- nom ;
- slug ;
- email ;
- pays ;
- langue ;
- timezone ;
- devise ;
- statut ;
- plan futur ;
- quotas futurs.

**Dependances**

- Users ;
- Sites ;
- RBAC ;
- Audit ;
- Analytics.

**APIs**

- routes admin organisations ;
- filtres par organisation pour SuperAdmin.

**Interfaces**

- page Organisations ;
- formulaires de creation et edition ;
- filtres et recherche.

**Limites**

- aucune donnee d'une organisation ne doit etre visible par une autre ;
- les suppressions doivent rester logiques par defaut.

### Utilisateurs

**Role**

Gerer les comptes administrateurs et les permissions.

**Responsabilites**

- rattacher un utilisateur a une organisation ;
- definir son role ;
- activer ou desactiver l'acces ;
- respecter les permissions.

**Fonctionnalites**

- liste ;
- creation ;
- modification ;
- desactivation ;
- attribution de role ;
- filtrage par organisation.

**Donnees Manipulees**

- prenom ;
- nom ;
- email ;
- role ;
- statut ;
- organisation ;
- mot de passe hashe.

**Dependances**

- Authentification ;
- Organizations ;
- RBAC ;
- Audit.

**APIs**

- routes admin users ;
- routes auth.

**Interfaces**

- page Utilisateurs ;
- formulaire utilisateur ;
- affichage role et organisation.

**Limites**

- un utilisateur non SuperAdmin ne doit pas administrer une autre organisation ;
- les mots de passe ne doivent jamais etre exposes.

### Sites

**Role**

Representer un site web equipe d'un chatbot VISITOR-OS.

**Responsabilites**

- stocker domaine et configuration ;
- porter le chatbot public ;
- gerer la cle publique du widget ;
- definir les domaines autorises ;
- rattacher connaissances, conversations et objectifs.

**Fonctionnalites**

- creation ;
- modification ;
- activation/desactivation ;
- cle publique widget ;
- domaines autorises ;
- reglages de capture lead ;
- import Q/A ;
- diagnostic widget.

**Donnees Manipulees**

- nom ;
- domaine ;
- slug ;
- cle publique ;
- organisation ;
- langue ;
- statut ;
- widget actif ;
- allowed domains ;
- settings widget.

**Dependances**

- Organizations ;
- Widget Public ;
- Chatbots ;
- Knowledge Engine ;
- Reasoning Engine ;
- CRM.

**APIs**

- routes admin sites ;
- routes publiques widget par site.

**Interfaces**

- page Sites ;
- page integration widget ;
- diagnostics widget ;
- import Q/A.

**Limites**

- un site ne doit jamais acceder aux donnees d'un autre site hors autorisation ;
- le widget doit respecter les domaines autorises.

### Chatbots

**Role**

Representer l'assistant conversationnel metier associe a un site.

**Responsabilites**

- orchestrer connaissance, raisonnement, personnalite, objectifs et widget ;
- conserver l'etat public du chatbot ;
- alimenter les conversations ;
- transmettre les leads au CRM.

**Fonctionnalites**

- configuration ;
- activation ;
- publication ;
- simulation ;
- revue des conversations ;
- diagnostic ;
- versioning ;
- optimisation.

**Donnees Manipulees**

- site ;
- version ;
- statut ;
- personnalite ;
- objectifs ;
- intentions ;
- connaissances ;
- traces de raisonnement ;
- metriques.

**Dependances**

- Sites ;
- Chatbot Studio ;
- Knowledge Engine ;
- Reasoning Engine ;
- Widget Public ;
- AI Trainer futur ;
- CRM.

**APIs**

- routes admin chatbots ;
- routes widget ;
- routes simulation ;
- routes review queue.

**Interfaces**

- workspace chatbots ;
- details chatbot ;
- diagnostics ;
- review queue ;
- simulation.

**Limites**

- le chatbot ne doit pas modifier des donnees critiques sans confirmation ;
- les propositions d'apprentissage doivent rester validees par l'administrateur.

### Chatbot Studio

**Role**

Permettre la creation no-code d'un chatbot metier.

**Responsabilites**

- guider la creation ;
- appliquer des templates ;
- importer des documents ;
- generer des propositions ;
- tester ;
- publier ;
- rollback.

**Fonctionnalites**

- tableau de bord Studio ;
- assistant de creation ;
- templates metier ;
- import documentaire ;
- simulation ;
- versioning draft / preproduction / published ;
- rollback.

**Donnees Manipulees**

- chatbot ;
- site ;
- template ;
- version ;
- connaissances proposees ;
- objectifs ;
- ton ;
- publication.

**Dependances**

- Sites ;
- Chatbots ;
- Knowledge Engine ;
- Reasoning Engine ;
- KMS ;
- Widget Public.

**APIs**

- routes Studio ;
- routes simulation ;
- routes publication.

**Interfaces**

- `/studio` ;
- wizard ;
- templates ;
- simulation ;
- historique versions.

**Limites**

- le Studio orchestre les modules existants ;
- il ne remplace pas le Knowledge Engine ni le CRM.

### Widget

**Role**

Afficher le chatbot public sur un site externe.

**Responsabilites**

- charger la configuration publique ;
- afficher un bouton flottant ;
- ouvrir la fenetre de conversation ;
- envoyer les messages ;
- recevoir les reponses ;
- gerer visitor_id ;
- respecter les domaines autorises ;
- exposer un mode debug.

**Fonctionnalites**

- script public `/widget/PUBLIC_KEY.js` ;
- ouverture/fermeture ;
- message d'accueil ;
- envoi question ;
- affichage reponse ;
- capture lead ;
- debug mode ;
- protection double chargement ;
- compatibilite mobile.

**Donnees Manipulees**

- public_key ;
- site ;
- visitor_id ;
- conversation_id ;
- messages ;
- erreurs widget ;
- evenements runtime.

**Dependances**

- Sites ;
- Chatbots ;
- Knowledge Engine ;
- Reasoning Engine ;
- CRM ;
- Monitoring.

**APIs**

- routes publiques widget ;
- routes conversation publiques ;
- routes events widget.

**Interfaces**

- script embarque ;
- bouton ;
- fenetre conversationnelle ;
- formulaire lead.

**Limites**

- aucune authentification admin cote widget ;
- aucune exposition de donnees internes ;
- compatibilite Moto CMS obligatoire.

### Knowledge Engine

**Role**

Centraliser les connaissances utilisables par les chatbots.

**Responsabilites**

- stocker les connaissances ;
- gerer intentions, formulations, tags et CTA ;
- rechercher une reponse ;
- versionner ;
- archiver ;
- transformer les questions inconnues en suggestions.

**Fonctionnalites**

- creation de connaissances ;
- edition ;
- publication ;
- archivage ;
- tags ;
- intentions ;
- import ;
- suggestions ;
- recherche ;
- historique.

**Donnees Manipulees**

- knowledge items ;
- intentions ;
- synonymes ;
- formulations ;
- reponses ;
- CTA ;
- objectifs ;
- conditions ;
- tags ;
- versions.

**Dependances**

- Sites ;
- Chatbots ;
- KMS ;
- Reasoning Engine ;
- AI Trainer futur.

**APIs**

- routes admin knowledge ;
- routes suggestions ;
- routes import.

**Interfaces**

- Knowledge admin ;
- unanswered questions ;
- suggestion validation ;
- import.

**Limites**

- le Knowledge Engine doit rester explicable ;
- il ne doit pas inventer de reponse non documentee.

### Reasoning Engine

**Role**

Decider quoi repondre, comment repondre et quelle action proposer.

**Responsabilites**

- detecter l'intention ;
- exploiter la connaissance ;
- tenir compte des objectifs ;
- adapter le ton ;
- evaluer lead readiness ;
- choisir next best action ;
- journaliser les traces admin.

**Fonctionnalites**

- detection intent ;
- reponse orientee objectif ;
- scoring lead readiness ;
- next best action ;
- quality scoring ;
- traces ;
- review queue.

**Donnees Manipulees**

- message visiteur ;
- contexte conversation ;
- connaissance selectionnee ;
- objectif ;
- personnalite ;
- score ;
- trace ;
- action.

**Dependances**

- Knowledge Engine ;
- Chatbots ;
- Widget ;
- CRM ;
- Monitoring.

**APIs**

- routes internes d'orchestration ;
- routes admin de traces et replay.

**Interfaces**

- Reasoning Lab ;
- traces admin ;
- review queue.

**Limites**

- les traces ne doivent pas etre exposees au visiteur ;
- le moteur doit rester controlable et auditable.

### AI Trainer Future Extension

**Role**

Proposer des ameliorations a partir des conversations.

**Responsabilites**

- analyser les conversations ;
- detecter les questions inconnues ;
- proposer nouvelles connaissances ;
- proposer nouvelles intentions ;
- proposer optimisations de parcours ;
- soumettre a validation humaine.

**Fonctionnalites**

- suggestions de connaissances ;
- suggestions d'intentions ;
- detection de formulations frequentes ;
- proposition de reponses ;
- analyse des chemins efficaces ;
- recommandations d'optimisation.

**Donnees Manipulees**

- conversations ;
- messages ;
- traces ;
- resultats ;
- conversions ;
- connaissances existantes ;
- suggestions.

**Dependances**

- Conversation Graph ;
- Knowledge Engine ;
- Reasoning Engine ;
- Analytics ;
- Chatbot Studio.

**APIs**

- routes futures de suggestions ;
- routes futures de validation.

**Interfaces**

- future page AI Trainer ;
- review queue enrichie ;
- suggestions admin.

**Limites**

- aucune publication automatique sans validation ;
- aucune suppression automatique de connaissance.

### CRM

**Role**

Recevoir et exploiter les leads generes par les conversations.

**Responsabilites**

- conserver les prospects ;
- suivre les statuts ;
- organiser le pipeline ;
- stocker l'historique commercial ;
- exposer les opportunites.

**Fonctionnalites**

- liste prospects ;
- detail prospect ;
- notes ;
- historique ;
- relances ;
- statuts ;
- tags ;
- exports ;
- recherche.

**Donnees Manipulees**

- prospects ;
- contacts ;
- notes ;
- statuts ;
- scores ;
- tags ;
- historiques ;
- relances.

**Dependances**

- Prospects ;
- Pipeline ;
- IA CRM ;
- Enrichissement ;
- Chatbots ;
- Dashboard.

**APIs**

- routes prospects ;
- routes contact history ;
- routes exports CRM.

**Interfaces**

- CRM ;
- fiche prospect ;
- follow-ups ;
- timeline.

**Limites**

- le CRM ne doit pas envoyer automatiquement de messages ;
- il ne doit pas redevenir le coeur produit.

### Prospects

**Role**

Representer une opportunite commerciale.

**Responsabilites**

- stocker les donnees publiques ou declarees ;
- gerer scoring et statut ;
- rattacher conversations et sources ;
- eviter les doublons.

**Fonctionnalites**

- CRUD ;
- import CSV ;
- export CSV ;
- deduplication ;
- scoring simple ;
- recherche ;
- filtres ;
- statut.

**Donnees Manipulees**

- nom ;
- pseudo ;
- societe ;
- email ;
- telephone ;
- ville ;
- activite ;
- plateformes ;
- source_url ;
- notes ;
- score ;
- score_label.

**Dependances**

- CRM ;
- Organizations ;
- Chatbots ;
- Pipeline ;
- Enrichissement.

**APIs**

- routes prospects ;
- import/export ;
- suggestions.

**Interfaces**

- liste prospects ;
- creation ;
- edition ;
- detail ;
- import.

**Limites**

- pas de collecte privee non autorisee ;
- pas d'ecrasement automatique de donnees par enrichissement.

### Pipeline

**Role**

Visualiser et piloter l'avancement commercial des prospects.

**Responsabilites**

- organiser les statuts ;
- calculer conversions ;
- exposer forecast ;
- journaliser les changements.

**Fonctionnalites**

- colonnes par statut ;
- changement de statut ;
- metriques de conversion ;
- forecast ;
- activity feed ;
- filtres.

**Donnees Manipulees**

- prospects ;
- statuts ;
- activites ;
- dates ;
- scores ;
- forecast config.

**Dependances**

- CRM ;
- Prospects ;
- Contact History ;
- Analytics.

**APIs**

- `/pipeline`
- `/pipeline/metrics`
- `/pipeline/forecast`
- `/pipeline/activity`

**Interfaces**

- page Pipeline ;
- dashboard widgets ;
- activity feed.

**Limites**

- le forecast reste indicatif ;
- pas de promesse predictive forte sans donnees suffisantes.

### IA CRM

**Role**

Aider l'administrateur a comprendre et prioriser les prospects.

**Responsabilites**

- analyser un prospect ;
- produire un resume ;
- identifier forces/faiblesses ;
- recommander une offre ;
- historiser les analyses.

**Fonctionnalites**

- analyse prospect ;
- analyse batch ;
- priorite ;
- confiance ;
- resume ;
- recalcul.

**Donnees Manipulees**

- prospect ;
- plateformes ;
- score ;
- analyse ;
- opportunites ;
- risques ;
- offre recommandee.

**Dependances**

- Prospects ;
- AI Provider ;
- Enrichissement ;
- CRM.

**APIs**

- `POST /prospects/:id/analyze`
- `GET /prospects/:id/analysis`
- `POST /prospects/analyze-batch`

**Interfaces**

- onglet AI Analysis ;
- dashboard IA.

**Limites**

- l'analyse doit rester une aide ;
- pas de decision automatique critique.

### Dashboard

**Role**

Donner une vue rapide de l'etat de VISITOR-OS.

**Responsabilites**

- afficher les indicateurs essentiels ;
- pointer les urgences ;
- resumer les modules actifs ;
- eviter la surcharge.

**Fonctionnalites**

- metriques organisations ;
- metriques utilisateurs ;
- metriques prospects ;
- metriques pipeline ;
- metriques chatbot ;
- metriques knowledge ;
- alertes.

**Donnees Manipulees**

- agregats ;
- compteurs ;
- statuts ;
- activites ;
- erreurs.

**Dependances**

- Analytics ;
- CRM ;
- Chatbots ;
- Monitoring ;
- Organizations.

**APIs**

- routes dashboard admin ;
- routes analytics.

**Interfaces**

- page dashboard ;
- cartes KPI ;
- activity feed.

**Limites**

- le dashboard doit rester lisible ;
- pas de BI complexe dans le coeur.

### Analytics

**Role**

Mesurer ce qui se passe dans VISITOR-OS.

**Responsabilites**

- agregation ;
- rapports ;
- snapshots ;
- exports ;
- indicateurs par organisation et site.

**Fonctionnalites**

- conversations par jour ;
- prospects crees ;
- taux conversion ;
- score moyen ;
- tags frequents ;
- sources de reponse ;
- cout IA estime ;
- exports.

**Donnees Manipulees**

- conversations ;
- prospects ;
- scores ;
- tags ;
- notifications ;
- IA ;
- sites ;
- organisations.

**Dependances**

- Dashboard ;
- CRM ;
- Chatbots ;
- Knowledge Engine ;
- Monitoring.

**APIs**

- routes analytics ;
- exports analytics.

**Interfaces**

- page Analytics ;
- dashboard metrics.

**Limites**

- pas d'analytics predictive avancee dans le coeur initial ;
- les agregats doivent respecter l'isolation organisationnelle.

### Monitoring

**Role**

Surveiller la sante technique de VISITOR-OS.

**Responsabilites**

- exposer l'etat API ;
- exposer l'etat DB ;
- exposer cache et queue ;
- exposer uptime ;
- tracer erreurs ;
- aider au diagnostic Railway.

**Fonctionnalites**

- `/live` ;
- `/health` ;
- `/ready` ;
- `/metrics` ;
- `/system` ;
- diagnostics widget ;
- logs securises ;
- trace id.

**Donnees Manipulees**

- uptime ;
- version ;
- environment ;
- database state ;
- cache stats ;
- queue stats ;
- erreurs ;
- traces.

**Dependances**

- App core ;
- PostgreSQL ;
- Cache ;
- Queue ;
- Railway ;
- OpenTelemetry.

**APIs**

- routes health ;
- routes metrics ;
- routes diagnostics.

**Interfaces**

- page System ;
- page Diagnostics ;
- logs Railway.

**Limites**

- ne pas exposer de secrets ;
- masquer les donnees sensibles.

## 3. Cycle De Vie D'un Chatbot

### Creer

L'administrateur cree un chatbot depuis :

- un site existant ;
- le Chatbot Studio ;
- un template metier ;
- un assistant de creation.

Le systeme doit demander le minimum utile :

- nom ;
- domaine ;
- metier ;
- objectif principal ;
- ton ;
- langue.

### Configurer

L'administrateur configure :

- message d'accueil ;
- fallback ;
- personnalite ;
- objectifs ;
- capture lead ;
- domaines autorises ;
- couleur widget ;
- CTA.

### Importer Connaissances

L'administrateur peut importer :

- Q/A CSV ;
- PDF ;
- DOCX ;
- Markdown ;
- TXT ;
- HTML ;
- connaissances manuelles.

Le systeme doit proposer une base de connaissances avant publication.

### Tester

Le chatbot doit etre testable avant publication.

La simulation doit afficher :

- intention detectee ;
- connaissance utilisee ;
- confiance ;
- fallback ;
- next best action ;
- lead readiness.

### Publier

La publication rend le chatbot actif pour le widget public.

Le widget doit charger automatiquement la version publiee.

### Apprendre

Le systeme collecte :

- questions inconnues ;
- reponses faibles ;
- fallback ;
- escalades ;
- leads captures ;
- resultats conversationnels.

### Optimiser

Le systeme propose :

- nouvelles connaissances ;
- nouvelles intentions ;
- reformulations ;
- CTA ;
- ajustements d'objectifs ;
- corrections de fallback.

L'administrateur valide.

### Versionner

Chaque chatbot doit pouvoir posseder :

- brouillon ;
- preproduction ;
- version publiee ;
- historique ;
- rollback.

### Archiver

Un chatbot peut etre archive sans supprimer :

- conversations ;
- prospects ;
- connaissances ;
- historiques ;
- traces.

## 4. Cycle De Vie D'une Conversation

```text
Visiteur
↓
Widget
↓
Reasoning
↓
Reponse
↓
Qualification
↓
Lead
↓
CRM
↓
Pipeline
↓
Historique
```

### Visiteur

Le visiteur arrive sur un site equipe du widget VISITOR-OS.

Il peut ouvrir le widget, lire le message d'accueil et poser une question.

### Widget

Le widget transmet :

- site public key ;
- visitor_id ;
- conversation_id ;
- message ;
- contexte technique minimal.

### Reasoning

Le backend charge :

- site ;
- chatbot ;
- configuration ;
- connaissances ;
- objectifs ;
- personnalite ;
- contexte conversationnel.

Le Reasoning Engine decide la reponse et l'action.

### Reponse

La reponse doit etre :

- claire ;
- utile ;
- professionnelle ;
- fondee sur une connaissance ;
- adaptee a l'objectif ;
- jamais inventee si l'information manque.

### Qualification

Le systeme detecte :

- intention ;
- niveau d'interet ;
- besoin ;
- urgence ;
- possibilite de lead ;
- next best action.

### Lead

Le lead est capture progressivement.

Le systeme ne doit pas demander trop tot les donnees personnelles.

### CRM

Si un lead est cree, le CRM recoit :

- source ;
- site ;
- conversation ;
- informations declarees ;
- notes ;
- statut initial ;
- score.

### Pipeline

Le prospect peut ensuite avancer dans le pipeline commercial.

### Historique

La conversation reste consultable pour :

- support ;
- qualification ;
- amelioration connaissance ;
- audit.

## 5. Gestion Des Connaissances

### Creer

Une connaissance peut etre creee manuellement depuis l'administration.

Elle doit contenir au minimum :

- question ou intention ;
- reponse ;
- site ;
- statut ;
- langue.

### Versionner

Chaque modification importante doit conserver un historique.

### Publier

Une connaissance publiee devient utilisable par le widget.

### Archiver

Une connaissance archivee ne doit plus etre utilisee par le chatbot public.

### Fusionner

Les connaissances proches peuvent etre fusionnees avec validation.

### Importer

Le systeme doit accepter des imports simples, notamment CSV Q/A et documents.

### Exporter

Les connaissances doivent pouvoir etre exportees pour sauvegarde ou audit.

### Apprentissage

Les conversations doivent alimenter des suggestions, jamais des changements automatiques non valides.

### Validation

Toute suggestion doit etre acceptee, ignoree ou corrigee par un administrateur.

## 6. Objectifs Conversationnels

Chaque objectif doit etre configurable par site ou chatbot.

Objectifs supportes :

- reservation ;
- lead ;
- telephone ;
- WhatsApp ;
- devis ;
- information ;
- support ;
- vente.

Chaque objectif peut influencer :

- ton ;
- CTA ;
- moment de capture lead ;
- next best action ;
- priorite de reponse ;
- escalade.

Un chatbot peut avoir un objectif principal et des objectifs secondaires.

## 7. Personnalite

La personnalite du chatbot doit etre configurable.

Parametres :

- ton ;
- style ;
- longueur ;
- niveau commercial ;
- niveau technique ;
- positionnement premium ;
- niveau professionnel ;
- tutoiement ;
- vouvoiement.

Regles :

- rester professionnel ;
- ne pas etre agressif ;
- ne pas inventer ;
- reconnaitre les informations inconnues ;
- respecter le metier ;
- respecter l'objectif du site.

## 8. Performances

VISITOR-OS doit mesurer les temps suivants :

- temps total de reponse public ;
- temps widget ;
- temps Knowledge Engine ;
- temps Reasoning Engine ;
- temps API ;
- temps DB ;
- taille payload ;
- erreurs.

Objectifs cibles :

| Mesure | Cible |
| --- | --- |
| Chargement widget | < 500 ms hors reseau lent |
| Reponse simple Knowledge Engine | < 800 ms |
| Reponse avec Reasoning Engine | < 1500 ms |
| API health | < 200 ms |
| Requete DB courante | < 200 ms |
| Dashboard principal | < 2 s sur donnees raisonnables |

Ces cibles doivent rester indicatives et etre mesurees par site.

## 9. Securite

### RBAC

Toutes les routes admin doivent respecter les roles et permissions.

### JWT

Les routes protegees doivent verifier le token.

### Isolation Organisations

Une organisation ne doit jamais lire ou modifier les donnees d'une autre organisation, sauf SuperAdmin autorise.

### RGPD

VISITOR-OS doit limiter la collecte, documenter les donnees et permettre export/suppression lorsque necessaire.

### Logs

Les logs ne doivent pas exposer :

- mots de passe ;
- tokens ;
- secrets ;
- donnees sensibles inutiles.

### Audit

Les actions importantes doivent etre historisees.

### Widget

Le widget doit verifier :

- public key ;
- site actif ;
- domaines autorises ;
- rate limiting ;
- CORS.

### Rate Limiting

Les routes publiques doivent etre protegees contre les abus.

## 10. Deploiement

### Railway

Railway est une cible officielle de deploiement.

Les endpoints de sante doivent rester compatibles :

- `/live`
- `/health`
- `/ready`

### Docker

Docker reste une option de packaging et de portabilite.

### Variables

Les variables d'environnement doivent etre documentees et fournir des valeurs de fallback raisonnables lorsque possible.

### Migration

Les migrations doivent etre testees avant production.

### Rollback

Un rollback doit etre possible en cas de probleme applicatif.

### Health

Les endpoints de health doivent permettre de distinguer :

- application live ;
- application ready ;
- database disabled/configured/ok/error ;
- cache ;
- queue ;
- version.

### Monitoring

Le monitoring doit exposer :

- uptime ;
- version ;
- environment ;
- database ;
- cache ;
- queue ;
- metrics ;
- trace id.

## 11. Qualite

Chaque evolution doit respecter :

- tests backend ;
- build frontend ;
- validation migration ;
- documentation ;
- changelog ;
- absence de secrets ;
- compatibilite Railway ;
- compatibilite widget ;
- compatibilite PostgreSQL.

Objectifs qualite :

- code lisible ;
- modules limites ;
- dependances justifiees ;
- DTO valides ;
- erreurs explicites ;
- tests de non-regression ;
- documentation a jour.

## 12. Roadmap

### Phase 1 - Foundation

Terminee.

Socle SaaS, auth, RBAC, organisations, PostgreSQL, Railway, health checks.

### Phase 2 - Conversation Platform

Terminee.

Widget public, Chatbot Multi-sites, Knowledge Engine, Chatbot Studio, Reasoning Engine, runtime optimization.

### Phase 3 - Extensions

En cours.

Extensions futures autour de l'apprentissage, du Conversation Graph, de l'AI Trainer, des providers et des plugins.

## 13. Criteres D'acceptation

Toute evolution doit respecter :

- `docs/PRODUCT_MANIFEST.md`
- `docs/ARCHITECTURE_GUARDRAILS.md`
- `docs/PRODUCT_REQUIREMENTS.md`

Sinon elle ne peut pas etre integree.

Avant tout developpement, verifier :

1. L'evolution renforce-t-elle la plateforme conversationnelle ?
2. Respecte-t-elle la retrocompatibilite ?
3. Conserve-t-elle les modules existants ?
4. Est-elle testable ?
5. Est-elle documentee ?
6. Peut-elle etre ajoutee sans casser le socle ?

Si une reponse critique est non, le developpement doit etre repense.

