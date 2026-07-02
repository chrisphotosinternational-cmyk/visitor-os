# Restore

La restauration depend de la plateforme cloud choisie.

## Principe

Restaurer d'abord PostgreSQL.

Puis verifier :

- backend ;
- admin ;
- KMS ;
- widget ;
- auth admin.

## Restauration PostgreSQL

Avec un dump :

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" visitor_os.dump
```

Ne pas lancer cette commande sur une production active sans sauvegarde recente.

## Procedure Recommandee

1. creer une base temporaire ;
2. restaurer le dump ;
3. connecter un backend de test ;
4. verifier `/ready` ;
5. verifier les documents KMS ;
6. verifier les conversations ;
7. basculer seulement apres validation.

## Plateformes

Render, Railway et DigitalOcean proposent des mecanismes differents.

Toujours documenter la procedure exacte choisie dans le runbook du client.

