# FAQ et Knowledge Base

## FAQ locale

La FAQ contient des reponses courtes, fiables et configurees par activite.

```json
{
  "id": "parking",
  "question": "Y a-t-il un parking ?",
  "keywords": ["parking", "stationnement", "voiture", "garer"],
  "answer": "Oui, un parking prive est disponible.",
  "confidence": 0.95,
  "enabled": true
}
```

## Ajouter une FAQ

1. Ajouter un item dans la configuration metier.
2. Choisir des mots-cles courts et explicites.
3. Ne pas mettre de tarif ou de disponibilite volatile dans la reponse.
4. Donner une confiance elevee uniquement si l'information est stable.
5. Ajouter un test si la question est critique.

## Base de connaissance simple

La base de connaissance accueille des informations plus longues que la FAQ.

```json
{
  "id": "about-cherche-midi",
  "title": "Presentation du Cherche-Midi",
  "content": "Le Cherche-Midi est une chambre d'hotes a Albi...",
  "keywords": ["presentation", "maison", "chambre d'hotes"],
  "enabled": true
}
```

## Limites v0.2.0-dev

- Pas de vector database.
- Pas d'embeddings.
- Pas de RAG complexe.
- Matching simple par mots-cles normalises.

Cette approche est volontaire : elle est lisible, testable, peu couteuse et suffisante pour valider le produit.

