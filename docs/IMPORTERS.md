# Importers

Les importers KMS convertissent des fichiers en contenu documentaire indexable.

## Entree

Un import fichier contient :

- organisation ;
- site optionnel ;
- nom de fichier ;
- type MIME optionnel ;
- type documentaire optionnel ;
- contenu binaire ;
- titre optionnel ;
- categorie ;
- langue ;
- tags ;
- auteur.

## Detection

Le type est detecte par extension ou MIME :

- `.pdf` -> PDF ;
- `.docx` -> DOCX ;
- `.txt` -> TXT ;
- `.md` / `.markdown` -> Markdown ;
- `.html` / `.htm` -> HTML ;
- `.csv` -> CSV ;
- `.json` -> JSON.

## Extraction

Chaque importer produit :

- texte extrait ;
- metadonnees ;
- avertissements ;
- taille ;
- type detecte.

## Journalisation

L'import retourne un rapport :

- document cree ou versionne ;
- nombre de chunks ;
- duree ;
- warnings ;
- metadonnees.

## Versionning

Un fichier importe avec la meme source `file:<nom>` met a jour le document existant et cree une nouvelle version.

## Securite

- pas de secret dans les fichiers ;
- validation Zod cote API ;
- isolation par organisation ;
- acces reserve a `settings:access`.

