# Production Checklist

Avant mise en production :

- [ ] Plateforme choisie : Render, Railway, Fly.io ou DigitalOcean App Platform
- [ ] Backend non deploye sur OVH Web mutualise
- [ ] Moto CMS limite au site vitrine et au script widget
- [ ] Variables de production completees sur la plateforme
- [ ] `ADMIN_SESSION_SECRET` unique et long
- [ ] `FIRST_ADMIN_PASSWORD` temporaire et robuste
- [ ] PostgreSQL managé provisionne
- [ ] Sauvegardes PostgreSQL activees
- [ ] Restauration testee sur environnement non critique
- [ ] HTTPS actif via plateforme
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
