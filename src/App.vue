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
      syncStatus: 'idle', // 'idle'|'preparing'|'syncing'|'success'|'error'
      lastSyncTime: null,
      storageService: new StorageService()
    };
  },
  computed: {
    syncStatusMessage() {
      const messages = {
        idle: '',
        preparing: '正在准备同步...',
        syncing: '同步中...',
        success: `同步完成 ${this.lastSyncTime ? this.formatTime(this.lastSyncTime) : ''}`,
        error: '同步失败，请检查网络连接'
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
    this.$store.dispatch('sync/startSync');

    // 监听路由变化
    this.$watch(
      () => this.$route.query,
      (newQuery) => {
        // 如果路由中没有tag参数，则清空选中的tags
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
    handleTagSearch(tagId) {
      const currentTags = this.$store.state.bookmarks.selectedTags;
      // 如果点击的是已选中的tag，则取消选中
      if (currentTags.includes(tagId)) {
        this.$store.commit('bookmarks/setSelectedTags', []);
        this.$router.replace({
          query: {
            ...this.$route.query,
            tag: undefined
          }
        });
      } else {
        // 否则选中该tag
        this.$store.commit('bookmarks/setSelectedTags', [tagId]);
        if (this.$route.query.tag !== tagId) {
          this.$router.replace({
            query: {
              ...this.$route.query,
              tag: tagId
            }
          });
        }
      }
    },
    setSearchQuery(query) {
      this.searchQuery = query;
    },
    formatTime(date) {
      if (!date) return '';
      
      const now = new Date();
      const diff = now - date; // 时间差（毫秒）
      
      // 如果时间差小于1分钟
      if (diff < 60000) {
        return '刚刚';
      }
      
      // 如果时间差小于1小时
      if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分钟前`;
      }
      
      // 如果是今天
      if (date.toDateString() === now.toDateString()) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // 如果是昨天
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // 其他情况显示完整日期
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
    padding-bottom: 60px; /* 为底部tab栏预留空间 */
  }
}
</style>