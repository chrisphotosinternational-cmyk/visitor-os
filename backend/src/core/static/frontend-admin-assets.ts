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
      route: normalizeRoute(window.location.pathname),
      token: '',
      tokenExpiresAt: null,
      loginForm: { email: '', password: '' },
      user: null,
      dashboard: null,
      health: null,
      ready: null,
      organizations: [],
      organizationStatuses: [],
      organizationSearch: '',
      organizationForm: emptyOrganizationForm(),
      users: [],
      userRoles: [],
      userStatuses: [],
      userSearch: '',
      userForm: emptyUserForm(),
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
    },
    canWriteOrganizations() {
      return this.user?.role === 'SuperAdmin';
    },
    canWriteUsers() {
      return ['SuperAdmin', 'Admin'].includes(this.user?.role);
    }
  },
  async mounted() {
    window.addEventListener('popstate', this.syncRouteFromLocation);
    this.restoreSession();
    await this.refreshTechnicalStatus();
    if (this.token && !this.isTokenExpired()) await this.loadAuthenticatedState();
    else this.logout(false);
  },
  beforeUnmount() {
    window.removeEventListener('popstate', this.syncRouteFromLocation);
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
      this.organizations = [];
      this.users = [];
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
        if (this.route === 'login') this.navigate('dashboard');
        this.startSessionWatcher();
        await Promise.all([this.refreshTechnicalStatus(), this.loadOrganizations(), this.loadUsers()]);
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
    async loadOrganizations() {
      if (!this.token) return;
      const query = this.organizationSearch ? '?search=' + encodeURIComponent(this.organizationSearch) : '';
      const response = await this.apiRequest('/admin-api/organizations' + query, { authenticated: true });
      if (!response.ok) throw new Error('Chargement des organisations impossible.');
      const data = await response.json();
      this.organizations = data.organizations;
      this.organizationStatuses = data.statuses;
    },
    async saveOrganization() {
      if (!this.canWriteOrganizations) return;
      const editing = Boolean(this.organizationForm.id);
      const response = await this.apiRequest(
        editing ? '/admin-api/organizations/' + this.organizationForm.id : '/admin-api/organizations',
        {
          method: editing ? 'PUT' : 'POST',
          authenticated: true,
          body: JSON.stringify(this.organizationForm)
        }
      );
      if (!response.ok) throw new Error('Enregistrement organisation impossible.');
      this.organizationForm = emptyOrganizationForm();
      await Promise.all([this.loadOrganizations(), this.refreshDashboard()]);
    },
    editOrganization(organization) {
      this.organizationForm = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        email: organization.email ?? '',
        phone: organization.phone ?? '',
        country: organization.country ?? 'FR',
        language: organization.language ?? 'fr',
        timezone: organization.timezone ?? 'Europe/Paris',
        currency: organization.currency ?? 'EUR',
        status: organization.status ?? 'active',
        plan: organization.plan ?? ''
      };
    },
    async disableOrganization(organization) {
      await this.updateOrganizationStatus(organization, 'inactive');
    },
    async deleteOrganization(organization) {
      const response = await this.apiRequest('/admin-api/organizations/' + organization.id, {
        method: 'DELETE',
        authenticated: true
      });
      if (!response.ok) throw new Error('Suppression logique impossible.');
      await Promise.all([this.loadOrganizations(), this.refreshDashboard()]);
    },
    async updateOrganizationStatus(organization, status) {
      const response = await this.apiRequest('/admin-api/organizations/' + organization.id + '/status', {
        method: 'PATCH',
        authenticated: true,
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Changement de statut impossible.');
      await Promise.all([this.loadOrganizations(), this.refreshDashboard()]);
    },
    async loadUsers() {
      if (!this.token) return;
      const query = this.userSearch ? '?search=' + encodeURIComponent(this.userSearch) : '';
      const response = await this.apiRequest('/admin-api/users' + query, { authenticated: true });
      if (!response.ok) throw new Error('Chargement des utilisateurs impossible.');
      const data = await response.json();
      this.users = data.users;
      this.userRoles = data.roles;
      this.userStatuses = data.statuses;
      if (!this.userForm.organizationId && this.user?.organizationId) {
        this.userForm.organizationId = this.user.organizationId;
      }
    },
    async saveUser() {
      if (!this.canWriteUsers) return;
      const editing = Boolean(this.userForm.id);
      const payload = { ...this.userForm };
      if (editing && !payload.password) delete payload.password;
      const response = await this.apiRequest(
        editing ? '/admin-api/users/' + this.userForm.id : '/admin-api/users',
        {
          method: editing ? 'PUT' : 'POST',
          authenticated: true,
          body: JSON.stringify(payload)
        }
      );
      if (!response.ok) throw new Error('Enregistrement utilisateur impossible.');
      this.userForm = emptyUserForm(this.user?.organizationId);
      await Promise.all([this.loadUsers(), this.refreshDashboard()]);
    },
    editUser(user) {
      this.userForm = {
        id: user.id,
        organizationId: user.organizationId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: '',
        role: user.role,
        status: user.status
      };
    },
    async disableUser(user) {
      const response = await this.apiRequest('/admin-api/users/' + user.id + '/status', {
        method: 'PATCH',
        authenticated: true,
        body: JSON.stringify({ status: 'inactive' })
      });
      if (!response.ok) throw new Error('Desactivation utilisateur impossible.');
      await Promise.all([this.loadUsers(), this.refreshDashboard()]);
    },
    async refreshDashboard() {
      const response = await this.apiRequest('/dashboard', { authenticated: true });
      if (response.ok) this.dashboard = await response.json();
    },
    navigate(route) {
      this.route = route;
      const path = route === 'dashboard' ? '/' : '/' + route;
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
    },
    syncRouteFromLocation() {
      this.route = normalizeRoute(window.location.pathname);
    },
    routeTitle(route) {
      return routeTitle(route);
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
        ...(options.authenticated ? { Authorization: 'Bearer ' + this.token } : {}),
        ...(options.headers ?? {})
      };
      return fetch(this.apiBaseUrl + path, { ...options, headers });
    }
  },
  template: \`
    <section v-if="route === 'login' || !user" class="login-shell">
      <form class="login-panel" @submit.prevent="login">
        <div class="brand-mark">VISITOR-OS</div>
        <div><h1>Connexion admin</h1><p>Accedez au tableau de bord de votre plateforme.</p></div>
        <label><span>Email</span><input v-model.trim="loginForm.email" type="email" autocomplete="email" required /></label>
        <label><span>Mot de passe</span><input v-model="loginForm.password" type="password" autocomplete="current-password" required /></label>
        <p v-if="error" class="error-message">{{ error }}</p>
        <button type="submit" :disabled="loading">{{ loading ? 'Connexion...' : 'Connexion' }}</button>
        <dl class="status-strip"><div><dt>API</dt><dd>{{ apiStatus }}</dd></div><div><dt>PostgreSQL</dt><dd>{{ databaseStatus }}</dd></div></dl>
      </form>
    </section>
    <section v-else class="app-shell">
      <aside class="sidebar" aria-label="Navigation principale">
        <div class="sidebar-brand">VISITOR-OS</div>
        <nav>
          <button :class="['nav-item', { active: route === 'dashboard' }]" type="button" @click="navigate('dashboard')">Dashboard</button>
          <button :class="['nav-item', { active: route === 'organizations' }]" type="button" @click="navigate('organizations')">Organisations</button>
          <button :class="['nav-item', { active: route === 'users' }]" type="button" @click="navigate('users')">Utilisateurs</button>
          <button :class="['nav-item', { active: route === 'settings' }]" type="button" @click="navigate('settings')">Parametres</button>
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <div><p class="eyebrow">Administration</p><h1>{{ routeTitle(route) }}</h1></div>
          <div class="topbar-actions"><span class="user-chip">{{ userName }}</span><button type="button" @click="logout()">Deconnexion</button></div>
        </header>
        <p v-if="error" class="error-message">{{ error }}</p>

        <section v-if="route === 'dashboard'" class="dashboard-grid" aria-label="Etat general">
          <article class="metric"><span>Organisations</span><strong>{{ dashboard?.organizationsCount ?? 0 }}</strong><small>PostgreSQL</small></article>
          <article class="metric"><span>Utilisateurs</span><strong>{{ dashboard?.usersCount ?? 0 }}</strong><small>PostgreSQL</small></article>
          <article class="metric"><span>Role</span><strong>{{ user?.role }}</strong><small>{{ user?.email }}</small></article>
          <article class="metric"><span>Organisation</span><strong>{{ user?.organizationId }}</strong><small>Contexte actif</small></article>
          <article class="metric"><span>API</span><strong>{{ apiStatus }}</strong><small>{{ apiBaseUrl }}</small></article>
          <article class="metric"><span>PostgreSQL</span><strong>{{ databaseStatus }}</strong><small>/ready</small></article>
        </section>

        <section v-if="route === 'organizations'" class="panel">
          <div class="panel-header"><h2>Organisations</h2><input v-model="organizationSearch" @input="loadOrganizations" placeholder="Rechercher" /></div>
          <form v-if="canWriteOrganizations" class="admin-form" @submit.prevent="saveOrganization">
            <input v-model="organizationForm.name" placeholder="Nom" required />
            <input v-model="organizationForm.slug" placeholder="Slug" required />
            <input v-model="organizationForm.email" placeholder="Email" type="email" />
            <input v-model="organizationForm.phone" placeholder="Telephone" />
            <select v-model="organizationForm.status"><option v-for="status in organizationStatuses" :key="status" :value="status">{{ status }}</option></select>
            <button type="submit">{{ organizationForm.id ? 'Modifier' : 'Creer' }}</button>
          </form>
          <div class="table-wrap">
            <table><thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Plan</th><th></th></tr></thead>
              <tbody><tr v-for="organization in organizations" :key="organization.id">
                <td><strong>{{ organization.name }}</strong><small>{{ organization.slug }}</small></td>
                <td>{{ organization.email || '-' }}</td>
                <td><span class="badge">{{ organization.status }}</span></td>
                <td>{{ organization.plan || '-' }}</td>
                <td class="actions"><button v-if="canWriteOrganizations" type="button" @click="editOrganization(organization)">Modifier</button><button v-if="canWriteOrganizations" type="button" @click="disableOrganization(organization)">Desactiver</button><button v-if="canWriteOrganizations" type="button" @click="deleteOrganization(organization)">Supprimer</button></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'users'" class="panel">
          <div class="panel-header"><h2>Utilisateurs</h2><input v-model="userSearch" @input="loadUsers" placeholder="Rechercher" /></div>
          <form v-if="canWriteUsers" class="admin-form" @submit.prevent="saveUser">
            <input v-model="userForm.firstName" placeholder="Prenom" required />
            <input v-model="userForm.lastName" placeholder="Nom" required />
            <input v-model="userForm.email" placeholder="Email" type="email" required />
            <input v-model="userForm.password" placeholder="Mot de passe" type="password" :required="!userForm.id" />
            <select v-model="userForm.organizationId" required>
              <option value="" disabled>Organisation</option>
              <option v-for="organization in organizations" :key="organization.id" :value="organization.id">{{ organization.name }}</option>
            </select>
            <select v-model="userForm.role"><option v-for="role in userRoles" :key="role" :value="role">{{ role }}</option></select>
            <select v-model="userForm.status"><option v-for="status in userStatuses" :key="status" :value="status">{{ status }}</option></select>
            <button type="submit">{{ userForm.id ? 'Modifier' : 'Creer' }}</button>
          </form>
          <div class="table-wrap">
            <table><thead><tr><th>Utilisateur</th><th>Email</th><th>Role</th><th>Statut</th><th></th></tr></thead>
              <tbody><tr v-for="item in users" :key="item.id">
                <td><strong>{{ item.firstName }} {{ item.lastName }}</strong><small>{{ item.organizationId }}</small></td>
                <td>{{ item.email }}</td>
                <td><span class="badge">{{ item.role }}</span></td>
                <td>{{ item.status }}</td>
                <td class="actions"><button v-if="canWriteUsers" type="button" @click="editUser(item)">Modifier</button><button v-if="canWriteUsers" type="button" @click="disableUser(item)">Desactiver</button></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'settings'" class="panel empty-panel">
          <h2>Parametres</h2>
          <p>Socle pret pour les prochains reglages administrateur.</p>
        </section>
      </main>
    </section>\`
}).mount('#app');

function normalizeRoute(pathname) {
  if (pathname === '/organizations') return 'organizations';
  if (pathname === '/users') return 'users';
  if (pathname === '/settings') return 'settings';
  return 'dashboard';
}

function routeTitle(route) {
  return { dashboard: 'Dashboard', organizations: 'Organisations', users: 'Utilisateurs', settings: 'Parametres' }[route] ?? 'Dashboard';
}

function emptyOrganizationForm() {
  return { id: '', name: '', slug: '', email: '', phone: '', country: 'FR', language: 'fr', timezone: 'Europe/Paris', currency: 'EUR', status: 'active', plan: '' };
}

function emptyUserForm(organizationId = '') {
  return { id: '', organizationId, firstName: '', lastName: '', email: '', password: '', role: 'Viewer', status: 'active' };
}

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
button, input, select { font: inherit; }
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
.login-shell { display: grid; min-height: 100vh; place-items: center; padding: 24px; background: #f5f7fa; }
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
h1, h2, p, .metric strong, .metric small { margin: 0; }
.login-panel p, .eyebrow, .metric span, .metric small, td small { color: #647084; }
.login-panel label { display: grid; gap: 7px; color: #354157; font-weight: 600; }
.login-panel input, .admin-form input, .admin-form select, .panel-header input {
  width: 100%;
  min-height: 42px;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
input:focus, select:focus { outline: 3px solid rgba(22, 106, 91, 0.18); border-color: #166a5b; }
.error-message { border: 1px solid #fecaca; border-radius: 6px; margin: 0 0 14px; padding: 10px 12px; color: #991b1b; background: #fff1f2; }
.status-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 4px 0 0; }
.status-strip div { border: 1px solid #e4e9f0; border-radius: 6px; padding: 10px; background: #f8fafc; }
.status-strip dt { color: #647084; font-size: 12px; }
.status-strip dd { margin: 3px 0 0; font-weight: 700; }
.app-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
.sidebar { display: flex; flex-direction: column; gap: 24px; padding: 24px; color: #fff; background: #172033; }
.sidebar nav { display: grid; gap: 8px; }
.nav-item { justify-content: flex-start; width: 100%; border: 1px solid transparent; color: #d9e1ee; background: transparent; text-align: left; }
.nav-item:hover, .nav-item.active { color: #fff; background: rgba(255, 255, 255, 0.1); }
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
.metric, .panel { border: 1px solid #dfe5ee; border-radius: 8px; background: #fff; }
.metric { display: grid; gap: 7px; min-width: 0; padding: 18px; }
.metric strong { overflow-wrap: anywhere; font-size: 22px; }
.metric small { overflow-wrap: anywhere; }
.panel { overflow: hidden; }
.panel-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e6ebf2; padding: 18px; }
.panel-header input { max-width: 320px; }
.admin-form { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; padding: 18px; border-bottom: 1px solid #e6ebf2; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #edf1f6; padding: 12px 18px; text-align: left; vertical-align: top; }
th { color: #647084; font-size: 13px; font-weight: 700; }
td strong, td small { display: block; }
.badge { display: inline-flex; border-radius: 999px; padding: 4px 8px; color: #075e51; background: #dff8ef; font-size: 12px; font-weight: 700; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.actions button { min-height: 32px; padding: 7px 9px; font-size: 13px; }
.empty-panel { display: grid; gap: 8px; padding: 18px; }
@media (max-width: 1180px) {
  .admin-form { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 980px) {
  .app-shell { grid-template-columns: 190px minmax(0, 1fr); }
  .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { padding: 16px; }
  .sidebar nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .content { padding: 16px; }
  .topbar, .panel-header { align-items: flex-start; flex-direction: column; }
  .topbar-actions, .panel-header input { width: 100%; max-width: none; }
  .dashboard-grid, .status-strip, .admin-form { grid-template-columns: 1fr; }
}
`;
