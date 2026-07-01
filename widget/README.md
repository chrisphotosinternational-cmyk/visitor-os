# VISITOR-OS Widget MVP

Minimal embeddable widget for the first vertical slice.

It can be installed on a Moto CMS page with:

```html
<script
  src="https://your-cdn.example.com/visitor-os-widget.js"
  data-api-url="https://your-api.example.com"
  data-site-key="demo-site-key"
></script>
```

Local demo:

1. Start the backend.
2. Serve the `widget` folder statically.
3. Open `demo.html`.

This MVP widget:

- opens and closes;
- starts a conversation;
- sends a visitor message;
- displays the backend temporary response;
- creates a prospect through the backend.

It does not include AI, authentication, attachments, or advanced configuration yet.
