# KMS Storage For Cloud Deployment

En `v0.12.0-beta-prep`, VISITOR-OS stocke le contenu documentaire exploitable dans PostgreSQL :

- metadonnees document ;
- texte extrait ;
- versions ;
- chunks ;
- index de recherche.

## Fichiers Originaux

Les fichiers originaux importes ne doivent pas etre stockes sur le disque local d'une plateforme cloud.

Pour une future version, utiliser un stockage objet compatible :

- S3 ;
- Cloudflare R2 ;
- DigitalOcean Spaces ;
- Supabase Storage.

## Recommandation Beta

Pour la premiere beta :

- conserver PostgreSQL managé comme source de verite ;
- eviter le stockage disque local ;
- ne pas activer de stockage objet tant que le besoin de conserver les binaires originaux n'est pas confirme.

## Evolution Future

Prevoir une interface :

```text
DocumentStorageProvider
```

Implementations futures :

- `DatabaseOnlyStorage`
- `S3Storage`
- `R2Storage`
- `SpacesStorage`

