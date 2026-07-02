import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';

const API_BASE_URL = window.VISITOR_OS_API_URL ?? 'http://localhost:3000';
const TOKEN_STORAGE_KEY = 'visitor_os_admin_jwt';

createApp({
  data() {
    return {
      apiBaseUrl: API_BASE_URL,
      route: 'login',
      token: '',
      tokenExpiresAt: null,
      loginForm: {
        email: '',
        password: ''
      },
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
    isAuthenticated() {
      return Boolean(this.token && this.user && !this.isTokenExpired());
    },

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

      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(this.tokenExpiresAt));
    }
  },

  async mounted() {
    this.restoreSession();
    await this.refreshTechnicalStatus();

    if (this.token && !this.isTokenExpired()) {
      await this.loadAuthenticatedState();
    } else {
      this.logout(false);
    }
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

        if (!response.ok) {
          throw new Error('Email ou mot de passe incorrect.');
        }

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
      if (callApi && this.token) {
        void this.apiRequest('/logout', { method: 'POST', authenticated: true });
      }

      this.token = '';
      this.tokenExpiresAt = null;
      this.user = null;
      this.dashboard = null;
      this.route = 'login';
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);

      if (this.sessionTimer) {
        window.clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }
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

        if (!meResponse.ok || !dashboardResponse.ok) {
          throw new Error('Session expiree ou invalide.');
        }

        const me = await meResponse.json();
        this.dashboard = await dashboardResponse.json();
        this.user = {
          ...me.user,
          ...(this.user ?? {})
        };
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
      }, 10_000);
    },

    apiRequest(path, options = {}) {
      const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.authenticated ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(options.headers ?? {})
      };

      return fetch(`${this.apiBaseUrl}${path}`, {
        ...options,
        headers
      });
    }
  },

  template: `
    <section v-if="route === 'login'" class="login-shell">
      <form class="login-panel" @submit.prevent="login">
        <div class="brand-mark">VISITOR-OS</div>
        <div>
          <h1>Connexion admin</h1>
          <p>Accedez au tableau de bord de votre plateforme.</p>
        </div>

        <label>
          <span>Email</span>
          <input v-model.trim="loginForm.email" type="email" autocomplete="email" required />
        </label>

        <label>
          <span>Mot de passe</span>
          <input
            v-model="loginForm.password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>

        <p v-if="error" class="error-message">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Connexion...' : 'Connexion' }}
        </button>

        <dl class="status-strip">
          <div>
            <dt>API</dt>
            <dd>{{ apiStatus }}</dd>
          </div>
          <div>
            <dt>PostgreSQL</dt>
            <dd>{{ databaseStatus }}</dd>
          </div>
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
          <div>
            <p class="eyebrow">Administration</p>
            <h1>Dashboard</h1>
          </div>
          <div class="topbar-actions">
            <span class="user-chip">{{ userName }}</span>
            <button type="button" @click="logout()">Deconnexion</button>
          </div>
        </header>

        <p v-if="error" class="error-message">{{ error }}</p>

        <section class="dashboard-grid" aria-label="Etat general">
          <article class="metric">
            <span>Utilisateur</span>
            <strong>{{ userName }}</strong>
            <small>{{ user?.email }}</small>
          </article>

          <article class="metric">
            <span>Role</span>
            <strong>{{ user?.role }}</strong>
            <small>Acces protege par JWT</small>
          </article>

          <article class="metric">
            <span>Organisation</span>
            <strong>{{ user?.organizationId }}</strong>
            <small>Isolation preparee cote API</small>
          </article>

          <article class="metric">
            <span>API</span>
            <strong>{{ apiStatus }}</strong>
            <small>{{ apiBaseUrl }}</small>
          </article>

          <article class="metric">
            <span>PostgreSQL</span>
            <strong>{{ databaseStatus }}</strong>
            <small>/ready</small>
          </article>

          <article class="metric">
            <span>Session</span>
            <strong>Active</strong>
            <small>Expire le {{ formattedExpiration }}</small>
          </article>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>Base applicative</h2>
            <button type="button" @click="refreshTechnicalStatus">Rafraichir</button>
          </div>
          <div class="module-grid">
            <article>
              <h3>Navigation</h3>
              <p>Structure prete pour les futurs modules admin.</p>
            </article>
            <article>
              <h3>Protection</h3>
              <p>Les routes admin affichent le dashboard seulement avec un JWT valide.</p>
            </article>
            <article>
              <h3>API</h3>
              <p>Endpoints utilises : /login, /me, /dashboard, /health, /ready.</p>
            </article>
          </div>
        </section>
      </main>
    </section>
  `
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
