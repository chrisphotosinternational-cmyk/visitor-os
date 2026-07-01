# VISITOR-OS Admin MVP

Minimal admin interface for the first VISITOR-OS vertical slice.

This is intentionally small:

- list prospects;
- open a prospect;
- read the full conversation;
- update the prospect status.

It uses Vue 3 from a CDN for this MVP slice. A dedicated Vue/Vite setup can replace it later when the admin grows.

## Run locally

Serve this folder with any static file server, then open `index.html`.

The admin calls the backend at:

```text
http://localhost:3000
```

Override it before loading `app.js` if needed:

```html
<script>
  window.VISITOR_OS_API_URL = 'https://your-api.example.com';
</script>
```
