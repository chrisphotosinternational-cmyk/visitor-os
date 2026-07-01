# Multi-Business Platform

## Principe

VISITOR-OS devient une plateforme multi-activites : le code reste identique, seule la configuration change.

## Resolution de configuration

Le backend resout une configuration par identifiant. Si l'identifiant n'existe pas, il utilise `default`.

## Decision Engine

Le Decision Engine applique maintenant :

1. business rules configurees ;
2. FAQ configuree ;
3. knowledge base configuree ;
4. provider IA abstrait ;
5. fallback configure.

## Ce qui reste hors Sprint 3

- Authentification admin.
- Association avancee site -> configuration depuis une interface dediee.
- Provider OpenAI reel.
- Gestion fine des droits.
- Editeur visuel de configuration.

