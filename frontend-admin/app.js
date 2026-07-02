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
      prospectStatuses: [],
      selectedProspect: null,
      crmTags: [],
      followUps: [],
      prospectFilters: {
        status: '',
        scoreMin: '',
        tag: '',
        siteId: '',
        search: ''
      },
      noteForm: {
        content: ''
      },
      followUpForm: {
        dueAt: '',
        reason: ''
      },
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
      notifications: [],
      notificationTypes: [],
      notificationStatuses: [],
      notificationFilters: {
        type: '',
        status: '',
        provider: ''
      },
      notificationSettings: {
        adminEmails: [],
        notificationsEnabled: true,
        frequency: 'instant',
        language: 'fr',
        preferredProvider: 'mock',
        webhookUrl: '',
        webhookHeaders: {},
        webhookSecret: '',
        retryAttempts: 2,
        timeoutMs: 5000
      },
      notificationAdminEmailsText: '',
      notificationTestResult: null,
      analytics: null,
      analyticsFilters: {
        preset: '7d',
        siteId: '',
        from: '',
        to: ''
      },
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
          this.loadNotifications(),
          this.loadNotificationSettings(),
          this.loadAnalytics(),
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
      const params = new URLSearchParams();
      Object.entries(this.prospectFilters).forEach(([key, value]) => {
        if (String(value).trim()) params.set(key, String(value).trim());
      });
      const response = await apiFetch(`${API_BASE_URL}/api/admin/prospects?${params.toString()}`);
      if (!response.ok) throw new Error('Impossible de charger les prospects.');
      const data = await response.json();
      this.prospects = data.prospects;
      this.prospectStatuses = data.statuses;
      this.crmTags = data.tags;

      if (!this.selectedProspect && this.prospects.length > 0) {
        await this.selectProspect(this.prospects[0].id);
      }
    },

    async selectProspect(id) {
      this.error = '';

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/prospects/${id}`);
        if (!response.ok) throw new Error('Impossible de charger le prospect.');
        const data = await response.json();
        this.selectedProspect = data.prospect;
        this.prospectStatuses = data.statuses;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async updateProspectStatus(status) {
      if (!this.selectedProspect) return;
      const response = await apiFetch(
        `${API_BASE_URL}/api/admin/prospects/${this.selectedProspect.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      );
      if (!response.ok) throw new Error('Impossible de modifier le prospect.');
      await this.loadProspects();
      await this.selectProspect(this.selectedProspect.id);
    },

    async recalculateProspectScore() {
      if (!this.selectedProspect) return;
      const response = await apiFetch(
        `${API_BASE_URL}/api/admin/prospects/${this.selectedProspect.id}/recalculate-score`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Recalcul impossible.');
      const data = await response.json();
      this.selectedProspect = data.prospect;
      await this.loadProspects();
    },

    async addProspectTag(tagId) {
      if (!this.selectedProspect || !tagId) return;
      const response = await apiFetch(`${API_BASE_URL}/api/admin/prospects/${this.selectedProspect.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId })
      });
      if (!response.ok) throw new Error('Tag impossible.');
      await this.selectProspect(this.selectedProspect.id);
    },

    async removeProspectTag(tagId) {
      if (!this.selectedProspect) return;
      const response = await apiFetch(
        `${API_BASE_URL}/api/admin/prospects/${this.selectedProspect.id}/tags/${tagId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Suppression tag impossible.');
      await this.selectProspect(this.selectedProspect.id);
    },

    async createNote() {
      if (!this.selectedProspect || !this.noteForm.content.trim()) return;
      const response = await apiFetch(`${API_BASE_URL}/api/admin/crm/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: this.selectedProspect.id,
          content: this.noteForm.content
        })
      });
      if (!response.ok) throw new Error('Note impossible.');
      this.noteForm.content = '';
      await this.selectProspect(this.selectedProspect.id);
    },

    async createFollowUp() {
      if (!this.selectedProspect || !this.followUpForm.dueAt || !this.followUpForm.reason.trim()) return;
      const response = await apiFetch(`${API_BASE_URL}/api/admin/crm/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId: this.selectedProspect.id,
          dueAt: new Date(this.followUpForm.dueAt).toISOString(),
          reason: this.followUpForm.reason
        })
      });
      if (!response.ok) throw new Error('Relance impossible.');
      this.followUpForm.dueAt = '';
      this.followUpForm.reason = '';
      await this.selectProspect(this.selectedProspect.id);
    },

    async completeFollowUp(id) {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/crm/follow-ups/${id}/complete`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Relance non traitee.');
      if (this.selectedProspect) await this.selectProspect(this.selectedProspect.id);
    },

    exportProspects(format = 'csv') {
      const params = new URLSearchParams({ format });
      Object.entries(this.prospectFilters).forEach(([key, value]) => {
        if (String(value).trim()) params.set(key, String(value).trim());
      });
      window.location.href = `${API_BASE_URL}/api/admin/prospects/export?${params.toString()}`;
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

    async loadNotifications() {
      if (!this.can('settings:access')) return;

      const params = new URLSearchParams();
      Object.entries(this.notificationFilters).forEach(([key, value]) => {
        if (String(value).trim()) params.set(key, String(value).trim());
      });
      const response = await apiFetch(`${API_BASE_URL}/api/admin/notifications?${params.toString()}`);
      if (!response.ok) throw new Error('Impossible de charger les notifications.');
      const data = await response.json();
      this.notifications = data.notifications;
      this.notificationTypes = data.types;
      this.notificationStatuses = data.statuses;
    },

    async loadNotificationSettings() {
      if (!this.can('settings:access')) return;

      const response = await apiFetch(`${API_BASE_URL}/api/admin/notifications/settings`);
      if (!response.ok) throw new Error('Impossible de charger les parametres notifications.');
      const data = await response.json();
      if (!data.settings) return;
      this.notificationSettings = {
        ...data.settings,
        webhookUrl: data.settings.webhookUrl || '',
        webhookSecret: data.settings.webhookSecret || ''
      };
      this.notificationAdminEmailsText = data.settings.adminEmails.join(', ');
    },

    async saveNotificationSettings() {
      this.error = '';

      try {
        const payload = {
          ...this.notificationSettings,
          adminEmails: this.notificationAdminEmailsText
            .split(',')
            .map((email) => email.trim())
            .filter(Boolean),
          webhookUrl: this.notificationSettings.webhookUrl || null,
          webhookSecret: this.notificationSettings.webhookSecret || null
        };
        const response = await apiFetch(`${API_BASE_URL}/api/admin/notifications/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Parametres notifications invalides.');
        await this.loadNotificationSettings();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async testNotification() {
      this.error = '';
      this.notificationTestResult = null;

      try {
        const response = await apiFetch(`${API_BASE_URL}/api/admin/notifications/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (!response.ok) throw new Error('Test notification impossible.');
        const data = await response.json();
        this.notificationTestResult = data.result;
        await this.loadNotifications();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async loadAnalytics() {
      if (!this.can('conversations:read')) return;

      const params = new URLSearchParams();
      params.set('preset', this.analyticsFilters.preset);
      if (this.analyticsFilters.siteId) params.set('siteId', this.analyticsFilters.siteId);
      if (this.analyticsFilters.preset === 'custom') {
        if (this.analyticsFilters.from) {
          params.set('from', new Date(this.analyticsFilters.from).toISOString());
        }
        if (this.analyticsFilters.to) {
          params.set('to', new Date(this.analyticsFilters.to).toISOString());
        }
      }
      const response = await apiFetch(`${API_BASE_URL}/api/admin/analytics?${params.toString()}`);
      if (!response.ok) throw new Error('Impossible de charger les analytics.');
      const data = await response.json();
      this.analytics = data.analytics;
    },

    exportAnalytics(format = 'csv') {
      const params = new URLSearchParams({ preset: this.analyticsFilters.preset, format });
      if (this.analyticsFilters.siteId) params.set('siteId', this.analyticsFilters.siteId);
      if (this.analyticsFilters.preset === 'custom') {
        if (this.analyticsFilters.from) {
          params.set('from', new Date(this.analyticsFilters.from).toISOString());
        }
        if (this.analyticsFilters.to) {
          params.set('to', new Date(this.analyticsFilters.to).toISOString());
        }
      }
      window.location.href = `${API_BASE_URL}/api/admin/analytics/export?${params.toString()}`;
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

    barWidth(value, rows) {
      const max = Math.max(1, ...rows.map((row) => Number(row.count)));

      return `${Math.max(4, Math.round((Number(value) / max) * 100))}%`;
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

        <section v-if="analytics" class="panel analytics-panel">
          <div class="panel-header config-header">
            <div>
              <h2>Analytics</h2>
              <p class="muted">Vue claire des conversations, prospects, IA et notifications.</p>
            </div>
            <div class="config-actions">
              <select v-model="analyticsFilters.preset" @change="loadAnalytics">
                <option value="today">Aujourd'hui</option>
                <option value="7d">7 jours</option>
                <option value="30d">30 jours</option>
                <option value="custom">Personnalise</option>
              </select>
              <select v-model="analyticsFilters.siteId" @change="loadAnalytics">
                <option value="">Tous sites</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.name }}</option>
              </select>
              <input v-if="analyticsFilters.preset === 'custom'" v-model="analyticsFilters.from" type="datetime-local" />
              <input v-if="analyticsFilters.preset === 'custom'" v-model="analyticsFilters.to" type="datetime-local" />
              <button type="button" @click="loadAnalytics">Actualiser</button>
              <button v-if="can('data:export')" type="button" @click="exportAnalytics('csv')">CSV</button>
              <button v-if="can('data:export')" type="button" @click="exportAnalytics('xlsx')">XLSX</button>
            </div>
          </div>

          <div class="analytics-kpis">
            <article class="metric">
              <span>Prospects crees</span>
              <strong>{{ analytics.kpis.prospects }}</strong>
            </article>
            <article class="metric">
              <span>Conversion</span>
              <strong>{{ analytics.kpis.visitorToProspectRate }} %</strong>
            </article>
            <article class="metric">
              <span>Score moyen</span>
              <strong>{{ analytics.kpis.averageScore }}</strong>
            </article>
            <article class="metric">
              <span>Prospects chauds</span>
              <strong>{{ analytics.kpis.hotProspects }}</strong>
            </article>
            <article class="metric">
              <span>Fallback</span>
              <strong>{{ analytics.kpis.fallbackRate }} %</strong>
            </article>
            <article class="metric">
              <span>Cout IA</span>
              <strong>{{ analytics.kpis.aiEstimatedCost }}</strong>
            </article>
          </div>

          <div class="analytics-grid">
            <section>
              <h3>Conversations par jour</h3>
              <div v-for="point in analytics.conversationsByDay" :key="point.date" class="bar-row">
                <span>{{ point.date }}</span>
                <div><i :style="{ width: barWidth(point.count, analytics.conversationsByDay) }"></i></div>
                <strong>{{ point.count }}</strong>
              </div>
            </section>

            <section>
              <h3>Prospects par jour</h3>
              <div v-for="point in analytics.prospectsByDay" :key="point.date" class="bar-row">
                <span>{{ point.date }}</span>
                <div><i :style="{ width: barWidth(point.count, analytics.prospectsByDay) }"></i></div>
                <strong>{{ point.count }}</strong>
              </div>
            </section>

            <section>
              <h3>Performance par site</h3>
              <table>
                <thead>
                  <tr><th>Site</th><th>Conv.</th><th>Prospects</th><th>Conv.</th></tr>
                </thead>
                <tbody>
                  <tr v-for="site in analytics.sitePerformance" :key="site.siteId">
                    <td>{{ site.siteName }}</td>
                    <td>{{ site.conversations }}</td>
                    <td>{{ site.prospects }}</td>
                    <td>{{ site.conversionRate }} %</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h3>Tags frequents</h3>
              <table>
                <tbody>
                  <tr v-for="tag in analytics.topTags" :key="tag.slug">
                    <td>{{ tag.label }}</td>
                    <td>{{ tag.count }}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h3>Sources de reponse</h3>
              <table>
                <tbody>
                  <tr v-for="source in analytics.responseSources" :key="source.source">
                    <td>{{ sourceLabel(source.source) }}</td>
                    <td>{{ source.count }}</td>
                    <td>{{ source.rate }} %</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h3>Alertes</h3>
              <dl class="analytics-alerts">
                <div><dt>Relances du jour</dt><dd>{{ analytics.kpis.followUpsToday }}</dd></div>
                <div><dt>Relances en retard</dt><dd>{{ analytics.kpis.followUpsOverdue }}</dd></div>
                <div><dt>Notifications envoyees</dt><dd>{{ analytics.kpis.notificationsSent }}</dd></div>
                <div><dt>Erreurs importantes</dt><dd>{{ analytics.kpis.importantErrors }}</dd></div>
                <div><dt>Escalade humaine</dt><dd>{{ analytics.kpis.humanEscalationRate }} %</dd></div>
              </dl>
            </section>
          </div>
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
            <div class="panel-header">
              <h2>CRM</h2>
              <span class="badge">{{ prospects.length }}</span>
            </div>
            <form class="crm-filters" @submit.prevent="loadProspects">
              <input v-model="prospectFilters.search" placeholder="Recherche" />
              <select v-model="prospectFilters.status">
                <option value="">Tous statuts</option>
                <option v-for="status in prospectStatuses" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
              <input v-model="prospectFilters.scoreMin" type="number" min="0" max="100" placeholder="Score min" />
              <select v-model="prospectFilters.tag">
                <option value="">Tous tags</option>
                <option v-for="tag in crmTags" :key="tag.id" :value="tag.slug">
                  {{ tag.label }}
                </option>
              </select>
              <select v-model="prospectFilters.siteId">
                <option value="">Tous sites</option>
                <option v-for="site in sites" :key="site.id" :value="site.id">
                  {{ site.name }}
                </option>
              </select>
              <button type="submit">Filtrer</button>
              <button v-if="can('data:export')" type="button" @click="exportProspects('csv')">CSV</button>
              <button v-if="can('data:export')" type="button" @click="exportProspects('xlsx')">XLSX</button>
            </form>
            <p v-if="prospects.length === 0" class="empty">Aucun prospect.</p>
            <button
              v-for="prospect in prospects"
              :key="prospect.id"
              type="button"
              class="prospect-card"
              :class="{ active: selectedProspect?.id === prospect.id }"
              @click="selectProspect(prospect.id)"
            >
              <strong>{{ prospect.display_name }}</strong>
              <small>{{ prospect.status }} · score {{ prospect.score_current }}</small>
            </button>

            <section v-if="selectedProspect" class="crm-detail">
              <div class="detail-header">
                <div>
                  <h3>{{ selectedProspect.display_name }}</h3>
                  <p class="muted">Score {{ selectedProspect.score_current }} · {{ selectedProspect.temperature }}</p>
                </div>
                <button v-if="can('prospects:write')" type="button" @click="recalculateProspectScore">Recalculer</button>
              </div>
              <label>
                Statut
                <select
                  :value="selectedProspect.status"
                  @change="updateProspectStatus($event.target.value)"
                >
                  <option v-for="status in prospectStatuses" :key="status" :value="status">
                    {{ status }}
                  </option>
                </select>
              </label>

              <div class="tag-list">
                <span v-for="tag in selectedProspect.tags" :key="tag.id" class="tag-chip">
                  {{ tag.label }}
                  <button v-if="can('prospects:write')" type="button" @click="removeProspectTag(tag.id)">x</button>
                </span>
              </div>
              <select v-if="can('prospects:write')" @change="addProspectTag($event.target.value); $event.target.value = ''">
                <option value="">Ajouter tag</option>
                <option v-for="tag in crmTags" :key="tag.id" :value="tag.id">{{ tag.label }}</option>
              </select>

              <form v-if="can('prospects:write')" class="crm-form" @submit.prevent="createNote">
                <textarea v-model="noteForm.content" placeholder="Note interne"></textarea>
                <button type="submit">Ajouter note</button>
              </form>
              <div v-for="note in selectedProspect.notes" :key="note.id" class="timeline-item">
                <small>{{ formatDate(note.created_at) }}</small>
                <p>{{ note.content }}</p>
              </div>

              <form v-if="can('prospects:write')" class="crm-form" @submit.prevent="createFollowUp">
                <input v-model="followUpForm.dueAt" type="datetime-local" />
                <input v-model="followUpForm.reason" placeholder="Motif relance" />
                <button type="submit">Ajouter relance</button>
              </form>
              <div v-for="followUp in selectedProspect.followUps" :key="followUp.id" class="timeline-item">
                <small>{{ formatDate(followUp.due_at) }} · {{ followUp.status }}</small>
                <p>{{ followUp.reason }}</p>
                <button
                  v-if="can('prospects:write') && followUp.status === 'pending'"
                  type="button"
                  @click="completeFollowUp(followUp.id)"
                >
                  Traitee
                </button>
              </div>

              <h3>Timeline</h3>
              <div v-for="conversation in selectedProspect.conversations" :key="conversation.id" class="timeline-item">
                <strong>{{ formatDate(conversation.created_at) }}</strong>
                <p v-for="message in conversation.messages" :key="message.id">
                  {{ message.sender_type }} · {{ message.content }}
                </p>
              </div>
            </section>
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

        <section v-if="can('settings:access')" class="panel notifications-panel">
          <div class="panel-header config-header">
            <div>
              <h2>Notifications</h2>
              <p class="muted">Email, interne et webhook via le moteur central.</p>
            </div>
            <div class="config-actions">
              <button type="button" @click="saveNotificationSettings">Sauvegarder</button>
              <button type="button" @click="testNotification">Tester</button>
              <button type="button" @click="loadNotifications">Actualiser</button>
            </div>
          </div>

          <div class="notification-grid">
            <form class="notification-settings" @submit.prevent="saveNotificationSettings">
              <label>
                Emails administrateurs
                <input v-model="notificationAdminEmailsText" placeholder="admin@example.com, equipe@example.com" />
              </label>
              <label>
                Notifications
                <select v-model="notificationSettings.notificationsEnabled">
                  <option :value="true">Activees</option>
                  <option :value="false">Desactivees</option>
                </select>
              </label>
              <label>
                Frequence
                <select v-model="notificationSettings.frequency">
                  <option value="instant">Instantanee</option>
                  <option value="daily">Quotidienne</option>
                  <option value="disabled">Desactivee</option>
                </select>
              </label>
              <label>
                Provider email
                <select v-model="notificationSettings.preferredProvider">
                  <option value="mock">Mock</option>
                  <option value="resend">Resend</option>
                </select>
              </label>
              <label>
                Webhook URL
                <input v-model="notificationSettings.webhookUrl" placeholder="https://..." />
              </label>
              <label>
                Timeout ms
                <input v-model.number="notificationSettings.timeoutMs" type="number" min="250" max="30000" />
              </label>
            </form>

            <div>
              <form class="crm-filters" @submit.prevent="loadNotifications">
                <select v-model="notificationFilters.type">
                  <option value="">Tous types</option>
                  <option v-for="type in notificationTypes" :key="type" :value="type">{{ type }}</option>
                </select>
                <select v-model="notificationFilters.status">
                  <option value="">Tous statuts</option>
                  <option v-for="status in notificationStatuses" :key="status" :value="status">{{ status }}</option>
                </select>
                <input v-model="notificationFilters.provider" placeholder="Provider" />
                <button type="submit">Filtrer</button>
              </form>

              <p v-if="notificationTestResult" class="muted">
                Test envoye · {{ notificationTestResult.records.length }} entree(s)
              </p>
              <p v-if="notifications.length === 0" class="empty">Aucune notification.</p>
              <div v-for="notification in notifications" :key="notification.id" class="notification-row">
                <span>
                  <strong>{{ notification.title }}</strong>
                  <small>{{ notification.type }} · {{ notification.provider }} · {{ formatDate(notification.created_at) }}</small>
                  <small>{{ notification.subject }}</small>
                </span>
                <span class="badge">{{ notification.status }}</span>
              </div>
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
