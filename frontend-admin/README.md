# VISITOR-OS Admin

Minimal web application for VISITOR-OS administrators.

This sprint intentionally covers only:

- JWT login through `POST /login`;
- session restoration and expiration handling;
- protected identity through `GET /me`;
- protected dashboard through `GET /dashboard`;
- API and PostgreSQL status through `/health` and `/ready`.

No CRM, AI or widget feature is implemented in this interface.

It uses Vue 3 from a CDN for this lightweight slice. A dedicated Vue/Vite setup can replace it later when the admin grows.

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

## Test Flow

1. Start the backend.
2. Open the admin dashboard.
3. Log in with the first administrator.
4. Confirm that user, role, organization, API and PostgreSQL status are visible.
5. Log out.
