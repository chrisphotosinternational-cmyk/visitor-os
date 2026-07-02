# RC2 Product Decision

Ce document prépare RC2 sans la développer.

## RC2 Envisagée

Nom :

```text
Document Intelligence / KMS avancé
```

Objectif :

```text
Rendre le KMS réellement exploitable à partir de fichiers importés.
```

## Périmètre Possible

- extraction PDF réelle ;
- extraction DOCX réelle ;
- import fichier ;
- jobs d'indexation ;
- préparation embeddings ;
- évaluation pgvector ou Qdrant ;
- amélioration de la recherche documentaire.

## Hors Périmètre RC2

- chatbot refondu ;
- WhatsApp ;
- paiements ;
- réservations ;
- campagnes marketing ;
- connecteurs Google Drive/Notion ;
- OCR avancé ;
- vector database en production obligatoire ;
- RAG complet si non nécessaire.

## Décision Produit

RC2 est pertinente si l'objectif est de faire de VISITOR-OS un produit crédible de connaissance documentaire.

Le KMS RC1 prouve l'architecture.

RC2 doit prouver l'usage réel :

```text
J'importe un fichier -> il devient recherchable -> le Decision Engine l'utilise avant l'IA.
```

## Question Centrale

RC2 doit répondre à une seule question :

```text
VISITOR-OS peut-il exploiter facilement les documents réels d'une organisation ?
```

## Recommandation Technique

Ordre recommandé :

1. import fichier ;
2. extraction TXT/Markdown/HTML robuste ;
3. extraction PDF ;
4. extraction DOCX ;
5. jobs d'indexation ;
6. amélioration chunking ;
7. évaluation embeddings ;
8. décision pgvector vs Qdrant.

## pgvector vs Qdrant

## pgvector

Avantages :

- reste dans PostgreSQL ;
- coût faible ;
- maintenance plus simple ;
- cohérent avec une équipe d'une personne.

Risques :

- performances limitées si volume très élevé ;
- tuning nécessaire plus tard.

## Qdrant

Avantages :

- moteur vectoriel dédié ;
- meilleures capacités à grande échelle ;
- API spécialisée.

Risques :

- infrastructure supplémentaire ;
- coût et maintenance ;
- complexité prématurée possible.

## Recommandation RC2

Évaluer les deux, mais ne pas introduire Qdrant par défaut.

Pour VISITOR-OS aujourd'hui, `pgvector` semble plus cohérent avec le principe KISS si une vector database devient nécessaire.

## Critères GO pour Démarrer RC2

GO si :

- RC1 est commitée et taguée ;
- le besoin documentaire est confirmé ;
- le périmètre reste limité au KMS ;
- aucune fonctionnalité métier parallèle n'est ajoutée ;
- les tests RC1 restent verts.

## Décision

Recommandation :

```text
GO conditionnel pour RC2
```

Condition :

RC2 doit rester strictement centrée sur Document Intelligence et ne pas devenir une refonte IA générale.
