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
import { syncDataToWebDAV, setupWebDAVSync } from './services/storage';

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
      lastSyncTime: null
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
    this.syncWithWebDAV();

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
    },
    
    async syncWithWebDAV() {
      try {
        this.syncStatus = 'preparing';
        
        const webdavConfig = JSON.parse(localStorage.getItem('webdavConfig'));
        if (!webdavConfig) {
          console.log('WebDAV configuration not found');
          this.syncStatus = 'error';
          return;
        }
        
        console.log('Setting up WebDAV sync...');
        await setupWebDAVSync(webdavConfig);

        this.syncStatus = 'syncing';
        console.log('Syncing data to WebDAV...');
        
        // 获取本地数据
        const localBookmarks = this.$store.state.bookmarks.bookmarks;
        const localTags = this.$store.state.tags.tags;
        
        // 从WebDAV加载远程数据
        const remoteData = await this.$store.dispatch('bookmarks/loadFromWebDAV');
        const remoteBookmarks = remoteData?.bookmarks || [];
        const remoteTags = remoteData?.tags || [];
        
        // 合并数据
        const mergedBookmarks = this.mergeData(localBookmarks, remoteBookmarks);
        const mergedTags = this.mergeData(localTags, remoteTags);
        
        // 保存合并后的数据到本地
        this.$store.commit('bookmarks/setBookmarks', mergedBookmarks);
        this.$store.commit('tags/setTags', mergedTags);
        
        // 同步到chrome.storage.local
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          try {
            await chrome.storage.local.set({ bookmarks: mergedBookmarks });
            console.log('Synced merged bookmarks to chrome.storage.local', {
              count: mergedBookmarks.length,
              firstItem: mergedBookmarks[0] ? mergedBookmarks[0].id : null
            });
          } catch (error) {
            console.error('Failed to sync to chrome.storage.local:', error);
          }
        }
        
        // 保存合并后的数据到WebDAV
        await this.$store.dispatch('bookmarks/syncToWebDAV', {
          bookmarks: mergedBookmarks,
          tags: mergedTags
        });
        
        this.syncStatus = 'success';
        this.lastSyncTime = new Date();
        console.log('WebDAV sync completed successfully');
      } catch (error) {
        console.error('WebDAV同步错误:', error);
        this.syncStatus = 'error';
        // 显示错误消息
        alert(`WebDAV同步失败: ${error.message}`);
      }
    },
    
    mergeData(localData, remoteData) {
      if (!Array.isArray(localData) || !Array.isArray(remoteData)) {
        throw new Error('Invalid data format: expected arrays');
      }
      
      // 使用Map来合并数据，以id为键
      const mergedMap = new Map();
      
      // 先添加远程数据
      remoteData.forEach(item => {
        if (item && item.id) {
          mergedMap.set(item.id, { ...item });
        }
      });
      
      // 然后添加或更新本地数据
      localData.forEach(item => {
        if (item && item.id) {
          const existingItem = mergedMap.get(item.id);
          // 如果本地数据有更新日期且比远程数据新，则使用本地数据
          if (!existingItem || 
              (item.updatedAt && existingItem.updatedAt && 
               new Date(item.updatedAt) > new Date(existingItem.updatedAt))) {
            mergedMap.set(item.id, { ...item });
          }
        }
      });
      
      // 转换回数组
      return Array.from(mergedMap.values());
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