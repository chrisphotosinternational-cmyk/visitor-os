# VISITOR-OS — Runtime Optimization

Sprint 21 ajoute une couche runtime autour du pipeline public :

visiteur -> Knowledge Engine -> Reasoning Engine -> reponse -> contexte -> lead readiness.

## Mesures collectees

- temps total de reponse ;
- temps Knowledge Engine ;
- temps Reasoning Engine ;
- temps DB reserve ;
- taille du message entrant ;
- taille de la reponse ;
- hits/misses du cache conversationnel ;
- erreurs runtime.

Les mesures sont stockees par organisation, site, conversation et message.

## Cache court TTL

Un cache memoire court est utilise pour :

- configuration business du site ;
- reglages widget ;
- donnees de configuration chatbot.

Le TTL par defaut est volontairement court : 30 secondes. Il reduit les lectures repetitives sans creer de dependance externe ni de probleme majeur en cas de changement admin.

## Quality scoring

Chaque reponse issue du Reasoning Engine possede :

- confidence_score ;
- intent_confidence ;
- knowledge_match_score ;
- goal_alignment_score ;
- lead_action_score ;
- response_quality_score.

Ces scores servent aux diagnostics, a la review queue et au pilotage qualite.

## Limites

Le cache est local a l'instance Railway. En multi-instance, il faudra Redis ou une couche partagee si l'invalidation stricte devient necessaire.
