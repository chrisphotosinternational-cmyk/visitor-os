# VISITOR-OS Architecture Guardrails

## Mission

Preserver la stabilite, la retrocompatibilite et la coherence de VISITOR-OS.

Le produit evolue uniquement par ajout de modules, extensions, providers ou plugins.

Aucun developpement ne doit remettre en cause le socle existant.

Ce document est une reference obligatoire pour tous les futurs sprints.

## 1. Architecture

VISITOR-OS est compose de modules independants.

Les modules actuels sont :

- Authentification
- Organisations
- Utilisateurs
- Sites
- Chatbots
- Chatbot Studio
- Knowledge Engine
- Reasoning Engine
- Widget Public
- CRM
- Prospects
- Pipeline
- IA CRM
- Enrichissement
- Dashboard
- Analytics
- Monitoring

Ces modules sont desormais consideres comme permanents.

Ils peuvent etre ameliores, etendus ou branches a de nouveaux modules, mais ils ne doivent pas etre supprimes, renommes ou remplaces de maniere incompatible.

## 2. Compatibilite

Interdictions :

- supprimer un module ;
- supprimer une table ;
- supprimer une API publique ;
- supprimer un endpoint ;
- supprimer un widget ;
- casser une migration existante ;
- casser le fonctionnement Moto CMS ;
- casser Railway ;
- casser PostgreSQL.

Les evolutions doivent etre retrocompatibles.

Quand une rupture est inevitable, elle doit etre preparee explicitement, documentee, versionnee et accompagnee d'une strategie de migration.

## 3. Extensions

Les futures fonctionnalites doivent etre developpees sous forme :

- d'un nouveau module ;
- d'une extension ;
- d'un provider ;
- d'un plugin.

Elles ne doivent jamais remplacer silencieusement le coeur existant.

Le coeur peut orchestrer de nouvelles capacites, mais il ne doit pas devenir une zone de couplage instable.

## 4. Base De Donnees

Toute migration doit :

- etre reversible lorsque c'est raisonnablement possible ;
- preserver les donnees existantes ;
- etre documentee ;
- etre testee.

Aucune suppression de colonne ou de table ne doit etre faite sans migration explicite, plan de sauvegarde et justification.

Les migrations doivent respecter les donnees multi-tenant et ne jamais melanger les organisations.

## 5. API

Une API publiee est stable.

Les changements incompatibles doivent creer une nouvelle version :

```text
/api/v2
```

Une API existante ne doit jamais etre modifiee silencieusement si cela casse un client, le widget public, l'administration, Moto CMS ou une integration externe.

## 6. Widget

Le widget public doit rester compatible.

Un site Moto CMS installe aujourd'hui doit continuer a fonctionner apres les prochaines versions.

Les evolutions du widget doivent respecter :

- le script public existant ;
- les cles publiques existantes ;
- les domaines autorises ;
- les conversations existantes ;
- la compatibilite mobile ;
- la compatibilite navigateur ;
- le mode debug ;
- les contraintes CORS.

## 7. CRM

Le CRM reste un module officiel.

Meme si le chatbot devient le coeur produit, le CRM continue de gerer :

- prospects ;
- pipeline ;
- scoring ;
- IA CRM ;
- enrichissement ;
- suivi commercial.

Il ne doit jamais etre supprime.

Il peut recevoir de meilleurs leads, de meilleurs scores et de meilleures informations, mais il ne doit pas redevenir le centre de gravite du produit.

## 8. Chatbot

Le chatbot est le coeur conversationnel de VISITOR-OS.

Toutes les nouvelles evolutions doivent enrichir :

- Knowledge Engine ;
- Reasoning Engine ;
- Chatbot Studio ;
- Widget Public ;
- AI Trainer ;
- Conversation Graph.

Ces evolutions doivent rester additives.

Elles ne doivent pas casser les conversations existantes, les connaissances existantes, les widgets deja deployes ou les leads deja transmis au CRM.

## 9. Documentation

Toute nouvelle fonctionnalite doit etre accompagnee :

- d'une documentation ;
- d'un changelog ;
- d'une mise a jour du `PRODUCT_MANIFEST` si la vision produit est impactee ;
- d'une mise a jour des guides concernes si l'usage administrateur change.

Une fonctionnalite non documentee est consideree comme incomplete.

## 10. Tests

Aucun module nouveau ne peut etre fusionne sans :

- tests backend ;
- build frontend ;
- migration validee ;
- documentation ;
- verification de non-regression des endpoints critiques.

Les endpoints critiques incluent notamment :

- `/live`
- `/health`
- `/ready`
- widget public
- authentification
- routes admin protegees
- routes CRM existantes
- routes chatbot existantes

## 11. Performance

Les evolutions ne doivent pas degrader :

- le temps de reponse ;
- le widget public ;
- Railway ;
- PostgreSQL ;
- l'experience admin ;
- la stabilite des conversations.

Les performances doivent etre mesurees lorsque le changement touche :

- le pipeline public du chatbot ;
- le Knowledge Engine ;
- le Reasoning Engine ;
- le dashboard ;
- les imports ;
- les exports ;
- les requetes PostgreSQL ;
- les batchs.

## 12. Vision

Avant chaque developpement, verifier :

1. Cette evolution ameliore-t-elle la plateforme conversationnelle ?
2. Respecte-t-elle la retrocompatibilite ?
3. Peut-elle etre ajoutee sans casser le socle ?

Si une reponse est non, le developpement doit etre repense.

## Regle Finale

VISITOR-OS doit grandir par couches stables.

Chaque sprint doit renforcer le produit sans fragiliser ce qui fonctionne deja.

