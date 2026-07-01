(function () {
  const currentScript = document.currentScript;
  const apiBaseUrl = currentScript?.dataset.apiUrl || 'http://localhost:3000';
  const siteKey = currentScript?.dataset.siteKey || 'demo-site-key';
  const siteId = currentScript?.dataset.siteId || '';
  const siteSlug = currentScript?.dataset.siteSlug || '';
  const anonymousId = getAnonymousId();
  let conversationId = null;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'visitor-os-launcher';
  launcher.textContent = 'Besoin d’aide ?';

  const panel = document.createElement('section');
  panel.className = 'visitor-os-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <header class="visitor-os-header">
      <strong>VISITOR-OS</strong>
      <button type="button" aria-label="Fermer">×</button>
    </header>
    <div class="visitor-os-messages"></div>
    <form class="visitor-os-form">
      <input name="message" autocomplete="off" placeholder="Posez votre question..." />
      <button type="submit">Envoyer</button>
    </form>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .visitor-os-launcher {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483000;
      border: 0;
      border-radius: 999px;
      padding: 12px 16px;
      color: #fff;
      background: #1f6f5b;
      font: 14px system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .18);
    }
    .visitor-os-panel {
      position: fixed;
      right: 20px;
      bottom: 76px;
      z-index: 2147483000;
      width: min(360px, calc(100vw - 32px));
      height: min(520px, calc(100vh - 110px));
      display: grid;
      grid-template-rows: auto 1fr auto;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 50px rgba(0, 0, 0, .2);
      font: 14px system-ui, sans-serif;
    }
    .visitor-os-panel[hidden] {
      display: none;
    }
    .visitor-os-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      color: #fff;
      background: #111827;
    }
    .visitor-os-header button {
      border: 0;
      color: #fff;
      background: transparent;
      font-size: 22px;
      cursor: pointer;
    }
    .visitor-os-messages {
      overflow: auto;
      padding: 14px;
      background: #f9fafb;
    }
    .visitor-os-message {
      margin: 0 0 10px;
      border-radius: 8px;
      padding: 10px 12px;
      background: #fff;
    }
    .visitor-os-message.visitor {
      margin-left: 28px;
      color: #064e3b;
      background: #d1fae5;
    }
    .visitor-os-message.assistant {
      margin-right: 28px;
      color: #111827;
      background: #fff;
    }
    .visitor-os-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .visitor-os-form input {
      min-width: 0;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 10px;
      font: inherit;
    }
    .visitor-os-form button {
      border: 0;
      border-radius: 6px;
      padding: 10px 12px;
      color: #fff;
      background: #1f6f5b;
      font: inherit;
      cursor: pointer;
    }
  `;

  document.head.append(style);
  document.body.append(panel, launcher);

  const messages = panel.querySelector('.visitor-os-messages');
  const form = panel.querySelector('.visitor-os-form');
  const input = form.querySelector('input');

  launcher.addEventListener('click', async () => {
    panel.hidden = false;
    launcher.hidden = true;
    await ensureConversation();
    input.focus();
  });

  panel.querySelector('.visitor-os-header button').addEventListener('click', () => {
    panel.hidden = true;
    launcher.hidden = false;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    addMessage('visitor', content);

    try {
      await ensureConversation();
      const response = await fetch(`${apiBaseUrl}/api/widget/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      addMessage('assistant', data.reply || 'Votre message a bien ete recu.');
    } catch {
      addMessage('assistant', "Le message n'a pas pu etre envoye. Veuillez reessayer.");
    }
  });

  async function ensureConversation() {
    if (conversationId) return;

    const response = await fetch(`${apiBaseUrl}/api/widget/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildSiteReference(),
        anonymousId,
        pageUrl: window.location.href,
        referrer: document.referrer
      })
    });
    const data = await response.json();
    conversationId = data.conversationId;
    addMessage('assistant', 'Bonjour, je peux vous aider. Posez-moi votre question.');
  }

  function buildSiteReference() {
    if (siteId) return { siteId };
    if (siteSlug) return { siteSlug };

    return { siteKey };
  }

  function addMessage(type, content) {
    const message = document.createElement('p');
    message.className = `visitor-os-message ${type}`;
    message.textContent = content;
    messages.append(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function getAnonymousId() {
    const key = 'visitor-os-anonymous-id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    const value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
    return value;
  }
})();
