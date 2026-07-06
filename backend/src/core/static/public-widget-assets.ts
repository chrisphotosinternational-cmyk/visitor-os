export const publicWidgetJs = String.raw`(function () {
  const currentScript = document.currentScript;
  const scriptUrl = currentScript?.src ? new URL(currentScript.src) : null;
  const apiBaseUrl = currentScript?.dataset.apiUrl || scriptUrl?.origin || 'http://localhost:3000';
  const inferredKey = scriptUrl?.pathname.match(/\/widget\/([^/]+)\.js$/)?.[1] || '';
  const siteKey = currentScript?.dataset.siteKey || inferredKey || 'demo-site-key';
  const siteId = currentScript?.dataset.siteId || '';
  const siteSlug = currentScript?.dataset.siteSlug || '';
  const anonymousId = getAnonymousId();
  let conversationId = null;
  let config = null;
  let leadCaptureVisible = false;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'visitor-os-launcher';
  launcher.textContent = 'Besoin d’aide ?';

  const panel = document.createElement('section');
  panel.className = 'visitor-os-panel';
  panel.hidden = true;
  panel.innerHTML = \`
    <header class="visitor-os-header">
      <strong>VISITOR-OS</strong>
      <button type="button" aria-label="Fermer">×</button>
    </header>
    <div class="visitor-os-messages"></div>
    <form class="visitor-os-lead-form" hidden>
      <input name="name" autocomplete="name" placeholder="Nom" />
      <input name="email" autocomplete="email" placeholder="Email" />
      <input name="phone" autocomplete="tel" placeholder="Téléphone" />
      <input name="need" autocomplete="off" placeholder="Votre besoin" />
      <small class="visitor-os-privacy"></small>
      <button type="submit">Être recontacté</button>
    </form>
    <form class="visitor-os-form">
      <input name="message" autocomplete="off" placeholder="Posez votre question..." />
      <button type="submit">Envoyer</button>
    </form>
  \`;

  const style = document.createElement('style');
  style.textContent = \`
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
      width: min(380px, calc(100vw - 32px));
      height: min(560px, calc(100vh - 110px));
      display: grid;
      grid-template-rows: auto 1fr auto auto;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 50px rgba(0, 0, 0, .2);
      font: 14px system-ui, sans-serif;
    }
    .visitor-os-panel[hidden], .visitor-os-lead-form[hidden] {
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
      white-space: pre-wrap;
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
    .visitor-os-form, .visitor-os-lead-form {
      display: grid;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #e5e7eb;
    }
    .visitor-os-form {
      grid-template-columns: 1fr auto;
    }
    .visitor-os-form input, .visitor-os-lead-form input {
      min-width: 0;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 10px;
      font: inherit;
    }
    .visitor-os-form button, .visitor-os-lead-form button {
      border: 0;
      border-radius: 6px;
      padding: 10px 12px;
      color: #fff;
      background: #1f6f5b;
      font: inherit;
      cursor: pointer;
    }
    .visitor-os-privacy {
      color: #6b7280;
      line-height: 1.4;
    }
    @media (max-width: 520px) {
      .visitor-os-panel {
        inset: 12px;
        width: auto;
        height: auto;
        bottom: 76px;
      }
    }
  \`;

  document.head.append(style);
  document.body.append(panel, launcher);

  const messages = panel.querySelector('.visitor-os-messages');
  const form = panel.querySelector('.visitor-os-form');
  const leadForm = panel.querySelector('.visitor-os-lead-form');
  const privacy = panel.querySelector('.visitor-os-privacy');
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
      const response = await fetch(apiBaseUrl + '/api/widget/conversations/' + conversationId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const data = await response.json();
      addMessage('assistant', data.reply || 'Votre message a bien ete recu.');
      if (data.leadCapture?.enabled) showLeadCapture(data.leadCapture);
    } catch {
      addMessage('assistant', "Le message n'a pas pu etre envoye. Veuillez reessayer.");
    }
  });

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!conversationId) return;
    const formData = new FormData(leadForm);
    const payload = Object.fromEntries(formData.entries());
    try {
      const response = await fetch(apiBaseUrl + '/api/widget/conversations/' + conversationId + '/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      addMessage('assistant', data.message || 'Merci, vos coordonnees ont bien ete transmises.');
      leadForm.hidden = true;
      leadCaptureVisible = false;
    } catch {
      addMessage('assistant', "Vos coordonnees n'ont pas pu etre transmises. Veuillez reessayer.");
    }
  });

  async function ensureConversation() {
    if (conversationId) return;
    if (!config) await loadConfig();

    const response = await fetch(apiBaseUrl + '/api/widget/conversations', {
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
    addMessage('assistant', config?.welcomeMessage || data.message || 'Bonjour, je peux vous aider. Posez-moi votre question.');
  }

  async function loadConfig() {
    const params = new URLSearchParams(buildSiteReference());
    params.set('sourceUrl', window.location.href);
    const response = await fetch(apiBaseUrl + '/api/widget/config?' + params.toString());
    config = response.ok ? await response.json() : null;
    const color = config?.primaryColor || '#1f6f5b';
    launcher.style.background = color;
    panel.querySelector('.visitor-os-header').style.background = color;
    for (const button of panel.querySelectorAll('button')) {
      if (!button.closest('.visitor-os-header')) button.style.background = color;
    }
  }

  function showLeadCapture(leadCapture) {
    if (leadCaptureVisible) return;
    leadCaptureVisible = true;
    privacy.textContent = leadCapture.privacyMessage || config?.privacyMessage || '';
    for (const input of leadForm.querySelectorAll('input')) {
      input.hidden = !leadCapture.fields.includes(input.name);
    }
    leadForm.hidden = false;
  }

  function buildSiteReference() {
    if (siteId) return { siteId };
    if (siteSlug) return { siteSlug };
    return { siteKey };
  }

  function addMessage(type, content) {
    const message = document.createElement('p');
    message.className = 'visitor-os-message ' + type;
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
})();`;
