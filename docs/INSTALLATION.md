# Installation Production

Ce guide prepare une premiere installation interne de VISITOR-OS.

## Prerequis

- Docker ;
- Docker Compose v2 ;
- Git ;
- curl ;
- acces SSH au serveur ;
- domaine ou sous-domaine configure ;
- ports HTTP/HTTPS ouverts au niveau pare-feu.

## Installation Rapide

Depuis le serveur :

```bash
git clone https://github.com/chrisphotosinternational-cmyk/visitor-os.git
cd visitor-os
cp deployment/.env.production.example deployment/.env.production
```

Modifier ensuite `deployment/.env.production`.

Variables minimales :

- `POSTGRES_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `FIRST_ADMIN_EMAIL`
- `FIRST_ADMIN_PASSWORD`
- `ALLOWED_ORIGINS`
- `NOTIFICATION_FROM_EMAIL`

Puis lancer :

```bash
scripts/install.sh
```

## Verification

```bash
scripts/healthcheck.sh
```

Endpoints attendus :

- `/health`
- `/live`
- `/ready`

## Temps Moyen D'installation

Estimation pour une machine deja equipee de Docker :

```text
15 a 30 minutes
```

La premiere execution peut prendre plus longtemps a cause du build Docker.

## Premiere Connexion Admin

Le premier administrateur est cree au demarrage si :

- `FIRST_ADMIN_EMAIL` est defini ;
- `FIRST_ADMIN_PASSWORD` est defini.

Changer le mot de passe temporaire apres la premiere connexion.

## Important

Ne jamais commiter `deployment/.env.production`.

