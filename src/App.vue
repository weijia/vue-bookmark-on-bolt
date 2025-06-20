<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <div class="app-container">
      <Sidebar @search-tag="handleTagSearch" />
      <main class="main-content">
        <div v-if="syncStatus !== 'idle'" class="sync-status">
          {{ syncStatusMessage }}
        </div>
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import Sidebar from './components/Sidebar.vue';
import StorageService from './services/StorageService';

export default {
  name: 'App',
  components: {
    Sidebar
  },
  data() {
    return {
      isDarkMode: false,
      searchQuery: '',
      syncStatus: 'idle', // Status values: 'idle'|'preparing'|'syncing'|'success'|'error'
      lastSyncTime: null,
      storageService: new StorageService()
    };
  },
  computed: {
    syncStatusMessage() {
      const messages = {
        idle: '',
        preparing: 'Preparing to sync...',
        syncing: 'Syncing...',
        success: `Sync completed ${this.lastSyncTime ? this.formatTime(this.lastSyncTime) : ''}`,
        error: 'Sync failed, please check network connection'
      };
      return messages[this.syncStatus];
    }
  },
  provide() {
    return {
      searchQuery: this.searchQuery,
      setSearchQuery: this.setSearchQuery
    };
  },
  created() {
    // Load dark mode settings from local storage
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
    this.$store.dispatch('sync/startSync');

    // Watch for route changes
    this.$watch(
      () => this.$route.query,
      (newQuery) => {
        // If there's no tag parameter in the route, clear selected tags
        if (!newQuery.tag) {
          this.$store.commit('bookmarks/setSelectedTags', []);
        }
      },
      { immediate: true }
    );
  },
  beforeUnmount() {
    // Cleanup if needed
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);
      document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
    },
    async handleTagSearch(tagId) {
      try {
        if (!tagId) {
          console.warn('handleTagSearch called with invalid tagId');
          return;
        }

        // 确保tagId是字符串类型
        const tagIdStr = String(tagId);
        
        const currentTags = this.$store.state.bookmarks.selectedTags;
        // 使用字符串比较
        const isTagSelected = currentTags.some(tag => String(tag) === tagIdStr);
        
        // 准备新的路由查询参数
        const newQuery = { ...this.$route.query };
        
        if (isTagSelected) {
          // 取消选中标签
          this.$store.commit('bookmarks/setSelectedTags', []);
          delete newQuery.tag;
        } else {
          // 选中新标签
          this.$store.commit('bookmarks/setSelectedTags', [tagIdStr]);
          newQuery.tag = tagIdStr;
        }

        // 更新路由（如果查询参数有变化）
        if (JSON.stringify(this.$route.query) !== JSON.stringify(newQuery)) {
          await this.$router.replace({ query: newQuery });
        }
      } catch (error) {
        console.error('Error handling tag search:', error);
        // 可以在这里添加错误通知逻辑
      }
    },
    setSearchQuery(query) {
      this.searchQuery = query;
    },
    formatTime(date) {
      if (!date) return '';
      
      const now = new Date();
      const diff = now - date; // Time difference (milliseconds)
      
      // If time difference is less than 1 minute
      if (diff < 60000) {
        return 'Just now';
      }
      
      // If time difference is less than 1 hour
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minutes ago`;
      }
      
      // If today
      if (date.toDateString() === now.toDateString()) {
        return `Today ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // If yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // Otherwise show full date
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
  }
};
</script>

<style>
.sync-status {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 8px 16px;
  background-color: var(--primary-color);
  color: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: opacity 0.3s ease;
}

.sync-status.error {
  background-color: var(--error-color);
}

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
    padding-bottom: 60px; /* Space reserved for bottom tab bar */
  }
}
</style>