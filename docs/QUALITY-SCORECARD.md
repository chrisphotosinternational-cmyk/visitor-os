# Quality Scorecard

Chaque release importante de VISITOR-OS doit être évaluée sur 100 points.

## Score Global

| Domaine | Points |
| --- | ---: |
| Produit | 15 |
| UX | 10 |
| Architecture | 15 |
| Sécurité | 15 |
| Qualité code | 15 |
| Tests | 10 |
| Documentation | 10 |
| Exploitabilité | 10 |
| Total | 100 |

## Produit - 15 points

- 5 pts : valeur utilisateur claire ;
- 4 pts : périmètre respecté ;
- 3 pts : pas de complexité inutile ;
- 3 pts : cohérence avec la vision.

## UX - 10 points

- 4 pts : écran compréhensible en moins de 3 secondes ;
- 3 pts : faible nombre de clics ;
- 2 pts : états vides/erreurs compréhensibles ;
- 1 pt : responsive acceptable.

## Architecture - 15 points

- 5 pts : module découplé ;
- 4 pts : interfaces propres ;
- 3 pts : extensibilité raisonnable ;
- 3 pts : pas de dépendance inutile.

## Sécurité - 15 points

- 5 pts : RBAC respecté ;
- 4 pts : isolation organisation/site ;
- 3 pts : validation des entrées ;
- 2 pts : secrets non exposés ;
- 1 pt : erreurs non sensibles.

## Qualité Code - 15 points

- 5 pts : lisibilité ;
- 4 pts : typage clair ;
- 3 pts : duplication limitée ;
- 2 pts : conventions respectées ;
- 1 pt : nommage cohérent.

## Tests - 10 points

- 4 pts : tests des cas nominaux ;
- 3 pts : tests sécurité/isolation ;
- 2 pts : tests erreurs ;
- 1 pt : tests de non-régression.

## Documentation - 10 points

- 4 pts : documentation fonctionnelle ;
- 3 pts : documentation technique ;
- 2 pts : limites connues ;
- 1 pt : recommandations suite.

## Exploitabilité - 10 points

- 3 pts : configuration claire ;
- 3 pts : logs ou historiques suffisants ;
- 2 pts : migration future claire ;
- 2 pts : coût maîtrisé.

## Interprétation

| Score | Décision |
| --- | --- |
| 90-100 | GO fort |
| 80-89 | GO |
| 70-79 | GO conditionnel |
| 60-69 | NO GO sauf urgence |
| < 60 | NO GO |

## Score Minimal

Une RC ne doit pas être validée sous 80.

Une version stable ne doit pas être validée sous 90.
