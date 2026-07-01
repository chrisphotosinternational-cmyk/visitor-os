import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';

const API_BASE_URL = window.VISITOR_OS_API_URL ?? 'http://localhost:3000';

function apiFetch(url, options = {}) {
  return fetch(url, {
    credentials: 'include',
    ...options
  });
}

createApp({
  data() {
    return {
      authenticated: false,
      currentUser: null,
      permissions: [],
      loginForm: {
        email: '',
        password: ''
      },
      conversations: [],
      conversationStatuses: [],
      selectedConversation: null,
      prospects: [],
      organizations: [],
      sites: [],
      configs: [],
      selectedConfigId: '',
      selectedConfig: null,
      configText: '',
      configPrompt: '',
      configHistory: [],
      aiProviders: [],
      aiConfig: {
        provider: 'mock',
        model: 'mock-conversational-v1',
        temperature: 0.2,
        maxTokens: 600,
        topP: 1,
        timeoutMs: 8000,
        language: 'fr',
        systemPrompt: '',
        enabled: true,
        futureCostLimit: null
      },
      aiTestQuestion: 'Bonjour, pouvez-vous aider un visiteur ?',
      aiTestResult: null,
      aiCostEstimates: null,
      organizationForm: {
        id: '',
        name: '',
        slug: '',
        email: '',
        phone: '',
        country: 'FR',
        language: 'fr',
        timezone: 'Europe/Paris',
        currency: 'EUR',
        status: 'active',
        plan: ''
      },
      siteForm: {
        id: '',
        organizationId: '',
        name: '',
        slug: '',
        domain: '',
        businessConfigId: 'default',
        language: 'fr',
        status: 'active',
        widgetEnabled: true
      },
      search: '',
      loading: true,
      configLoading: false,
      error: ''
    };
  },

  computed: {
    openConversationsCount() {
      return this.conversations.filter((conversation) => conversation.status === 'open').length;
    }
  },

  async mounted() {
    await this.checkSession();
  },

  methods: {
    async checkSession() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/auth/me`);
        if (!response.ok) {
          this.authenticated = false;
          return;
        }
        const data = await response.json();
        this.authenticated = true;
        this.currentUser = data.user;
        this.permissions = data.permissions;
        await this.refreshDashboard();
      } catch {
        this.authenticated = false;
      }
    },

    async login() {
      this.error = '';

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.loginForm)
        });
        if (!response.ok) throw new Error('Identifiants invalides.');
        const data = await response.json();
        this.authenticated = true;
        this.currentUser = data.user;
        this.permissions = data.permissions;
        this.loginForm.password = '';
        await this.refreshDashboard();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async logout() {
      await apiFetch(`${API_BASE_URL}/api/admin/auth/logout`, { method: 'POST' });
      this.authenticated = false;
      this.currentUser = null;
      this.permissions = [];
      this.selectedConversation = null;
    },

    async refreshDashboard() {
      this.loading = true;
      this.error = '';

      try {
        await Promise.all([
          this.loadConversations(),
          this.loadProspects(),
          this.loadConfigs(),
          this.loadAiConfig(),
          this.loadOrganizations(),
          this.loadSites()
        ]);
      } finally {
        this.loading = false;
      }
    },

    async loadConversations() {
      const params = new URLSearchParams();
      if (this.search.trim()) params.set('search', this.search.trim());

      const response = await apiFetch(`${API_BASE_URL}/api/admin/conversations?${params.toString()}`);
      if (!response.ok) throw new Error('Impossible de charger les conversations.');
      const data = await response.json();
      this.conversations = data.conversations;
      this.conversationStatuses = data.statuses;

      if (!this.selectedConversation && this.conversations.length > 0) {
        await this.selectConversation(this.conversations[0].id);
      }
    },

    async loadProspects() {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/prospects`);
      if (!response.ok) throw new Error('Impossible de charger les prospects.');
      const data = await response.json();
      this.prospects = data.prospects;
    },

    async loadConfigs() {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/configs`);
      if (!response.ok) throw new Error('Impossible de charger les configurations.');
      const data = await response.json();
      this.configs = data.configs;

      if (!this.selectedConfigId && this.configs.length > 0) {
        await this.selectConfig(this.configs[0].id);
      }
    },

    async loadAiConfig() {
      if (!this.can('settings:access')) return;

      const response = await apiFetch(`${API_BASE_URL}/api/admin/ai/config`);
      if (!response.ok) throw new Error('Impossible de charger la configuration IA.');
      const data = await response.json();
      this.aiProviders = data.providers;
      this.aiConfig = data.configuration;
      this.aiCostEstimates = data.estimates;
    },

    async saveAiConfig() {
      this.error = '';

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/ai/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.aiConfig)
        });
        if (!response.ok) throw new Error('Configuration IA invalide.');
        const data = await response.json();
        this.aiConfig = data.configuration;
        this.aiCostEstimates = data.estimates;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async testAiProvider() {
      this.error = '';
      this.aiTestResult = null;

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/ai/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configId: this.selectedConfigId,
            question: this.aiTestQuestion
          })
        });
        if (!response.ok) throw new Error('Test IA impossible.');
        const data = await response.json();
        this.aiTestResult = data.result;
        this.aiCostEstimates = data.estimates;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async loadOrganizations() {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/organizations`);
      if (!response.ok) throw new Error('Impossible de charger les organisations.');
      const data = await response.json();
      this.organizations = data.organizations;

      if (!this.organizationForm.organizationId && this.organizations.length > 0) {
        this.siteForm.organizationId = this.organizations[0].id;
      }
    },

    async loadSites() {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/sites`);
      if (!response.ok) throw new Error('Impossible de charger les sites.');
      const data = await response.json();
      this.sites = data.sites;
    },

    async searchConversations() {
      this.error = '';

      try {
        this.selectedConversation = null;
        await this.loadConversations();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async selectConversation(id) {
      this.error = '';

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/conversations/${id}`);
        if (!response.ok) throw new Error('Impossible de charger la conversation.');
        const data = await response.json();
        this.selectedConversation = data.conversation;
        this.conversationStatuses = data.statuses;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async updateConversationStatus(status) {
      if (!this.selectedConversation) return;

      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/admin/conversations/${this.selectedConversation.id}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          }
        );

        if (!response.ok) throw new Error('Impossible de modifier le statut.');
        const data = await response.json();
        this.selectedConversation = data.conversation;
        await this.loadConversations();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async selectConfig(id) {
      this.configLoading = true;
      this.error = '';

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/configs/${id}`);
        if (!response.ok) throw new Error('Impossible de charger la configuration.');
        const data = await response.json();
        this.selectedConfigId = id;
        this.selectedConfig = data.config;
        this.configText = JSON.stringify(data.config, null, 2);
        this.configPrompt = data.prompt;
        this.configHistory = data.history;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      } finally {
        this.configLoading = false;
      }
    },

    async saveConfig() {
      if (!this.selectedConfigId) return;
      this.error = '';

      try {
        const parsed = JSON.parse(this.configText);
        const response = await apiFetch(`${API_BASE_URL}/api/admin/configs/${this.selectedConfigId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: parsed,
            author: 'admin-placeholder',
            comment: 'Saved from admin'
          })
        });

        if (!response.ok) throw new Error('Configuration invalide ou non sauvegardee.');
        const data = await response.json();
        this.selectedConfig = data.config;
        this.configText = JSON.stringify(data.config, null, 2);
        this.configPrompt = data.prompt;
        this.configHistory = data.history;
        await this.loadConfigs();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async importConfig() {
      this.error = '';

      try {
        const parsed = JSON.parse(this.configText);
        const response = await apiFetch(`${API_BASE_URL}/api/admin/configs/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: parsed,
            author: 'admin-placeholder',
            comment: 'Imported from admin'
          })
        });

        if (!response.ok) throw new Error('Import impossible. Verifiez le JSON.');
        const data = await response.json();
        await this.loadConfigs();
        await this.selectConfig(data.config.id);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async reloadConfigs() {
      this.error = '';

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/configs/reload`, {
          method: 'POST'
        });
        if (!response.ok) throw new Error('Rechargement impossible.');
        await this.loadConfigs();
        if (this.selectedConfigId) await this.selectConfig(this.selectedConfigId);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    exportConfig() {
      if (!this.selectedConfig) return;

      const blob = new Blob([`${JSON.stringify(this.selectedConfig, null, 2)}\n`], {
        type: 'application/json'
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${this.selectedConfig.id}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    },

    editOrganization(organization) {
      this.organizationForm = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        email: organization.email || '',
        phone: organization.phone || '',
        country: organization.country,
        language: organization.language,
        timezone: organization.timezone,
        currency: organization.currency,
        status: organization.status,
        plan: organization.plan || ''
      };
    },

    resetOrganizationForm() {
      this.organizationForm = {
        id: '',
        name: '',
        slug: '',
        email: '',
        phone: '',
        country: 'FR',
        language: 'fr',
        timezone: 'Europe/Paris',
        currency: 'EUR',
        status: 'active',
        plan: ''
      };
    },

    async saveOrganization() {
      const payload = {
        name: this.organizationForm.name,
        slug: this.organizationForm.slug,
        email: this.organizationForm.email || undefined,
        phone: this.organizationForm.phone || undefined,
        country: this.organizationForm.country,
        language: this.organizationForm.language,
        timezone: this.organizationForm.timezone,
        currency: this.organizationForm.currency,
        status: this.organizationForm.status,
        plan: this.organizationForm.plan || undefined
      };
      const url = this.organizationForm.id
        ? `${API_BASE_URL}/api/admin/organizations/${this.organizationForm.id}`
        : `${API_BASE_URL}/api/admin/organizations`;
      const response = await apiFetch(url, {
        method: this.organizationForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Impossible d'enregistrer l'organisation.");
      this.resetOrganizationForm();
      await this.loadOrganizations();
    },

    async toggleOrganization(organization) {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/organizations/${organization.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: organization.status === 'active' ? 'inactive' : 'active' })
      });

      if (!response.ok) throw new Error("Impossible de modifier l'organisation.");
      await this.loadOrganizations();
    },

    async deleteOrganization(organization) {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/organizations/${organization.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error("Impossible de supprimer l'organisation.");
      await this.loadOrganizations();
      await this.loadSites();
    },

    editSite(site) {
      this.siteForm = {
        id: site.id,
        organizationId: site.organization_id,
        name: site.name,
        slug: site.slug || '',
        domain: site.domain || '',
        businessConfigId: site.business_config_id,
        language: site.language,
        status: site.status,
        widgetEnabled: site.widget_enabled
      };
    },

    resetSiteForm() {
      this.siteForm = {
        id: '',
        organizationId: this.organizations[0]?.id || '',
        name: '',
        slug: '',
        domain: '',
        businessConfigId: 'default',
        language: 'fr',
        status: 'active',
        widgetEnabled: true
      };
    },

    async saveSite() {
      const payload = {
        organizationId: this.siteForm.organizationId,
        name: this.siteForm.name,
        slug: this.siteForm.slug,
        domain: this.siteForm.domain || undefined,
        businessConfigId: this.siteForm.businessConfigId,
        language: this.siteForm.language,
        status: this.siteForm.status,
        widgetEnabled: this.siteForm.widgetEnabled
      };
      const url = this.siteForm.id
        ? `${API_BASE_URL}/api/admin/sites/${this.siteForm.id}`
        : `${API_BASE_URL}/api/admin/sites`;
      const response = await apiFetch(url, {
        method: this.siteForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Impossible d'enregistrer le site.");
      this.resetSiteForm();
      await this.loadSites();
    },

    async toggleSite(site) {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/sites/${site.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: site.status === 'active' ? 'inactive' : 'active' })
      });

      if (!response.ok) throw new Error('Impossible de modifier le site.');
      await this.loadSites();
    },

    async deleteSite(site) {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/sites/${site.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Impossible de supprimer le site.');
      await this.loadSites();
    },

    formatDate(value) {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(value));
    },

    statusLabel(status) {
      return (
        {
          open: 'Ouverte',
          in_review: 'A traiter',
          qualified: 'Qualifiee',
          closed: 'Fermee'
        }[status] ?? status
      );
    },

    confidenceLabel(value) {
      if (value === null || value === undefined) return 'n/a';

      return `${Math.round(Number(value) * 100)} %`;
    },

    sourceLabel(source) {
      return (
        {
          faq: 'FAQ',
          knowledge_base: 'Base de connaissance',
          ai: 'IA mock',
          fallback: 'Fallback',
          human_escalation: 'Escalade humaine'
        }[source] ?? source
      );
    },

    can(permission) {
      return this.permissions.includes(permission);
    }
  },

  template: `
    <main v-if="!authenticated" class="login-shell">
      <form class="login-panel" @submit.prevent="login">
        <strong>VISITOR-OS</strong>
        <h1>Connexion admin</h1>
        <p v-if="error" class="alert">{{ error }}</p>
        <label>
          Email
          <input v-model="loginForm.email" type="email" autocomplete="email" required />
        </label>
        <label>
          Mot de passe
          <input
            v-model="loginForm.password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <button type="submit">Se connecter</button>
      </form>
    </main>

    <main v-else class="app-shell">
      <aside class="sidebar">
        <strong>VISITOR-OS</strong>
        <span>Admin sécurisé</span>
      </aside>

      <section v-if="authenticated" class="content">
        <header class="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Conversations, prospects et suivi minimal.</p>
          </div>
          <div class="topbar-actions">
            <span v-if="currentUser" class="user-chip">
              {{ currentUser.firstName }} {{ currentUser.lastName }} · {{ currentUser.role }}
            </span>
            <button type="button" @click="refreshDashboard">Actualiser</button>
            <button type="button" @click="logout">Deconnexion</button>
          </div>
        </header>

        <p v-if="error" class="alert">{{ error }}</p>

        <section class="metrics">
          <article class="metric">
            <span>Conversations</span>
            <strong>{{ conversations.length }}</strong>
          </article>
          <article class="metric">
            <span>Ouvertes</span>
            <strong>{{ openConversationsCount }}</strong>
          </article>
          <article class="metric">
            <span>Prospects</span>
            <strong>{{ prospects.length }}</strong>
          </article>
        </section>

        <section class="tenant-layout">
          <article class="panel tenant-panel">
            <div class="panel-header">
              <h2>Organisations</h2>
            </div>
            <form v-if="can('organizations:write')" class="tenant-form" @submit.prevent="saveOrganization">
              <input v-model="organizationForm.name" placeholder="Nom" required />
              <input v-model="organizationForm.slug" placeholder="Slug" required />
              <input v-model="organizationForm.email" placeholder="Email" />
              <input v-model="organizationForm.phone" placeholder="Telephone" />
              <button type="submit">{{ organizationForm.id ? 'Modifier' : 'Creer' }}</button>
              <button type="button" @click="resetOrganizationForm">Nouveau</button>
            </form>
            <div v-for="organization in organizations" :key="organization.id" class="tenant-row">
              <span>
                <strong>{{ organization.name }}</strong>
                <small>{{ organization.slug }} · {{ organization.status }}</small>
              </span>
              <span class="tenant-actions">
                <button v-if="can('organizations:write')" type="button" @click="editOrganization(organization)">Editer</button>
                <button v-if="can('organizations:write')" type="button" @click="toggleOrganization(organization)">
                  {{ organization.status === 'active' ? 'Desactiver' : 'Activer' }}
                </button>
                <button v-if="can('organizations:write')" type="button" @click="deleteOrganization(organization)">Supprimer</button>
              </span>
            </div>
          </article>

          <article class="panel tenant-panel">
            <div class="panel-header">
              <h2>Sites</h2>
            </div>
            <form v-if="can('sites:write')" class="tenant-form" @submit.prevent="saveSite">
              <select v-model="siteForm.organizationId" required>
                <option v-for="organization in organizations" :key="organization.id" :value="organization.id">
                  {{ organization.name }}
                </option>
              </select>
              <input v-model="siteForm.name" placeholder="Nom" required />
              <input v-model="siteForm.slug" placeholder="Slug" required />
              <select v-model="siteForm.businessConfigId" required>
                <option v-for="config in configs" :key="config.id" :value="config.id">
                  {{ config.id }}
                </option>
              </select>
              <button type="submit">{{ siteForm.id ? 'Modifier' : 'Creer' }}</button>
              <button type="button" @click="resetSiteForm">Nouveau</button>
            </form>
            <div v-for="site in sites" :key="site.id" class="tenant-row">
              <span>
                <strong>{{ site.name }}</strong>
                <small>{{ site.slug }} · {{ site.business_config_id }} · {{ site.status }}</small>
              </span>
              <span class="tenant-actions">
                <button v-if="can('sites:write')" type="button" @click="editSite(site)">Editer</button>
                <button v-if="can('sites:write')" type="button" @click="toggleSite(site)">
                  {{ site.status === 'active' ? 'Desactiver' : 'Activer' }}
                </button>
                <button v-if="can('sites:write')" type="button" @click="deleteSite(site)">Supprimer</button>
              </span>
            </div>
          </article>
        </section>

        <section class="layout">
          <div class="panel list-panel">
            <div class="panel-header">
              <h2>Conversations</h2>
              <form class="search-form" @submit.prevent="searchConversations">
                <input v-model="search" placeholder="Rechercher..." />
                <button type="submit">OK</button>
              </form>
            </div>

            <p v-if="loading">Chargement...</p>
            <p v-else-if="conversations.length === 0" class="empty">
              Aucune conversation. Envoyez un message depuis la page demo.
            </p>

            <button
              v-for="conversation in conversations"
              :key="conversation.id"
              type="button"
              class="conversation-row"
              :class="{ active: selectedConversation?.id === conversation.id }"
              @click="selectConversation(conversation.id)"
            >
              <span>
                <strong>{{ conversation.display_name || 'Visiteur anonyme' }}</strong>
                <small>{{ formatDate(conversation.created_at) }}</small>
                <small>{{ conversation.last_message || 'Conversation demarree' }}</small>
              </span>
              <span class="badge">{{ statusLabel(conversation.status) }}</span>
            </button>
          </div>

          <article class="panel detail-panel">
            <template v-if="selectedConversation">
              <div class="detail-header">
                <div>
                  <h2>{{ selectedConversation.display_name || 'Conversation visiteur' }}</h2>
                  <p>{{ formatDate(selectedConversation.created_at) }}</p>
                  <p v-if="selectedConversation.page_url" class="muted">
                    {{ selectedConversation.page_url }}
                  </p>
                </div>
                <label>
                  Statut conversation
                  <select
                    :value="selectedConversation.status"
                    @change="updateConversationStatus($event.target.value)"
                  >
                    <option
                      v-for="status in conversationStatuses"
                      :key="status"
                      :value="status"
                    >
                      {{ statusLabel(status) }}
                    </option>
                  </select>
                </label>
              </div>

              <section class="conversation">
                <div
                  v-for="message in selectedConversation.messages"
                  :key="message.id"
                  class="message"
                  :class="message.sender_type"
                >
                  <small>{{ message.sender_type }} · {{ formatDate(message.created_at) }}</small>
                  <p>{{ message.content }}</p>
                  <dl v-if="message.response_source" class="decision-meta">
                    <div>
                      <dt>Source</dt>
                      <dd>{{ sourceLabel(message.response_source) }}</dd>
                    </div>
                    <div>
                      <dt>Confiance</dt>
                      <dd>{{ confidenceLabel(message.response_confidence) }}</dd>
                    </div>
                    <div>
                      <dt>Escalade</dt>
                      <dd>{{ message.should_escalate ? 'Oui' : 'Non' }}</dd>
                    </div>
                    <div>
                      <dt>Temps</dt>
                      <dd>{{ message.processing_time_ms }} ms</dd>
                    </div>
                  </dl>
                </div>
              </section>
            </template>

            <p v-else class="empty">Selectionnez une conversation.</p>
          </article>

          <aside class="panel prospects-panel">
            <h2>Prospects</h2>
            <p v-if="prospects.length === 0" class="empty">Aucun prospect.</p>
            <div v-for="prospect in prospects" :key="prospect.id" class="prospect-card">
              <strong>{{ prospect.display_name }}</strong>
              <small>{{ prospect.status }} · score {{ prospect.score_current }}</small>
            </div>
          </aside>
        </section>

        <section class="panel config-panel">
          <div class="panel-header config-header">
            <div>
              <h2>Configuration</h2>
              <p class="muted">Moteur metier configurable par JSON.</p>
            </div>
            <div class="config-actions">
              <select
                :value="selectedConfigId"
                @change="selectConfig($event.target.value)"
              >
                <option v-for="config in configs" :key="config.id" :value="config.id">
                  {{ config.name }} · {{ config.id }}
                </option>
              </select>
              <button type="button" @click="reloadConfigs">Recharger</button>
              <button v-if="can('settings:access')" type="button" @click="saveConfig">Sauvegarder</button>
              <button v-if="can('settings:access')" type="button" @click="importConfig">Importer</button>
              <button v-if="can('data:export')" type="button" @click="exportConfig">Exporter</button>
            </div>
          </div>

          <div class="config-grid">
            <label class="config-editor">
              JSON
              <textarea v-model="configText" spellcheck="false"></textarea>
            </label>

            <div class="config-preview">
              <h3>Prompt Builder</h3>
              <pre>{{ configPrompt }}</pre>

              <h3>Historique</h3>
              <p v-if="configHistory.length === 0" class="empty">Aucune version sauvegardee.</p>
              <ul v-else class="history-list">
                <li v-for="item in configHistory" :key="item.fileName">
                  <strong>{{ formatDate(item.createdAt) }}</strong>
                  <span>{{ item.author }} · {{ item.version }}</span>
                  <small>{{ item.comment }}</small>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section v-if="can('settings:access')" class="panel ai-panel">
          <div class="panel-header config-header">
            <div>
              <h2>Configuration IA</h2>
              <p class="muted">Provider interchangeable, test sans coupler le moteur de decision.</p>
            </div>
            <div class="config-actions">
              <button type="button" @click="saveAiConfig">Sauvegarder IA</button>
              <button type="button" @click="testAiProvider">Tester le provider</button>
            </div>
          </div>

          <div class="ai-grid">
            <label>
              Provider
              <select v-model="aiConfig.provider">
                <option v-for="provider in aiProviders" :key="provider" :value="provider">
                  {{ provider }}
                </option>
              </select>
            </label>
            <label>
              Modele
              <input v-model="aiConfig.model" />
            </label>
            <label>
              Temperature
              <input v-model.number="aiConfig.temperature" type="number" min="0" max="2" step="0.1" />
            </label>
            <label>
              Max tokens
              <input v-model.number="aiConfig.maxTokens" type="number" min="1" max="4000" />
            </label>
            <label>
              Top P
              <input v-model.number="aiConfig.topP" type="number" min="0" max="1" step="0.1" />
            </label>
            <label>
              Timeout ms
              <input v-model.number="aiConfig.timeoutMs" type="number" min="250" max="60000" />
            </label>
            <label>
              Langue
              <input v-model="aiConfig.language" />
            </label>
            <label>
              Actif
              <select v-model="aiConfig.enabled">
                <option :value="true">Oui</option>
                <option :value="false">Non</option>
              </select>
            </label>
          </div>

          <div class="ai-test">
            <label>
              Question de test
              <input v-model="aiTestQuestion" />
            </label>
            <dl v-if="aiTestResult" class="decision-meta">
              <div>
                <dt>Provider</dt>
                <dd>{{ aiTestResult.provider }}</dd>
              </div>
              <div>
                <dt>Modele</dt>
                <dd>{{ aiTestResult.model }}</dd>
              </div>
              <div>
                <dt>Latence</dt>
                <dd>{{ aiTestResult.latencyMs }} ms</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{{ aiTestResult.inputTokens }} / {{ aiTestResult.outputTokens }}</dd>
              </div>
              <div>
                <dt>Cout</dt>
                <dd>{{ aiTestResult.estimatedCost }}</dd>
              </div>
              <div>
                <dt>Fallback</dt>
                <dd>{{ aiTestResult.fallbackUsed ? 'Oui' : 'Non' }}</dd>
              </div>
            </dl>
            <p v-if="aiTestResult" class="muted">{{ aiTestResult.reply }}</p>
            <p v-if="aiCostEstimates" class="muted">
              Estimation: {{ aiCostEstimates.requestCost }} par requete ·
              {{ aiCostEstimates.monthlyCost }} par mois pour 100 requetes/jour.
            </p>
          </div>
        </section>
      </section>
    </main>
  `
}).mount('#app');
