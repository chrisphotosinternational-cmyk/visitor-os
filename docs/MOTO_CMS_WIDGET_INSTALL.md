# Installation du widget VISITOR-OS dans Moto CMS 4

## Objectif

Moto CMS 4 reste uniquement le site vitrine.

VISITOR-OS est charge par un script JavaScript externe heberge par Railway.

Exemple :

```html
<script src="https://visitor-os-production-3a31.up.railway.app/widget/PUBLIC_KEY.js"></script>
```

## Preparer le site dans VISITOR-OS

1. Ouvrir l'administration VISITOR-OS.
2. Aller dans `Chatbot sites`.
3. Ouvrir le site concerne.
4. Verifier :
   - widget actif ;
   - domaine autorise ;
   - couleur ;
   - message d'accueil ;
   - message fallback ;
   - message confidentialite ;
   - capture lead si necessaire.
5. Copier le script genere.

## Domaines autorises recommandes

Pour les premiers tests :

- `chambres-dhotes-albi.com`
- `photographe-boudoir-albi.ovh`
- `photographe-boudoir-lyon.ovh`
- `decoration-murale-photo.com`

Le widget refusera les appels venant d'un domaine non autorise si la liste n'est pas vide.

## Coller le script dans Moto CMS 4

1. Ouvrir Moto CMS 4.
2. Ouvrir le site a connecter.
3. Aller dans les reglages d'integration, code personnalise ou section HTML globale.
4. Coller le script avant `</body>` si Moto CMS propose cet emplacement.
5. Publier le site.
6. Ouvrir le site public dans un nouvel onglet.

## Tester

Verifier :

- le bouton flottant apparait ;
- la fenetre s'ouvre ;
- un `visitor_id` est cree dans `localStorage` ;
- une question peut etre envoyee ;
- une reponse Q/A ou fallback revient ;
- la conversation apparait dans VISITOR-OS ;
- le prospect est cree ou rattache au CRM si la capture lead est terminee ;
- le widget reste lisible sur mobile.

## Exemple chambres-dhotes-albi.com

Dans VISITOR-OS :

- domaine autorise : `chambres-dhotes-albi.com`
- Q/A importee depuis `examples/site_qa_import.csv`
- capture lead : active si question reservation/disponibilite
- champs : nom, email, telephone, besoin

Script :

```html
<script src="https://visitor-os-production-3a31.up.railway.app/widget/PUBLIC_KEY.js"></script>
```

Remplacer `PUBLIC_KEY` par la cle affichee dans l'administration du site.

## Desactiver le widget

Dans VISITOR-OS :

1. Aller dans `Chatbot sites`.
2. Ouvrir le site.
3. Decochez `Widget actif`.
4. Sauvegarder.

Le script peut rester dans Moto CMS, mais le backend refusera les nouvelles conversations.

## Erreurs frequentes

### Le bouton n'apparait pas

- Verifier que le script est bien publie dans Moto CMS.
- Verifier que l'URL Railway est correcte.
- Verifier que la cle publique est correcte.

### Le widget apparait mais n'envoie pas de message

- Verifier les domaines autorises.
- Verifier que le site est actif.
- Verifier que Railway est online.
- Tester `/health` et `/ready`.

### Reponse fallback trop frequente

- Importer plus de Q/A pour ce site.
- Consulter `Questions sans reponse`.
- Transformer les questions recurrentes en Q/A.

### Le prospect n'est pas cree

- Verifier que la capture lead est active.
- Verifier le moment de capture choisi.
- Verifier que l'email ou telephone n'est pas deja rattache a un prospect existant.

## Limites V1

- Le widget ne contourne pas les protections navigateur.
- Le widget ne fonctionne que sur les domaines autorises.
- La capture lead reste volontaire et non intrusive.
- Aucun message commercial n'est envoye automatiquement.
