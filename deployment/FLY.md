# Fly.io Deployment

Fly.io est une option plus technique que Render ou Railway.

Elle peut convenir si VISITOR-OS a besoin d'un controle plus fin sur les regions et le runtime.

## Pertinence

Avantages :

- deploiement proche des utilisateurs ;
- containers ;
- controle plus fin ;
- bonne evolutivite.

Inconvenients :

- plus technique ;
- demande plus de maintenance ;
- PostgreSQL managé a evaluer attentivement ;
- moins ideal pour une premiere installation par une seule personne.

## Recommandation

Ne pas choisir Fly.io pour la toute premiere installation sauf raison technique claire.

Render ou Railway restent plus simples.

## Healthchecks

Configurer :

- `/live` pour verifier le processus ;
- `/ready` pour verifier PostgreSQL.

