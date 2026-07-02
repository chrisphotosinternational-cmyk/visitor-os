# Chunking

Le chunking transforme un document long en morceaux recherchables.

## Configuration RC2

Valeurs par defaut :

```text
maxCharacters: 1200
overlapCharacters: 120
splitByParagraph: true
```

## Regles

- decoupage prioritaire par paragraphes ;
- decoupage secondaire par phrases ;
- limite stricte de taille ;
- recouvrement configurable ;
- generation de tokens pour la recherche.

## Pourquoi un Recouvrement

Le recouvrement evite de perdre du contexte entre deux chunks.

C'est aussi une preparation directe aux embeddings futurs.

## Hors Perimetre RC2

- chunking semantique avance ;
- embeddings ;
- summarisation automatique ;
- reranking IA.

