# DigitalOcean App Platform

DigitalOcean App Platform est une option managée classique.

## Pertinence

Avantages :

- plateforme managée ;
- base PostgreSQL managée ;
- logs et metrics ;
- deploiement Git ;
- couts lisibles.

Inconvenients :

- configuration parfois plus verbeuse que Render ;
- attention aux couts des bases managées ;
- moins rapide a iterer que Railway.

## Architecture

```text
App Platform Web Service -> Backend
App Platform Static Site -> Admin
Managed PostgreSQL -> Database
Moto CMS -> Widget script only
```

## Healthchecks

Utiliser :

```text
/ready
```

pour le service backend.

## Recommandation

Bonne option si l'objectif est une plateforme cloud classique et stable.

Pour une premiere beta, Render reste plus direct.

