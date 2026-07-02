# Restore

La restauration permet de recuperer PostgreSQL et la configuration.

## Commande

```bash
scripts/restore.sh backups/YYYYMMDD-HHMMSS
```

## Procedure Recommandee

1. prevenir les utilisateurs ;
2. arreter le backend si necessaire ;
3. sauvegarder l'etat actuel ;
4. restaurer depuis le dossier choisi ;
5. relancer les services ;
6. verifier `/ready` ;
7. verifier l'admin ;
8. verifier une conversation et un document KMS.

## Risques

La restauration remplace le contenu de la base cible.

Ne jamais tester une restauration directement sur la production sans validation prealable.

## Apres Restauration

```bash
scripts/healthcheck.sh
```

Puis consulter :

```bash
docker compose -f deployment/docker-compose.yml logs --tail=100 backend
```

