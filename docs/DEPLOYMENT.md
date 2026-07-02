# Deployment

VISITOR-OS Beta Internal peut etre deploye avec Docker Compose.

## Architecture Cible

```text
Internet
-> HTTPS reverse proxy
-> frontend admin statique
-> backend Fastify
-> PostgreSQL
```

## Services Compose

- `postgres` : base PostgreSQL ;
- `backend` : API Node.js/Fastify ;
- `frontend` : admin statique servi par Nginx.

## Fichiers

- `deployment/Dockerfile.backend`
- `deployment/Dockerfile.frontend`
- `deployment/docker-compose.yml`
- `deployment/docker-compose.production.yml`
- `deployment/.env.production.example`
- `deployment/nginx.example.conf`
- `deployment/Caddyfile.example`

## Lancement

```bash
scripts/install.sh
```

## Reverse Proxy

Deux exemples sont fournis :

- Nginx : `deployment/nginx.example.conf`
- Caddy : `deployment/Caddyfile.example`

Caddy est plus simple pour HTTPS automatique.

Nginx est plus classique si le serveur possede deja une configuration existante.

## HTTPS

Le backend ne gere pas directement HTTPS.

HTTPS doit etre termine par :

- Caddy ;
- Nginx + Let's Encrypt ;
- reverse proxy managé.

## Health Checks

- `/health` : application accessible ;
- `/live` : processus vivant ;
- `/ready` : application prete et PostgreSQL accessible.

## Monitoring Minimal

Sur une premiere installation, surveiller :

- CPU ;
- RAM ;
- espace disque ;
- statut Docker ;
- taille base PostgreSQL ;
- erreurs backend ;
- echecs IA ;
- echecs notifications ;
- logs reverse proxy.

Commandes utiles :

```bash
docker compose -f deployment/docker-compose.yml ps
docker compose -f deployment/docker-compose.yml logs -f backend
docker stats
```

