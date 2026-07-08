# VISITOR-OS Decision Principles

## 1. Le Produit Avant La Fonctionnalite

Nous n'ajoutons pas une fonctionnalite parce qu'elle est interessante.

Nous l'ajoutons parce qu'elle ameliore le produit.

Une fonctionnalite doit renforcer la plateforme conversationnelle, simplifier l'administration ou augmenter la qualite des conversations.

Si elle ne sert pas clairement le produit, elle doit rester hors du coeur.

## 2. Le Chatbot Avant Le CRM

Le chatbot est le point d'entree.

Le CRM est le point de sortie.

Les evolutions doivent en priorite ameliorer :

- la comprehension ;
- la qualite des reponses ;
- la qualification ;
- la conversion.

Le CRM reste indispensable pour exploiter les leads, mais il ne doit pas redevenir le centre de gravite du produit.

## 3. Ajouter Sans Casser

Toute evolution doit preserver :

- les APIs ;
- les donnees ;
- les widgets ;
- les integrations ;
- les migrations.

VISITOR-OS doit grandir par addition, extension ou composition.

Il ne doit pas grandir par rupture silencieuse.

## 4. Observer Avant De Developper

Avant de creer une nouvelle fonctionnalite :

- analyser les conversations ;
- analyser les statistiques ;
- identifier le probleme reel.

Puis seulement developper.

Une intuition produit doit etre confirmee par les usages, les conversations, les erreurs, les demandes recurrentes ou les indicateurs.

## 5. Une Seule Responsabilite Par Module

Chaque module possede un role precis.

Ne pas melanger les responsabilites.

Exemples :

- le Knowledge Engine gere la connaissance ;
- le Reasoning Engine decide la reponse et l'action ;
- le Widget affiche et transmet la conversation ;
- le CRM gere les leads et le suivi commercial ;
- Analytics mesure ;
- Monitoring surveille.

Un module qui fait trop de choses devient difficile a maintenir, tester et faire evoluer.

## 6. Les Donnees Appartiennent Au Client

Les donnees suivantes restent toujours exportables :

- connaissances ;
- conversations ;
- leads ;
- statistiques ;
- templates ;
- configurations ;
- historiques.

VISITOR-OS ne doit pas creer de verrouillage proprietaire.

Le client doit pouvoir recuperer ses donnees dans un format exploitable.

## 7. L'IA Est Interchangeable

VISITOR-OS ne depend d'aucun fournisseur IA.

Les moteurs peuvent evoluer.

La valeur du produit reside dans :

- le Knowledge Engine ;
- le Reasoning Engine ;
- les donnees ;
- les parcours ;
- les outils d'administration.

Un LLM est un provider.

Il n'est ni le produit, ni l'architecture, ni la strategie.

## 8. Simplicite

Creer un chatbot doit devenir plus simple a chaque version.

Jamais plus complique.

Chaque nouvelle capacite doit etre evaluee selon son impact sur :

- le temps de creation ;
- la clarte de l'administration ;
- le nombre de clics ;
- la comprehension de l'utilisateur ;
- la maintenance.

Une evolution qui ajoute de la puissance mais rend le produit confus doit etre repensee.

## 9. Mesurer

Chaque evolution doit etre evaluee avec des indicateurs :

- temps de creation ;
- temps de reponse ;
- taux de resolution ;
- taux de conversion ;
- satisfaction.

Les indicateurs doivent aider a decider, pas a decorer le dashboard.

Une fonctionnalite non mesuree est difficile a ameliorer.

## 10. Vision

VISITOR-OS n'est pas developpe pour ajouter des fonctionnalites.

VISITOR-OS est developpe pour construire la meilleure plateforme conversationnelle specialisee administrable sans code.

Chaque decision doit etre jugee selon cette vision.

Avant chaque sprint, poser la question :

```text
Cette evolution rend-elle VISITOR-OS plus intelligent, plus fiable ou plus simple a administrer ?
```

Si la reponse est non, il faut repousser, simplifier ou abandonner l'evolution.

