# Troubleshooting

## Le Backend Ne Demarre Pas

Verifier :

```bash
docker compose -f deployment/docker-compose.yml logs backend
```

Causes frequentes :

- `DATABASE_URL` invalide ;
- `ADMIN_SESSION_SECRET` trop court ;
- `ALLOWED_ORIGINS` absent en production ;
- PostgreSQL non pret ;
- port deja utilise.

## `/ready` Echoue

`/ready` teste PostgreSQL.

Verifier :

```bash
docker compose -f deployment/docker-compose.yml ps
docker compose -f deployment/docker-compose.yml logs postgres
```

## L'Admin Ne Communique Pas Avec L'API

Verifier :

- `VISITOR_OS_API_URL` ;
- reverse proxy `/api/` ;
- `ALLOWED_ORIGINS` ;
- cookies admin ;
- HTTPS.

## Connexion Admin Impossible

Verifier :

- `FIRST_ADMIN_EMAIL` ;
- `FIRST_ADMIN_PASSWORD` ;
- logs backend ;
- presence de l'utilisateur en base ;
- cookies bloques par navigateur.

## Erreurs CORS

En production, `ALLOWED_ORIGINS` doit contenir les domaines exacts.

Exemple :

```text
https://chambres-dhotes-albi.com,https://admin.chambres-dhotes-albi.com
```

## Sauvegarde Echoue

Verifier :

- service `postgres` actif ;
- permissions du dossier `backups` ;
- espace disque disponible ;
- variables `POSTGRES_USER` et `POSTGRES_DB`.

## Import KMS Echoue

Verifier :

- taille du fichier ;
- format supporte ;
- fichier PDF non scanne ;
- logs backend ;
- espace base PostgreSQL.

