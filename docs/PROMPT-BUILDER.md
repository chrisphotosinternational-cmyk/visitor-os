# Prompt Builder

## Objectif

Le Prompt Builder prepare une chaine prete pour un futur provider IA. Il n'appelle pas OpenAI.

Il assemble :

- BusinessConfig ;
- FAQ ;
- Knowledge Base ;
- Business Rules ;
- personnalite ;
- objectifs ;
- restrictions.

## Exemple de sortie

```text
You are VISITOR-OS for Le Cherche-Midi.
Business category: tourisme.
Description: Chambre d'hotes a Albi...

Personality:
- Tone: rassurant
- Style: sobre et premium

Never:
- annoncer un tarif
- annoncer une disponibilite

FAQ:
- Y a-t-il un parking ? Answer: Oui, un parking prive est disponible...
```

## Limite volontaire

Le Prompt Builder ne choisit pas la reponse et ne contacte pas de modele IA. Il fournit seulement le contexte systeme lorsque le futur provider OpenAI sera ajoute.

