import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';

const API_BASE_URL = window.VISITOR_OS_API_URL ?? 'http://localhost:3000';

createApp({
  data() {
    return {
      conversations: [],
      conversationStatuses: [],
      selectedConversation: null,
      prospects: [],
      search: '',
      loading: true,
      error: ''
    };
  },

  computed: {
    openConversationsCount() {
      return this.conversations.filter((conversation) => conversation.status === 'open').length;
    }
  },

  async mounted() {
    await this.refreshDashboard();
  },

  methods: {
    async refreshDashboard() {
      this.loading = true;
      this.error = '';

      try {
        await Promise.all([this.loadConversations(), this.loadProspects()]);
      } finally {
        this.loading = false;
      }
    },

    async loadConversations() {
      const params = new URLSearchParams();
      if (this.search.trim()) params.set('search', this.search.trim());

      const response = await fetch(`${API_BASE_URL}/api/admin/conversations?${params.toString()}`);
      if (!response.ok) throw new Error('Impossible de charger les conversations.');
      const data = await response.json();
      this.conversations = data.conversations;
      this.conversationStatuses = data.statuses;

      if (!this.selectedConversation && this.conversations.length > 0) {
        await this.selectConversation(this.conversations[0].id);
      }
    },

    async loadProspects() {
      const response = await fetch(`${API_BASE_URL}/api/admin/prospects`);
      if (!response.ok) throw new Error('Impossible de charger les prospects.');
      const data = await response.json();
      this.prospects = data.prospects;
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
        const response = await fetch(`${API_BASE_URL}/api/admin/conversations/${id}`);
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
        const response = await fetch(
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
    }
  },

  template: `
    <main class="app-shell">
      <aside class="sidebar">
        <strong>VISITOR-OS</strong>
        <span>Dashboard MVP</span>
      </aside>

      <section class="content">
        <header class="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Conversations, prospects et suivi minimal.</p>
          </div>
          <button type="button" @click="refreshDashboard">Actualiser</button>
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
      </section>
    </main>
  `
}).mount('#app');
