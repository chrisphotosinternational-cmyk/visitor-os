# Chatbot Multi-sites

## Role

Le Chatbot Multi-sites est le moteur public d'acquisition de VISITOR-OS.

Il transforme les visiteurs anonymes des sites connectes en conversations, puis en prospects exploitables par le CRM.

Il ne remplace aucun module existant :

- le CRM reste le moteur de gestion commerciale ;
- le pipeline reste le moteur de pilotage commercial ;
- l'AI CRM Chatbot reste l'assistant interne de lecture du CRM ;
- le Widget public reste le canal d'affichage ;
- le Decision Engine reste le moteur de reponse ;
- la Knowledge Base reste une source documentaire.

## Position dans l'architecture

```text
VISITOR-OS
  -> Administration des sites
  -> Widget public
  -> Chatbot Multi-sites
  -> Decision Engine
  -> Knowledge Base / KMS
  -> AI Provider si necessaire
  -> Conversations
  -> Prospects
  -> CRM
```

## Responsabilites

Le module `chatbot-multisite` gere :

- resolution du site par `siteId`, `siteSlug` ou `siteKey` ;
- chargement de la configuration metier associee au site ;
- configuration publique du widget ;
- demarrage d'une conversation visiteur ;
- enregistrement des messages ;
- appel au Decision Engine ;
- creation progressive d'un prospect CRM ;
- application des tags automatiques ;
- recalcul du score ;
- notifications de conversation ou prospect chaud.

## Isolation multi-sites

Chaque conversation est rattachee a :

- une organisation ;
- un site ;
- une configuration metier ;
- un visiteur ;
- eventuellement un prospect.

Le chatbot ne charge jamais une configuration metier globale par defaut si un site actif est trouve. La configuration utilisee est celle de `sites.business_config_id`.

## Routes publiques conservees

Le module est expose par les routes widget existantes :

- `GET /api/widget/config`
- `POST /api/widget/conversations`
- `POST /api/widget/conversations/:conversationId/messages`

Ces routes restent compatibles avec le widget public et Moto CMS.

## Difference avec AI CRM Chatbot

Le Chatbot Multi-sites est public et oriente acquisition.

L'AI CRM Chatbot est prive, admin, et oriente analyse du CRM.

| Module | Public | Role | Modifie les donnees |
| --- | --- | --- | --- |
| Chatbot Multi-sites | Oui | Acquerir conversations et prospects | Oui, via conversations/prospects/tags/scoring |
| AI CRM Chatbot | Non | Interroger le CRM en langage naturel | Non, lecture seule |

## Contraintes

- Aucun module existant ne doit etre renomme ou remplace.
- Le CRM reste la source de verite commerciale.
- Le chatbot public ne doit pas contourner RBAC cote admin.
- Les routes publiques ne donnent acces qu'au flux widget.
- Aucune logique metier ne doit etre codee en dur dans le widget.

## Evolution future

Le module pourra ensuite recevoir :

- personnalisation par site avancee ;
- scripts de qualification par activite ;
- collecte progressive de coordonnees ;
- escalation humaine ;
- handoff vers CRM ;
- analyse qualite conversationnelle ;
- widget multilingue.
