# Release Governance

Ce document définit comment valider les futures releases de VISITOR-OS.

## Types de Release

## dev

Version de développement validant un sprint fonctionnel.

Exemple :

```text
v0.9.0-dev
```

## rc

Release Candidate stabilisée avant une version majeure ou une étape produit importante.

Exemple :

```text
v0.10.0-rc1
```

## stable

Version prête pour usage réel contrôlé.

Exemple futur :

```text
v1.0.0
```

## Critères Obligatoires Avant Release

Une release ne peut être validée que si :

- le périmètre est clairement défini ;
- aucune fonctionnalité hors périmètre n'a été ajoutée ;
- le backend compile ;
- les tests passent ;
- le frontend admin ne contient pas d'erreur syntaxique ;
- le widget ne contient pas d'erreur syntaxique ;
- la documentation est mise à jour ;
- les risques restants sont listés ;
- le commit est créé ;
- le tag est créé.

## Checklist Technique

Avant chaque release :

```bash
cd backend
pnpm check
```

Puis à la racine :

```bash
node --check frontend-admin/app.js
node --check widget/visitor-os-widget.js
git status
git log --oneline -5
```

## Critères GO / NO GO

## GO

GO si :

- tous les tests critiques sont verts ;
- aucun problème de sécurité évident n'est ouvert ;
- aucune fuite multi-tenant connue ;
- aucune dette bloquante ;
- documentation suffisante ;
- périmètre respecté.

## NO GO

NO GO si :

- auth/RBAC cassé ;
- isolation organisation cassée ;
- tests critiques rouges ;
- build cassé ;
- risque de perte de données ;
- fonctionnalité centrale non documentée ;
- comportement produit ambigu.

## Gestion des Tags

Chaque sprint ou RC validé doit être tagué.

Format :

```text
vMAJOR.MINOR.PATCH-suffix
```

Exemples :

- `v0.10.0-rc1`
- `v0.11.0-rc2`
- `v1.0.0`

## Règle de Gel

Après une RC, seules les corrections nécessaires doivent entrer dans la branche avant validation suivante.

Aucune fonctionnalité opportuniste ne doit être ajoutée pendant une stabilisation.
