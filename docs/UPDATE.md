# Update

Les mises a jour doivent rester previsibles.

## Commande

```bash
scripts/update.sh
```

Le script :

1. recupere le dernier code si Git est disponible ;
2. reconstruit les images ;
3. relance les services ;
4. lance le healthcheck.

## Avant Mise A Jour

Toujours lancer :

```bash
scripts/backup.sh
```

## Apres Mise A Jour

Verifier :

- `/health` ;
- `/live` ;
- `/ready` ;
- connexion admin ;
- liste conversations ;
- import KMS simple ;
- logs backend.

## Rollback Simple

1. revenir au commit precedent ;
2. reconstruire ;
3. restaurer la sauvegarde si la base a change ;
4. relancer `scripts/healthcheck.sh`.

