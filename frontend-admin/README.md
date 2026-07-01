# VISITOR-OS Admin MVP

Minimal dashboard for the first VISITOR-OS MVP.

It is intentionally small:

- list conversations;
- search conversations;
- open a conversation;
- read the full message history;
- see conversation date and status;
- update conversation status;
- see created prospects.

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

## MVP Test Flow

1. Start the backend.
2. Open the widget demo.
3. Send a visitor message.
4. Open the admin dashboard.
5. Search or select the conversation.
6. Read the messages.
7. Change the conversation status.
