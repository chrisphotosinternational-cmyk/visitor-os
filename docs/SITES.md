# Sites

## Role

A site belongs to one organization and points to one business configuration.

```text
Organization -> Sites -> Business Configuration -> Widget -> Conversations -> Prospects
```

## Fields

- `id`
- `organization_id`
- `name`
- `slug`
- `domain`
- `widget_public_key`
- `business_config_id`
- `language`
- `status`
- `widget_enabled`

The legacy `activity` column is kept only as a compatibility alias for `business_config_id` during the migration period.

## Widget Resolution

The widget can identify a site through:

- `siteId`
- `siteSlug`
- `siteKey`

`siteKey` remains supported for the current demo and Moto CMS integration.

