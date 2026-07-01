# Configuration Guide

## Ajouter une nouvelle activite

1. Creer un fichier `configs/<id>.json`.
2. Respecter le schema BusinessConfig.
3. Ajouter les FAQ stables.
4. Ajouter les articles de knowledge base.
5. Ajouter les business rules d'escalade.
6. Recharger les configurations depuis l'admin ou redemarrer le backend.

## Regles importantes

- Ne jamais stocker de secret dans une configuration.
- Ne jamais mettre de tarif volatile dans une FAQ.
- Utiliser une business rule pour les tarifs, disponibilites, urgences et demandes sensibles.
- Garder les mots-cles simples et explicites.

## Import / Export

L'admin accepte un JSON complet. La validation Zod est obligatoire avant sauvegarde.

Chaque sauvegarde cree une entree dans `configs/.history/`.

