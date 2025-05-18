<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <div class="app-container">
      <Sidebar @search-tag="handleTagSearch" />
      <main class="main-content">
        <router-view />
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
      isDarkMode: false,
      searchQuery: ''
    };
  },
  provide() {
    return {
      searchQuery: this.searchQuery,
      setSearchQuery: this.setSearchQuery
    };
  },
  created() {
    // 从本地存储加载暗黑模式设置
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      this.isDarkMode = JSON.parse(savedMode);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.isDarkMode = prefersDark;
    }
    document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
    
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
      localStorage.setItem('darkMode', this.isDarkMode);
      document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
    },
    handleTagSearch(tagId) {
      this.$store.commit('bookmarks/setSelectedTags', [tagId]);
      this.$router.replace({
        query: {
          ...this.$route.query,
          tag: tagId
        }
      });
    },
    setSearchQuery(query) {
      this.searchQuery = query;
    }
  }
};
</script>

<style>
.app-container {
  display: flex;
  height: 100vh;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
  
  .main-content {
    height: auto;
    padding: 0;
    padding-bottom: 60px; /* 为底部tab栏预留空间 */
  }
}
</style>