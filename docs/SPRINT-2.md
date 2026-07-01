# Sprint 2 - Conversational Decision Engine

## Statut

Version : v0.2.0-dev.

## Objectif

Construire le cerveau conversationnel minimal de VISITOR-OS :

- FAQ locale ;
- knowledge base simple ;
- provider IA abstrait ;
- provider mock sans appel externe ;
- escalade humaine ;
- metriques minimales de decision ;
- integration au flux widget existant.

## Ce qui est inclus

- Module `decision-engine`.
- Module `ai`.
- Persistance des metadonnees de decision sur les messages.
- Table `decision_events`.
- Affichage admin minimal : source, confiance, escalade, temps de traitement.
- Tests unitaires du moteur.
- Test du flux widget vers admin avec source de decision stockee.

## Ce qui est exclu

- OpenAI reel.
- CRM avance.
- Notifications.
- Authentification.
- Paiements.
- Reservations.
- Analytics avancees.

## Questions testees

- "Y a-t-il un parking ?" -> FAQ.
- "Le petit-dejeuner est-il inclus ?" -> FAQ.
- "Quels sont vos tarifs ?" -> escalade humaine.
- "Avez-vous une chambre disponible demain ?" -> escalade humaine.
- "Est-ce qu'il y a la climatisation ?" -> FAQ.
- Question inconnue non sensible -> provider IA mock.

## Prochaines etapes

1. Brancher une vraie configuration metier par site.
2. Ajouter une authentification admin avant exposition publique.
3. Ajouter un provider OpenAI optionnel.
4. Ajouter des metriques agregees seulement apres validation du besoin.

