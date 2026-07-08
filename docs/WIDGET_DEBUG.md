# VISITOR-OS — Widget Debug

Le widget public accepte un mode debug non intrusif :

```html
<script src="https://visitor-os-production-3a31.up.railway.app/widget/PUBLIC_KEY.js" data-debug="true"></script>
```

Ce mode affiche dans la console navigateur :

- cle publique detectee ;
- domaine detecte ;
- URL API utilisee ;
- site charge ;
- conversation creee ;
- erreurs reseau lisibles.

Le mode debug journalise aussi les erreurs widget cote backend via `/api/widget/events`.

## A verifier sur Moto CMS 4

- coller le script avant `</body>` ;
- verifier que le domaine est bien present dans les domaines autorises du site ;
- ouvrir la console navigateur ;
- charger la page en desktop et mobile ;
- envoyer une question simple ;
- verifier que `/chatbots/:siteId/widget` affiche le dernier chargement.

Le mode debug ne doit pas rester actif en production publique si les logs console genent l'experience visiteur.
