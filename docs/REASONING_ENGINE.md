# Reasoning Engine

Le Reasoning Engine ajoute une couche de decision au chatbot public sans remplacer le CRM, le Knowledge Engine, le widget ou le Chatbot Studio.

## Role

Pour chaque message visiteur, le moteur :

- detecte l'intention sans dependance obligatoire a une IA externe ;
- relit le contexte de conversation ;
- tient compte des objectifs et de la personnalite du site ;
- choisit la meilleure reponse disponible ;
- calcule un score de lead readiness ;
- propose une next best action ;
- enregistre une trace visible uniquement cote administration.

## Pipeline

```text
Message visiteur
-> Knowledge Engine
-> Reasoning Engine
-> Reponse widget
-> Contexte visiteur
-> Trace admin
-> CRM si lead qualifie
```

## Isolation

Toutes les lectures et ecritures utilisent `organization_id` et `site_id`. Une conversation d'une organisation ne peut pas alimenter le contexte ou les traces d'une autre organisation.

## Mode sans IA

Le moteur fonctionne avec :

- intentions configurees ;
- synonymes ;
- exemples ;
- questions alternatives ;
- tags ;
- mots-cles metier ;
- historique de conversation.

L'IA externe reste optionnelle.
