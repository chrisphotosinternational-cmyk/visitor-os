# Backup

Les sauvegardes doivent couvrir :

- PostgreSQL ;
- configurations ;
- documents KMS stockes en base ;
- logs utiles ;
- fichier d'environnement redige sans secrets.

## Commande

```bash
scripts/backup.sh
```

Le script cree un dossier :

```text
backups/YYYYMMDD-HHMMSS/
```

Contenu :

- `postgres.dump`
- `configs.tar.gz`
- `docker.log`
- `env.production.redacted`

## Frequence Recommandee

Beta Internal :

- une sauvegarde quotidienne ;
- une sauvegarde avant chaque mise a jour ;
- une restauration testee au moins une fois avant production publique.

## Retention Simple

Conserver :

- 7 sauvegardes quotidiennes ;
- 4 sauvegardes hebdomadaires ;
- 3 sauvegardes mensuelles.

## Verification

Une sauvegarde non restauree n'est pas encore une vraie sauvegarde.

Tester `scripts/restore.sh` sur une machine non critique.
