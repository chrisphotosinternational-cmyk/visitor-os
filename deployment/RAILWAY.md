# Railway Deployment

Railway est l'alternative principale a Render pour une beta rapide.

## Pourquoi Railway

- tres rapide a configurer ;
- PostgreSQL managé ;
- variables d'environnement simples ;
- deploiement Git ;
- logs accessibles ;
- bonne experience developpeur.

## Services A Creer

1. PostgreSQL plugin.
2. Backend service Node.js.
3. Admin static service ou service Nginx.
4. Widget servi comme fichier statique.

## Backend

Configuration recommandee :

```text
Build: cd backend && pnpm install --frozen-lockfile && pnpm build
Start: cd backend && pnpm start
Healthcheck: /ready
```

Variables :

- `NODE_ENV=production`
- `DATABASE_URL`
- `ALLOWED_ORIGINS`
- `ADMIN_SESSION_SECRET`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`
- `BUSINESS_CONFIG_DIR=../configs`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

## PostgreSQL

Utiliser PostgreSQL managé Railway.

Sauvegardes :

- verifier les options de backup du plan ;
- planifier un export `pg_dump` regulier ;
- tester la restauration sur une base separee.

## Moto CMS

Moto CMS reste le site vitrine.

Il ne fait qu'ajouter le script widget externe.

## Limites

- couts variables selon usage ;
- attention aux environnements multiples ;
- sauvegardes a verifier selon plan.
