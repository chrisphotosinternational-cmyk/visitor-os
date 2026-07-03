# Backup

La strategie de sauvegarde beta doit etre adaptee a un deploiement cloud managé.

## Elements A Sauvegarder

- PostgreSQL managé ;
- configurations JSON ;
- documents KMS extraits ;
- chunks et versions KMS ;
- variables d'environnement ;
- logs importants.

## PostgreSQL Managé

Activer les backups de la plateforme :

- Render PostgreSQL backups ;
- Railway backups selon plan ;
- DigitalOcean managed database backups ;
- solution externe `pg_dump` si necessaire.

## KMS

En beta, le KMS stocke le contenu exploitable dans PostgreSQL.

Donc la sauvegarde PostgreSQL couvre :

- documents ;
- texte extrait ;
- versions ;
- chunks ;
- evenements de recherche.

Les fichiers originaux ne doivent pas dependre d'un disque local ephemeral.

## Export Manuel

Si la plateforme permet un acces base :

```bash
pg_dump "$DATABASE_URL" --format=custom > visitor_os.dump
```

## Frequence Recommandee

Beta interne :

- backup automatique quotidien ;
- export manuel avant mise a jour importante ;
- test restauration avant ouverture publique.

## Retention Simple

- 7 jours quotidiens ;
- 4 semaines hebdomadaires ;
- 3 mois mensuels.

## Sprint 12 Production Readiness

Backups must cover:

- PostgreSQL managed database;
- KMS documents and chunks stored in PostgreSQL;
- organization configuration;
- environment variables stored in the deployment platform;
- `logs/` only when file logs are enabled and retained externally.

Recommended beta procedure:

1. Verify provider automatic backups.
2. Run a manual `pg_dump` before each release.
3. Restore the dump in a temporary database at least once per month.
4. Keep the restore command documented next to the platform credentials.

Do not rely on local Railway container disk for durable backups.
