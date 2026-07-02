# Indexing

L'indexation RC2 reste simple et robuste.

## Index Disponibles

- texte extrait ;
- tokens ;
- titre ;
- categorie ;
- tags ;
- langue ;
- organisation ;
- site ;
- statut.

## File d'Indexation

RC2 introduit une abstraction de queue.

L'implementation est synchrone en V1 :

```text
queued -> processing -> completed
queued -> processing -> failed
```

Cette abstraction permet une migration future vers :

- worker separe ;
- BullMQ ;
- queue PostgreSQL ;
- file managée cloud.

## Pourquoi Pas Plus Complexe

Une queue externe serait prematuree en RC2.

Le besoin actuel est de valider la chaine documentaire, pas de traiter des milliers de fichiers en parallele.

