# Troubleshooting

## Erreur Importante

Ne pas chercher a installer le backend sur OVH Web mutualise.

Si le backend ne demarre pas, verifier la plateforme externe choisie.

## Backend Indisponible

Verifier :

- logs du service Render/Railway/Fly/DigitalOcean ;
- `DATABASE_URL` ;
- `ADMIN_SESSION_SECRET` ;
- `ALLOWED_ORIGINS` ;
- build command ;
- start command ;
- healthcheck `/ready`.

## `/ready` Echoue

`/ready` verifie PostgreSQL.

Causes probables :

- base managée non accessible ;
- `DATABASE_URL` invalide ;
- SSL requis par la plateforme ;
- limite de connexions ;
- migration/schema non initialise.

## Erreurs CORS

Verifier `ALLOWED_ORIGINS`.

Inclure exactement :

- domaine admin ;
- domaine widget si different ;
- domaine Moto CMS si le widget appelle l'API depuis ce domaine.

## Moto CMS Ne Charge Pas Le Widget

Verifier :

- URL du script ;
- HTTPS ;
- CSP eventuelle ;
- console navigateur ;
- disponibilite du fichier widget ;
- domaine API autorise.

## Admin Ne Se Connecte Pas

Verifier :

- cookies ;
- HTTPS ;
- sameSite ;
- `FIRST_ADMIN_EMAIL` ;
- `FIRST_ADMIN_PASSWORD` ;
- logs backend.

## KMS Import Echoue

Verifier :

- taille du fichier ;
- format ;
- logs backend ;
- espace PostgreSQL ;
- PDF scanne non supporte sans OCR.

