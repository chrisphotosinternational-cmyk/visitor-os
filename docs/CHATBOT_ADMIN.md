# Chatbot Administration

L'administration des chatbots est disponible dans l'admin via `/chatbots`.

## Liste des chatbots

Chaque site affiche :

- nom du site ;
- domaine ;
- statut ;
- conversations ;
- connaissances actives ;
- questions inconnues ;
- leads capturés.

## Détail chatbot

Chaque chatbot dispose des onglets :

- Vue d'ensemble ;
- Intentions ;
- Connaissances ;
- Questions inconnues ;
- Parcours ;
- Personnalité ;
- Objectifs ;
- Widget.

## Permissions

Les routes utilisent les permissions existantes :

- lecture : `sites:read` ;
- écriture : `sites:write`.

Les utilisateurs non SuperAdmin restent limités à leur organisation.
