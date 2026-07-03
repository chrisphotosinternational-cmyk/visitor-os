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
      prospects: [],
      prospectStatuses: [],
      prospectScoreLabels: [],
      prospectPlatforms: [],
      prospectSearch: '',
      prospectFilters: { status: '', city: '', scoreLabel: '', platform: '' },
      prospectForm: emptyProspectForm(),
      prospectImportCsv: '',
      selectedProspect: null,
      contactHistory: [],
      contactChannels: [],
      contactOutcomes: [],
      contactHistoryForm: emptyContactHistoryForm(),
      followUps: [],
      followUpFilters: { overdue: false, upcoming: false, city: '', scoreLabel: '', status: '' },
      messageTemplates: [],
      messageTemplateChannels: [],
      messageTemplatePurposes: [],
      messageTemplateForm: emptyMessageTemplateForm(),
      selectedMessageTemplate: null,
      messageDraft: emptyMessageDraft(),
      renderedMessage: '',
      prospectAiAnalysis: null,
      aiBatchJob: null,
      prospectEnrichments: [],
      prospectSuggestions: [],
      enrichments: [],
      enrichmentStatuses: [],
      enrichmentSourceTypes: [],
      enrichmentFilters: { status: '', sourceType: '', city: '', platform: '', confidenceMin: '' },
      enrichmentBatchJob: null,
      pipelineColumns: [],
      pipelineStages: [],
      pipelineMetrics: null,
      pipelineForecast: null,
      pipelineActivity: [],
      pipelineFilters: { city: '', scoreLabel: '', platform: '', sort: 'score' },
      draggedProspectId: '',
      loading: false,
      error: '',
      notification: '',
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
    },
    canWriteProspects() {
      return ['SuperAdmin', 'Admin', 'Manager', 'Agent'].includes(this.user?.role);
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
      this.prospects = [];
      this.messageTemplates = [];
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
          this.apiRequest('/admin-api/dashboard', { authenticated: true })
        ]);
        if (!meResponse.ok || !dashboardResponse.ok) throw new Error('Session expiree ou invalide.');
        const me = await meResponse.json();
        this.dashboard = await dashboardResponse.json();
        this.user = { ...(this.user ?? {}), ...me.user };
        if (this.route === 'login') this.navigate('dashboard');
        this.startSessionWatcher();
        await Promise.all([
          this.refreshTechnicalStatus(),
          this.loadOrganizations(),
          this.loadUsers(),
          this.loadProspects(),
          this.loadFollowUps(),
          this.loadMessageTemplates(),
          this.loadEnrichments(),
          this.loadPipeline()
        ]);
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
      const response = await this.apiRequest('/admin-api/dashboard', { authenticated: true });
      if (response.ok) this.dashboard = await response.json();
    },
    async loadPipeline() {
      if (!this.token) return;
      const params = new URLSearchParams();
      if (this.pipelineFilters.city) params.set('city', this.pipelineFilters.city);
      if (this.pipelineFilters.scoreLabel) params.set('scoreLabel', this.pipelineFilters.scoreLabel);
      if (this.pipelineFilters.platform) params.set('platform', this.pipelineFilters.platform);
      if (this.pipelineFilters.sort) params.set('sort', this.pipelineFilters.sort);
      const [pipelineResponse, metricsResponse, forecastResponse, activityResponse] = await Promise.all([
        this.apiRequest('/admin-api/pipeline' + (params.toString() ? '?' + params.toString() : ''), { authenticated: true }),
        this.apiRequest('/admin-api/pipeline/metrics', { authenticated: true }),
        this.apiRequest('/admin-api/pipeline/forecast', { authenticated: true }),
        this.apiRequest('/admin-api/pipeline/activity', { authenticated: true })
      ]);
      if (!pipelineResponse.ok || !metricsResponse.ok || !forecastResponse.ok || !activityResponse.ok) {
        throw new Error('Chargement pipeline impossible.');
      }
      const pipelineData = await pipelineResponse.json();
      this.pipelineColumns = pipelineData.columns;
      this.pipelineStages = pipelineData.stages;
      this.pipelineMetrics = (await metricsResponse.json()).metrics;
      this.pipelineForecast = (await forecastResponse.json()).forecast;
      this.pipelineActivity = (await activityResponse.json()).activity;
    },
    async moveProspectToStage(prospect, stage) {
      if (!prospect || !stage || prospect.status === stage) return;
      const response = await this.apiRequest('/admin-api/prospects/' + prospect.id + '/pipeline-stage', {
        method: 'PATCH',
        authenticated: true,
        body: JSON.stringify({ stage })
      });
      if (!response.ok) throw new Error('Changement d etape impossible.');
      await Promise.all([this.loadPipeline(), this.loadProspects(), this.refreshDashboard()]);
    },
    startProspectDrag(prospect) {
      this.draggedProspectId = prospect.id;
    },
    async dropProspectOnStage(stage) {
      const prospect = this.pipelineColumns.flatMap((column) => column.prospects).find((item) => item.id === this.draggedProspectId);
      this.draggedProspectId = '';
      if (prospect) await this.moveProspectToStage(prospect, stage);
    },
    async loadProspects() {
      if (!this.token) return;
      const params = new URLSearchParams();
      if (this.prospectSearch) params.set('search', this.prospectSearch);
      if (this.prospectFilters.status) params.set('status', this.prospectFilters.status);
      if (this.prospectFilters.city) params.set('city', this.prospectFilters.city);
      if (this.prospectFilters.scoreLabel) params.set('scoreLabel', this.prospectFilters.scoreLabel);
      if (this.prospectFilters.platform) params.set('platform', this.prospectFilters.platform);
      const response = await this.apiRequest('/admin-api/prospects' + (params.toString() ? '?' + params.toString() : ''), { authenticated: true });
      if (!response.ok) throw new Error('Chargement des prospects impossible.');
      const data = await response.json();
      this.prospects = data.prospects;
      this.prospectStatuses = data.statuses;
      this.prospectScoreLabels = data.scoreLabels;
      this.prospectPlatforms = data.platforms;
      if (!this.prospectForm.organizationId && this.user?.organizationId) {
        this.prospectForm.organizationId = this.user.organizationId;
      }
    },
    async saveProspect() {
      if (!this.canWriteProspects) return;
      const editing = Boolean(this.prospectForm.id);
      const response = await this.apiRequest(
        editing ? '/admin-api/prospects/' + this.prospectForm.id : '/admin-api/prospects',
        {
          method: editing ? 'PATCH' : 'POST',
          authenticated: true,
          body: JSON.stringify(this.prospectForm)
        }
      );
      if (!response.ok) throw new Error('Enregistrement prospect impossible.');
      const data = await response.json();
      this.selectedProspect = data.prospect;
      this.prospectForm = emptyProspectForm(this.user?.organizationId);
      await Promise.all([this.loadProspects(), this.refreshDashboard()]);
      this.navigate('prospects');
    },
    editProspect(prospect) {
      this.selectedProspect = prospect;
      this.prospectForm = prospectToForm(prospect);
      void this.loadProspectHistory(prospect.id);
      void this.loadProspectAnalysis(prospect.id);
      void this.loadProspectEnrichments(prospect.id);
      this.navigate('prospect-detail', prospect.id);
    },
    newProspect() {
      this.selectedProspect = null;
      this.prospectForm = emptyProspectForm(this.user?.organizationId);
      this.navigate('prospect-new');
    },
    async deleteProspect(prospect) {
      const response = await this.apiRequest('/admin-api/prospects/' + prospect.id, {
        method: 'DELETE',
        authenticated: true
      });
      if (!response.ok) throw new Error('Suppression prospect impossible.');
      await Promise.all([this.loadProspects(), this.refreshDashboard()]);
    },
    async importProspects() {
      const response = await this.apiRequest('/admin-api/prospects/import-csv', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          organizationId: this.user?.organizationId,
          csv: this.prospectImportCsv
        })
      });
      if (!response.ok) throw new Error('Import CSV impossible.');
      this.prospectImportCsv = '';
      await Promise.all([this.loadProspects(), this.refreshDashboard()]);
      this.navigate('prospects');
    },
    async loadProspectHistory(prospectId) {
      const response = await this.apiRequest('/admin-api/prospects/' + prospectId + '/history', { authenticated: true });
      if (!response.ok) throw new Error('Chargement historique impossible.');
      const data = await response.json();
      this.contactHistory = data.history;
      this.contactChannels = data.channels;
      this.contactOutcomes = data.outcomes;
      this.contactHistoryForm = emptyContactHistoryForm();
    },
    async saveContactHistory() {
      if (!this.selectedProspect) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/history', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify(this.contactHistoryForm)
      });
      if (!response.ok) throw new Error('Ajout historique impossible.');
      const data = await response.json();
      this.selectedProspect = data.prospect ?? this.selectedProspect;
      await Promise.all([this.loadProspectHistory(this.selectedProspect.id), this.loadProspects(), this.loadFollowUps(), this.refreshDashboard()]);
    },
    async deleteContactHistory(entry) {
      const response = await this.apiRequest('/admin-api/contact-history/' + entry.id, {
        method: 'DELETE',
        authenticated: true
      });
      if (!response.ok) throw new Error('Suppression historique impossible.');
      if (this.selectedProspect) await this.loadProspectHistory(this.selectedProspect.id);
      await Promise.all([this.loadFollowUps(), this.refreshDashboard()]);
    },
    async markFollowedUp(entry) {
      this.selectedProspect = {
        id: entry.prospect_id,
        organization_id: entry.organization_id,
        display_name: entry.prospect_display_name
      };
      this.contactHistoryForm = {
        channel: entry.channel || 'other',
        outcome: 'follow_up_needed',
        contactDate: new Date().toISOString().slice(0, 16),
        messageUsed: '',
        response: '',
        nextAction: '',
        followUpDate: '',
        notes: 'Relance effectuee'
      };
      await this.saveContactHistory();
    },
    async loadFollowUps() {
      if (!this.token) return;
      const params = new URLSearchParams();
      if (this.followUpFilters.overdue) params.set('overdue', 'true');
      if (this.followUpFilters.upcoming) params.set('upcoming', 'true');
      if (this.followUpFilters.city) params.set('city', this.followUpFilters.city);
      if (this.followUpFilters.scoreLabel) params.set('scoreLabel', this.followUpFilters.scoreLabel);
      if (this.followUpFilters.status) params.set('status', this.followUpFilters.status);
      const response = await this.apiRequest('/admin-api/contact-history/follow-ups' + (params.toString() ? '?' + params.toString() : ''), { authenticated: true });
      if (!response.ok) throw new Error('Chargement relances impossible.');
      const data = await response.json();
      this.followUps = data.followUps;
      this.contactChannels = data.channels;
      this.contactOutcomes = data.outcomes;
    },
    async exportContactHistory() {
      const response = await this.apiRequest('/admin-api/contact-history/export-csv', { authenticated: true });
      if (!response.ok) throw new Error('Export historique impossible.');
      const blob = new Blob([await response.text()], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'visitor-os-contact-history.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    async loadMessageTemplates() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/message-templates', { authenticated: true });
      if (!response.ok) throw new Error('Chargement des messages impossible.');
      const data = await response.json();
      this.messageTemplates = data.templates;
      this.messageTemplateChannels = data.channels;
      this.messageTemplatePurposes = data.purposes;
      if (!this.messageTemplateForm.organizationId && this.user?.organizationId) {
        this.messageTemplateForm.organizationId = this.user.organizationId;
      }
      if (!this.messageDraft.templateId && this.messageTemplates[0]) {
        this.messageDraft.templateId = this.messageTemplates[0].id;
      }
    },
    newMessageTemplate() {
      this.selectedMessageTemplate = null;
      this.messageTemplateForm = emptyMessageTemplateForm(this.user?.organizationId);
      this.navigate('message-template-new');
    },
    editMessageTemplate(template) {
      this.selectedMessageTemplate = template;
      this.messageTemplateForm = messageTemplateToForm(template);
      this.navigate('message-template-detail', template.id);
    },
    async saveMessageTemplate() {
      if (!this.canWriteProspects) return;
      const editing = Boolean(this.messageTemplateForm.id);
      const response = await this.apiRequest(
        editing ? '/admin-api/message-templates/' + this.messageTemplateForm.id : '/admin-api/message-templates',
        {
          method: editing ? 'PATCH' : 'POST',
          authenticated: true,
          body: JSON.stringify({
            ...this.messageTemplateForm,
            variables: this.messageTemplateForm.variables
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          })
        }
      );
      if (!response.ok) throw new Error('Enregistrement template impossible.');
      this.messageTemplateForm = emptyMessageTemplateForm(this.user?.organizationId);
      await Promise.all([this.loadMessageTemplates(), this.refreshDashboard()]);
      this.navigate('message-templates');
    },
    async deleteMessageTemplate(template) {
      const response = await this.apiRequest('/admin-api/message-templates/' + template.id, {
        method: 'DELETE',
        authenticated: true
      });
      if (!response.ok) throw new Error('Suppression template impossible.');
      await Promise.all([this.loadMessageTemplates(), this.refreshDashboard()]);
    },
    async renderProspectMessage(recordCopy = false) {
      if (!this.selectedProspect || !this.messageDraft.templateId) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/render-message', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          templateId: this.messageDraft.templateId,
          recordCopy
        })
      });
      if (!response.ok) throw new Error('Rendu du message impossible.');
      const data = await response.json();
      this.renderedMessage = data.rendered;
      const template = data.template ?? this.messageTemplates.find((item) => item.id === this.messageDraft.templateId);
      if (template?.channel && this.contactChannels.includes(template.channel)) {
        this.messageDraft.channel = template.channel;
      }
    },
    async copyRenderedMessage() {
      if (!this.renderedMessage) await this.renderProspectMessage(false);
      if (!this.renderedMessage) return;
      await navigator.clipboard.writeText(this.renderedMessage);
      await this.renderProspectMessage(true);
      await this.refreshDashboard();
    },
    async saveRenderedMessage() {
      if (!this.selectedProspect || !this.messageDraft.templateId || !this.renderedMessage) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/save-rendered-message', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          templateId: this.messageDraft.templateId,
          rendered: this.renderedMessage,
          channel: this.messageDraft.channel,
          outcome: this.messageDraft.outcome,
          followUpDate: this.messageDraft.followUpDate || undefined,
          notes: this.messageDraft.notes || undefined
        })
      });
      if (!response.ok) throw new Error('Historisation du message impossible.');
      const data = await response.json();
      this.selectedProspect = data.prospect ?? this.selectedProspect;
      this.messageDraft = emptyMessageDraft(this.messageDraft.templateId);
      this.renderedMessage = '';
      await Promise.all([
        this.loadProspectHistory(this.selectedProspect.id),
        this.loadProspects(),
        this.loadFollowUps(),
        this.loadMessageTemplates(),
        this.refreshDashboard()
      ]);
    },
    async loadProspectAnalysis(prospectId) {
      const response = await this.apiRequest('/admin-api/prospects/' + prospectId + '/analysis', { authenticated: true });
      if (!response.ok) throw new Error('Chargement analyse IA impossible.');
      const data = await response.json();
      this.prospectAiAnalysis = data.analysis;
    },
    async analyzeSelectedProspect() {
      if (!this.selectedProspect) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/analyze', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Analyse IA impossible.');
      const data = await response.json();
      this.prospectAiAnalysis = data.analysis;
      await this.refreshDashboard();
    },
    async analyzeProspectBatch() {
      const response = await this.apiRequest('/admin-api/prospects/analyze-batch', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ all: true })
      });
      if (!response.ok) throw new Error('Batch analyse IA impossible.');
      const data = await response.json();
      this.aiBatchJob = data.job;
      await this.refreshDashboard();
    },
    async loadProspectEnrichments(prospectId) {
      const response = await this.apiRequest('/admin-api/prospects/' + prospectId + '/enrichments', { authenticated: true });
      if (!response.ok) throw new Error('Chargement enrichissement impossible.');
      const data = await response.json();
      this.prospectEnrichments = data.enrichments;
      this.prospectSuggestions = data.suggestions;
    },
    async enrichSelectedProspect() {
      if (!this.selectedProspect) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/enrich', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Enrichissement impossible.');
      const data = await response.json();
      this.prospectEnrichments = data.enrichments;
      this.prospectSuggestions = data.suggestions;
      await Promise.all([this.loadEnrichments(), this.refreshDashboard()]);
    },
    async acceptSuggestion(suggestion) {
      if (!this.selectedProspect) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/suggestions/' + suggestion.id + '/accept', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Acceptation suggestion impossible.');
      const data = await response.json();
      this.selectedProspect = data.prospect ?? this.selectedProspect;
      this.prospectForm = prospectToForm(this.selectedProspect);
      await Promise.all([this.loadProspectEnrichments(this.selectedProspect.id), this.loadProspects(), this.refreshDashboard()]);
    },
    async rejectSuggestion(suggestion) {
      if (!this.selectedProspect) return;
      const response = await this.apiRequest('/admin-api/prospects/' + this.selectedProspect.id + '/suggestions/' + suggestion.id + '/reject', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Rejet suggestion impossible.');
      await this.loadProspectEnrichments(this.selectedProspect.id);
    },
    async loadEnrichments() {
      if (!this.token) return;
      const params = new URLSearchParams();
      if (this.enrichmentFilters.status) params.set('status', this.enrichmentFilters.status);
      if (this.enrichmentFilters.sourceType) params.set('sourceType', this.enrichmentFilters.sourceType);
      if (this.enrichmentFilters.city) params.set('city', this.enrichmentFilters.city);
      if (this.enrichmentFilters.platform) params.set('platform', this.enrichmentFilters.platform);
      if (this.enrichmentFilters.confidenceMin) params.set('confidenceMin', this.enrichmentFilters.confidenceMin);
      const response = await this.apiRequest('/admin-api/enrichments' + (params.toString() ? '?' + params.toString() : ''), { authenticated: true });
      if (!response.ok) throw new Error('Chargement enrichissements impossible.');
      const data = await response.json();
      this.enrichments = data.enrichments;
      this.enrichmentStatuses = data.statuses;
      this.enrichmentSourceTypes = data.sourceTypes;
    },
    async enrichProspectBatch() {
      const response = await this.apiRequest('/admin-api/prospects/enrich-batch', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ mode: 'not_enriched' })
      });
      if (!response.ok) throw new Error('Batch enrichissement impossible.');
      const data = await response.json();
      this.enrichmentBatchJob = data.job;
      await Promise.all([this.loadEnrichments(), this.refreshDashboard()]);
    },
    async exportMessageTemplates() {
      const response = await this.apiRequest('/admin-api/message-templates/export-csv', { authenticated: true });
      if (!response.ok) throw new Error('Export templates impossible.');
      downloadCsv(await response.text(), 'visitor-os-message-templates.csv');
    },
    async exportMessageUsage() {
      const response = await this.apiRequest('/admin-api/message-templates/usage-csv', { authenticated: true });
      if (!response.ok) throw new Error('Export usages impossible.');
      downloadCsv(await response.text(), 'visitor-os-message-usage.csv');
    },
    async exportProspects() {
      const response = await this.apiRequest('/admin-api/prospects/export-csv', { authenticated: true });
      if (!response.ok) throw new Error('Export CSV impossible.');
      const blob = new Blob([await response.text()], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'visitor-os-prospects.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    navigate(route) {
      this.route = route;
      const path = routePath(route, arguments[1]);
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
    notify(message) {
      this.notification = message;
      window.setTimeout(() => {
        if (this.notification === message) this.notification = '';
      }, 3500);
    },
    async apiRequest(path, options = {}) {
      const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.authenticated ? { Authorization: 'Bearer ' + this.token } : {}),
        ...(options.headers ?? {})
      };
      const retries = options.method && options.method !== 'GET' ? 0 : 1;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetch(this.apiBaseUrl + path, { ...options, headers });
          if (response.status >= 500 && attempt < retries) {
            await delay(350);
            continue;
          }
          return response;
        } catch (error) {
          if (attempt >= retries) throw error;
          await delay(350);
        }
      }
      throw new Error('API indisponible.');
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
          <button :class="['nav-item', { active: route.startsWith('prospect') }]" type="button" @click="navigate('prospects')">Prospects</button>
          <button :class="['nav-item', { active: route === 'pipeline' }]" type="button" @click="navigate('pipeline')">Pipeline</button>
          <button :class="['nav-item', { active: route === 'enrichments' }]" type="button" @click="navigate('enrichments')">Enrichments</button>
          <button :class="['nav-item', { active: route === 'follow-ups' }]" type="button" @click="navigate('follow-ups')">Relances</button>
          <button :class="['nav-item', { active: route.startsWith('message-template') }]" type="button" @click="navigate('message-templates')">Messages</button>
          <button :class="['nav-item', { active: route === 'settings' }]" type="button" @click="navigate('settings')">Parametres</button>
        </nav>
      </aside>
      <main class="content">
        <header class="topbar">
          <div><p class="eyebrow">Administration</p><h1>{{ routeTitle(route) }}</h1></div>
          <div class="topbar-actions"><span class="user-chip">{{ userName }}</span><button type="button" @click="logout()">Deconnexion</button></div>
        </header>
        <p v-if="error" class="error-message">{{ error }}</p>
        <p v-if="notification" class="toast-message">{{ notification }}</p>
        <div v-if="loading" class="loading-skeleton" aria-label="Chargement">
          <span></span><span></span><span></span>
        </div>

        <section v-if="route === 'dashboard'" class="dashboard-grid" aria-label="Etat general">
          <article class="metric"><span>Organisations</span><strong>{{ dashboard?.organizationsCount ?? 0 }}</strong><small>PostgreSQL</small></article>
          <article class="metric"><span>Utilisateurs</span><strong>{{ dashboard?.usersCount ?? 0 }}</strong><small>PostgreSQL</small></article>
          <article class="metric"><span>Role</span><strong>{{ user?.role }}</strong><small>{{ user?.email }}</small></article>
          <article class="metric"><span>Organisation</span><strong>{{ user?.organizationId }}</strong><small>Contexte actif</small></article>
          <article class="metric"><span>API</span><strong>{{ apiStatus }}</strong><small>{{ apiBaseUrl }}</small></article>
          <article class="metric"><span>PostgreSQL</span><strong>{{ databaseStatus }}</strong><small>/ready</small></article>
          <article class="metric"><span>Prospects</span><strong>{{ dashboard?.prospects?.total ?? 0 }}</strong><small>Total CRM</small></article>
          <article class="metric"><span>A contacter</span><strong>{{ dashboard?.prospects?.toContact ?? 0 }}</strong><small>Relance commerciale</small></article>
          <article class="metric"><span>Interessés</span><strong>{{ dashboard?.prospects?.interested ?? 0 }}</strong><small>Potentiel</small></article>
          <article class="metric"><span>Blacklist</span><strong>{{ dashboard?.prospects?.blacklist ?? 0 }}</strong><small>A exclure</small></article>
          <article class="metric"><span>Score élevé</span><strong>{{ dashboard?.prospects?.highScore ?? 0 }}</strong><small>high / very_high</small></article>
          <article class="metric"><span>Email</span><strong>{{ dashboard?.prospects?.withEmail ?? 0 }}</strong><small>Contactable</small></article>
          <article class="metric"><span>Téléphone</span><strong>{{ dashboard?.prospects?.withPhone ?? 0 }}</strong><small>Contactable</small></article>
          <article class="metric"><span>MYM / OnlyFans</span><strong>{{ dashboard?.prospects?.premiumPlatforms ?? 0 }}</strong><small>Plateformes</small></article>
          <article class="metric"><span>Relances aujourd'hui</span><strong>{{ dashboard?.contactHistory?.dueToday ?? 0 }}</strong><small>A traiter</small></article>
          <article class="metric"><span>Relances en retard</span><strong>{{ dashboard?.contactHistory?.overdue ?? 0 }}</strong><small>Urgent</small></article>
          <article class="metric"><span>Sans réponse</span><strong>{{ dashboard?.contactHistory?.noResponse ?? 0 }}</strong><small>Historique</small></article>
          <article class="metric"><span>Taux positif</span><strong>{{ dashboard?.contactHistory?.positiveRate ?? 0 }}%</strong><small>Simple</small></article>
          <article class="metric"><span>Contacts semaine</span><strong>{{ dashboard?.contactHistory?.contactsThisWeek ?? 0 }}</strong><small>7 jours</small></article>
          <article class="metric"><span>Jamais contactés</span><strong>{{ dashboard?.contactHistory?.neverContacted ?? 0 }}</strong><small>A qualifier</small></article>
          <article class="metric"><span>Templates actifs</span><strong>{{ dashboard?.messageTemplates?.activeTemplates ?? 0 }}</strong><small>Messages</small></article>
          <article class="metric"><span>Messages copiés</span><strong>{{ dashboard?.messageTemplates?.copiedThisWeek ?? 0 }}</strong><small>7 jours</small></article>
          <article class="metric"><span>Messages historisés</span><strong>{{ dashboard?.messageTemplates?.historySavedThisWeek ?? 0 }}</strong><small>7 jours</small></article>
          <article class="metric"><span>Prospects analysés</span><strong>{{ dashboard?.aiQualification?.analyzedProspects ?? 0 }}</strong><small>AI Analysis</small></article>
          <article class="metric"><span>Analyses en attente</span><strong>{{ dashboard?.aiQualification?.pendingAnalyses ?? 0 }}</strong><small>A traiter</small></article>
          <article class="metric"><span>Score IA moyen</span><strong>{{ dashboard?.aiQualification?.averageConfidence ?? 0 }}</strong><small>Confiance</small></article>
          <article class="metric"><span>Opportunités IA</span><strong>{{ dashboard?.aiQualification?.priorityOpportunities ?? 0 }}</strong><small>high / very_high</small></article>
          <article class="metric"><span>Prospects enrichis</span><strong>{{ dashboard?.enrichments?.enrichedProspects ?? 0 }}</strong><small>Public</small></article>
          <article class="metric"><span>Enrichissements OK</span><strong>{{ dashboard?.enrichments?.successful ?? 0 }}</strong><small>success</small></article>
          <article class="metric"><span>Enrichissements partiels</span><strong>{{ dashboard?.enrichments?.partial ?? 0 }}</strong><small>partial</small></article>
          <article class="metric"><span>Bloques</span><strong>{{ dashboard?.enrichments?.blocked ?? 0 }}</strong><small>Protection</small></article>
          <article class="metric"><span>Suggestions</span><strong>{{ dashboard?.enrichments?.pendingSuggestions ?? 0 }}</strong><small>En attente</small></article>
          <article class="metric"><span>Emails detectes</span><strong>{{ dashboard?.enrichments?.detectedEmails ?? 0 }}</strong><small>Public</small></article>
          <article class="metric"><span>Telephones detectes</span><strong>{{ dashboard?.enrichments?.detectedPhones ?? 0 }}</strong><small>Public</small></article>
          <article class="metric"><span>Conversion globale</span><strong>{{ dashboard?.pipeline?.newToSignedRate ?? 0 }}%</strong><small>new -> signed</small></article>
          <article class="metric"><span>Bloques sans action</span><strong>{{ dashboard?.pipeline?.stalledProspects ?? 0 }}</strong><small>14 jours</small></article>
          <article class="metric"><span>Forecast moyen</span><strong>{{ dashboard?.forecast?.mediumEstimate ?? 0 }} €</strong><small>Prévision simple</small></article>
          <article class="metric"><span>Prioritaires non contactés</span><strong>{{ dashboard?.forecast?.highPriorityUncontacted ?? 0 }}</strong><small>high / very_high</small></article>
        </section>

        <section v-if="route === 'dashboard' && dashboard?.pipeline?.byStage?.length" class="panel">
          <div class="panel-header"><h2>Pipeline par etape</h2><span class="badge">Conversion</span></div>
          <div class="pipeline-mini">
            <article v-for="stage in dashboard.pipeline.byStage" :key="stage.stage">
              <span>{{ stage.stage }}</span><strong>{{ stage.count }}</strong>
            </article>
          </div>
        </section>

        <section v-if="route === 'dashboard' && dashboard?.activity?.length" class="panel">
          <div class="panel-header"><h2>Activite recente</h2><span class="badge">CRM</span></div>
          <div class="activity-list">
            <article v-for="item in dashboard.activity.slice(0, 8)" :key="item.id">
              <strong>{{ item.action_type }}</strong>
              <span>{{ item.prospect_display_name || item.prospect_id || '-' }}</span>
              <small>{{ item.created_at }}</small>
            </article>
          </div>
        </section>

        <section v-if="route === 'dashboard' && dashboard?.aiQualification?.topProspects?.length" class="panel">
          <div class="panel-header"><h2>Top prospects IA</h2><span class="badge">Priorites commerciales</span></div>
          <div class="table-wrap">
            <table><thead><tr><th>Prospect</th><th>Priorite</th><th>Confiance</th><th>Offre</th></tr></thead>
              <tbody><tr v-for="prospect in dashboard.aiQualification.topProspects" :key="prospect.prospectId">
                <td><strong>{{ prospect.displayName }}</strong></td>
                <td><span class="badge">{{ prospect.priority }}</span></td>
                <td><span class="score-pill">{{ prospect.confidence }}/100</span></td>
                <td>{{ prospect.recommendedOffer }}</td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'dashboard' && dashboard?.enrichments?.topPlatforms?.length" class="panel">
          <div class="panel-header"><h2>Plateformes detectees</h2><span class="badge">Enrichissement public</span></div>
          <div class="table-wrap">
            <table><thead><tr><th>Plateforme</th><th>Occurrences</th></tr></thead>
              <tbody><tr v-for="platform in dashboard.enrichments.topPlatforms" :key="platform.platform">
                <td><strong>{{ platform.platform }}</strong></td>
                <td><span class="score-pill">{{ platform.count }}</span></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'pipeline'" class="panel pipeline-panel">
          <div class="panel-header">
            <h2>Pipeline commercial</h2>
            <div class="inline-actions">
              <button type="button" @click="loadPipeline">Actualiser</button>
            </div>
          </div>
          <form class="filters" @submit.prevent="loadPipeline">
            <input v-model="pipelineFilters.city" @input="loadPipeline" placeholder="Ville" />
            <select v-model="pipelineFilters.scoreLabel" @change="loadPipeline"><option value="">Tous scores</option><option v-for="label in prospectScoreLabels" :key="label" :value="label">{{ label }}</option></select>
            <select v-model="pipelineFilters.platform" @change="loadPipeline"><option value="">Toutes plateformes</option><option v-for="platform in prospectPlatforms" :key="platform" :value="platform">{{ platform }}</option></select>
            <select v-model="pipelineFilters.sort" @change="loadPipeline"><option value="score">Score</option><option value="follow_up">Relance</option><option value="created_at">Creation</option></select>
          </form>
          <div v-if="pipelineMetrics" class="dashboard-grid compact-grid">
            <article class="metric"><span>Contacte -> Interesse</span><strong>{{ pipelineMetrics.contactedToInterestedRate }}%</strong><small>Conversion</small></article>
            <article class="metric"><span>Interesse -> Client</span><strong>{{ pipelineMetrics.interestedToSignedRate }}%</strong><small>Conversion</small></article>
            <article class="metric"><span>New -> Client</span><strong>{{ pipelineMetrics.newToSignedRate }}%</strong><small>Global</small></article>
            <article class="metric"><span>Relances retard</span><strong>{{ pipelineMetrics.overdueFollowUps }}</strong><small>Critique</small></article>
          </div>
          <div v-if="pipelineForecast" class="dashboard-grid compact-grid">
            <article class="metric"><span>Basse</span><strong>{{ pipelineForecast.lowEstimate }} €</strong><small>{{ pipelineForecast.lowConversionRate }}%</small></article>
            <article class="metric"><span>Moyenne</span><strong>{{ pipelineForecast.mediumEstimate }} €</strong><small>{{ pipelineForecast.mediumConversionRate }}%</small></article>
            <article class="metric"><span>Haute</span><strong>{{ pipelineForecast.highEstimate }} €</strong><small>{{ pipelineForecast.highConversionRate }}%</small></article>
            <article class="metric"><span>Panier moyen</span><strong>{{ pipelineForecast.averageDealValue }} €</strong><small>Configurable API</small></article>
          </div>
          <div class="pipeline-board">
            <section v-for="column in pipelineColumns" :key="column.stage" class="pipeline-column" @dragover.prevent @drop="dropProspectOnStage(column.stage)">
              <header><strong>{{ column.label }}</strong><span class="badge">{{ column.count }}</span></header>
              <article v-for="prospect in column.prospects" :key="prospect.id" class="pipeline-card" draggable="true" @dragstart="startProspectDrag(prospect)">
                <div><strong>{{ prospect.display_name }}</strong><small>{{ prospect.city || '-' }} · {{ prospect.platform || '-' }}</small></div>
                <p><span class="score-pill">{{ prospect.score }} / {{ prospect.score_label }}</span></p>
                <p v-if="prospect.next_follow_up_at"><small>Relance : {{ prospect.next_follow_up_at }}</small></p>
                <div class="inline-actions">
                  <button type="button" @click="editProspect(prospect)">Ouvrir</button>
                  <select :value="prospect.status" @change="moveProspectToStage(prospect, $event.target.value)">
                    <option v-for="stage in pipelineStages" :key="stage" :value="stage">{{ stage }}</option>
                  </select>
                </div>
              </article>
            </section>
          </div>
          <section class="activity-list">
            <h3>Activite pipeline</h3>
            <article v-for="item in pipelineActivity" :key="item.id">
              <strong>{{ item.action_type }}</strong>
              <span>{{ item.prospect_display_name || item.prospect_id || '-' }}</span>
              <small>{{ item.previous_value || '-' }} -> {{ item.new_value || '-' }}</small>
            </article>
          </section>
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

        <section v-if="route === 'prospects'" class="panel">
          <div class="panel-header">
            <h2>Prospects</h2>
            <div class="inline-actions">
              <input v-model="prospectSearch" @input="loadProspects" placeholder="Rechercher" />
              <button v-if="canWriteProspects" type="button" @click="newProspect">Nouveau</button>
              <button type="button" @click="navigate('prospect-import')">Import CSV</button>
              <button type="button" @click="exportProspects">Export CSV</button>
            </div>
          </div>
          <form class="filters" @submit.prevent="loadProspects">
            <select v-model="prospectFilters.status" @change="loadProspects"><option value="">Tous statuts</option><option v-for="status in prospectStatuses" :key="status" :value="status">{{ status }}</option></select>
            <input v-model="prospectFilters.city" @input="loadProspects" placeholder="Ville" />
            <select v-model="prospectFilters.scoreLabel" @change="loadProspects"><option value="">Tous scores</option><option v-for="label in prospectScoreLabels" :key="label" :value="label">{{ label }}</option></select>
            <select v-model="prospectFilters.platform" @change="loadProspects"><option value="">Toutes plateformes</option><option v-for="platform in prospectPlatforms" :key="platform" :value="platform">{{ platform }}</option></select>
          </form>
          <div class="table-wrap">
            <table><thead><tr><th>Prospect</th><th>Contact</th><th>Ville</th><th>Statut</th><th>Score</th><th></th></tr></thead>
              <tbody><tr v-for="prospect in prospects" :key="prospect.id">
                <td><strong>{{ prospect.display_name }}</strong><small>{{ prospect.pseudo || prospect.company || prospect.source_url || '-' }}</small></td>
                <td>{{ prospect.email || prospect.phone || '-' }}</td>
                <td>{{ prospect.city || '-' }}</td>
                <td><span class="badge">{{ prospect.status }}</span></td>
                <td><span class="score-pill">{{ prospect.score }} / {{ prospect.score_label }}</span></td>
                <td class="actions"><button type="button" @click="editProspect(prospect)">Ouvrir</button><button v-if="canWriteProspects" type="button" @click="deleteProspect(prospect)">Supprimer</button></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'prospect-new' || route === 'prospect-detail'" class="panel">
          <div class="panel-header"><h2>{{ prospectForm.id ? 'Modifier prospect' : 'Nouveau prospect' }}</h2><button type="button" @click="navigate('prospects')">Retour</button></div>
          <form class="admin-form prospect-form" @submit.prevent="saveProspect">
            <select v-model="prospectForm.organizationId" required>
              <option value="" disabled>Organisation</option>
              <option v-for="organization in organizations" :key="organization.id" :value="organization.id">{{ organization.name }}</option>
            </select>
            <input v-model="prospectForm.firstName" placeholder="Prenom" />
            <input v-model="prospectForm.lastName" placeholder="Nom" />
            <input v-model="prospectForm.pseudo" placeholder="Pseudo" />
            <input v-model="prospectForm.company" placeholder="Societe" />
            <input v-model="prospectForm.email" placeholder="Email" type="email" />
            <input v-model="prospectForm.phone" placeholder="Telephone" />
            <input v-model="prospectForm.city" placeholder="Ville" />
            <input v-model="prospectForm.activity" placeholder="Activite" />
            <input v-model="prospectForm.website" placeholder="Site / Portfolio" />
            <input v-model="prospectForm.instagram" placeholder="Instagram" />
            <input v-model="prospectForm.twitterX" placeholder="Twitter / X" />
            <input v-model="prospectForm.mym" placeholder="MYM" />
            <input v-model="prospectForm.onlyfans" placeholder="OnlyFans" />
            <input v-model="prospectForm.linktree" placeholder="Linktree" />
            <input v-model="prospectForm.allmylinks" placeholder="AllMyLinks" />
            <input v-model="prospectForm.sourceUrl" placeholder="URL source" />
            <select v-model="prospectForm.status"><option v-for="status in prospectStatuses" :key="status" :value="status">{{ status }}</option></select>
            <textarea v-model="prospectForm.description" placeholder="Description"></textarea>
            <textarea v-model="prospectForm.notes" placeholder="Notes internes"></textarea>
            <button type="submit">{{ prospectForm.id ? 'Modifier' : 'Creer' }}</button>
          </form>
          <section v-if="route === 'prospect-detail'" class="timeline-section">
            <div class="panel-header">
              <h2>Enrichment</h2>
              <div class="inline-actions">
                <button type="button" @click="enrichSelectedProspect">Enrichir ce prospect</button>
                <button type="button" @click="enrichProspectBatch">Enrichir batch</button>
              </div>
            </div>
            <div class="analysis-grid">
              <article class="analysis-main">
                <h3>Suggestions</h3>
                <p v-if="!prospectSuggestions.length">Aucune suggestion en attente.</p>
                <ul v-else>
                  <li v-for="suggestion in prospectSuggestions" :key="suggestion.id">
                    <strong>{{ suggestion.field_name }}</strong> : {{ suggestion.suggested_value }}
                    <span class="badge">{{ suggestion.status }}</span>
                    <button v-if="suggestion.status === 'pending'" type="button" @click="acceptSuggestion(suggestion)">Accepter</button>
                    <button v-if="suggestion.status === 'pending'" type="button" @click="rejectSuggestion(suggestion)">Rejeter</button>
                  </li>
                </ul>
              </article>
              <article v-for="enrichment in prospectEnrichments" :key="enrichment.id">
                <h3>{{ enrichment.source_type }}</h3>
                <p><span class="badge">{{ enrichment.status }}</span> <span class="score-pill">{{ enrichment.confidence_score }}/100</span></p>
                <p>{{ enrichment.extracted_summary || enrichment.error_message || enrichment.meta_description || '-' }}</p>
                <p v-if="enrichment.detected_emails?.length"><strong>Emails :</strong> {{ enrichment.detected_emails.join(', ') }}</p>
                <p v-if="enrichment.detected_phones?.length"><strong>Telephones :</strong> {{ enrichment.detected_phones.join(', ') }}</p>
                <p v-if="enrichment.detected_platforms?.length"><strong>Plateformes :</strong> {{ enrichment.detected_platforms.join(', ') }}</p>
              </article>
            </div>
            <div class="panel-header">
              <h2>AI Analysis</h2>
              <div class="inline-actions">
                <button type="button" @click="analyzeSelectedProspect">Recalculer l'analyse</button>
                <button type="button" @click="analyzeProspectBatch">Analyser tous</button>
              </div>
            </div>
            <div v-if="prospectAiAnalysis" class="analysis-grid">
              <article class="analysis-main">
                <h3>Résumé IA</h3>
                <p>{{ prospectAiAnalysis.summary }}</p>
                <dl class="status-strip"><div><dt>Offre</dt><dd>{{ prospectAiAnalysis.recommended_offer }}</dd></div><div><dt>Confiance</dt><dd>{{ prospectAiAnalysis.confidence }}/100</dd></div></dl>
              </article>
              <article><h3>Forces</h3><ul><li v-for="item in prospectAiAnalysis.strengths" :key="item">{{ item }}</li></ul></article>
              <article><h3>Faiblesses</h3><ul><li v-for="item in prospectAiAnalysis.weaknesses" :key="item">{{ item }}</li></ul></article>
              <article><h3>Opportunités</h3><ul><li v-for="item in prospectAiAnalysis.opportunities" :key="item">{{ item }}</li></ul></article>
              <article><h3>Risques</h3><ul><li v-for="item in prospectAiAnalysis.risks" :key="item">{{ item }}</li></ul></article>
              <article><h3>Priorité</h3><p><span class="score-pill">{{ prospectAiAnalysis.priority }}</span></p></article>
            </div>
            <div v-else class="empty-panel"><p>Aucune analyse IA pour ce prospect.</p></div>
            <div class="panel-header"><h2>Messages</h2><span class="badge">Copie manuelle uniquement</span></div>
            <form class="admin-form prospect-form" @submit.prevent="renderProspectMessage(false)">
              <select v-model="messageDraft.templateId" required>
                <option value="" disabled>Template</option>
                <option v-for="template in messageTemplates" :key="template.id" :value="template.id">{{ template.name }}</option>
              </select>
              <select v-model="messageDraft.channel"><option v-for="channel in contactChannels" :key="channel" :value="channel">{{ channel }}</option></select>
              <select v-model="messageDraft.outcome"><option v-for="outcome in contactOutcomes" :key="outcome" :value="outcome">{{ outcome }}</option></select>
              <input v-model="messageDraft.followUpDate" type="datetime-local" />
              <textarea v-model="messageDraft.notes" placeholder="Notes optionnelles"></textarea>
              <button type="submit">Previsualiser</button>
            </form>
            <div v-if="renderedMessage" class="message-preview">
              <textarea v-model="renderedMessage"></textarea>
              <div class="inline-actions">
                <button type="button" @click="copyRenderedMessage">Copier</button>
                <button type="button" @click="saveRenderedMessage">Enregistrer dans l'historique</button>
              </div>
            </div>
            <div class="panel-header"><h2>Timeline / Historique</h2><span class="badge">{{ contactHistory.length }} interaction(s)</span></div>
            <form class="admin-form prospect-form" @submit.prevent="saveContactHistory">
              <input v-model="contactHistoryForm.contactDate" type="datetime-local" />
              <select v-model="contactHistoryForm.channel"><option v-for="channel in contactChannels" :key="channel" :value="channel">{{ channel }}</option></select>
              <select v-model="contactHistoryForm.outcome"><option v-for="outcome in contactOutcomes" :key="outcome" :value="outcome">{{ outcome }}</option></select>
              <input v-model="contactHistoryForm.followUpDate" type="datetime-local" />
              <input v-model="contactHistoryForm.nextAction" placeholder="Prochaine action" />
              <textarea v-model="contactHistoryForm.messageUsed" placeholder="Message utilise"></textarea>
              <textarea v-model="contactHistoryForm.response" placeholder="Reponse"></textarea>
              <textarea v-model="contactHistoryForm.notes" placeholder="Notes"></textarea>
              <button type="submit">Ajouter interaction</button>
            </form>
            <div class="timeline">
              <article v-for="entry in contactHistory" :key="entry.id" class="timeline-item">
                <header><strong>{{ entry.channel }}</strong><span class="badge">{{ entry.outcome }}</span><small>{{ entry.contact_date }}</small></header>
                <p v-if="entry.message_used">{{ entry.message_used }}</p>
                <p v-if="entry.response"><strong>Reponse :</strong> {{ entry.response }}</p>
                <p v-if="entry.next_action"><strong>Prochaine action :</strong> {{ entry.next_action }}</p>
                <p v-if="entry.follow_up_date"><strong>Relance :</strong> {{ entry.follow_up_date }}</p>
                <p v-if="entry.notes">{{ entry.notes }}</p>
                <button v-if="canWriteProspects" type="button" @click="deleteContactHistory(entry)">Supprimer</button>
              </article>
            </div>
          </section>
        </section>

        <section v-if="route === 'enrichments'" class="panel">
          <div class="panel-header">
            <h2>Enrichissements publics</h2>
            <div class="inline-actions">
              <button type="button" @click="loadEnrichments">Actualiser</button>
              <button type="button" @click="enrichProspectBatch">Batch prospects</button>
            </div>
          </div>
          <form class="filters" @submit.prevent="loadEnrichments">
            <select v-model="enrichmentFilters.status" @change="loadEnrichments"><option value="">Tous statuts</option><option v-for="status in enrichmentStatuses" :key="status" :value="status">{{ status }}</option></select>
            <select v-model="enrichmentFilters.sourceType" @change="loadEnrichments"><option value="">Toutes sources</option><option v-for="sourceType in enrichmentSourceTypes" :key="sourceType" :value="sourceType">{{ sourceType }}</option></select>
            <input v-model="enrichmentFilters.city" @input="loadEnrichments" placeholder="Ville detectee" />
            <input v-model="enrichmentFilters.platform" @input="loadEnrichments" placeholder="Plateforme" />
            <input v-model="enrichmentFilters.confidenceMin" @input="loadEnrichments" type="number" min="0" max="100" placeholder="Score min" />
          </form>
          <div class="table-wrap">
            <table><thead><tr><th>Source</th><th>Statut</th><th>Confiance</th><th>Donnees</th><th>Erreur</th></tr></thead>
              <tbody><tr v-for="enrichment in enrichments" :key="enrichment.id">
                <td><strong>{{ enrichment.source_type }}</strong><small>{{ enrichment.source_url }}</small></td>
                <td><span class="badge">{{ enrichment.status }}</span></td>
                <td><span class="score-pill">{{ enrichment.confidence_score }}/100</span></td>
                <td><small>{{ [...(enrichment.detected_emails || []), ...(enrichment.detected_phones || []), ...(enrichment.detected_platforms || [])].join(', ') || '-' }}</small></td>
                <td>{{ enrichment.error_message || '-' }}</td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'message-templates'" class="panel">
          <div class="panel-header">
            <h2>Messages</h2>
            <div class="inline-actions">
              <button v-if="canWriteProspects" type="button" @click="newMessageTemplate">Nouveau</button>
              <button type="button" @click="exportMessageTemplates">Export templates</button>
              <button type="button" @click="exportMessageUsage">Export usages</button>
            </div>
          </div>
          <div class="table-wrap">
            <table><thead><tr><th>Nom</th><th>Canal</th><th>Objectif</th><th>Statut</th><th></th></tr></thead>
              <tbody><tr v-for="template in messageTemplates" :key="template.id">
                <td><strong>{{ template.name }}</strong><small>{{ template.content.slice(0, 90) }}</small></td>
                <td>{{ template.channel }}</td>
                <td>{{ template.purpose }}</td>
                <td><span class="badge">{{ template.is_active ? 'actif' : 'inactif' }}</span></td>
                <td class="actions"><button type="button" @click="editMessageTemplate(template)">Ouvrir</button><button v-if="canWriteProspects" type="button" @click="deleteMessageTemplate(template)">Supprimer</button></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'message-template-new' || route === 'message-template-detail'" class="panel">
          <div class="panel-header"><h2>{{ messageTemplateForm.id ? 'Modifier message' : 'Nouveau message' }}</h2><button type="button" @click="navigate('message-templates')">Retour</button></div>
          <form class="admin-form prospect-form" @submit.prevent="saveMessageTemplate">
            <select v-model="messageTemplateForm.organizationId" required>
              <option value="" disabled>Organisation</option>
              <option v-for="organization in organizations" :key="organization.id" :value="organization.id">{{ organization.name }}</option>
            </select>
            <input v-model="messageTemplateForm.name" placeholder="Nom" required />
            <select v-model="messageTemplateForm.channel"><option v-for="channel in messageTemplateChannels" :key="channel" :value="channel">{{ channel }}</option></select>
            <select v-model="messageTemplateForm.purpose"><option v-for="purpose in messageTemplatePurposes" :key="purpose" :value="purpose">{{ purpose }}</option></select>
            <label class="checkbox-field"><input v-model="messageTemplateForm.isActive" type="checkbox" /> Actif</label>
            <input v-model="messageTemplateForm.variables" placeholder="Variables separees par virgule" />
            <textarea v-model="messageTemplateForm.content" placeholder="Contenu du message" required></textarea>
            <button type="submit">{{ messageTemplateForm.id ? 'Modifier' : 'Creer' }}</button>
          </form>
          <p class="muted">Variables disponibles : first_name, last_name, pseudo, city, activity, platform, website, instagram, mym, onlyfans, score_label.</p>
        </section>

        <section v-if="route === 'prospect-import'" class="panel">
          <div class="panel-header"><h2>Import CSV prospects</h2><button type="button" @click="navigate('prospects')">Retour</button></div>
          <p class="muted">Champs acceptes : first_name, last_name, pseudo, company, email, phone, website, instagram, twitter_x, mym, onlyfans, linktree, allmylinks, city, activity, description, source_url, status, notes.</p>
          <form class="import-form" @submit.prevent="importProspects">
            <textarea v-model="prospectImportCsv" placeholder="Colle le contenu CSV ici" required></textarea>
            <button type="submit">Importer</button>
          </form>
        </section>

        <section v-if="route === 'follow-ups'" class="panel">
          <div class="panel-header">
            <h2>Relances</h2>
            <div class="inline-actions"><button type="button" @click="exportContactHistory">Export CSV</button></div>
          </div>
          <form class="filters" @submit.prevent="loadFollowUps">
            <label><input v-model="followUpFilters.overdue" type="checkbox" @change="loadFollowUps" /> En retard</label>
            <label><input v-model="followUpFilters.upcoming" type="checkbox" @change="loadFollowUps" /> A venir</label>
            <input v-model="followUpFilters.city" @input="loadFollowUps" placeholder="Ville" />
            <select v-model="followUpFilters.scoreLabel" @change="loadFollowUps"><option value="">Tous scores</option><option v-for="label in prospectScoreLabels" :key="label" :value="label">{{ label }}</option></select>
            <select v-model="followUpFilters.status" @change="loadFollowUps"><option value="">Tous statuts</option><option v-for="status in prospectStatuses" :key="status" :value="status">{{ status }}</option></select>
          </form>
          <div class="table-wrap">
            <table><thead><tr><th>Prospect</th><th>Relance</th><th>Outcome</th><th>Action</th><th></th></tr></thead>
              <tbody><tr v-for="entry in followUps" :key="entry.id">
                <td><strong>{{ entry.prospect_display_name || entry.prospect_id }}</strong><small>{{ entry.prospect_city || '-' }} · score {{ entry.prospect_score ?? '-' }}</small></td>
                <td>{{ entry.follow_up_date }}</td>
                <td><span class="badge">{{ entry.outcome }}</span></td>
                <td>{{ entry.next_action || entry.notes || '-' }}</td>
                <td class="actions"><button type="button" @click="markFollowedUp(entry)">Marquer relancé</button></td>
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
  if (pathname === '/pipeline') return 'pipeline';
  if (pathname === '/organizations') return 'organizations';
  if (pathname === '/users') return 'users';
  if (pathname === '/prospects') return 'prospects';
  if (pathname === '/prospects/new') return 'prospect-new';
  if (pathname === '/prospects/import') return 'prospect-import';
  if (pathname.startsWith('/prospects/')) return 'prospect-detail';
  if (pathname === '/enrichments') return 'enrichments';
  if (pathname === '/follow-ups') return 'follow-ups';
  if (pathname === '/message-templates') return 'message-templates';
  if (pathname === '/message-templates/new') return 'message-template-new';
  if (pathname.startsWith('/message-templates/')) return 'message-template-detail';
  if (pathname === '/settings') return 'settings';
  return 'dashboard';
}

function routePath(route, id) {
  if (route === 'dashboard') return '/';
  if (route === 'pipeline') return '/pipeline';
  if (route === 'prospect-new') return '/prospects/new';
  if (route === 'prospect-import') return '/prospects/import';
  if (route === 'prospect-detail') return '/prospects/' + id;
  if (route === 'follow-ups') return '/follow-ups';
  if (route === 'message-template-new') return '/message-templates/new';
  if (route === 'message-template-detail') return '/message-templates/' + id;
  return '/' + route;
}

function routeTitle(route) {
  return {
    dashboard: 'Dashboard',
    pipeline: 'Pipeline',
    organizations: 'Organisations',
    users: 'Utilisateurs',
    prospects: 'Prospects',
    'prospect-new': 'Nouveau prospect',
    'prospect-detail': 'Prospect',
    'prospect-import': 'Import CSV',
    enrichments: 'Enrichissements',
    'follow-ups': 'Relances',
    'message-templates': 'Messages',
    'message-template-new': 'Nouveau message',
    'message-template-detail': 'Message',
    settings: 'Parametres'
  }[route] ?? 'Dashboard';
}

function emptyOrganizationForm() {
  return { id: '', name: '', slug: '', email: '', phone: '', country: 'FR', language: 'fr', timezone: 'Europe/Paris', currency: 'EUR', status: 'active', plan: '' };
}

function emptyUserForm(organizationId = '') {
  return { id: '', organizationId, firstName: '', lastName: '', email: '', password: '', role: 'Viewer', status: 'active' };
}

function emptyProspectForm(organizationId = '') {
  return {
    id: '',
    organizationId,
    firstName: '',
    lastName: '',
    pseudo: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    instagram: '',
    twitterX: '',
    mym: '',
    onlyfans: '',
    linktree: '',
    allmylinks: '',
    city: '',
    activity: '',
    description: '',
    sourceUrl: '',
    status: 'new',
    notes: ''
  };
}

function prospectToForm(prospect) {
  return {
    id: prospect.id,
    organizationId: prospect.organization_id,
    firstName: prospect.first_name ?? '',
    lastName: prospect.last_name ?? '',
    pseudo: prospect.pseudo ?? '',
    company: prospect.company ?? '',
    email: prospect.email ?? '',
    phone: prospect.phone ?? '',
    website: prospect.website ?? '',
    instagram: prospect.instagram ?? '',
    twitterX: prospect.twitter_x ?? '',
    mym: prospect.mym ?? '',
    onlyfans: prospect.onlyfans ?? '',
    linktree: prospect.linktree ?? '',
    allmylinks: prospect.allmylinks ?? '',
    city: prospect.city ?? '',
    activity: prospect.activity ?? '',
    description: prospect.description ?? '',
    sourceUrl: prospect.source_url ?? '',
    status: prospect.status ?? 'new',
    notes: prospect.notes ?? ''
  };
}

function emptyContactHistoryForm() {
  return {
    contactDate: new Date().toISOString().slice(0, 16),
    channel: 'email',
    outcome: 'no_response',
    messageUsed: '',
    response: '',
    nextAction: '',
    followUpDate: '',
    notes: ''
  };
}

function emptyMessageTemplateForm(organizationId = '') {
  return {
    id: '',
    organizationId,
    name: '',
    channel: 'email',
    purpose: 'first_contact',
    content: '',
    variables: '',
    isActive: true
  };
}

function messageTemplateToForm(template) {
  return {
    id: template.id,
    organizationId: template.organization_id,
    name: template.name,
    channel: template.channel,
    purpose: template.purpose,
    content: template.content,
    variables: Array.isArray(template.variables) ? template.variables.join(', ') : '',
    isActive: Boolean(template.is_active)
  };
}

function emptyMessageDraft(templateId = '') {
  return {
    templateId,
    channel: 'email',
    outcome: 'no_response',
    followUpDate: '',
    notes: ''
  };
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function responseJsonOrFallback(result, fallback) {
  if (result.status !== 'fulfilled' || !result.value.ok) return fallback;
  return result.value.json();
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
button, input, select, textarea { font: inherit; }
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
.login-panel input, .admin-form input, .admin-form select, .admin-form textarea, .panel-header input, .filters input, .filters select, .import-form textarea, .message-preview textarea {
  width: 100%;
  min-height: 42px;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
textarea { resize: vertical; }
input:focus, select:focus, textarea:focus { outline: 3px solid rgba(22, 106, 91, 0.18); border-color: #166a5b; }
.error-message { border: 1px solid #fecaca; border-radius: 6px; margin: 0 0 14px; padding: 10px 12px; color: #991b1b; background: #fff1f2; }
.toast-message { position: sticky; top: 12px; z-index: 4; border: 1px solid #a7f3d0; border-radius: 6px; margin: 0 0 14px; padding: 10px 12px; color: #065f46; background: #ecfdf5; }
.loading-skeleton { display: grid; gap: 10px; margin: 0 0 14px; }
.loading-skeleton span { display: block; height: 12px; border-radius: 999px; background: linear-gradient(90deg, #e7edf5, #f6f8fb, #e7edf5); background-size: 220% 100%; animation: shimmer 1.2s linear infinite; }
.loading-skeleton span:nth-child(2) { width: 72%; }
.loading-skeleton span:nth-child(3) { width: 48%; }
@keyframes shimmer { from { background-position: 220% 0; } to { background-position: -220% 0; } }
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
.prospect-form { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.prospect-form textarea { grid-column: span 2; min-height: 92px; }
.inline-actions, .filters { display: flex; flex-wrap: wrap; gap: 10px; }
.filters { padding: 14px 18px; border-bottom: 1px solid #e6ebf2; }
.filters label { display: inline-flex; align-items: center; gap: 7px; min-height: 42px; color: #354157; }
.filters label input { width: auto; }
.checkbox-field { display: inline-flex; align-items: center; gap: 8px; color: #354157; }
.checkbox-field input { width: auto; min-height: auto; }
.filters input, .filters select { width: auto; min-width: 180px; }
.import-form { display: grid; gap: 12px; padding: 18px; }
.import-form textarea { min-height: 280px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.message-preview { display: grid; gap: 12px; padding: 18px; border-bottom: 1px solid #e6ebf2; background: #fbfcfe; }
.message-preview textarea { min-height: 160px; }
.analysis-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 18px; border-bottom: 1px solid #e6ebf2; }
.analysis-grid article { display: grid; gap: 8px; border: 1px solid #e6ebf2; border-radius: 8px; padding: 14px; background: #fbfcfe; }
.analysis-grid .analysis-main { grid-column: span 2; }
.analysis-grid ul { margin: 0; padding-left: 18px; color: #354157; }
.muted { padding: 0 18px; color: #647084; }
.timeline-section { border-top: 1px solid #e6ebf2; }
.timeline { display: grid; gap: 12px; padding: 18px; }
.timeline-item { display: grid; gap: 8px; border: 1px solid #e6ebf2; border-radius: 8px; padding: 14px; background: #fbfcfe; }
.timeline-item header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.timeline-item p { color: #354157; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { border-bottom: 1px solid #edf1f6; padding: 12px 18px; text-align: left; vertical-align: top; }
th { color: #647084; font-size: 13px; font-weight: 700; }
td strong, td small { display: block; }
.badge { display: inline-flex; border-radius: 999px; padding: 4px 8px; color: #075e51; background: #dff8ef; font-size: 12px; font-weight: 700; }
.score-pill { display: inline-flex; border-radius: 999px; padding: 4px 8px; color: #1e3a8a; background: #dbeafe; font-size: 12px; font-weight: 700; }
.actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.actions button { min-height: 32px; padding: 7px 9px; font-size: 13px; }
.empty-panel { display: grid; gap: 8px; padding: 18px; }
.compact-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.pipeline-mini { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; padding: 18px; }
.pipeline-mini article { display: grid; gap: 5px; border: 1px solid #e6ebf2; border-radius: 8px; padding: 12px; background: #fbfcfe; }
.pipeline-mini span { color: #647084; font-size: 12px; }
.pipeline-mini strong { font-size: 20px; }
.pipeline-board {
  display: grid;
  grid-auto-columns: minmax(230px, 1fr);
  grid-auto-flow: column;
  gap: 12px;
  overflow-x: auto;
  padding: 18px;
}
.pipeline-column {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 280px;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
}
.pipeline-column header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pipeline-card {
  display: grid;
  gap: 9px;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(23, 32, 51, 0.05);
}
.pipeline-card small { display: block; color: #647084; }
.pipeline-card select { min-width: 130px; border: 1px solid #cfd7e3; border-radius: 6px; padding: 8px 10px; background: #fff; }
.activity-list { display: grid; gap: 10px; padding: 18px; }
.activity-list article { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: center; border: 1px solid #e6ebf2; border-radius: 8px; padding: 12px; background: #fbfcfe; }
.activity-list span, .activity-list small { color: #647084; }
@media (max-width: 1180px) {
  .admin-form, .prospect-form { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .prospect-form textarea { grid-column: span 3; }
  .compact-grid, .pipeline-mini { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
  .dashboard-grid, .status-strip, .admin-form, .prospect-form { grid-template-columns: 1fr; }
  .prospect-form textarea { grid-column: span 1; }
  .analysis-grid, .analysis-grid .analysis-main { grid-template-columns: 1fr; grid-column: span 1; }
  .compact-grid, .pipeline-mini, .activity-list article { grid-template-columns: 1fr; }
  .inline-actions, .filters, .filters input, .filters select { width: 100%; }
}
`;
