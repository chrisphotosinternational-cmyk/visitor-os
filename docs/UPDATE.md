# Update

Les mises a jour beta doivent passer par Git et la plateforme cloud choisie.

## Render

Le push Git declenche le redeploiement si auto-deploy est actif.

Verifier apres deploy :

- logs build ;
- logs runtime ;
- `/ready` ;
- connexion admin ;
- widget demo.

## Railway

Railway redeploie depuis Git selon configuration.

Verifier :

- variables d'environnement ;
- service backend ;
- PostgreSQL ;
- logs deploy.

## Avant Mise A Jour

Toujours :

- verifier le changelog ;
- sauvegarder PostgreSQL ;
- noter le commit courant ;
- tester localement si possible.

## Rollback

Rollback simple :

1. revenir au commit precedent sur la plateforme ;
2. redeployer ;
3. restaurer PostgreSQL uniquement si le schema ou les donnees ont ete modifies ;
4. verifier `/ready`.

