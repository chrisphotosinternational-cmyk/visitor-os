# Installation Beta Externe

Ce guide prepare une premiere installation externe de VISITOR-OS.

## Principe

Ne pas installer le backend sur OVH Web mutualise.

Installer VISITOR-OS sur :

- Render ;
- Railway ;
- Fly.io ;
- DigitalOcean App Platform.

Moto CMS 4 reste le site vitrine.

## Installation Recommandee Sur Render

1. Creer une base PostgreSQL managée.
2. Creer un Web Service backend.
3. Creer un Static Site admin.
4. Configurer les variables d'environnement.
5. Configurer `ALLOWED_ORIGINS`.
6. Configurer le domaine public.
7. Tester `/ready`.
8. Ajouter le script widget dans Moto CMS.

## Variables Minimales

- `NODE_ENV=production`
- `DATABASE_URL`
- `ALLOWED_ORIGINS`
- `ADMIN_SESSION_SECRET`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`
- `NOTIFICATION_FROM_EMAIL`
- `BUSINESS_CONFIG_DIR=../configs`

Variables optionnelles :

- `OPENAI_API_KEY`
- `RESEND_API_KEY`

## Moto CMS

Moto CMS integre uniquement :

```html
<script src="https://widget.example.com/visitor-os-widget.js"></script>
```

Le backend, l'admin et la base ne sont pas installes sur Moto CMS.

## Verification

Tester :

- `/health`
- `/live`
- `/ready`
- connexion admin ;
- creation conversation demo ;
- lecture admin ;
- import KMS simple.

## Temps Moyen D'installation

Avec un compte Render ou Railway pret :

```text
30 a 60 minutes
```

La majorite du temps concerne :

- variables d'environnement ;
- domaine ;
- CORS ;
- premiere connexion admin ;
- verification du widget Moto CMS.

