# Module Strategy

VISITOR-OS doit évoluer par modules sans perdre la simplicité du coeur produit.

## Coeur Produit

Une fonctionnalité appartient au coeur si elle est nécessaire pour la promesse principale :

```text
Créer, administrer, publier et améliorer un chatbot métier qui transforme les conversations en opportunités.
```

Le coeur contient :

- widget ;
- chatbots ;
- Chatbot Studio ;
- conversations ;
- Knowledge Engine ;
- Reasoning Engine ;
- AI Trainer ;
- Conversation Graph ;
- objectifs par site ;
- prospects ;
- Decision Engine ;
- Business Configuration ;
- KMS ;
- admin minimal ;
- RBAC ;
- multi-tenant ;
- notifications système ;
- analytics essentiels.

Le CRM, les prospects et le pipeline restent dans l'architecture, mais comme modules d'exploitation commerciale des leads, pas comme centre du produit.

## Module Optionnel

Une fonctionnalité devient un module optionnel si :

- elle ne sert pas tous les clients ;
- elle dépend d'un métier spécifique ;
- elle augmente le coût ;
- elle ajoute des intégrations externes ;
- elle peut être activée plus tard sans casser le coeur.

Exemples :

- réservation ;
- paiement ;
- WhatsApp ;
- campagnes email ;
- calendrier ;
- OCR avancé ;
- YouTube ;
- connecteurs Notion ou Drive.

## Critères de Décision

Avant d'ajouter une fonctionnalité, répondre :

1. Rend-elle VISITOR-OS plus intelligent ?
2. Rend-elle VISITOR-OS plus simple à administrer ?
3. Aide-t-elle à créer ou améliorer un chatbot métier ?
4. Est-elle configurable sans code ?
5. Est-elle maintenable par une seule personne ?
6. Est-elle testable simplement ?
7. Est-elle isolée par organisation ?
8. Peut-on la désactiver ?
9. Peut-on la reporter ?

## Matrice de Décision

| Question | Oui | Non |
| --- | --- | --- |
| Sert la promesse principale | coeur possible | module ou rejet |
| Utile à la majorité des clients | coeur possible | module |
| Complexité faible | coeur possible | module |
| Coût faible | coeur possible | module |
| Dépendance externe forte | module | coeur possible |
| Usage métier spécifique | module | coeur possible |

## Règle KISS

Si une fonctionnalité peut être :

- documentée avant d'être codée ;
- simulée avant d'être automatisée ;
- configurée avant d'être spécialisée ;
- faite manuellement avant d'être industrialisée ;

alors il faut choisir l'option la plus simple.

## Exemples

## KMS

Coeur produit.

Raison : la qualité des réponses dépend directement de la connaissance.

## PDF/DOCX Extraction

Module coeur étendu RC2.

Raison : nécessaire pour rendre le KMS réellement utile, mais peut rester limité et local au KMS.

## WhatsApp

Module optionnel.

Raison : utile mais dépendant d'un canal externe, de coûts, d'autorisations et d'une logique métier spécifique.

## Paiement

Module optionnel.

Raison : tous les clients n'en auront pas besoin, et le risque sécurité/maintenance est élevé.
