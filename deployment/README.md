# External SaaS Deployment

VISITOR-OS Beta Internal doit etre deploye sur une plateforme externe compatible Node.js.

L'hebergement Web OVH mutualise/performance ne doit pas heberger le backend VISITOR-OS.

## Cible Officielle

Priorite :

1. Render ;
2. Railway ;
3. Fly.io ;
4. DigitalOcean App Platform.

## Role De Moto CMS 4

Moto CMS 4 reste uniquement le site vitrine.

Il integre VISITOR-OS avec un script externe :

```html
<script src="https://widget.visitor-os.example/visitor-os-widget.js"></script>
```

Moto CMS ne lance aucun processus Node.js, ne gere pas PostgreSQL et ne stocke pas les donnees applicatives.

## Fichiers De Ce Dossier

- `RENDER.md` : deploiement recommande pour la premiere beta.
- `RAILWAY.md` : alternative rapide pour MVP/beta.
- `FLY.md` : option plus technique.
- `DIGITALOCEAN_APP_PLATFORM.md` : option managée classique.
- `.env.production.example` : variables production.
- `Dockerfile.backend` : utile si la plateforme choisie utilise Docker.
- `Dockerfile.frontend` : admin statique conteneurisable.
- `docker-compose.yml` : validation locale uniquement.
- `docker-compose.production.yml` : reference technique, pas cible OVH Web.
- `CHECKLIST.md` : checklist avant mise en production.

## Decision V1

Pour une premiere installation reelle, recommander Render sauf contrainte contraire.

Raison :

- Web Service Node.js simple ;
- PostgreSQL managé ;
- variables d'environnement faciles ;
- healthchecks ;
- logs accessibles ;
- pas d'administration serveur.

## Ce Qui N'est Pas Recommande

- OVH Web mutualise pour le backend ;
- serveur FTP/PHP pour VISITOR-OS ;
- PostgreSQL local sur un hebergement non administre ;
- Docker Compose sur un serveur que tu ne possedes pas.
