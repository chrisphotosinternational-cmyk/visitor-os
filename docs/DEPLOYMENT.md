# Deployment

VISITOR-OS Beta Internal doit etre deploye sur une plateforme externe compatible SaaS.

## Correction D'hebergement

L'hebergement Web OVH actuel est mutualise/performance.

Il est adapte a :

- Moto CMS ;
- PHP ;
- MySQL ;
- fichiers statiques simples ;
- site vitrine.

Il n'est pas adapte a :

- backend Node.js persistant ;
- PostgreSQL applicatif ;
- workers ;
- processus long-running ;
- orchestration Docker.

## Cible Recommandee

Priorite :

1. Render ;
2. Railway ;
3. Fly.io ;
4. DigitalOcean App Platform.

## Architecture Cible

```text
Moto CMS 4
-> script widget externe
-> API VISITOR-OS sur plateforme SaaS
-> PostgreSQL managé
-> admin statique
```

## Render

Recommande pour la premiere installation.

Voir :

```text
deployment/RENDER.md
```

## Railway

Alternative rapide et tres simple pour beta.

Voir :

```text
deployment/RAILWAY.md
```

## Sprint 12 Health And Metrics

Production services must expose:

- `GET /live` for liveness;
- `GET /ready` for readiness;
- `GET /health` for database/cache/queue/log status;
- `GET /metrics` for minimal Prometheus-compatible metrics.

Railway should keep using `/ready` for deployment healthchecks.

Use `/health` after deployment to verify:

- database state;
- cache state;
- queue state;
- uptime;
- application version.

## Runtime Logs

File logs are optional because SaaS platforms already collect stdout/stderr.

Enable only when needed:

```text
FILE_LOGS_ENABLED=true
FILE_LOGS_DIR=logs
FILE_LOG_MAX_BYTES=5000000
```

Generated files:

- `logs/application.log`;
- `logs/error.log`;
- `logs/audit.log`.

Do not store these logs in a public bucket.

## Fly.io

Option plus technique.

Voir :

```text
deployment/FLY.md
```

## DigitalOcean App Platform

Option managée classique.

Voir :

```text
deployment/DIGITALOCEAN_APP_PLATFORM.md
```

## PostgreSQL

Utiliser PostgreSQL managé fourni par la plateforme ou un fournisseur cloud compatible.

Ne pas utiliser une base locale sur OVH Web.

## Stockage KMS

En beta :

- contenu extrait et chunks dans PostgreSQL ;
- pas de stockage disque local ;
- stockage objet futur si conservation des fichiers originaux necessaire.

Voir :

```text
deployment/KMS_STORAGE.md
```

## Healthchecks

- `/health` : application accessible ;
- `/live` : processus vivant ;
- `/ready` : application prete et PostgreSQL accessible.

## Monitoring Minimal

Sur la plateforme choisie, surveiller :

- statut du service backend ;
- latence `/ready` ;
- CPU/RAM ;
- connexions PostgreSQL ;
- taille base ;
- erreurs backend ;
- echecs IA ;
- echecs notifications ;
- logs deploy ;
- couts.

## Docker Compose

Les fichiers Docker Compose du depot servent uniquement a :

- validation locale ;
- environnement de test ;
- reference technique.

Ils ne sont pas la recommandation pour l'hebergement Web OVH.
