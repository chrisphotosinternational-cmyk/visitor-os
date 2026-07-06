# VISITOR-OS - Premier demarrage

Ce guide decrit le parcours de validation initiale en production.

## Assistant

La page `/first-start` affiche les 5 etapes du premier lancement :

1. Bienvenue.
2. Creation d'une organisation.
3. Creation d'un administrateur.
4. Import CSV.
5. Tableau de bord.

Si aucune organisation n'existe, VISITOR-OS indique que l'onboarding est requis.

## Projet demo

Le bouton `Creer projet demo` initialise un jeu de donnees fictif :

- organisation `VISITOR DEMO` ;
- utilisateur `demo@visitor-os.app` ;
- mot de passe `demo123` ;
- 200 prospects fictifs ;
- 20 contacts ;
- 10 relances ;
- 5 prospects signes ;
- 5 refus.

Ces donnees ne representent aucune personne reelle.

## Validation attendue

Apres creation du projet demo :

- le dashboard doit afficher des donnees ;
- la page Prospects doit lister les contacts fictifs ;
- la page Relances doit contenir des actions ;
- le Quality Report doit afficher un score CRM exploitable.
