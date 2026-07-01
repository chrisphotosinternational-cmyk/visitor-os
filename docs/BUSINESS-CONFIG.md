# Business Configuration Engine

Version cible : v0.3.0-dev.

## Objectif

VISITOR-OS ne doit plus connaitre de metier en dur. Le backend charge une configuration JSON et le moteur conversationnel utilise uniquement cette configuration.

## Emplacement

Les configurations actives sont dans `configs/`.

Fichiers ajoutes :

- `default.json`
- `cherche-midi.json`
- `photographe-glamour.json`
- `decoration-murale.json`

Les fichiers `*.example.json` restent des exemples historiques et ne sont pas charges automatiquement par le backend.

## Structure principale

Une configuration contient :

- identite : nom, slogan, description, categorie, logo futur, couleurs futures ;
- contact : telephone, email, site web, adresse, Google Maps, horaires ;
- personnalite : ton, style, niveau de formalite, vocabulaire, langues ;
- objectifs : contact, reservation, devis, vente, rendez-vous, lead ;
- restrictions : regles `never` et `always` ;
- FAQ administrable ;
- knowledge base administrable ;
- business rules configurables ;
- widget : message d'accueil, fallback, quick replies.

## Administration minimale

L'administration permet de :

- voir une configuration ;
- modifier le JSON ;
- sauvegarder ;
- recharger depuis le disque ;
- importer un JSON ;
- exporter un JSON ;
- consulter l'historique des sauvegardes.

L'auteur est encore un placeholder tant que l'authentification n'existe pas.

