# VISITOR-OS - Guide qualite

Le Quality Report aide a verifier qu'une campagne peut etre exploitee sans risque operationnel.

## Indicateurs

- erreurs detectees ;
- donnees incompletes ;
- prospects sans contact ;
- prospects jamais relances ;
- score moyen ;
- qualite CRM.

## Nettoyage des donnees

Le bouton `Nettoyer les donnees` prepare un apercu avant validation.

Corrections prevues :

- espaces inutiles ;
- casse des emails ;
- format telephone simple ;
- URLs sans protocole ;
- villes normalisees ;
- doublons simples signales.

Le nettoyage ne supprime pas brutalement les doublons. Les doublons simples sont signales pour revue.

## Import intelligent

Avant import CSV, l'analyse detecte :

- doublons probables ;
- emails invalides ;
- telephones invalides ;
- villes manquantes ;
- colonnes ignorees ;
- propositions de correction.

## Regle de prudence

Aucune donnee critique ne doit etre ecrasee automatiquement sans validation humaine.
