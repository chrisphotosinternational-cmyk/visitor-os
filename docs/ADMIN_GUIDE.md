# VISITOR-OS Administrator Guide - v1.0.0-RC1

## Daily Entry Points

- `/` opens the protected admin application.
- `/system` shows runtime health, queue, cache, logs, DB state and metrics.
- `/prospects` manages CRM records.
- `/pipeline` manages commercial progression.
- `/follow-ups` lists manual relances.
- `/settings` manages feature flags and runtime settings.

## Recommended Daily Routine

1. Check `/system` for API, DB and queue status.
2. Review dashboard alerts and pipeline counts.
3. Process overdue follow-ups.
4. Import or update prospects.
5. Use message templates manually, then record the interaction.
6. Review enrichment suggestions before accepting them.

## Roles

- SuperAdmin: full cross-organization access.
- Admin: organization-level administration.
- Manager: operational management.
- Agent: CRM and follow-up execution.
- Viewer: read-only access.

## Production Rules

- Never store real secrets in the repository.
- Do not enable external AI or email providers without keys and cost controls.
- Export data only when necessary.
- Use backups before migrations or large imports.
# Sprint 15 - Exploitation initiale

## Diagnostics

La page `/diagnostics` permet de verifier :

- base de donnees ;
- queue ;
- cache ;
- OpenTelemetry ;
- variables critiques ;
- version ;
- Railway ;
- permissions ;
- temps de reponse.

## Backup complet

La page `/quality` permet de telecharger un backup VISITOR-OS au format ZIP.

Le backup contient :

- organisation ;
- utilisateurs sans hash de mot de passe ;
- prospects ;
- historique ;
- templates ;
- pipeline ;
- configuration.

## Quality Report

Le rapport qualite doit etre consulte avant toute premiere campagne reelle.

## Chat IA CRM

La page `/chat` donne un assistant CRM en lecture seule.

Points de controle administrateur :

- les routes sont protegees par JWT ;
- les reponses respectent l'organisation de l'utilisateur ;
- les actions destructives sont refusees ;
- les questions sont historisees dans les tables de chat et le journal d'activite CRM ;
- le mode fallback fonctionne sans cle IA externe.
