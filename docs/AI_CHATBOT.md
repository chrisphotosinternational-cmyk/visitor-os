# AI CRM Chatbot

Le chatbot IA de VISITOR-OS permet d'interroger le CRM en langage naturel.

Ce document concerne le chatbot interne d'administration. Le chatbot public multi-sites utilise le widget et est documente dans `docs/CHATBOT_MULTI_SITES.md`.

## Objectif

Le chatbot aide l'administrateur a comprendre ses donnees commerciales sans construire manuellement des filtres.

Exemples :

- Quels sont les meilleurs prospects a contacter aujourd'hui ?
- Qui dois-je relancer cette semaine ?
- Quels prospects sont interesses mais non signes ?
- Quels profils MYM / OnlyFans sont prioritaires ?
- Resume-moi l'etat du pipeline.

## Perimetre V1

Le chatbot est volontairement en lecture seule.

Il peut :

- rechercher des prospects ;
- lire le pipeline ;
- lire les relances ;
- lire les analyses IA existantes ;
- produire des listes d'action ;
- proposer un export CSV du resultat ;
- citer les donnees utilisees.

Il ne peut pas :

- envoyer un message ;
- supprimer un prospect ;
- modifier un statut ;
- changer une organisation ;
- contourner les permissions.

## Securite

Toutes les routes utilisent JWT et RBAC.

Un utilisateur non SuperAdmin ne voit que les donnees de son organisation.

Les roles sans permission de lecture prospects ne peuvent pas utiliser le chatbot.

Chaque requete est historisee dans :

- `ai_chat_sessions`
- `ai_chat_messages`
- `crm_activity_log`

## Routes

- `POST /chat/sessions`
- `GET /chat/sessions`
- `GET /chat/sessions/:id`
- `POST /chat/sessions/:id/messages`

## Fallback sans IA externe

Le moteur fonctionne sans cle OpenAI ou autre fournisseur.

Le mode fallback analyse la question avec des regles deterministes :

- scoring ;
- relances ;
- pipeline ;
- plateformes ;
- champs de contact ;
- analyses IA deja stockees.

## Citations

Les reponses citent les donnees utilisees :

- prospect ;
- score ;
- statut ;
- ville ;
- derniere action ;
- source de donnees.

## Limites

Le chatbot ne remplace pas une action CRM confirmee par l'utilisateur.

Il ne fait aucune modification automatique et ne declenche aucune communication sortante.
