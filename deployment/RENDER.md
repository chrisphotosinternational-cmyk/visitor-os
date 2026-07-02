# Render Deployment

Render est la recommandation principale pour la premiere beta interne de VISITOR-OS.

## Pourquoi Render

- deploiement Git simple ;
- Web Service Node.js ;
- PostgreSQL managé ;
- Static Site pour l'admin ;
- variables d'environnement faciles ;
- healthchecks HTTP ;
- logs integres ;
- aucune administration serveur.

## Services A Creer

1. PostgreSQL managed database.
2. Backend Web Service.
3. Admin Static Site.
4. Widget static delivery via Static Site ou backend public.

## Backend

Configuration recommandee :

```text
Runtime: Node
Build command: cd backend && pnpm install --frozen-lockfile && pnpm build
Start command: cd backend && pnpm start
Health check path: /ready
```

Variables importantes :

- `NODE_ENV=production`
- `DATABASE_URL`
- `ALLOWED_ORIGINS`
- `ADMIN_SESSION_SECRET`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`
- `BUSINESS_CONFIG_DIR=../configs`
- `OPENAI_API_KEY` optionnel
- `RESEND_API_KEY` optionnel

## PostgreSQL

Utiliser Render PostgreSQL managé.

Ne pas utiliser une base PostgreSQL installee sur OVH Web.

Sauvegardes :

- activer les backups Render disponibles ;
- exporter regulierement avec `pg_dump` si le plan le permet ;
- tester une restauration avant ouverture publique.

## Admin

Option simple :

```text
Static Site
Root: frontend-admin
Publish directory: frontend-admin
```

Ajouter un fichier `config.js` ou une variable runtime qui definit :

```js
window.VISITOR_OS_API_URL = 'https://api.example.com';
```

## Widget Et Moto CMS

Moto CMS integre uniquement :

```html
<script src="https://widget.example.com/visitor-os-widget.js"></script>
```

Le widget appelle l'API Render.

## Monitoring Minimal

Sur Render, surveiller :

- statut Web Service ;
- latence `/ready` ;
- erreurs logs backend ;
- connexions PostgreSQL ;
- stockage base ;
- echecs notifications ;
- cout IA estime.

## Limites

- les plans gratuits ou basiques peuvent dormir ou etre limites ;
- les backups dependent du plan PostgreSQL ;
- le stockage disque local ne doit pas etre utilise pour les documents KMS.
