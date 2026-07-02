# Module Strategy

VISITOR-OS doit évoluer par modules sans perdre la simplicité du coeur produit.

## Coeur Produit

Une fonctionnalité appartient au coeur si elle est nécessaire pour la promesse principale :

```text
Transformer un visiteur en information exploitable.
```

Le coeur contient :

- widget ;
- conversations ;
- prospects ;
- Decision Engine ;
- Business Configuration ;
- KMS ;
- admin minimal ;
- RBAC ;
- multi-tenant ;
- notifications système ;
- analytics essentiels.

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

1. Est-ce nécessaire pour tous les clients ?
2. Est-ce nécessaire pour la V1 ?
3. Est-ce configurable sans code ?
4. Est-ce maintenable par une seule personne ?
5. Est-ce testable simplement ?
6. Est-ce isolé par organisation ?
7. Peut-on le désactiver ?
8. Peut-on le reporter ?

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
