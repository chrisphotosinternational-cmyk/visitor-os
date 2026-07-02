# KMS RC2

RC2 transforme le Knowledge Management System en couche documentaire exploitable.

Le perimetre reste strictement limite au KMS.

## Objectif

Permettre a une organisation d'importer des fichiers reels, d'en extraire le texte, de les decouper en chunks, de les indexer, puis de les rechercher avant tout recours a l'IA.

## Formats Supportes

- PDF ;
- DOCX ;
- TXT ;
- Markdown ;
- HTML ;
- CSV ;
- JSON.

## Flux Fonctionnel

```text
Fichier
-> detection format
-> extraction texte
-> validation
-> versionning
-> chunking
-> indexation texte
-> recherche documentaire
-> Decision Engine
```

## Choix Technique

RC2 utilise uniquement les API natives Node.js.

Aucune dependance PDF, DOCX, embedding ou vector database n'est ajoutee.

Ce choix garde VISITOR-OS simple, peu couteux et maintenable.

## Limites Connues

- PDF : extraction fiable sur PDF textuels simples, limitee sur PDF scannes ou encodages complexes.
- DOCX : extraction du contenu principal `word/document.xml`.
- OCR : non inclus.
- Embeddings : interfaces seulement.
- Vector database : non incluse.

## Critere de Succes

RC2 est validee si :

- un fichier reel peut etre importe ;
- le texte est extrait ;
- le document est versionne ;
- les chunks sont crees ;
- la recherche retrouve le contenu ;
- l'isolation organisation/site est respectee.

