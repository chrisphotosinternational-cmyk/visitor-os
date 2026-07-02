# Architecture Philosophy

L'architecture de VISITOR-OS doit etre simple, modulaire et durable.

Le projet doit pouvoir etre developpe progressivement par une seule personne pendant plusieurs annees.

## Principes Fondateurs

- configuration avant developpement ;
- IA sous controle ;
- multi-provider ;
- multi-tenant ;
- architecture modulaire ;
- aucun verrou proprietaire ;
- documentation obligatoire ;
- tests obligatoires ;
- une release egale une capacite ;
- donnees client exportables ;
- modules interchangeables.

## Style Architectural

VISITOR-OS privilegie :

- modular monolith avant microservices ;
- PostgreSQL comme source principale ;
- interfaces pour providers externes ;
- validation stricte des entrees ;
- RBAC et isolation organisation ;
- logs et erreurs stables ;
- dependances limitees ;
- migrations progressives.

## Ce Qui Est Interdit Par Defaut

Sauf justification forte, VISITOR-OS doit eviter :

- microservices prematures ;
- orchestration complexe ;
- dependances SaaS non remplacables ;
- logique metier codee en dur ;
- prompts IA comme source de verite ;
- dashboards inutiles ;
- abstractions sans usage reel.

## Regle De Maintenance

Chaque module doit pouvoir etre compris par lecture locale.

Un developpeur doit pouvoir repondre rapidement :

- quel est le role du module ;
- quelles donnees il manipule ;
- quelles permissions il exige ;
- quels tests le protegent ;
- comment le remplacer plus tard.

## Donnees Et Isolation

Toutes les donnees doivent etre rattachees clairement a :

- une organisation ;
- un site lorsque pertinent ;
- un utilisateur lorsque pertinent ;
- une source ;
- un historique.

Aucune fuite inter-tenant n'est acceptable.

## Evolution Technique

VISITOR-OS doit preparer l'avenir sans le coder trop tot.

Exemples :

- interfaces RAG avant vector database ;
- providers IA avant dependance OpenAI stricte ;
- queue abstraite avant worker distribue ;
- exports simples avant BI complexe ;
- modules optionnels avant marketplace.

