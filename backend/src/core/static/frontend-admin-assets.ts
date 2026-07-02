export const adminIndexHtml = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Connexion admin VISITOR-OS" />
    <title>VISITOR-OS Admin</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/config.js"></script>
    <script type="module" src="/app.js"></script>
  </body>
</html>
`;

export const adminConfigJs = `window.VISITOR_OS_API_URL = window.VISITOR_OS_API_URL ?? window.location.origin;
`;

export const adminAppJs = `import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';

const API_BASE_URL = window.VISITOR_OS_API_URL ?? window.location.origin;
const TOKEN_STORAGE_KEY = 'visitor_os_admin_jwt';

createApp({
  data() {
    return {
      apiBaseUrl: API_BASE_URL,
      route: 'login',
      token: '',
      tokenExpiresAt: null,
      loginForm: { email: '', password: '' },
      user: null,
      dashboard: null,
      health: null,
      ready: null,
      loading: false,
      error: '',
      sessionTimer: null
    };
  },
  computed: {
    userName() {
      if (!this.user) return 'Administrateur';
      return [this.user.firstName, this.user.lastName].filter(Boolean).join(' ') || this.user.email;
    },
    apiStatus() {
      return this.health?.status ?? 'unknown';
    },
    databaseStatus() {
      return this.ready?.database ?? 'unknown';
    },
    formattedExpiration() {
      if (!this.tokenExpiresAt) return 'Session active';
      return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(this.tokenExpiresAt));
    }
  },
  async mounted() {
    this.restoreSession();
    await this.refreshTechnicalStatus();
    if (this.token && !this.isTokenExpired()) await this.loadAuthenticatedState();
    else this.logout(false);
  },
  beforeUnmount() {
    if (this.sessionTimer) window.clearInterval(this.sessionTimer);
  },
  methods: {
    async login() {
      this.loading = true;
      this.error = '';
      try {
        const response = await this.apiRequest('/login', {
          method: 'POST',
          body: JSON.stringify(this.loginForm)
        });
        if (!response.ok) throw new Error('Email ou mot de passe incorrect.');
        const data = await response.json();
        this.setToken(data.token);
        this.user = data.user;
        this.loginForm.password = '';
        await this.loadAuthenticatedState();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Connexion impossible.';
      } finally {
        this.loading = false;
      }
    },
    logout(callApi = true) {
      if (callApi && this.token) void this.apiRequest('/logout', { method: 'POST', authenticated: true });
      this.token = '';
      this.tokenExpiresAt = null;
      this.user = null;
      this.dashboard = null;
      this.route = 'login';
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      if (this.sessionTimer) window.clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    },
    async loadAuthenticatedState() {
      if (!this.token || this.isTokenExpired()) {
        this.logout(false);
        return;
      }
      this.loading = true;
      this.error = '';
      try {
        const [meResponse, dashboardResponse] = await Promise.all([
          this.apiRequest('/me', { authenticated: true }),
          this.apiRequest('/dashboard', { authenticated: true })
        ]);
        if (!meResponse.ok || !dashboardResponse.ok) throw new Error('Session expiree ou invalide.');
        const me = await meResponse.json();
        this.dashboard = await dashboardResponse.json();
        this.user = { ...(this.user ?? {}), ...me.user };
        this.route = 'dashboard';
        this.startSessionWatcher();
        await this.refreshTechnicalStatus();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Session invalide.';
        this.logout(false);
      } finally {
        this.loading = false;
      }
    },
    async refreshTechnicalStatus() {
      const [health, ready] = await Promise.allSettled([
        this.apiRequest('/health'),
        this.apiRequest('/ready')
      ]);
      this.health = await responseJsonOrFallback(health, { status: 'unreachable' });
      this.ready = await responseJsonOrFallback(ready, { status: 'unreachable', database: 'unknown' });
    },
    setToken(token) {
      this.token = token;
      this.tokenExpiresAt = extractTokenExpiration(token);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    },
    restoreSession() {
      const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) return;
      this.token = token;
      this.tokenExpiresAt = extractTokenExpiration(token);
    },
    isTokenExpired() {
      return Boolean(this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt);
    },
    startSessionWatcher() {
      if (this.sessionTimer) window.clearInterval(this.sessionTimer);
      this.sessionTimer = window.setInterval(() => {
        if (this.isTokenExpired()) {
          this.error = 'Session expiree. Merci de vous reconnecter.';
          this.logout(false);
        }
      }, 10000);
    },
    apiRequest(path, options = {}) {
      const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.authenticated ? { Authorization: \`Bearer \${this.token}\` } : {}),
        ...(options.headers ?? {})
      };
      return fetch(\`\${this.apiBaseUrl}\${path}\`, { ...options, headers });
    }
  },
  template: \`
    <section v-if="route === 'login'" class="login-shell">
      <form class="login-panel" @submit.prevent="login">
        <div class="brand-mark">VISITOR-OS</div>
        <div>
          <h1>Connexion admin</h1>
          <p>Accedez au tableau de bord de votre plateforme.</p>
        </div>
        <label><span>Email</span><input v-model.trim="loginForm.email" type="email" autocomplete="email" required /></label>
        <label><span>Mot de passe</span><input v-model="loginForm.password" type="password" autocomplete="current-password" required /></label>
        <p v-if="error" class="error-message">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? 'Connexion...' : 'Connexion' }}</button>
        <dl class="status-strip">
          <div><dt>API</dt><dd>{{ apiStatus }}</dd></div>
          <div><dt>PostgreSQL</dt><dd>{{ databaseStatus }}</dd></div>
        </dl>
      </form>
    </section>
    <section v-else class="app-shell">
      <aside class="sidebar" aria-label="Navigation principale">
        <div class="sidebar-brand">VISITOR-OS</div>
        <nav>
          <button class="nav-item active" type="button">Dashboard</button>
          <button class="nav-item" type="button" disabled>Conversations</button>
          <button class="nav-item" type="button" disabled>CRM</button>
          <button class="nav-item" type="button" disabled>Knowledge</button>
          <button class="nav-item" type="button" disabled>Parametres</button>
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <div><p class="eyebrow">Administration</p><h1>Dashboard</h1></div>
          <div class="topbar-actions"><span class="user-chip">{{ userName }}</span><button type="button" @click="logout()">Deconnexion</button></div>
        </header>
        <p v-if="error" class="error-message">{{ error }}</p>
        <section class="dashboard-grid" aria-label="Etat general">
          <article class="metric"><span>Utilisateur</span><strong>{{ userName }}</strong><small>{{ user?.email }}</small></article>
          <article class="metric"><span>Role</span><strong>{{ user?.role }}</strong><small>Acces protege par JWT</small></article>
          <article class="metric"><span>Organisation</span><strong>{{ user?.organizationId }}</strong><small>Isolation preparee cote API</small></article>
          <article class="metric"><span>API</span><strong>{{ apiStatus }}</strong><small>{{ apiBaseUrl }}</small></article>
          <article class="metric"><span>PostgreSQL</span><strong>{{ databaseStatus }}</strong><small>/ready</small></article>
          <article class="metric"><span>Session</span><strong>Active</strong><small>Expire le {{ formattedExpiration }}</small></article>
        </section>
      </main>
    </section>\`
}).mount('#app');

async function responseJsonOrFallback(result, fallback) {
  if (result.status !== 'fulfilled' || !result.value.ok) return fallback;
  return result.value.json();
}

function extractTokenExpiration(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const parsed = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof parsed.exp !== 'number') return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}
`;

export const adminStylesCss = `:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #172033;
  background: #f5f7fa;
}
* { box-sizing: border-box; }
body { min-width: 320px; margin: 0; }
button, input { font: inherit; }
button {
  min-height: 40px;
  border: 0;
  border-radius: 6px;
  padding: 10px 14px;
  color: #fff;
  background: #166a5b;
  cursor: pointer;
}
button:hover { background: #10574b; }
button:disabled { color: #8b95a7; background: #e6eaf0; cursor: not-allowed; }
.login-shell {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: #f5f7fa;
}
.login-panel {
  display: grid;
  width: min(100%, 420px);
  gap: 16px;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 28px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(23, 32, 51, 0.08);
}
.brand-mark, .sidebar-brand { font-weight: 800; letter-spacing: 0; }
.brand-mark { color: #166a5b; }
.login-panel h1, .login-panel p, .topbar h1, .topbar p, .metric strong, .metric small { margin: 0; }
.login-panel p, .eyebrow, .metric span, .metric small { color: #647084; }
.login-panel label { display: grid; gap: 7px; color: #354157; font-weight: 600; }
.login-panel input {
  width: 100%;
  min-height: 42px;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  padding: 10px 12px;
}
.login-panel input:focus { outline: 3px solid rgba(22, 106, 91, 0.18); border-color: #166a5b; }
.error-message {
  border: 1px solid #fecaca;
  border-radius: 6px;
  margin: 0;
  padding: 10px 12px;
  color: #991b1b;
  background: #fff1f2;
}
.status-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 4px 0 0; }
.status-strip div { border: 1px solid #e4e9f0; border-radius: 6px; padding: 10px; background: #f8fafc; }
.status-strip dt { color: #647084; font-size: 12px; }
.status-strip dd { margin: 3px 0 0; font-weight: 700; }
.app-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
.sidebar { display: flex; flex-direction: column; gap: 24px; padding: 24px; color: #fff; background: #172033; }
.sidebar nav { display: grid; gap: 8px; }
.nav-item { justify-content: flex-start; width: 100%; border: 1px solid transparent; color: #d9e1ee; background: transparent; text-align: left; }
.nav-item:hover, .nav-item.active { color: #fff; background: rgba(255, 255, 255, 0.1); }
.nav-item:disabled { color: #8c96a7; background: transparent; }
.content { min-width: 0; padding: 24px; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.eyebrow { margin-bottom: 4px; font-size: 13px; font-weight: 700; text-transform: uppercase; }
.topbar-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.user-chip {
  max-width: 260px;
  overflow: hidden;
  border: 1px solid #d9e1ec;
  border-radius: 999px;
  padding: 9px 12px;
  color: #354157;
  background: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dashboard-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.metric {
  display: grid;
  gap: 7px;
  min-width: 0;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 18px;
  background: #fff;
}
.metric strong { overflow-wrap: anywhere; font-size: 22px; }
.metric small { overflow-wrap: anywhere; }
@media (max-width: 980px) {
  .app-shell { grid-template-columns: 190px minmax(0, 1fr); }
  .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { padding: 16px; }
  .sidebar nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content { padding: 16px; }
  .topbar { align-items: flex-start; flex-direction: column; }
  .topbar-actions { width: 100%; justify-content: space-between; }
  .dashboard-grid, .status-strip { grid-template-columns: 1fr; }
}
`;
