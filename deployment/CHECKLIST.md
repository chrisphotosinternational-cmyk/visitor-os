# Production Checklist

Avant mise en production :

- [ ] Variables de production completees dans `deployment/.env.production`
- [ ] `ADMIN_SESSION_SECRET` unique et long
- [ ] `FIRST_ADMIN_PASSWORD` temporaire et robuste
- [ ] Base PostgreSQL demarree
- [ ] Sauvegarde testee
- [ ] Restauration testee sur environnement non critique
- [ ] HTTPS actif
- [ ] Reverse proxy configure
- [ ] Origines CORS exactes dans `ALLOWED_ORIGINS`
- [ ] SMTP/Resend configure ou mock volontaire
- [ ] IA configuree ou mock volontaire
- [ ] Organisation initiale verifiee
- [ ] Utilisateur admin cree
- [ ] `/health` OK
- [ ] `/live` OK
- [ ] `/ready` OK
- [ ] Logs consultables
- [ ] Tests backend verts

