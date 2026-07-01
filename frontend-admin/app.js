import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';

const API_BASE_URL = window.VISITOR_OS_API_URL ?? 'http://localhost:3000';

createApp({
  data() {
    return {
      prospects: [],
      statuses: [],
      selectedProspect: null,
      loading: true,
      error: ''
    };
  },

  async mounted() {
    await this.loadProspects();
  },

  methods: {
    async loadProspects() {
      this.loading = true;
      this.error = '';

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/prospects`);
        if (!response.ok) throw new Error('Impossible de charger les prospects.');
        const data = await response.json();
        this.prospects = data.prospects;
        this.statuses = data.statuses;
        if (!this.selectedProspect && this.prospects.length > 0) {
          await this.selectProspect(this.prospects[0].id);
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      } finally {
        this.loading = false;
      }
    },

    async selectProspect(id) {
      this.error = '';

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/prospects/${id}`);
        if (!response.ok) throw new Error('Impossible de charger la fiche prospect.');
        const data = await response.json();
        this.selectedProspect = data.prospect;
        this.statuses = data.statuses;
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    async updateStatus(status) {
      if (!this.selectedProspect) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/admin/prospects/${this.selectedProspect.id}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
          }
        );

        if (!response.ok) throw new Error('Impossible de modifier le statut.');
        const data = await response.json();
        this.selectedProspect = {
          ...this.selectedProspect,
          ...data.prospect
        };
        await this.loadProspects();
        await this.selectProspect(data.prospect.id);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Erreur inconnue.';
      }
    },

    formatDate(value) {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date(value));
    }
  },

  template: `
    <main class="app-shell">
      <aside class="sidebar">
        <strong>VISITOR-OS</strong>
        <span>Admin MVP</span>
      </aside>

      <section class="content">
        <header class="topbar">
          <div>
            <h1>Prospects</h1>
            <p>Relire les conversations et modifier les statuts.</p>
          </div>
          <button type="button" @click="loadProspects">Actualiser</button>
        </header>

        <p v-if="error" class="alert">{{ error }}</p>

        <section class="layout">
          <div class="panel list-panel">
            <h2>Prospects</h2>
            <p v-if="loading">Chargement...</p>
            <p v-else-if="prospects.length === 0" class="empty">
              Aucun prospect pour l'instant. Envoyez un message depuis le widget.
            </p>

            <button
              v-for="prospect in prospects"
              :key="prospect.id"
              type="button"
              class="prospect-row"
              :class="{ active: selectedProspect?.id === prospect.id }"
              @click="selectProspect(prospect.id)"
            >
              <span>
                <strong>{{ prospect.display_name }}</strong>
                <small>{{ prospect.status }} · score {{ prospect.score_current }}</small>
              </span>
              <span class="badge">{{ prospect.temperature }}</span>
            </button>
          </div>

          <article class="panel detail-panel">
            <template v-if="selectedProspect">
              <div class="detail-header">
                <div>
                  <h2>{{ selectedProspect.display_name }}</h2>
                  <p>Score {{ selectedProspect.score_current }} · {{ selectedProspect.temperature }}</p>
                </div>
                <label>
                  Statut
                  <select
                    :value="selectedProspect.status"
                    @change="updateStatus($event.target.value)"
                  >
                    <option v-for="status in statuses" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </label>
              </div>

              <section
                v-for="conversation in selectedProspect.conversations"
                :key="conversation.id"
                class="conversation"
              >
                <h3>Conversation du {{ formatDate(conversation.created_at) }}</h3>
                <p v-if="conversation.page_url" class="muted">{{ conversation.page_url }}</p>
                <div
                  v-for="message in conversation.messages"
                  :key="message.id"
                  class="message"
                  :class="message.sender_type"
                >
                  <small>{{ message.sender_type }}</small>
                  <p>{{ message.content }}</p>
                </div>
              </section>
            </template>

            <p v-else class="empty">Selectionnez un prospect pour lire sa conversation.</p>
          </article>
        </section>
      </section>
    </main>
  `
}).mount('#app');
