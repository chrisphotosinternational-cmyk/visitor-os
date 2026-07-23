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
      systemMetrics: '',
      organizations: [],
      organizationStatuses: [],
      organizationSearch: '',
      organizationForm: emptyOrganizationForm(),
      users: [],
      userRoles: [],
      userStatuses: [],
      userSearch: '',
      userForm: emptyUserForm(),
      sites: [],
      siteForm: emptySiteForm(),
      siteCreating: false,
      selectedSite: null,
      siteWidget: null,
      siteWidgetForm: emptySiteWidgetForm(),
      siteWidgetSaving: false,
      siteWidgetTesting: false,
      siteCrawlerForm: emptySiteCrawlerForm(),
      siteCrawlerLoading: false,
      siteCrawlerResult: null,
      siteCrawlerError: '',
      siteQaCsv: '',
      siteQaImportResult: null,
      unansweredQuestions: [],
      unansweredFilter: 'pending',
      unansweredAnswer: '',
      chatbotMetrics: null,
      chatbots: [],
      selectedChatbot: null,
      chatbotOverview: null,
      chatbotIntents: [],
      chatbotKnowledge: [],
      chatbotFlows: [],
      chatbotPersonality: null,
      chatbotGoals: [],
      chatbotSuggestions: [],
      reasoningLabMessage: '',
      reasoningLabResult: null,
      reasoningMetrics: null,
      chatbotReviewQueue: [],
      chatbotReviewStatus: 'pending',
      studioDashboard: null,
      studioTemplates: [],
      studioBusinessTypes: [],
      studioGoals: [],
      selectedStudio: null,
      studioVersions: [],
      studioDiff: null,
      studioWizard: emptyStudioWizard(),
      studioImport: emptyStudioImport(),
      studioImportProposal: null,
      studioSimulationMessage: '',
      studioSimulation: null,
      intentForm: emptyIntentForm(),
      knowledgeForm: emptyKnowledgeForm(),
      flowForm: emptyFlowForm(),
      flowStepForm: emptyFlowStepForm(),
      personalityForm: emptyPersonalityForm(),
      goalForm: emptyGoalForm(),
      chatbotSearch: '',
      prospects: [],
      prospectStatuses: [],
      prospectScoreLabels: [],
      prospectPlatforms: [],
      prospectSearch: '',
      prospectFilters: { status: '', city: '', scoreLabel: '', platform: '' },
      prospectForm: emptyProspectForm(),
      prospectImportCsv: '',
      prospectImportResult: null,
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
      featureFlags: {},
      runtimeSettings: null,
      runtimeSettingsJson: '',
      onboarding: null,
      diagnostics: null,
      about: null,
      qualityReport: null,
      cleanupPreview: null,
      importIntelligence: null,
      chatSessions: [],
      selectedChatSession: null,
      chatMessages: [],
      chatInput: '',
      chatSuggestions: [
        'Quels sont les 20 meilleurs prospects à contacter aujourd’hui ?',
        'Qui dois-je relancer cette semaine ?',
        'Quels prospects sont intéressés mais non signés ?',
        'Quels profils MYM / OnlyFans sont prioritaires ?',
        'Résume-moi l’état du pipeline.'
      ],
      chatLastCsv: '',
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
    },
    canWriteSites() {
      return ['SuperAdmin', 'Admin', 'Manager'].includes(this.user?.role);
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
          this.loadSites(),
          this.loadChatbotMetrics(),
          this.loadReasoningMetrics(),
          this.loadChatbots(),
          this.loadStudioDashboard(),
          this.loadProspects(),
          this.loadFollowUps(),
          this.loadMessageTemplates(),
          this.loadEnrichments(),
          this.loadPipeline(),
          this.loadSettings(),
          this.loadOnboardingStatus(),
          this.loadQualityReport(),
          this.loadChatSessions()
        ]);
        await this.loadRouteContext();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Session invalide.';
        this.logout(false);
      } finally {
        this.loading = false;
      }
    },
    async refreshTechnicalStatus() {
      const [health, ready, metrics] = await Promise.allSettled([
        this.apiRequest('/health'),
        this.apiRequest('/ready'),
        this.apiRequest('/metrics')
      ]);
      this.health = await responseJsonOrFallback(health, { status: 'unreachable' });
      this.ready = await responseJsonOrFallback(ready, { status: 'unreachable', database: 'unknown' });
      this.systemMetrics = await responseTextOrFallback(metrics, 'metrics_unavailable 1');
    },
    async loadRouteContext() {
      if (this.route === 'site-widget') {
        const siteId = routeResourceId(window.location.pathname);
        if (!siteId) return;
        try {
          await this.loadSiteWidget(siteId);
        } catch (error) {
          this.error = error instanceof Error ? error.message : 'Configuration widget indisponible.';
        }
      }
    },
    async loadOnboardingStatus() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/onboarding/status', { authenticated: true });
      if (response.ok) this.onboarding = (await response.json()).onboarding;
    },
    async createDemoProject() {
      const response = await this.apiRequest('/admin-api/demo-project', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Creation demo impossible.');
      const data = await response.json();
      this.notify('Projet demo pret : ' + data.demo.user.email + ' / ' + data.demo.user.password);
      await Promise.all([
        this.loadOnboardingStatus(),
        this.loadOrganizations(),
        this.loadUsers(),
        this.loadProspects(),
        this.loadFollowUps(),
        this.refreshDashboard()
      ]);
    },
    async loadDiagnostics() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/diagnostics', { authenticated: true });
      if (!response.ok) throw new Error('Diagnostics indisponibles.');
      this.diagnostics = (await response.json()).diagnostics;
    },
    async loadAbout() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/about', { authenticated: true });
      if (!response.ok) throw new Error('Informations version indisponibles.');
      this.about = (await response.json()).about;
    },
    async loadQualityReport() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/quality-report', { authenticated: true });
      if (response.ok) this.qualityReport = (await response.json()).quality;
    },
    async analyzeImportCsv() {
      const response = await this.apiRequest('/admin-api/import/intelligence', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ csv: this.prospectImportCsv })
      });
      if (!response.ok) throw new Error('Analyse import impossible.');
      this.importIntelligence = (await response.json()).intelligence;
    },
    async loadCleanupPreview() {
      const response = await this.apiRequest('/admin-api/data-cleanup/preview', { authenticated: true });
      if (!response.ok) throw new Error('Apercu nettoyage indisponible.');
      this.cleanupPreview = (await response.json()).cleanup;
    },
    async applyCleanup() {
      const response = await this.apiRequest('/admin-api/data-cleanup/apply', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Nettoyage impossible.');
      const data = await response.json();
      this.cleanupPreview = data.cleanup.preview;
      this.notify(data.cleanup.updated + ' prospect(s) nettoye(s).');
      await Promise.all([this.loadProspects(), this.loadQualityReport(), this.refreshDashboard()]);
    },
    async exportFullBackup() {
      const response = await this.apiRequest('/admin-api/backup/full', { authenticated: true });
      if (!response.ok) throw new Error('Backup complet impossible.');
      const blob = new Blob([await response.arrayBuffer()], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'visitor-os-backup.zip';
      link.click();
      URL.revokeObjectURL(link.href);
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
    async loadSites() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/sites', { authenticated: true });
      if (!response.ok) throw new Error('Chargement des sites impossible.');
      this.sites = (await response.json()).sites;
    },
    async createSite() {
      if (!this.canWriteSites) return;
      this.siteCreating = true;
      this.error = '';
      const payload = {
        name: this.siteForm.name,
        domain: this.siteForm.domain,
        organizationId: this.siteForm.organizationId || this.user?.organizationId,
        status: this.siteForm.status,
        widgetEnabled: this.siteForm.widgetEnabled
      };
      try {
        const response = await this.apiRequest('/admin-api/sites', {
          method: 'POST',
          authenticated: true,
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await responseErrorMessage(response, 'Creation site impossible.'));
        const data = await response.json();
        this.siteForm = emptySiteForm();
        await this.loadSites();
        this.notify('Site cree. Configuration widget ouverte.');
        await this.openSiteWidget(data.site);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Creation site impossible.';
      } finally {
        this.siteCreating = false;
      }
    },
    async loadSiteWidget(siteId, options = {}) {
      if (!siteId) {
        this.error = 'Site widget introuvable.';
        return;
      }
      const response = await this.apiRequest('/admin-api/sites/' + siteId + '/widget', { authenticated: true });
      if (!response.ok) throw new Error('Configuration widget indisponible.');
      const data = await response.json();
      this.selectedSite = data.site;
      this.siteWidget = data.widget;
      this.siteWidgetForm = siteWidgetToForm(data.site, data.widget.settings);
      this.siteCrawlerForm = emptySiteCrawlerForm(data.site.domain);
      this.siteCrawlerResult = null;
      this.siteCrawlerError = '';
      if (options.refreshDiagnostics !== false) await this.loadWidgetDiagnostics(data.site.id, false);
      await this.loadUnansweredQuestions();
    },
    async openSiteWidget(site) {
      this.loading = true;
      this.error = '';
      try {
        await this.loadSiteWidget(site.id);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Configuration widget indisponible.';
        return;
      } finally {
        this.loading = false;
      }
      this.navigate('site-widget', site.id);
    },
    async loadWidgetDiagnostics(siteId = this.selectedSite?.id, showMessage = true) {
      if (!siteId) {
        this.error = 'Aucun site selectionne pour tester l API widget.';
        return;
      }
      this.siteWidgetTesting = true;
      this.error = '';
      try {
        const response = await this.apiRequest('/admin-api/chatbots/' + siteId + '/widget-diagnostics', { authenticated: true });
        if (!response.ok) throw new Error(await responseErrorMessage(response, 'Diagnostic widget impossible.'));
        const data = await response.json();
        this.siteWidget = { ...(this.siteWidget || {}), diagnostics: data.diagnostics };
        if (showMessage) this.notify('Test API widget reussi.');
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Diagnostic widget impossible.';
      } finally {
        this.siteWidgetTesting = false;
      }
    },
    async saveSiteWidgetSettings() {
      if (!this.selectedSite) {
        this.error = 'Aucun site selectionne pour sauvegarder le widget.';
        return;
      }
      this.siteWidgetSaving = true;
      this.error = '';
      const payload = {
        allowedDomains: parseDomainLines(this.siteWidgetForm.allowedDomains),
        primaryColor: this.siteWidgetForm.primaryColor,
        welcomeMessage: this.siteWidgetForm.welcomeMessage,
        fallbackMessage: this.siteWidgetForm.fallbackMessage,
        privacyMessage: this.siteWidgetForm.privacyMessage,
        leadCaptureEnabled: this.siteWidgetForm.leadCaptureEnabled,
        leadCaptureTrigger: this.siteWidgetForm.leadCaptureTrigger,
        leadCaptureAfterMessages: Number(this.siteWidgetForm.leadCaptureAfterMessages || 3),
        leadCaptureFields: Object.entries(this.siteWidgetForm.leadCaptureFields).filter((entry) => entry[1]).map((entry) => entry[0]),
        widgetEnabled: this.siteWidgetForm.widgetEnabled,
        status: this.siteWidgetForm.status,
        name: this.siteWidgetForm.name,
        domain: this.siteWidgetForm.domain
      };
      try {
        const response = await this.apiRequest('/admin-api/sites/' + this.selectedSite.id + '/widget-settings', {
          method: 'PATCH',
          authenticated: true,
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await responseErrorMessage(response, 'Sauvegarde widget impossible.'));
        await this.loadSiteWidget(this.selectedSite.id, { refreshDiagnostics: false });
        const savedDomains = this.siteWidget?.settings?.allowedDomains ?? [];
        if (parseDomainLines(savedDomains.join('\\n')).join('\\n') !== payload.allowedDomains.join('\\n')) {
          throw new Error('Sauvegarde widget incomplete : domaines autorises non confirmes par l API.');
        }
        await Promise.all([this.loadSites(), this.loadChatbotMetrics(), this.loadWidgetDiagnostics(this.selectedSite.id, false)]);
        this.notify('Configuration widget sauvegardee. Domaines autorises confirmes.');
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Sauvegarde widget impossible.';
      } finally {
        this.siteWidgetSaving = false;
      }
    },
    async copyWidgetScript() {
      if (!this.siteWidget?.scriptCode) return;
      await navigator.clipboard.writeText(this.siteWidget.scriptCode);
      this.notify('Code widget copie.');
    },
    async copyWidgetDebugScript() {
      if (!this.siteWidget?.debugScriptCode) return;
      await navigator.clipboard.writeText(this.siteWidget.debugScriptCode);
      this.notify('Code widget debug copie.');
    },
    async crawlSelectedSite() {
      if (!this.selectedSite) {
        this.siteCrawlerError = 'Aucun site selectionne pour lancer le crawler.';
        return;
      }
      const maxPages = Number(this.siteCrawlerForm.maxPages || 50);
      if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 250) {
        this.siteCrawlerError = 'Le nombre maximum de pages doit etre compris entre 1 et 250.';
        return;
      }
      const siteHost = hostFromUrlOrDomain(this.selectedSite.domain);
      const startHost = hostFromUrlOrDomain(this.siteCrawlerForm.startUrl);
      if (!siteHost || !startHost || startHost !== siteHost) {
        this.siteCrawlerError = 'L URL de depart doit rester sur le domaine du site courant.';
        return;
      }

      this.siteCrawlerLoading = true;
      this.siteCrawlerError = '';
      this.siteCrawlerResult = null;
      const startedAt = performance.now();
      try {
        const response = await this.apiRequest('/api/admin/sites/' + this.selectedSite.id + '/crawl', {
          method: 'POST',
          authenticated: true,
          body: JSON.stringify({
            startUrl: normalizeCrawlerStartUrl(this.siteCrawlerForm.startUrl),
            maxPages
          })
        });
        if (!response.ok) throw new Error(await responseErrorMessage(response, 'Crawl du site impossible.'));
        const data = await response.json();
        const elapsedMs = Math.round(performance.now() - startedAt);
        this.siteCrawlerResult = {
          ...(data.crawl ?? {}),
          durationMs: data.crawl?.durationMs ?? data.crawl?.duration_ms ?? elapsedMs
        };
        this.notify('Import automatique du site termine.');
        await this.loadChatbotMetrics();
      } catch (error) {
        this.siteCrawlerError = error instanceof Error ? error.message : 'Crawl du site impossible.';
      } finally {
        this.siteCrawlerLoading = false;
      }
    },
    async importSiteQa() {
      if (!this.selectedSite || !this.siteQaCsv.trim()) return;
      const response = await this.apiRequest('/admin-api/sites/' + this.selectedSite.id + '/qa/import-csv', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ csv: this.siteQaCsv })
      });
      if (!response.ok) throw new Error('Import Q/A impossible.');
      this.siteQaImportResult = (await response.json()).import;
      this.siteQaCsv = '';
      this.notify('Base Q/A importee.');
      await this.loadChatbotMetrics();
    },
    async loadUnansweredQuestions() {
      if (!this.selectedSite) return;
      const response = await this.apiRequest('/admin-api/sites/' + this.selectedSite.id + '/unanswered?status=' + this.unansweredFilter, { authenticated: true });
      if (!response.ok) throw new Error('Questions sans reponse indisponibles.');
      this.unansweredQuestions = (await response.json()).unanswered;
    },
    async ignoreUnanswered(question) {
      if (!this.selectedSite) return;
      const response = await this.apiRequest('/admin-api/sites/' + this.selectedSite.id + '/unanswered/' + question.id + '/ignore', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Impossible d ignorer la question.');
      await Promise.all([this.loadUnansweredQuestions(), this.loadChatbotMetrics()]);
    },
    async convertUnanswered(question) {
      if (!this.selectedSite) return;
      const answer = this.unansweredAnswer.trim() || question.suggested_answer || '';
      if (!answer) throw new Error('Ajoute une reponse avant validation.');
      const response = await this.apiRequest('/admin-api/sites/' + this.selectedSite.id + '/unanswered/' + question.id + '/convert', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ answer, category: question.category || 'general', tags: question.tags || [] })
      });
      if (!response.ok) throw new Error('Conversion Q/A impossible.');
      this.unansweredAnswer = '';
      await Promise.all([this.loadUnansweredQuestions(), this.loadChatbotMetrics()]);
      this.notify('Question transformee en Q/A.');
    },
    async loadChatbotMetrics() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/chatbot/dashboard', { authenticated: true });
      if (response.ok) this.chatbotMetrics = (await response.json()).metrics;
    },
    async loadReasoningMetrics() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/reasoning/dashboard', { authenticated: true });
      if (response.ok) this.reasoningMetrics = (await response.json()).metrics;
    },
    async loadChatbots() {
      if (!this.token) return;
      const response = await this.apiRequest('/admin-api/chatbots', { authenticated: true });
      if (!response.ok) throw new Error('Chargement des chatbots impossible.');
      this.chatbots = (await response.json()).chatbots;
    },
    async openChatbot(chatbot, tab = 'overview') {
      this.selectedChatbot = chatbot;
      await this.loadChatbotWorkspace(chatbot.id);
      this.navigate('chatbot-' + tab, chatbot.id);
    },
    async loadChatbotWorkspace(siteId = this.selectedChatbot?.id) {
      if (!siteId) return;
      this.selectedChatbot = this.selectedChatbot?.id === siteId ? this.selectedChatbot : (this.chatbots.find((item) => item.id === siteId) || this.selectedChatbot);
      const [
        overview,
        intents,
        knowledge,
        flows,
        personality,
        goals,
        suggestions,
        unanswered
      ] = await Promise.all([
        this.apiRequest('/admin-api/chatbots/' + siteId + '/overview', { authenticated: true }),
        this.apiRequest('/admin-api/chatbots/' + siteId + '/intents?search=' + encodeURIComponent(this.chatbotSearch), { authenticated: true }),
        this.apiRequest('/admin-api/chatbots/' + siteId + '/knowledge?search=' + encodeURIComponent(this.chatbotSearch), { authenticated: true }),
        this.apiRequest('/admin-api/chatbots/' + siteId + '/flows', { authenticated: true }),
        this.apiRequest('/admin-api/chatbots/' + siteId + '/personality', { authenticated: true }),
        this.apiRequest('/admin-api/chatbots/' + siteId + '/goals', { authenticated: true }),
        this.apiRequest('/admin-api/chatbots/' + siteId + '/suggestions', { authenticated: true }),
        this.apiRequest('/admin-api/sites/' + siteId + '/unanswered?status=pending', { authenticated: true })
      ]);
      if (overview.ok) this.chatbotOverview = (await overview.json()).overview;
      if (intents.ok) this.chatbotIntents = (await intents.json()).intents;
      if (knowledge.ok) this.chatbotKnowledge = (await knowledge.json()).knowledge;
      if (flows.ok) this.chatbotFlows = (await flows.json()).flows;
      if (personality.ok) {
        this.chatbotPersonality = (await personality.json()).personality;
        this.personalityForm = personalityToForm(this.chatbotPersonality);
      }
      if (goals.ok) this.chatbotGoals = (await goals.json()).goals;
      if (suggestions.ok) this.chatbotSuggestions = (await suggestions.json()).suggestions;
      if (unanswered.ok) this.unansweredQuestions = (await unanswered.json()).unanswered;
    },
    async testReasoningLab() {
      if (!this.selectedChatbot || !this.reasoningLabMessage.trim()) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/reasoning/test', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ message: this.reasoningLabMessage })
      });
      if (!response.ok) throw new Error('Test Reasoning impossible.');
      this.reasoningLabResult = (await response.json()).reasoning;
      await this.loadReasoningMetrics();
    },
    async loadChatbotReviewQueue(siteId = this.selectedChatbot?.id) {
      if (!siteId) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + siteId + '/review?status=' + this.chatbotReviewStatus, { authenticated: true });
      if (!response.ok) throw new Error('File de revue indisponible.');
      this.chatbotReviewQueue = (await response.json()).review;
    },
    async resolveChatbotReview(item, status) {
      if (!this.selectedChatbot) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/review/' + item.id + '/resolve', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Mise a jour revue impossible.');
      await this.loadChatbotReviewQueue();
    },
    async createChatbotIntent() {
      if (!this.selectedChatbot) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/intents', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          ...this.intentForm,
          examples: splitLines(this.intentForm.examples),
          synonyms: splitLines(this.intentForm.synonyms),
          priority: Number(this.intentForm.priority || 50)
        })
      });
      if (!response.ok) throw new Error('Creation intention impossible.');
      this.intentForm = emptyIntentForm();
      await this.loadChatbotWorkspace();
      this.notify('Intention creee.');
    },
    async createKnowledgeItem(status = 'draft') {
      if (!this.selectedChatbot) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/knowledge', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          ...this.knowledgeForm,
          status,
          alternativeQuestions: splitLines(this.knowledgeForm.alternativeQuestions),
          links: splitLines(this.knowledgeForm.links),
          tags: splitTags(this.knowledgeForm.tags),
          priority: Number(this.knowledgeForm.priority || 50)
        })
      });
      if (!response.ok) throw new Error('Creation connaissance impossible.');
      this.knowledgeForm = emptyKnowledgeForm();
      await this.loadChatbotWorkspace();
      this.notify('Connaissance creee.');
    },
    async publishKnowledge(item) {
      const response = await this.apiRequest('/admin-api/knowledge/' + item.id + '/publish', { method: 'POST', authenticated: true });
      if (!response.ok) throw new Error('Publication impossible.');
      await this.loadChatbotWorkspace();
    },
    async archiveKnowledge(item) {
      const response = await this.apiRequest('/admin-api/knowledge/' + item.id + '/archive', { method: 'POST', authenticated: true });
      if (!response.ok) throw new Error('Archivage impossible.');
      await this.loadChatbotWorkspace();
    },
    async duplicateKnowledge(item) {
      const response = await this.apiRequest('/admin-api/knowledge/' + item.id + '/duplicate', { method: 'POST', authenticated: true });
      if (!response.ok) throw new Error('Duplication impossible.');
      await this.loadChatbotWorkspace();
    },
    async saveChatbotPersonality() {
      if (!this.selectedChatbot) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/personality', {
        method: 'PUT',
        authenticated: true,
        body: JSON.stringify({
          ...this.personalityForm,
          commercialIntensity: Number(this.personalityForm.commercialIntensity || 50),
          reassuranceLevel: Number(this.personalityForm.reassuranceLevel || 70)
        })
      });
      if (!response.ok) throw new Error('Sauvegarde personnalite impossible.');
      await this.loadChatbotWorkspace();
      this.notify('Personnalite sauvegardee.');
    },
    async createChatbotGoal() {
      if (!this.selectedChatbot) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/goals', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          ...this.goalForm,
          priority: Number(this.goalForm.priority || 50)
        })
      });
      if (!response.ok) throw new Error('Creation objectif impossible.');
      this.goalForm = emptyGoalForm();
      await this.loadChatbotWorkspace();
      this.notify('Objectif cree.');
    },
    async createChatbotFlow() {
      if (!this.selectedChatbot) return;
      const response = await this.apiRequest('/admin-api/chatbots/' + this.selectedChatbot.id + '/flows', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify(this.flowForm)
      });
      if (!response.ok) throw new Error('Creation parcours impossible.');
      this.flowForm = emptyFlowForm();
      await this.loadChatbotWorkspace();
      this.notify('Parcours cree.');
    },
    async addFlowStep(flow) {
      const response = await this.apiRequest('/admin-api/flows/' + flow.id + '/steps', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({
          ...this.flowStepForm,
          stepOrder: Number(this.flowStepForm.stepOrder || 1)
        })
      });
      if (!response.ok) throw new Error('Ajout etape impossible.');
      this.flowStepForm = emptyFlowStepForm();
      await this.loadChatbotWorkspace();
    },
    async generateKnowledgeSuggestion(question) {
      const response = await this.apiRequest('/admin-api/unanswered-questions/' + question.id + '/generate-suggestion', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Suggestion impossible.');
      await this.loadChatbotWorkspace();
      this.notify('Suggestion creee.');
    },
    async acceptKnowledgeSuggestion(suggestion) {
      const response = await this.apiRequest('/admin-api/knowledge-suggestions/' + suggestion.id + '/accept', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Acceptation impossible.');
      await this.loadChatbotWorkspace();
    },
    async rejectKnowledgeSuggestion(suggestion) {
      const response = await this.apiRequest('/admin-api/knowledge-suggestions/' + suggestion.id + '/reject', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Rejet impossible.');
      await this.loadChatbotWorkspace();
    },
    async loadStudioDashboard() {
      if (!this.token) return;
      const [dashboardResponse, templatesResponse] = await Promise.all([
        this.apiRequest('/admin-api/studio', { authenticated: true }),
        this.apiRequest('/admin-api/studio/templates', { authenticated: true })
      ]);
      if (dashboardResponse.ok) this.studioDashboard = await dashboardResponse.json();
      if (templatesResponse.ok) {
        const data = await templatesResponse.json();
        this.studioTemplates = data.templates;
        this.studioBusinessTypes = data.businessTypes;
        this.studioGoals = data.goals;
      }
    },
    async openStudio(site) {
      this.selectedStudio = site;
      await this.loadStudioSite(site.id);
      this.navigate('studio-detail', site.id);
    },
    async loadStudioSite(siteId = this.selectedStudio?.site_id || this.selectedStudio?.id) {
      if (!siteId) return;
      const response = await this.apiRequest('/admin-api/studio/' + siteId, { authenticated: true });
      if (!response.ok) throw new Error('Studio indisponible.');
      const data = await response.json();
      this.selectedStudio = data.studio;
      this.studioVersions = data.versions;
      this.studioDiff = data.diff;
      this.studioWizard = studioWizardFromSite(data.studio, this.studioWizard);
    },
    async runStudioWizard() {
      if (!this.selectedStudio?.site_id) return;
      const response = await this.apiRequest('/admin-api/studio/' + this.selectedStudio.site_id + '/wizard', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify(this.studioWizard)
      });
      if (!response.ok) throw new Error('Assistant Studio impossible.');
      await Promise.all([this.loadStudioSite(this.selectedStudio.site_id), this.loadChatbots()]);
      this.notify('Base chatbot creee en brouillon.');
    },
    async importStudioDocument() {
      if (!this.selectedStudio?.site_id) return;
      const response = await this.apiRequest('/admin-api/studio/' + this.selectedStudio.site_id + '/import-document', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify(this.studioImport)
      });
      if (!response.ok) throw new Error('Import documentaire impossible.');
      this.studioImportProposal = (await response.json()).proposal;
      this.notify('Proposition de connaissances creee.');
    },
    async acceptStudioImportProposal() {
      if (!this.studioImportProposal) return;
      const response = await this.apiRequest('/admin-api/studio/import-proposals/' + this.studioImportProposal.id + '/accept', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Validation import impossible.');
      this.studioImportProposal = null;
      this.studioImport = emptyStudioImport();
      await this.loadStudioSite();
      this.notify('Connaissances ajoutees en brouillon.');
    },
    async simulateStudio() {
      if (!this.selectedStudio?.site_id || !this.studioSimulationMessage.trim()) return;
      const response = await this.apiRequest('/admin-api/studio/' + this.selectedStudio.site_id + '/simulate', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ message: this.studioSimulationMessage })
      });
      if (!response.ok) throw new Error('Simulation impossible.');
      this.studioSimulation = await response.json();
    },
    async publishStudio() {
      if (!this.selectedStudio?.site_id) return;
      const response = await this.apiRequest('/admin-api/studio/' + this.selectedStudio.site_id + '/publish', {
        method: 'POST',
        authenticated: true
      });
      if (!response.ok) throw new Error('Publication impossible.');
      await this.loadStudioSite();
      this.notify('Chatbot publie.');
    },
    async rollbackStudio(version) {
      if (!this.selectedStudio?.site_id) return;
      const response = await this.apiRequest('/admin-api/studio/' + this.selectedStudio.site_id + '/rollback', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ versionNumber: Number(version.version_number || version.versionNumber) })
      });
      if (!response.ok) throw new Error('Rollback impossible.');
      await this.loadStudioSite();
      this.notify('Version restauree.');
    },
    async refreshDashboard() {
      const response = await this.apiRequest('/admin-api/dashboard', { authenticated: true });
      if (response.ok) {
        this.dashboard = await response.json();
        this.featureFlags = this.dashboard.featureFlags ?? this.featureFlags;
        this.runtimeSettings = this.dashboard.settings ?? this.runtimeSettings;
        this.runtimeSettingsJson = JSON.stringify(this.runtimeSettings ?? {}, null, 2);
      }
    },
    async loadSettings() {
      if (!this.token) return;
      const [flagsResponse, settingsResponse] = await Promise.all([
        this.apiRequest('/admin-api/feature-flags', { authenticated: true }),
        this.apiRequest('/admin-api/settings', { authenticated: true })
      ]);
      if (!flagsResponse.ok || !settingsResponse.ok) return;
      this.featureFlags = (await flagsResponse.json()).featureFlags;
      this.runtimeSettings = (await settingsResponse.json()).settings;
      this.runtimeSettingsJson = JSON.stringify(this.runtimeSettings, null, 2);
    },
    async saveFeatureFlags() {
      const response = await this.apiRequest('/admin-api/feature-flags', {
        method: 'PATCH',
        authenticated: true,
        body: JSON.stringify(this.featureFlags)
      });
      if (!response.ok) throw new Error('Sauvegarde des modules impossible.');
      this.featureFlags = (await response.json()).featureFlags;
      this.notify('Modules mis a jour.');
      await this.refreshDashboard();
    },
    async saveRuntimeSettings() {
      let parsed;
      try {
        parsed = JSON.parse(this.runtimeSettingsJson);
      } catch {
        throw new Error('Configuration JSON invalide.');
      }
      const response = await this.apiRequest('/admin-api/settings', {
        method: 'PATCH',
        authenticated: true,
        body: JSON.stringify(parsed)
      });
      if (!response.ok) throw new Error('Sauvegarde configuration impossible.');
      this.runtimeSettings = (await response.json()).settings;
      this.runtimeSettingsJson = JSON.stringify(this.runtimeSettings, null, 2);
      this.notify('Configuration mise a jour.');
      await this.refreshDashboard();
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
      if (!pipelineResponse.ok || !metricsResponse.ok || !activityResponse.ok) {
        throw new Error('Chargement pipeline impossible.');
      }
      const pipelineData = await pipelineResponse.json();
      this.pipelineColumns = pipelineData.columns;
      this.pipelineStages = pipelineData.stages;
      this.pipelineMetrics = (await metricsResponse.json()).metrics;
      this.pipelineForecast = forecastResponse.ok ? (await forecastResponse.json()).forecast : null;
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
      this.prospectImportResult = (await response.json()).import;
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
    async loadChatSessions() {
      if (!this.token) return;
      const response = await this.apiRequest('/chat/sessions', { authenticated: true });
      if (!response.ok) return;
      this.chatSessions = (await response.json()).sessions;
    },
    async createChatSession() {
      const response = await this.apiRequest('/chat/sessions', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ title: 'Assistant CRM' })
      });
      if (!response.ok) throw new Error('Creation conversation impossible.');
      const session = (await response.json()).session;
      this.selectedChatSession = session;
      this.chatMessages = [];
      await this.loadChatSessions();
    },
    async openChatSession(session) {
      const response = await this.apiRequest('/chat/sessions/' + session.id, { authenticated: true });
      if (!response.ok) throw new Error('Chargement conversation impossible.');
      const data = await response.json();
      this.selectedChatSession = data.session;
      this.chatMessages = data.messages;
      this.chatLastCsv = [...this.chatMessages].reverse().find((message) => message.result_csv)?.result_csv || '';
    },
    async sendChatMessage(content = '') {
      const message = (content || this.chatInput).trim();
      if (!message) return;
      if (!this.selectedChatSession) await this.createChatSession();
      this.chatInput = '';
      const response = await this.apiRequest('/chat/sessions/' + this.selectedChatSession.id + '/messages', {
        method: 'POST',
        authenticated: true,
        body: JSON.stringify({ content: message })
      });
      if (!response.ok) throw new Error('Question impossible a traiter.');
      const data = await response.json();
      this.chatMessages.push(data.userMessage, data.assistantMessage);
      this.chatLastCsv = data.answer.csv || '';
      await this.loadChatSessions();
    },
    exportChatCsv() {
      if (!this.chatLastCsv) return;
      downloadCsv(this.chatLastCsv, 'visitor-os-chat-result.csv');
    },
    openProspectFromChat(prospectId) {
      this.navigate('prospect-detail', prospectId);
    },
    navigate(route) {
      this.route = route;
      const path = routePath(route, arguments[1]);
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
      if (route === 'diagnostics') void this.loadDiagnostics();
      if (route === 'about') void this.loadAbout();
      if (route === 'quality') void this.loadQualityReport();
      if (route === 'first-start') void this.loadOnboardingStatus();
      if (route === 'chat') void this.loadChatSessions();
      if (route === 'chatbots') void this.loadChatbots();
      if (route === 'studio') void this.loadStudioDashboard();
      if (route === 'studio-detail') {
        const siteId = arguments[1] || this.selectedStudio?.site_id;
        if (siteId) void this.loadStudioSite(siteId);
      }
      if (route.startsWith('chatbot-')) {
        const siteId = arguments[1] || this.selectedChatbot?.id;
        if (siteId) void this.loadChatbotWorkspace(siteId);
        if (route === 'chatbot-review' && siteId) void this.loadChatbotReviewQueue(siteId);
      }
      if (route === 'sites') {
        void this.loadSites();
        void this.loadChatbotMetrics();
      }
      if (route === 'site-unanswered') void this.loadUnansweredQuestions();
      if (route === 'site-widget') {
        const siteId = arguments[1] || this.selectedSite?.id || routeResourceId(window.location.pathname);
        if (siteId && this.selectedSite?.id !== siteId) void this.loadSiteWidget(siteId);
        else void this.loadWidgetDiagnostics(siteId, false);
      }
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
          <button :class="['nav-item', { active: route === 'dashboard' }]" :aria-current="route === 'dashboard' ? 'page' : null" type="button" @click="navigate('dashboard')">Dashboard</button>
          <button :class="['nav-item', { active: route === 'organizations' }]" :aria-current="route === 'organizations' ? 'page' : null" type="button" @click="navigate('organizations')">Organisations</button>
          <button :class="['nav-item', { active: route === 'users' }]" :aria-current="route === 'users' ? 'page' : null" type="button" @click="navigate('users')">Utilisateurs</button>
          <button :class="['nav-item', { active: route.startsWith('prospect') }]" :aria-current="route.startsWith('prospect') ? 'page' : null" type="button" @click="navigate('prospects')">Prospects</button>
          <button :class="['nav-item', { active: route === 'pipeline' }]" :aria-current="route === 'pipeline' ? 'page' : null" type="button" @click="navigate('pipeline')">Pipeline</button>
          <button :class="['nav-item', { active: route === 'chat' }]" :aria-current="route === 'chat' ? 'page' : null" type="button" @click="navigate('chat')">Chat IA</button>
          <button :class="['nav-item', { active: route.startsWith('studio') }]" :aria-current="route.startsWith('studio') ? 'page' : null" type="button" @click="navigate('studio')">Chatbot Studio</button>
          <button :class="['nav-item', { active: route.startsWith('chatbot') || route === 'chatbots' }]" :aria-current="route.startsWith('chatbot') || route === 'chatbots' ? 'page' : null" type="button" @click="navigate('chatbots')">Knowledge Engine</button>
          <button :class="['nav-item', { active: route.startsWith('site') || route === 'sites' }]" :aria-current="route.startsWith('site') || route === 'sites' ? 'page' : null" type="button" @click="navigate('sites')">Chatbot sites</button>
          <button :class="['nav-item', { active: route === 'enrichments' }]" :aria-current="route === 'enrichments' ? 'page' : null" type="button" @click="navigate('enrichments')">Enrichments</button>
          <button :class="['nav-item', { active: route === 'follow-ups' }]" :aria-current="route === 'follow-ups' ? 'page' : null" type="button" @click="navigate('follow-ups')">Relances</button>
          <button :class="['nav-item', { active: route.startsWith('message-template') }]" :aria-current="route.startsWith('message-template') ? 'page' : null" type="button" @click="navigate('message-templates')">Messages</button>
          <button :class="['nav-item', { active: route === 'first-start' }]" :aria-current="route === 'first-start' ? 'page' : null" type="button" @click="navigate('first-start')">Premier demarrage</button>
          <button :class="['nav-item', { active: route === 'quality' }]" :aria-current="route === 'quality' ? 'page' : null" type="button" @click="navigate('quality')">Qualite</button>
          <button :class="['nav-item', { active: route === 'diagnostics' }]" :aria-current="route === 'diagnostics' ? 'page' : null" type="button" @click="navigate('diagnostics')">Diagnostics</button>
          <button :class="['nav-item', { active: route === 'about' }]" :aria-current="route === 'about' ? 'page' : null" type="button" @click="navigate('about')">About</button>
          <button :class="['nav-item', { active: route === 'system' }]" :aria-current="route === 'system' ? 'page' : null" type="button" @click="navigate('system')">System</button>
          <button :class="['nav-item', { active: route === 'settings' }]" :aria-current="route === 'settings' ? 'page' : null" type="button" @click="navigate('settings')">Parametres</button>
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
          <article class="metric"><span>Questions sans reponse</span><strong>{{ chatbotMetrics?.unansweredQuestions ?? 0 }}</strong><small>Chatbot</small></article>
          <article class="metric"><span>Leads chatbot</span><strong>{{ chatbotMetrics?.leadsCaptured ?? 0 }}</strong><small>Captures</small></article>
          <article class="metric"><span>Fallback chatbot</span><strong>{{ Math.round((chatbotMetrics?.fallbackRate ?? 0) * 100) }}%</strong><small>Questions non couvertes</small></article>
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

        <section v-if="route === 'chatbots'" class="panel">
          <div class="panel-header">
            <h2>Knowledge Engine</h2>
            <div class="inline-actions"><input v-model="chatbotSearch" @input="loadChatbots" placeholder="Rechercher un chatbot" /><button type="button" @click="loadChatbots">Actualiser</button></div>
          </div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Chatbots</span><strong>{{ chatbots.length }}</strong><small>Sites connectes</small></article>
            <article class="metric"><span>Knowledge actifs</span><strong>{{ chatbots.reduce((sum, item) => sum + Number(item.knowledge_items || 0), 0) }}</strong><small>Reponses v2</small></article>
            <article class="metric"><span>Intentions</span><strong>{{ chatbots.reduce((sum, item) => sum + Number(item.intents || 0), 0) }}</strong><small>Actives</small></article>
            <article class="metric"><span>Inconnues</span><strong>{{ chatbots.reduce((sum, item) => sum + Number(item.unanswered || 0), 0) }}</strong><small>A traiter</small></article>
          </div>
          <table class="admin-table">
            <thead><tr><th>Site</th><th>Domaine</th><th>Statut</th><th>Conversations</th><th>Knowledge</th><th>Inconnues</th><th>Leads</th><th></th></tr></thead>
            <tbody>
              <tr v-for="chatbot in chatbots" :key="chatbot.id">
                <td>{{ chatbot.name }}</td>
                <td>{{ chatbot.domain || '-' }}</td>
                <td><span class="badge">{{ chatbot.status }} / {{ chatbot.widget_enabled ? 'actif' : 'inactif' }}</span></td>
                <td>{{ chatbot.conversations ?? 0 }}</td>
                <td>{{ chatbot.knowledge_items ?? 0 }}</td>
                <td>{{ chatbot.unanswered ?? 0 }}</td>
                <td>{{ chatbot.leads_captured ?? 0 }}</td>
                <td><button type="button" @click="openChatbot(chatbot)">Administrer</button></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="route === 'studio'" class="panel">
          <div class="panel-header">
            <div><h2>Chatbot Studio</h2><p>Creation no-code des chatbots publics, de la base de connaissances a la publication.</p></div>
            <button type="button" @click="loadStudioDashboard">Actualiser</button>
          </div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Studios</span><strong>{{ studioDashboard?.studios?.length || 0 }}</strong><small>Chatbots constructibles</small></article>
            <article class="metric"><span>Intentions</span><strong>{{ (studioDashboard?.studios || []).reduce((sum, item) => sum + Number(item.intents || 0), 0) }}</strong><small>Total</small></article>
            <article class="metric"><span>Connaissances</span><strong>{{ (studioDashboard?.studios || []).reduce((sum, item) => sum + Number(item.knowledge_items || 0), 0) }}</strong><small>Publiees</small></article>
            <article class="metric"><span>Questions inconnues</span><strong>{{ (studioDashboard?.studios || []).reduce((sum, item) => sum + Number(item.unknown_questions || 0), 0) }}</strong><small>A traiter</small></article>
          </div>
          <table class="admin-table">
            <thead><tr><th>Chatbot</th><th>Domaine</th><th>Etat</th><th>Intentions</th><th>Knowledge</th><th>Reponse</th><th>Version</th><th></th></tr></thead>
            <tbody>
              <tr v-for="studio in studioDashboard?.studios || []" :key="studio.site_id">
                <td><strong>{{ studio.name }}</strong></td>
                <td>{{ studio.domain || '-' }}</td>
                <td><span class="badge">{{ studio.current_stage }}</span></td>
                <td>{{ studio.intents }}</td>
                <td>{{ studio.knowledge_items }}</td>
                <td>{{ studio.answer_rate }}%</td>
                <td>v{{ studio.published_version || 0 }}</td>
                <td><button type="button" @click="openStudio(studio)">Ouvrir Studio</button></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="route === 'studio-detail'" class="panel">
          <div class="panel-header">
            <div><h2>{{ selectedStudio?.name || 'Studio' }}</h2><p>{{ selectedStudio?.domain || selectedStudio?.site_id }}</p></div>
            <div class="inline-actions"><button type="button" @click="publishStudio">Publier</button><button type="button" @click="navigate('studio')">Retour</button></div>
          </div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Etat</span><strong>{{ selectedStudio?.current_stage || 'draft' }}</strong><small>Version active</small></article>
            <article class="metric"><span>Intentions</span><strong>{{ selectedStudio?.intents || 0 }}</strong><small>Configurees</small></article>
            <article class="metric"><span>Connaissances</span><strong>{{ selectedStudio?.knowledge_items || 0 }}</strong><small>Actives</small></article>
            <article class="metric"><span>Conversations jour</span><strong>{{ selectedStudio?.conversations_today || 0 }}</strong><small>Aujourd'hui</small></article>
            <article class="metric"><span>Inconnues</span><strong>{{ selectedStudio?.unknown_questions || 0 }}</strong><small>A enrichir</small></article>
            <article class="metric"><span>Taux reponse</span><strong>{{ selectedStudio?.answer_rate || 0 }}%</strong><small>Estime</small></article>
            <article class="metric"><span>Leads</span><strong>{{ selectedStudio?.leads_generated || 0 }}</strong><small>Generes</small></article>
            <article class="metric"><span>Publiee</span><strong>v{{ selectedStudio?.published_version || 0 }}</strong><small>{{ selectedStudio?.last_published_at || 'jamais' }}</small></article>
          </div>

          <div class="split-layout">
            <form class="admin-form" @submit.prevent="runStudioWizard">
              <h3>Assistant creation</h3>
              <input v-model="studioWizard.name" placeholder="Nom du chatbot" required />
              <input v-model="studioWizard.domain" placeholder="Domaine" required />
              <select v-model="studioWizard.businessType"><option v-for="type in studioBusinessTypes" :key="type" :value="type">{{ type }}</option></select>
              <select v-model="studioWizard.primaryGoal"><option v-for="goal in studioGoals" :key="goal" :value="goal">{{ goal }}</option></select>
              <select v-model="studioWizard.templateId"><option value="">Template automatique</option><option v-for="template in studioTemplates" :key="template.id" :value="template.id">{{ template.name }}</option></select>
              <input v-model="studioWizard.tone" placeholder="Ton : professionnel, premium..." />
              <button type="submit">Generer la base brouillon</button>
            </form>

            <form class="admin-form" @submit.prevent="importStudioDocument">
              <h3>Import documentaire</h3>
              <input v-model="studioImport.fileName" placeholder="Nom du fichier" required />
              <select v-model="studioImport.fileType"><option>pdf</option><option>docx</option><option>markdown</option><option>txt</option><option>html</option></select>
              <textarea v-model="studioImport.content" placeholder="Collez ici le contenu extrait ou le document texte" required></textarea>
              <button type="submit">Analyser le document</button>
              <article v-if="studioImportProposal" class="empty-state">
                <strong>{{ studioImportProposal.extracted_questions?.length || 0 }} questions detectees</strong>
                <p>Une proposition de base de connaissances est prete.</p>
                <button type="button" @click="acceptStudioImportProposal">Valider en brouillon</button>
              </article>
            </form>
          </div>

          <div class="split-layout">
            <form class="admin-form" @submit.prevent="simulateStudio">
              <h3>Tester mon chatbot</h3>
              <textarea v-model="studioSimulationMessage" placeholder="Posez une question comme un visiteur"></textarea>
              <button type="submit">Simuler</button>
              <article v-if="studioSimulation" class="empty-state">
                <strong>{{ studioSimulation.fallback ? 'Fallback' : 'Reponse trouvee' }}</strong>
                <p>{{ studioSimulation.reply }}</p>
                <small>Intention: {{ studioSimulation.intent || '-' }} · Confiance: {{ Math.round((studioSimulation.confidence || 0) * 100) }}%</small>
                <small>Actions: {{ studioSimulation.actions?.join(', ') }}</small>
              </article>
            </form>
            <div class="activity-list">
              <h3>Monitoring versions</h3>
              <article>
                <strong>Brouillon vs publie</strong>
                <span>{{ studioDiff?.draft_items || 0 }} brouillons · {{ studioDiff?.published_items || 0 }} publies · {{ studioDiff?.needs_review || 0 }} a revoir</span>
              </article>
              <article v-for="version in studioVersions" :key="version.id">
                <strong>Version {{ version.version_number }}</strong>
                <span>{{ version.status }} · {{ version.created_at }}</span>
                <button type="button" @click="rollbackStudio(version)">Rollback</button>
              </article>
            </div>
          </div>
        </section>

        <section v-if="route.startsWith('chatbot-')" class="panel">
          <div class="panel-header">
            <div><h2>{{ selectedChatbot?.name || 'Chatbot' }}</h2><p>{{ selectedChatbot?.domain || selectedChatbot?.id }}</p></div>
            <button type="button" @click="navigate('chatbots')">Retour</button>
          </div>
          <nav class="tabs">
            <button type="button" @click="openChatbot(selectedChatbot, 'overview')">Vue d’ensemble</button>
            <button type="button" @click="navigate('chatbot-intents', selectedChatbot?.id)">Intentions</button>
            <button type="button" @click="navigate('chatbot-knowledge', selectedChatbot?.id)">Connaissances</button>
            <button type="button" @click="navigate('chatbot-unanswered', selectedChatbot?.id)">Questions inconnues</button>
            <button type="button" @click="navigate('chatbot-flows', selectedChatbot?.id)">Parcours</button>
            <button type="button" @click="navigate('chatbot-personality', selectedChatbot?.id)">Personnalite</button>
            <button type="button" @click="navigate('chatbot-goals', selectedChatbot?.id)">Objectifs</button>
            <button type="button" @click="navigate('chatbot-reasoning', selectedChatbot?.id)">Reasoning Lab</button>
            <button type="button" @click="navigate('chatbot-review', selectedChatbot?.id)">Review</button>
            <button type="button" @click="openSiteWidget(selectedChatbot)">Widget</button>
          </nav>
          <div class="filters"><input v-model="chatbotSearch" @input="loadChatbotWorkspace()" placeholder="Rechercher intention, connaissance, tag" /></div>

          <div v-if="route === 'chatbot-overview'" class="dashboard-grid compact-grid">
            <article class="metric"><span>Conversations</span><strong>{{ chatbotOverview?.conversations ?? 0 }}</strong><small>Total site</small></article>
            <article class="metric"><span>Knowledge</span><strong>{{ chatbotOverview?.knowledge_items ?? 0 }}</strong><small>Tous statuts</small></article>
            <article class="metric"><span>Intentions</span><strong>{{ chatbotOverview?.intents ?? 0 }}</strong><small>Configurees</small></article>
            <article class="metric"><span>Suggestions</span><strong>{{ chatbotOverview?.suggestions ?? 0 }}</strong><small>En attente</small></article>
          </div>

          <div v-if="route === 'chatbot-reasoning'" class="split-layout">
            <form class="admin-form" @submit.prevent="testReasoningLab">
              <h3>Reasoning Lab</h3>
              <textarea v-model="reasoningLabMessage" placeholder="Question visiteur a tester"></textarea>
              <button type="submit">Tester la question</button>
            </form>
            <div class="activity-list">
              <article v-if="reasoningLabResult">
                <strong>{{ reasoningLabResult.response_text }}</strong>
                <span>Intention : {{ reasoningLabResult.detected_intent }} · confiance {{ Math.round((reasoningLabResult.confidence_score || 0) * 100) }}%</span>
                <small>Action : {{ reasoningLabResult.next_best_action }} · lead readiness {{ reasoningLabResult.lead_readiness_score }}</small>
                <small>Connaissance : {{ reasoningLabResult.selected_knowledge_item_id || '-' }}</small>
                <small>Objectif : {{ reasoningLabResult.applied_goal || '-' }} · personnalite : {{ reasoningLabResult.applied_personality || '-' }}</small>
                <pre>{{ reasoningLabResult.reasoning_trace }}</pre>
              </article>
              <article v-if="reasoningMetrics">
                <strong>Metriques Reasoning</strong>
                <span>Lead >60 : {{ reasoningMetrics.lead_readiness_over_60 || 0 }} · Lead >80 : {{ reasoningMetrics.lead_readiness_over_80 || 0 }}</span>
                <small>Confiance moyenne : {{ reasoningMetrics.average_confidence || 0 }} · Escalades : {{ reasoningMetrics.admin_escalations || 0 }}</small>
                <small v-if="reasoningMetrics.runtime?.bySite?.length">Runtime moyen : {{ reasoningMetrics.runtime.bySite[0].average_response_ms }} ms</small>
              </article>
            </div>
          </div>

          <div v-if="route === 'chatbot-review'" class="activity-list">
            <div class="inline-actions">
              <select v-model="chatbotReviewStatus" @change="loadChatbotReviewQueue()"><option value="pending">pending</option><option value="fixed">fixed</option><option value="ignored">ignored</option></select>
              <button type="button" @click="loadChatbotReviewQueue()">Actualiser</button>
            </div>
            <article v-for="item in chatbotReviewQueue" :key="item.id">
              <strong>{{ item.question || item.reason }}</strong>
              <span>{{ item.reason }} · {{ item.status }}</span>
              <small>Confiance {{ Math.round((item.confidence_score || 0) * 100) }}% · lead {{ item.lead_readiness_score || 0 }} · action {{ item.next_best_action || '-' }}</small>
              <small>Conversation : {{ item.conversation_id || '-' }}</small>
              <div class="inline-actions"><button type="button" @click="resolveChatbotReview(item, 'fixed')">Marquer corrige</button><button type="button" @click="resolveChatbotReview(item, 'ignored')">Ignorer</button></div>
            </article>
            <p v-if="chatbotReviewQueue.length === 0" class="muted">Aucune conversation a revoir.</p>
          </div>

          <div v-if="route === 'chatbot-intents'" class="split-layout">
            <form class="admin-form" @submit.prevent="createChatbotIntent">
              <input v-model="intentForm.name" placeholder="Nom intention" required />
              <input v-model="intentForm.category" placeholder="Categorie" />
              <textarea v-model="intentForm.examples" placeholder="Exemples, une ligne par phrase"></textarea>
              <textarea v-model="intentForm.synonyms" placeholder="Synonymes, un par ligne"></textarea>
              <input v-model.number="intentForm.priority" type="number" min="0" max="100" />
              <label class="checkbox-line"><input v-model="intentForm.isActive" type="checkbox" /> Active</label>
              <button type="submit">Creer intention</button>
            </form>
            <div class="activity-list">
              <article v-for="intent in chatbotIntents" :key="intent.id">
                <strong>{{ intent.name }}</strong><span>{{ intent.category }}</span><small>{{ intent.examples?.join(', ') }}</small>
              </article>
            </div>
          </div>

          <div v-if="route === 'chatbot-knowledge'" class="split-layout">
            <form class="admin-form" @submit.prevent="createKnowledgeItem('active')">
              <input v-model="knowledgeForm.title" placeholder="Titre" required />
              <input v-model="knowledgeForm.mainQuestion" placeholder="Question principale" required />
              <textarea v-model="knowledgeForm.alternativeQuestions" placeholder="Questions alternatives, une par ligne"></textarea>
              <textarea v-model="knowledgeForm.shortAnswer" placeholder="Reponse courte" required></textarea>
              <textarea v-model="knowledgeForm.detailedAnswer" placeholder="Reponse detaillee"></textarea>
              <textarea v-model="knowledgeForm.commercialAnswer" placeholder="Reponse commerciale"></textarea>
              <input v-model="knowledgeForm.tags" placeholder="Tags separes par virgule" />
              <select v-model="knowledgeForm.intentId"><option value="">Aucune intention</option><option v-for="intent in chatbotIntents" :key="intent.id" :value="intent.id">{{ intent.name }}</option></select>
              <button type="submit">Creer et publier</button>
              <button type="button" @click="createKnowledgeItem('draft')">Enregistrer brouillon</button>
            </form>
            <div class="activity-list">
              <article v-for="item in chatbotKnowledge" :key="item.id">
                <strong>{{ item.title }}</strong><span>{{ item.status }} · {{ item.intent_name || 'sans intention' }}</span><small>{{ item.main_question }}</small>
                <div class="inline-actions"><button type="button" @click="publishKnowledge(item)">Publier</button><button type="button" @click="duplicateKnowledge(item)">Dupliquer</button><button type="button" @click="archiveKnowledge(item)">Archiver</button></div>
              </article>
            </div>
          </div>

          <div v-if="route === 'chatbot-unanswered'" class="activity-list">
            <article v-for="question in unansweredQuestions" :key="question.id">
              <strong>{{ question.question }}</strong><span>{{ question.detected_intent || question.category || 'intention inconnue' }} · {{ question.occurrence_count || 1 }} occurrence(s)</span>
              <small>{{ question.action_status || question.status }}</small>
              <div class="inline-actions"><button type="button" @click="generateKnowledgeSuggestion(question)">Creer suggestion</button><button type="button" @click="ignoreUnanswered(question)">Ignorer</button></div>
            </article>
            <article v-for="suggestion in chatbotSuggestions" :key="suggestion.id">
              <strong>Suggestion : {{ suggestion.suggested_question }}</strong><span>{{ suggestion.status }} · {{ suggestion.suggested_intent || 'general' }}</span>
              <small>{{ suggestion.suggested_answer }}</small>
              <div class="inline-actions"><button type="button" @click="acceptKnowledgeSuggestion(suggestion)">Accepter</button><button type="button" @click="rejectKnowledgeSuggestion(suggestion)">Rejeter</button></div>
            </article>
          </div>

          <div v-if="route === 'chatbot-flows'" class="split-layout">
            <form class="admin-form" @submit.prevent="createChatbotFlow">
              <input v-model="flowForm.name" placeholder="Nom du parcours" required />
              <textarea v-model="flowForm.description" placeholder="Description"></textarea>
              <select v-model="flowForm.triggerIntentId"><option value="">Declencheur libre</option><option v-for="intent in chatbotIntents" :key="intent.id" :value="intent.id">{{ intent.name }}</option></select>
              <button type="submit">Creer parcours</button>
            </form>
            <div class="activity-list">
              <article v-for="flow in chatbotFlows" :key="flow.id">
                <strong>{{ flow.name }}</strong><span>{{ flow.is_active ? 'actif' : 'inactif' }}</span><small>{{ flow.description }}</small>
                <form class="inline-actions" @submit.prevent="addFlowStep(flow)"><input v-model.number="flowStepForm.stepOrder" type="number" min="1" /><select v-model="flowStepForm.stepType"><option>question</option><option>answer</option><option>lead_capture</option><option>end</option></select><input v-model="flowStepForm.content" placeholder="Contenu etape" /><button type="submit">Ajouter etape</button></form>
              </article>
            </div>
          </div>

          <form v-if="route === 'chatbot-personality'" class="admin-form" @submit.prevent="saveChatbotPersonality">
            <select v-model="personalityForm.tone"><option>professionnel</option><option>chaleureux</option><option>premium</option><option>direct</option><option>rassurant</option><option>technique</option></select>
            <select v-model="personalityForm.answerLength"><option>short</option><option>medium</option><option>detailed</option></select>
            <select v-model="personalityForm.formality"><option>vouvoiement</option><option>tutoiement</option></select>
            <select v-model="personalityForm.emojiLevel"><option>none</option><option>low</option><option>medium</option></select>
            <input v-model.number="personalityForm.commercialIntensity" type="number" min="0" max="100" placeholder="Intensite commerciale" />
            <input v-model.number="personalityForm.reassuranceLevel" type="number" min="0" max="100" placeholder="Niveau reassurance" />
            <textarea v-model="personalityForm.style" placeholder="Consignes de style"></textarea>
            <button type="submit">Sauvegarder personnalite</button>
          </form>

          <div v-if="route === 'chatbot-goals'" class="split-layout">
            <form class="admin-form" @submit.prevent="createChatbotGoal">
              <input v-model="goalForm.goalType" placeholder="Type objectif" required />
              <textarea v-model="goalForm.description" placeholder="Description" required></textarea>
              <input v-model.number="goalForm.priority" type="number" min="0" max="100" />
              <input v-model="goalForm.successAction" placeholder="Action de succes" />
              <button type="submit">Ajouter objectif</button>
            </form>
            <div class="activity-list"><article v-for="goal in chatbotGoals" :key="goal.id"><strong>{{ goal.goal_type }}</strong><span>{{ goal.priority }}</span><small>{{ goal.description }}</small></article></div>
          </div>
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

        <section v-if="route === 'sites'" class="panel">
          <div class="panel-header">
            <h2>Chatbot multi-sites</h2>
            <div class="inline-actions">
              <button type="button" @click="loadSites">Rafraichir</button>
              <button type="button" @click="loadChatbotMetrics">Metriques</button>
              <button v-if="canWriteSites" form="site-create-form" type="submit" :disabled="siteCreating">{{ siteCreating ? 'Creation...' : 'Ajouter un site' }}</button>
            </div>
          </div>

          <form v-if="canWriteSites" id="site-create-form" class="admin-form prospect-form" @submit.prevent="createSite">
            <input v-model="siteForm.name" required placeholder="Nom du site" />
            <input v-model="siteForm.domain" required placeholder="domaine.example" />
            <select v-model="siteForm.organizationId" required>
              <option disabled value="">Organisation</option>
              <option v-for="organization in organizations" :key="organization.id" :value="organization.id">{{ organization.name }}</option>
            </select>
            <select v-model="siteForm.status"><option value="active">active</option><option value="inactive">inactive</option></select>
            <label class="checkbox-field"><input v-model="siteForm.widgetEnabled" type="checkbox" /> Widget actif</label>
          </form>
          <div class="dashboard-grid">
            <article class="metric"><span>Questions sans reponse</span><strong>{{ chatbotMetrics?.unansweredQuestions ?? 0 }}</strong><small>Pending</small></article>
            <article class="metric"><span>Leads captures</span><strong>{{ chatbotMetrics?.leadsCaptured ?? 0 }}</strong><small>Chatbot</small></article>
            <article class="metric"><span>Conversion chatbot</span><strong>{{ Math.round((chatbotMetrics?.conversionRate ?? 0) * 100) }}%</strong><small>Conversation -> prospect</small></article>
          </div>
          <div class="table-wrap">
            <table><thead><tr><th>Site</th><th>Domaine</th><th>Widget</th><th>Cle publique</th><th></th></tr></thead>
              <tbody><tr v-for="site in sites" :key="site.id">
                <td><strong>{{ site.name }}</strong><small>{{ site.slug || site.id }}</small></td>
                <td>{{ site.domain || '-' }}</td>
                <td><span class="badge">{{ site.widget_enabled ? 'actif' : 'inactif' }}</span></td>
                <td><code>{{ site.widget_public_key }}</code></td>
                <td class="actions"><button type="button" @click="openSiteWidget(site)">Configurer</button></td>
              </tr></tbody>
            </table>
          </div>
        </section>

        <section v-if="route === 'site-widget'" class="panel">
          <div class="panel-header">
            <h2>Widget {{ selectedSite?.name }}</h2>
            <div class="inline-actions">
              <button type="button" @click="navigate('sites')">Retour</button>
              <button type="button" @click="navigate('site-unanswered', selectedSite?.id)">Questions sans reponse</button>
            </div>
          </div>
          <div class="analysis-grid">
            <article class="analysis-main">
              <h3>Code Moto CMS</h3>
              <p>Collez ce script dans Moto CMS 4.</p>
              <textarea readonly rows="3">{{ siteWidget?.scriptCode }}</textarea>
              <textarea readonly rows="3">{{ siteWidget?.debugScriptCode }}</textarea>
              <div class="inline-actions"><button type="button" @click="copyWidgetScript">Copier le script</button><button type="button" @click="copyWidgetDebugScript">Copier debug</button><a :href="siteWidget?.scriptUrl" target="_blank" rel="noreferrer">Voir le script</a></div>
            </article>
            <article>
              <h3>Apercu live</h3>
              <div class="widget-preview" :style="{ borderColor: siteWidgetForm.primaryColor }">
                <button type="button" :style="{ background: siteWidgetForm.primaryColor }">Besoin d’aide ?</button>
                <p>{{ siteWidgetForm.welcomeMessage }}</p>
                <small>{{ siteWidgetForm.privacyMessage }}</small>
              </div>
            </article>
          </div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Script</span><strong>{{ siteWidget?.diagnostics?.scriptStatus || '-' }}</strong><small>Etat widget</small></article>
            <article class="metric"><span>Conversations</span><strong>{{ siteWidget?.diagnostics?.conversationsCreated || 0 }}</strong><small>Depuis widget</small></article>
            <article class="metric"><span>Temps moyen</span><strong>{{ siteWidget?.diagnostics?.metrics?.average_response_ms || 0 }} ms</strong><small>7 derniers jours</small></article>
            <article class="metric"><span>Erreurs</span><strong>{{ siteWidget?.diagnostics?.metrics?.errors || 0 }}</strong><small>Runtime</small></article>
          </div>
          <section class="timeline-section">
            <div class="panel-header"><h2>Diagnostics widget</h2><button type="button" :disabled="siteWidgetTesting" @click="loadWidgetDiagnostics()">{{ siteWidgetTesting ? 'Test en cours...' : 'Tester API' }}</button></div>
            <p>Dernier chargement : {{ siteWidget?.diagnostics?.lastWidgetLoad?.created_at || '-' }}</p>
            <p>Domaines autorises : {{ (siteWidget?.diagnostics?.allowedDomains || []).join(', ') || '-' }}</p>
            <div class="activity-list">
              <article v-for="error in siteWidget?.diagnostics?.recentErrors || []" :key="error.id">
                <strong>{{ error.message || error.event_type }}</strong>
                <span>{{ error.domain || error.source_url || '-' }}</span>
                <small>{{ error.created_at }}</small>
              </article>
            </div>
          </section>
          <form class="admin-form prospect-form" @submit.prevent="saveSiteWidgetSettings">
            <input v-model="siteWidgetForm.name" required placeholder="Nom du site" />
            <input v-model="siteWidgetForm.domain" required placeholder="Domaine" />
            <label class="checkbox-field"><input v-model="siteWidgetForm.widgetEnabled" type="checkbox" /> Widget actif</label>
            <select v-model="siteWidgetForm.status"><option value="active">active</option><option value="inactive">inactive</option></select>
            <input v-model="siteWidgetForm.primaryColor" placeholder="#1f6f5b" />
            <textarea v-model="siteWidgetForm.allowedDomains" placeholder="Un domaine autorise par ligne"></textarea>
            <textarea v-model="siteWidgetForm.welcomeMessage" placeholder="Message d'accueil"></textarea>
            <textarea v-model="siteWidgetForm.fallbackMessage" placeholder="Message fallback"></textarea>
            <textarea v-model="siteWidgetForm.privacyMessage" placeholder="Message confidentialite"></textarea>
            <label class="checkbox-field"><input v-model="siteWidgetForm.leadCaptureEnabled" type="checkbox" /> Capture lead active</label>
            <select v-model="siteWidgetForm.leadCaptureTrigger">
              <option value="after_messages">apres X messages</option>
              <option value="repeated_fallback">fallback repete</option>
              <option value="commercial_intent">intention commerciale</option>
              <option value="manual">manuel</option>
            </select>
            <input v-model="siteWidgetForm.leadCaptureAfterMessages" type="number" min="1" max="20" />
            <label class="checkbox-field"><input v-model="siteWidgetForm.leadCaptureFields.name" type="checkbox" /> nom</label>
            <label class="checkbox-field"><input v-model="siteWidgetForm.leadCaptureFields.email" type="checkbox" /> email</label>
            <label class="checkbox-field"><input v-model="siteWidgetForm.leadCaptureFields.phone" type="checkbox" /> telephone</label>
            <label class="checkbox-field"><input v-model="siteWidgetForm.leadCaptureFields.need" type="checkbox" /> besoin</label>
            <button type="submit" :disabled="siteWidgetSaving">{{ siteWidgetSaving ? 'Sauvegarde...' : 'Sauvegarder widget' }}</button>
          </form>
          <section class="timeline-section">
            <div class="panel-header"><h2>Import automatique du site</h2><span class="badge">Crawler KMS</span></div>
            <form class="import-form" @submit.prevent="crawlSelectedSite">
              <label>
                <span>URL de depart</span>
                <input v-model.trim="siteCrawlerForm.startUrl" type="url" :placeholder="selectedSite?.domain || 'https://example.com'" required />
              </label>
              <label>
                <span>Nombre maximum de pages</span>
                <input v-model.number="siteCrawlerForm.maxPages" type="number" min="1" max="250" required />
              </label>
              <button type="submit" :disabled="siteCrawlerLoading">
                {{ siteCrawlerLoading ? 'Crawl en cours...' : 'Crawler le site' }}
              </button>
            </form>
            <p class="muted">Le crawler reste limite au domaine courant : {{ selectedSite?.domain || '-' }}.</p>
            <p v-if="siteCrawlerError" class="error-message">{{ siteCrawlerError }}</p>
            <div v-if="siteCrawlerResult" class="dashboard-grid compact-grid">
              <article class="metric"><span>Pages explorees</span><strong>{{ siteCrawlerResult.pagesDiscovered ?? 0 }}</strong><small>URLs internes</small></article>
              <article class="metric"><span>Pages importees</span><strong>{{ siteCrawlerResult.pagesImported ?? 0 }}</strong><small>KMS site</small></article>
              <article class="metric"><span>Chunks crees</span><strong>{{ siteCrawlerResult.chunksCreated ?? siteCrawlerResult.documentsCreated ?? 0 }}</strong><small>Connaissances indexees</small></article>
              <article class="metric"><span>Duree</span><strong>{{ siteCrawlerResult.durationMs ?? '-' }} ms</strong><small>Crawl</small></article>
            </div>
          </section>
          <section class="timeline-section">
            <div class="panel-header"><h2>Import Q/A site</h2><span class="badge">CSV</span></div>
            <form class="import-form" @submit.prevent="importSiteQa">
              <textarea v-model="siteQaCsv" placeholder="site_domain,category,question,answer,tags,priority,is_active"></textarea>
              <button type="submit">Importer Q/A</button>
            </form>
            <pre v-if="siteQaImportResult" class="metrics-output">{{ JSON.stringify(siteQaImportResult, null, 2) }}</pre>
          </section>
        </section>

        <section v-if="route === 'site-unanswered'" class="panel">
          <div class="panel-header">
            <h2>Questions sans reponse</h2>
            <div class="inline-actions">
              <button type="button" @click="navigate('site-widget', selectedSite?.id)">Retour widget</button>
              <select v-model="unansweredFilter" @change="loadUnansweredQuestions"><option value="pending">pending</option><option value="ignored">ignored</option><option value="converted">converted</option></select>
            </div>
          </div>
          <div class="message-preview">
            <textarea v-model="unansweredAnswer" placeholder="Reponse a utiliser pour transformer une question en Q/A"></textarea>
          </div>
          <div class="timeline">
            <article v-for="question in unansweredQuestions" :key="question.id" class="timeline-item">
              <header><strong>{{ question.question }}</strong><span class="badge">{{ question.status }}</span></header>
              <p>{{ question.created_at }}</p>
              <div class="inline-actions">
                <button type="button" @click="convertUnanswered(question)">Transformer en Q/A</button>
                <button type="button" @click="ignoreUnanswered(question)">Ignorer</button>
              </div>
            </article>
            <p v-if="unansweredQuestions.length === 0" class="muted">Aucune question pour ce filtre.</p>
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
          <div v-if="prospectImportResult" class="notice success">
            Import CSV : {{ prospectImportResult.created }} cree(s), {{ prospectImportResult.merged }} fusionne(s), {{ prospectImportResult.rejected }} rejete(s), {{ prospectImportResult.accepted }} accepte(s).
            <small v-if="prospectImportResult.errors?.length">Premiere erreur : ligne {{ prospectImportResult.errors[0].row }} - {{ prospectImportResult.errors[0].reason }}</small>
          </div>
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
            <div class="inline-actions">
              <button type="button" @click="analyzeImportCsv">Analyser import</button>
              <button type="submit">Importer</button>
            </div>
          </form>
          <div v-if="importIntelligence" class="dashboard-grid compact-grid">
            <article class="metric"><span>Lignes</span><strong>{{ importIntelligence.rows }}</strong><small>CSV</small></article>
            <article class="metric"><span>Doublons</span><strong>{{ importIntelligence.duplicates }}</strong><small>Probables</small></article>
            <article class="metric"><span>Emails invalides</span><strong>{{ importIntelligence.invalidEmails }}</strong><small>A corriger</small></article>
            <article class="metric"><span>Telephones invalides</span><strong>{{ importIntelligence.invalidPhones }}</strong><small>A corriger</small></article>
            <article class="metric"><span>Villes inconnues</span><strong>{{ importIntelligence.unknownCities }}</strong><small>Manquantes</small></article>
            <article class="metric"><span>Colonnes ignorees</span><strong>{{ importIntelligence.ignoredColumns?.length || 0 }}</strong><small>{{ importIntelligence.ignoredColumns?.join(', ') || '-' }}</small></article>
          </div>
          <div v-if="importIntelligence?.correctionProposals?.length" class="activity-list">
            <article v-for="proposal in importIntelligence.correctionProposals" :key="proposal">
              <strong>Correction proposee</strong><span>{{ proposal }}</span><small>Import intelligent</small>
            </article>
          </div>
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

        <section v-if="route === 'first-start'" class="panel">
          <div class="panel-header">
            <h2>Assistant premier demarrage</h2>
            <div class="inline-actions">
              <button type="button" @click="loadOnboardingStatus">Actualiser</button>
              <button type="button" @click="createDemoProject">Creer projet demo</button>
            </div>
          </div>
          <div class="dashboard-grid compact-grid">
            <article v-for="step in onboarding?.steps || []" :key="step.key" class="metric">
              <span>{{ step.label }}</span>
              <strong>{{ step.completed ? 'OK' : 'A faire' }}</strong>
              <small>{{ step.key }}</small>
            </article>
          </div>
          <div class="empty-panel">
            <p>Compte demo : <strong>demo@visitor-os.app</strong> / <strong>demo123</strong></p>
            <p class="muted">Le projet demo cree 200 prospects fictifs, 20 contacts, 10 relances, 5 signatures et 5 refus.</p>
          </div>
        </section>

        <section v-if="route === 'quality'" class="panel">
          <div class="panel-header">
            <h2>Quality Report</h2>
            <div class="inline-actions">
              <button type="button" @click="loadQualityReport">Actualiser</button>
              <button type="button" @click="loadCleanupPreview">Nettoyer les donnees</button>
              <button type="button" @click="exportFullBackup">Backup VISITOR-OS</button>
            </div>
          </div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Erreurs</span><strong>{{ qualityReport?.errors ?? 0 }}</strong><small>Qualite donnees</small></article>
            <article class="metric"><span>Donnees incompletes</span><strong>{{ qualityReport?.incompleteData ?? 0 }}</strong><small>Nom / pseudo</small></article>
            <article class="metric"><span>Sans contact</span><strong>{{ qualityReport?.prospectsWithoutContact ?? 0 }}</strong><small>Email / telephone</small></article>
            <article class="metric"><span>Jamais relances</span><strong>{{ qualityReport?.prospectsNeverFollowedUp ?? 0 }}</strong><small>Historique absent</small></article>
            <article class="metric"><span>Score moyen</span><strong>{{ qualityReport?.averageScore ?? 0 }}</strong><small>CRM</small></article>
            <article class="metric"><span>Qualite CRM</span><strong>{{ qualityReport?.crmQuality ?? 0 }}%</strong><small>Indice simple</small></article>
          </div>
          <div v-if="qualityReport?.recommendations?.length" class="activity-list">
            <article v-for="recommendation in qualityReport.recommendations" :key="recommendation">
              <strong>Recommandation</strong><span>{{ recommendation }}</span><small>Avant campagne</small>
            </article>
          </div>
          <div v-if="cleanupPreview" class="panel">
            <div class="panel-header"><h2>Apercu nettoyage</h2><button type="button" @click="applyCleanup">Valider nettoyage</button></div>
            <div class="dashboard-grid compact-grid">
              <article class="metric"><span>Espaces</span><strong>{{ cleanupPreview.trimSpaces }}</strong><small>Corrections</small></article>
              <article class="metric"><span>Emails</span><strong>{{ cleanupPreview.normalizeEmails }}</strong><small>Normalisation</small></article>
              <article class="metric"><span>Telephones</span><strong>{{ cleanupPreview.normalizePhones }}</strong><small>Normalisation</small></article>
              <article class="metric"><span>URLs</span><strong>{{ cleanupPreview.normalizeUrls }}</strong><small>Normalisation</small></article>
              <article class="metric"><span>Doublons simples</span><strong>{{ cleanupPreview.simpleDuplicates }}</strong><small>A surveiller</small></article>
            </div>
            <div class="table-wrap">
              <table><thead><tr><th>Champ</th><th>Avant</th><th>Apres</th></tr></thead>
                <tbody><tr v-for="sample in cleanupPreview.samples" :key="sample.id + sample.field">
                  <td>{{ sample.field }}</td><td>{{ sample.before || '-' }}</td><td>{{ sample.after || '-' }}</td>
                </tr></tbody>
              </table>
            </div>
          </div>
        </section>

        <section v-if="route === 'chat'" class="panel">
          <div class="panel-header">
            <h2>Chat IA CRM</h2>
            <div class="inline-actions">
              <button type="button" @click="createChatSession">Nouvelle conversation</button>
              <button type="button" :disabled="!chatLastCsv" @click="exportChatCsv">Exporter resultat CSV</button>
            </div>
          </div>
          <div class="chat-layout">
            <aside class="chat-history" aria-label="Historique conversations">
              <button v-for="session in chatSessions" :key="session.id" type="button" :class="{ active: selectedChatSession?.id === session.id }" @click="openChatSession(session)">
                <strong>{{ session.title }}</strong>
                <small>{{ new Date(session.updated_at).toLocaleString('fr-FR') }}</small>
              </button>
              <p v-if="chatSessions.length === 0" class="muted">Aucune conversation.</p>
            </aside>
            <div class="chat-main">
              <div class="chat-suggestions">
                <button v-for="suggestion in chatSuggestions" :key="suggestion" type="button" @click="sendChatMessage(suggestion)">{{ suggestion }}</button>
              </div>
              <div class="chat-messages" aria-live="polite">
                <article v-for="message in chatMessages" :key="message.id" :class="['chat-message', message.role]">
                  <strong>{{ message.role === 'user' ? 'Vous' : 'VISITOR-OS' }}</strong>
                  <p>{{ message.content }}</p>
                  <div v-if="message.citations?.length" class="chat-citations">
                    <span v-for="citation in message.citations.slice(0, 8)" :key="citation.source + citation.prospectId" class="badge">
                      {{ citation.prospect || citation.status || citation.source }} · {{ citation.score ?? '-' }} · {{ citation.city || '-' }}
                    </span>
                  </div>
                </article>
                <div v-if="chatMessages.length === 0" class="empty-panel">
                  <strong>Pose une question sur le CRM.</strong>
                  <p>Le chat lit les prospects, relances, pipeline, analyses IA et enrichissements. Il ne modifie rien et n'envoie aucun message.</p>
                </div>
              </div>
              <form class="chat-input" @submit.prevent="sendChatMessage()">
                <input v-model="chatInput" type="text" maxlength="1500" placeholder="Exemple : Quels sont les 20 meilleurs prospects à contacter aujourd'hui ?" />
                <button type="submit">Envoyer</button>
              </form>
            </div>
          </div>
        </section>

        <section v-if="route === 'diagnostics'" class="panel">
          <div class="panel-header"><h2>Diagnostics</h2><button type="button" @click="loadDiagnostics">Actualiser</button></div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Database</span><strong>{{ diagnostics?.database?.state || 'unknown' }}</strong><small>{{ diagnostics?.database?.latencyMs ?? '-' }} ms</small></article>
            <article class="metric"><span>Queue</span><strong>{{ diagnostics?.queue?.enabled ? 'enabled' : 'disabled' }}</strong><small>{{ diagnostics?.queue?.queued ?? 0 }} queued</small></article>
            <article class="metric"><span>Cache</span><strong>{{ diagnostics?.cache?.enabled ? 'enabled' : 'disabled' }}</strong><small>{{ diagnostics?.cache?.keys ?? 0 }} keys</small></article>
            <article class="metric"><span>OpenTelemetry</span><strong>{{ diagnostics?.openTelemetry?.enabled ? 'enabled' : 'disabled' }}</strong><small>{{ diagnostics?.openTelemetry?.serviceName || '-' }}</small></article>
            <article class="metric"><span>Version</span><strong>{{ diagnostics?.version || '-' }}</strong><small>{{ diagnostics?.variables?.NODE_ENV || '-' }}</small></article>
            <article class="metric"><span>Railway</span><strong>{{ diagnostics?.railway?.environment || '-' }}</strong><small>{{ diagnostics?.railway?.service || '-' }}</small></article>
            <article class="metric"><span>Permissions</span><strong>{{ diagnostics?.permissions?.readiness || '-' }}</strong><small>DB configured: {{ diagnostics?.permissions?.databaseConfigured }}</small></article>
            <article class="metric"><span>Temps reponse</span><strong>{{ diagnostics?.responseTimeMs ?? 0 }} ms</strong><small>Diagnostic API</small></article>
          </div>
          <pre class="metrics-output" tabindex="0">{{ JSON.stringify(diagnostics, null, 2) }}</pre>
        </section>

        <section v-if="route === 'about'" class="panel">
          <div class="panel-header"><h2>About VISITOR-OS</h2><button type="button" @click="loadAbout">Actualiser</button></div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Version</span><strong>{{ about?.version || '-' }}</strong><small>APP_VERSION</small></article>
            <article class="metric"><span>Commit</span><strong>{{ about?.commit || '-' }}</strong><small>Git</small></article>
            <article class="metric"><span>Date build</span><strong>{{ about?.buildDate || '-' }}</strong><small>Railway</small></article>
            <article class="metric"><span>Railway</span><strong>{{ about?.railway?.environment || '-' }}</strong><small>{{ about?.railway?.service || '-' }}</small></article>
            <article class="metric"><span>Node</span><strong>{{ about?.node || '-' }}</strong><small>Runtime</small></article>
            <article class="metric"><span>PostgreSQL</span><strong>{{ about?.postgresql || '-' }}</strong><small>Readiness</small></article>
            <article class="metric"><span>Licence</span><strong>{{ about?.license || '-' }}</strong><small>Projet</small></article>
            <article class="metric"><span>Documentation</span><strong>{{ about?.documentation || '-' }}</strong><small>Guides</small></article>
          </div>
        </section>

        <section v-if="route === 'settings'" class="panel">
          <div class="panel-header"><h2>Parametres production</h2><button type="button" @click="loadSettings">Recharger</button></div>
          <div class="settings-grid">
            <article>
              <h3>Modules</h3>
              <label v-for="(_enabled, key) in featureFlags" :key="key" class="checkbox-field">
                <input v-model="featureFlags[key]" type="checkbox" />
                {{ key }}
              </label>
              <button type="button" @click="saveFeatureFlags">Sauvegarder modules</button>
            </article>
            <article>
              <h3>Configuration avancee</h3>
              <textarea v-model="runtimeSettingsJson" spellcheck="false"></textarea>
              <button type="button" @click="saveRuntimeSettings">Sauvegarder configuration</button>
            </article>
          </div>
        </section>

        <section v-if="route === 'system'" class="panel">
          <div class="panel-header">
            <h2>System</h2>
            <button type="button" @click="refreshTechnicalStatus">Actualiser</button>
          </div>
          <div class="dashboard-grid compact-grid">
            <article class="metric"><span>Version</span><strong>{{ health?.version || 'unknown' }}</strong><small>{{ health?.environment || 'environment' }}</small></article>
            <article class="metric"><span>API</span><strong>{{ health?.status || 'unknown' }}</strong><small>/health</small></article>
            <article class="metric"><span>DB</span><strong>{{ ready?.database || health?.database || 'unknown' }}</strong><small>/ready</small></article>
            <article class="metric"><span>Uptime</span><strong>{{ health?.uptime ?? 0 }}s</strong><small>Backend</small></article>
            <article class="metric"><span>Cache</span><strong>{{ health?.cache?.enabled ? 'enabled' : 'disabled' }}</strong><small>{{ health?.cache?.entries ?? 0 }} entree(s)</small></article>
            <article class="metric"><span>Queue</span><strong>{{ health?.queue?.pending ?? 0 }}</strong><small>{{ health?.queue?.running ?? 0 }} running</small></article>
            <article class="metric"><span>Logs</span><strong>{{ health?.disk?.logs || 'unknown' }}</strong><small>application / error / audit</small></article>
            <article class="metric"><span>OpenTelemetry</span><strong>{{ health?.openTelemetry?.enabled ? 'enabled' : 'disabled' }}</strong><small>{{ health?.openTelemetry?.serviceName || '-' }}</small></article>
          </div>
          <pre class="metrics-output" tabindex="0">{{ systemMetrics }}</pre>
        </section>
      </main>
    </section>\`
}).mount('#app');

function normalizeRoute(pathname) {
  if (pathname === '/system') return 'system';
  if (pathname === '/diagnostics') return 'diagnostics';
  if (pathname === '/about') return 'about';
  if (pathname === '/quality') return 'quality';
  if (pathname === '/first-start') return 'first-start';
  if (pathname === '/chat') return 'chat';
  if (pathname === '/studio') return 'studio';
  if (pathname.startsWith('/studio/')) return 'studio-detail';
  if (pathname === '/pipeline') return 'pipeline';
  if (pathname === '/chatbots') return 'chatbots';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/intents')) return 'chatbot-intents';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/knowledge')) return 'chatbot-knowledge';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/conversations')) return 'chatbot-conversations';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/unanswered')) return 'chatbot-unanswered';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/flows')) return 'chatbot-flows';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/stats')) return 'chatbot-stats';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/personality')) return 'chatbot-personality';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/goals')) return 'chatbot-goals';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/reasoning')) return 'chatbot-reasoning';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/review')) return 'chatbot-review';
  if (pathname.startsWith('/chatbots/') && pathname.endsWith('/widget')) return 'site-widget';
  if (pathname.startsWith('/chatbots/')) return 'chatbot-overview';
  if (pathname === '/sites') return 'sites';
  if (pathname.startsWith('/sites/') && pathname.endsWith('/unanswered')) return 'site-unanswered';
  if (pathname.startsWith('/sites/') && pathname.endsWith('/widget')) return 'site-widget';
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

function routeResourceId(pathname) {
  return pathname.split('/').filter(Boolean)[1] || '';
}

function routePath(route, id) {
  if (route === 'dashboard') return '/';
  if (route === 'system') return '/system';
  if (route === 'diagnostics') return '/diagnostics';
  if (route === 'about') return '/about';
  if (route === 'quality') return '/quality';
  if (route === 'first-start') return '/first-start';
  if (route === 'chat') return '/chat';
  if (route === 'studio') return '/studio';
  if (route === 'studio-detail') return '/studio/' + id;
  if (route === 'pipeline') return '/pipeline';
  if (route === 'chatbots') return '/chatbots';
  if (route === 'chatbot-overview') return '/chatbots/' + id;
  if (route === 'chatbot-intents') return '/chatbots/' + id + '/intents';
  if (route === 'chatbot-knowledge') return '/chatbots/' + id + '/knowledge';
  if (route === 'chatbot-conversations') return '/chatbots/' + id + '/conversations';
  if (route === 'chatbot-unanswered') return '/chatbots/' + id + '/unanswered';
  if (route === 'chatbot-flows') return '/chatbots/' + id + '/flows';
  if (route === 'chatbot-stats') return '/chatbots/' + id + '/stats';
  if (route === 'chatbot-personality') return '/chatbots/' + id + '/personality';
  if (route === 'chatbot-goals') return '/chatbots/' + id + '/goals';
  if (route === 'chatbot-reasoning') return '/chatbots/' + id + '/reasoning';
  if (route === 'chatbot-review') return '/chatbots/' + id + '/review';
  if (route === 'sites') return '/sites';
  if (route === 'site-widget') return '/sites/' + id + '/widget';
  if (route === 'site-unanswered') return '/sites/' + id + '/unanswered';
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
    system: 'System',
    diagnostics: 'Diagnostics',
    about: 'About',
    quality: 'Quality Report',
    'first-start': 'Premier demarrage',
    chat: 'Chat IA CRM',
    studio: 'Chatbot Studio',
    'studio-detail': 'Studio chatbot',
    chatbots: 'Knowledge Engine',
    'chatbot-overview': 'Vue chatbot',
    'chatbot-intents': 'Intentions',
    'chatbot-knowledge': 'Connaissances',
    'chatbot-conversations': 'Conversations chatbot',
    'chatbot-unanswered': 'Questions inconnues',
    'chatbot-flows': 'Parcours',
    'chatbot-stats': 'Statistiques chatbot',
    'chatbot-personality': 'Personnalite',
    'chatbot-goals': 'Objectifs',
    'chatbot-reasoning': 'Reasoning Lab',
    'chatbot-review': 'Review chatbot',
    sites: 'Chatbot multi-sites',
    'site-widget': 'Integration widget',
    'site-unanswered': 'Questions sans reponse',
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

function emptySiteForm() {
  return { name: '', domain: '', organizationId: '', status: 'active', widgetEnabled: true };
}

function emptySiteCrawlerForm(domain = '') {
  return { startUrl: normalizeCrawlerStartUrl(domain), maxPages: 50 };
}

function normalizeCrawlerStartUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return hasHttpProtocol(trimmed) ? trimmed : 'https://' + trimmed;
}

function hasHttpProtocol(value) {
  const lower = String(value || '').toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

function hostFromUrlOrDomain(value) {
  try {
    const hostname = new URL(normalizeCrawlerStartUrl(value)).hostname.toLowerCase();
    return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
  } catch {
    return '';
  }
}

function emptySiteWidgetForm() {
  return {
    name: '',
    domain: '',
    allowedDomains: ['chambres-dhotes-albi.com', 'photographe-boudoir-albi.ovh', 'photographe-boudoir-lyon.ovh', 'decoration-murale-photo.com'].join('\\n'),
    primaryColor: '#1f6f5b',
    welcomeMessage: 'Bonjour, je peux vous aider.',
    fallbackMessage: "Je n'ai pas encore cette information. Contactez-nous pour une reponse precise.",
    privacyMessage: 'Vos informations sont utilisees uniquement pour repondre a votre demande.',
    leadCaptureEnabled: false,
    leadCaptureTrigger: 'after_messages',
    leadCaptureAfterMessages: 3,
    leadCaptureFields: { name: true, email: true, phone: true, need: true },
    widgetEnabled: true,
    status: 'active'
  };
}

function parseDomainLines(value) {
  return String(value || '')
    .split(/\\r?\\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function siteWidgetToForm(site, settings) {
  const defaults = emptySiteWidgetForm();
  const fields = new Set(settings?.leadCaptureFields ?? ['name', 'email', 'phone', 'need']);

  return {
    name: site?.name ?? '',
    domain: site?.domain ?? '',
    allowedDomains: (settings?.allowedDomains ?? site?.allowed_domains ?? []).join('\\n'),
    primaryColor: settings?.primaryColor ?? defaults.primaryColor,
    welcomeMessage: settings?.welcomeMessage ?? defaults.welcomeMessage,
    fallbackMessage: settings?.fallbackMessage ?? defaults.fallbackMessage,
    privacyMessage: settings?.privacyMessage ?? defaults.privacyMessage,
    leadCaptureEnabled: Boolean(settings?.leadCaptureEnabled),
    leadCaptureTrigger: settings?.leadCaptureTrigger ?? defaults.leadCaptureTrigger,
    leadCaptureAfterMessages: settings?.leadCaptureAfterMessages ?? defaults.leadCaptureAfterMessages,
    leadCaptureFields: {
      name: fields.has('name'),
      email: fields.has('email'),
      phone: fields.has('phone'),
      need: fields.has('need')
    },
    widgetEnabled: Boolean(site?.widget_enabled ?? true),
    status: site?.status ?? 'active'
  };
}

function emptyIntentForm() {
  return { name: '', slug: '', description: '', category: 'general', examples: '', synonyms: '', priority: 50, isActive: true };
}

function emptyKnowledgeForm() {
  return {
    intentId: '',
    title: '',
    mainQuestion: '',
    alternativeQuestions: '',
    shortAnswer: '',
    detailedAnswer: '',
    commercialAnswer: '',
    reassuranceAnswer: '',
    links: '',
    ctaLabel: '',
    ctaUrl: '',
    conditions: '',
    tags: '',
    priority: 50,
    status: 'draft'
  };
}

function emptyFlowForm() {
  return { name: '', description: '', triggerIntentId: '', isActive: true };
}

function emptyFlowStepForm() {
  return { stepOrder: 1, stepType: 'answer', content: '', conditions: '', nextStepId: '', actionType: 'show_answer', metadata: {} };
}

function emptyPersonalityForm() {
  return {
    tone: 'professionnel',
    style: '',
    answerLength: 'medium',
    formality: 'vouvoiement',
    emojiLevel: 'none',
    commercialIntensity: 50,
    reassuranceLevel: 70
  };
}

function personalityToForm(personality) {
  if (!personality) return emptyPersonalityForm();
  return {
    tone: personality.tone ?? 'professionnel',
    style: personality.style ?? '',
    answerLength: personality.answer_length ?? 'medium',
    formality: personality.formality ?? 'vouvoiement',
    emojiLevel: personality.emoji_level ?? 'none',
    commercialIntensity: personality.commercial_intensity ?? 50,
    reassuranceLevel: personality.reassurance_level ?? 70
  };
}

function emptyGoalForm() {
  return { goalType: 'information', description: '', priority: 50, successAction: '', isActive: true };
}

function emptyStudioWizard() {
  return {
    name: '',
    domain: '',
    businessType: 'chambre_hotes',
    primaryGoal: 'reservation',
    tone: 'professionnel et rassurant',
    templateId: ''
  };
}

function studioWizardFromSite(site, current = emptyStudioWizard()) {
  return {
    ...current,
    name: current.name || site?.name || '',
    domain: current.domain || site?.domain || '',
    businessType: current.businessType || site?.business_type || 'chambre_hotes',
    primaryGoal: current.primaryGoal || site?.primary_goal || 'reservation',
    tone: current.tone || site?.tone || 'professionnel et rassurant'
  };
}

function emptyStudioImport() {
  return {
    fileName: '',
    fileType: 'txt',
    content: ''
  };
}

function splitLines(value) {
  return String(value || '').split('\\n').map((item) => item.trim()).filter(Boolean);
}

function splitTags(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
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

async function responseTextOrFallback(result, fallback) {
  if (result.status !== 'fulfilled' || !result.value.ok) return fallback;
  return result.value.text();
}

async function responseErrorMessage(response, fallback) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return payload?.error?.message || payload?.message || fallback;
  }
  const text = await response.text();
  return text || fallback;
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
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
  outline: 3px solid #f5b942;
  outline-offset: 3px;
}
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
.widget-preview { display: grid; gap: 12px; border: 2px solid #166a5b; border-radius: 8px; padding: 16px; background: #fbfcfe; }
.widget-preview button { justify-self: start; border-radius: 999px; }
.widget-preview small { color: #647084; }
code { overflow-wrap: anywhere; color: #172033; }
.settings-grid { display: grid; grid-template-columns: minmax(240px, 0.8fr) minmax(0, 1.2fr); gap: 18px; padding: 18px; }
.settings-grid article { display: grid; align-content: start; gap: 12px; border: 1px solid #e6ebf2; border-radius: 8px; padding: 14px; background: #fbfcfe; }
.settings-grid textarea { min-height: 360px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
.metrics-output {
  overflow: auto;
  max-height: 360px;
  margin: 18px;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  padding: 14px;
  color: #172033;
  background: #f8fafc;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
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
.chat-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 620px; }
.chat-history { display: grid; align-content: start; gap: 8px; border-right: 1px solid #e6ebf2; padding: 18px; background: #fbfcfe; }
.chat-history button { justify-content: flex-start; align-items: flex-start; flex-direction: column; border: 1px solid #dfe5ee; color: #172033; background: #fff; text-align: left; }
.chat-history button.active { border-color: #166a5b; background: #ecfdf5; }
.chat-history small { color: #647084; font-weight: 500; }
.chat-main { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-width: 0; }
.chat-suggestions { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #e6ebf2; padding: 14px 18px; }
.chat-suggestions button { min-height: 34px; padding: 8px 10px; color: #354157; background: #f8fafc; font-size: 13px; }
.chat-messages { display: grid; align-content: start; gap: 12px; overflow: auto; padding: 18px; }
.chat-message { max-width: 880px; border: 1px solid #dfe5ee; border-radius: 8px; padding: 14px; background: #fff; }
.chat-message.user { justify-self: end; background: #eef6ff; }
.chat-message p { white-space: pre-wrap; color: #354157; }
.chat-citations { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chat-input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; border-top: 1px solid #e6ebf2; padding: 14px 18px; background: #fbfcfe; }
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
  .settings-grid { grid-template-columns: 1fr; }
  .prospect-form textarea { grid-column: span 1; }
  .analysis-grid, .analysis-grid .analysis-main { grid-template-columns: 1fr; grid-column: span 1; }
  .compact-grid, .pipeline-mini, .activity-list article { grid-template-columns: 1fr; }
  .chat-layout { grid-template-columns: 1fr; }
  .chat-history { border-right: 0; border-bottom: 1px solid #e6ebf2; }
  .chat-input { grid-template-columns: 1fr; }
  .inline-actions, .filters, .filters input, .filters select { width: 100%; }
}
`;
