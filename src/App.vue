<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <header class="app-header">
      <div class="logo-container">
        <h1 class="logo">BookmarkHub</h1>
        <span class="logo-dot"></span>
      </div>
      <div class="header-actions">
        <button class="theme-toggle" @click="toggleDarkMode">
          <span v-if="isDarkMode">☀️</span>
          <span v-else>🌙</span>
        </button>
      </div>
    </header>
    <div class="app-container">
      <Sidebar />
      <main class="content">
        <router-view/>
      </main>
    </div>
  </div>
</template>

<script>
import Sidebar from './components/Sidebar.vue';
import { startSync, stopSync } from './services/storage';

export default {
  name: 'App',
  components: {
    Sidebar
  },
  data() {
    return {
      isDarkMode: false
    };
  },
  created() {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      this.isDarkMode = JSON.parse(savedMode);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode = prefersDark;
    }
    
    // Load initial data
    this.$store.dispatch('bookmarks/loadBookmarks');
    this.$store.dispatch('tags/loadTags');
    
    // Start sync
    startSync();
  },
  beforeDestroy() {
    stopSync();
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', JSON.stringify(this.isDarkMode));
    }
  }
};
</script>

<style>
#app {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
}

.app-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--surface-color);
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo-container {
  display: flex;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--primary-color);
  margin: 0;
}

.logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--accent-color);
  margin-left: 8px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.app-container {
  display: flex;
  height: calc(100vh - 64px);
}

.content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.theme-toggle:hover {
  background-color: var(--hover-color);
}

@media (max-width: 768px) {
  .app-container {
    padding-bottom: 60px; /* Add space for mobile navigation */
  }
  
  .content {
    padding: 16px;
  }
}
</style>