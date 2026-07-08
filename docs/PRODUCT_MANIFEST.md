# VISITOR-OS Product Manifest

VISITOR-OS ne doit plus etre considere comme un CRM.

Le CRM est un module important, stable et compatible, mais il n'est pas le coeur du produit.

Le veritable produit est une plateforme conversationnelle capable de creer, administrer, deployer, faire evoluer et optimiser des assistants metier specialises sans code.

## Mission

VISITOR-OS doit devenir la meilleure plateforme de creation de chatbots metier administrables sans code.

Chaque chatbot doit pouvoir :

- comprendre un metier ;
- comprendre les objectifs du site ;
- apprendre des conversations ;
- ameliorer progressivement sa base de connaissances ;
- proposer des optimisations ;
- generer des leads qualifies ;
- alimenter automatiquement le CRM.

## Architecture Produit

Le noyau produit devient :

```text
VISITOR-OS
├── Organisations
├── Utilisateurs
├── Sites
├── Chatbots
├── Chatbot Studio
├── Knowledge Engine
├── Reasoning Engine
├── AI Trainer
├── Conversation Graph
├── Widget Public
├── CRM
├── Pipeline
├── IA CRM
├── Analytics
└── Monitoring
```

## Role Du CRM

Le CRM reste entierement compatible.

Il ne doit jamais etre supprime, renomme ou remplace par le chatbot.

Le CRM recoit les leads et gere :

- prospects ;
- pipeline ;
- scoring ;
- IA CRM ;
- enrichissement ;
- suivi commercial.

Le CRM n'est plus le coeur. Il devient la couche commerciale qui exploite les opportunites creees par les conversations.

## Role Du Chatbot

Le chatbot devient le coeur de VISITOR-OS.

Il pilote :

- la conversation ;
- les connaissances ;
- la qualification ;
- les objectifs ;
- la capture de leads ;
- l'alimentation du CRM.

Le chatbot ne doit pas etre un simple widget de reponse. Il doit devenir un assistant metier oriente objectif.

## Knowledge Engine

Toutes les reponses doivent provenir prioritairement du Knowledge Engine.

Une connaissance devient un objet metier complet.

Elle peut posseder :

- intentions ;
- synonymes ;
- formulations ;
- reponses ;
- CTA ;
- objectifs ;
- conditions ;
- tags ;
- historique ;
- version.

La qualite du chatbot depend de la qualite de ses connaissances.

## Reasoning Engine

Le Reasoning Engine decide :

- quoi repondre ;
- comment repondre ;
- pourquoi repondre ;
- quelle action proposer ;
- quand demander un lead ;
- quand rassurer ;
- quand vendre ;
- quand arreter.

Il doit rester explicable, auditable et controlable par l'administrateur.

## AI Trainer

Toutes les conversations deviennent des donnees d'entrainement.

Le systeme peut proposer :

- nouvelles connaissances ;
- nouvelles intentions ;
- nouvelles reponses ;
- nouveaux parcours ;
- nouvelles optimisations.

L'administrateur valide toujours.

Le systeme propose. L'humain decide.

## Conversation Graph

VISITOR-OS doit construire progressivement un graphe conversationnel :

```text
Question
↓
Intention
↓
Connaissance
↓
Reponse
↓
Action
↓
Resultat
```

Le systeme doit apprendre les chemins les plus performants sans rendre la plateforme opaque.

## Objectif Par Site

Le chatbot ne cherche plus seulement a repondre.

Il cherche a atteindre l'objectif defini pour le site.

Exemples :

| Metier | Objectif principal |
| --- | --- |
| Hotel | Reservation |
| Chambre d'hotes | Demande de disponibilite |
| Photographe | Prise de rendez-vous |
| Decoration | Demande de projet |
| Agence | Audit |
| Restaurant | Reservation ou demande d'information |

## Vision Long Terme

Un nouveau chatbot doit pouvoir etre cree en moins de 30 minutes :

```text
Creer le site
↓
Choisir un template
↓
Importer la documentation
↓
Definir les objectifs
↓
Publier
↓
Copier une ligne JavaScript
↓
Le chatbot fonctionne
```

## Regle Absolue

Toute nouvelle fonctionnalite doit repondre a cette question :

```text
Cette evolution rend-elle VISITOR-OS plus intelligent ou plus simple a administrer ?
```

Si la reponse est non, la fonctionnalite ne doit pas etre developpee.

