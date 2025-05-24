import { mapState, mapActions } from 'vuex'
import { syncService } from '../../services/syncService'
import { escapeId } from '../../utils/idEscape'

export default {
  name: 'Settings',
  data() {
    return {
      syncStatusInterval: null,
      syncStatus: {
        lastSync: null,
        nextSync: null,
        status: 'unknown'
      },
      // 添加缺失的数据属性
      isDarkMode: false,
      showPouchDBModal: false,
      showWebDAVModal: false,
      showResetModal: false,
      loading: false,
      isTesting: false,
      isSaving: false,
      webdavStatus: null,
      pouchDBConfig: {
        remoteUrl: '',
        username: '',
        password: '',
        enableSync: false,
        syncInterval: 15
      }
    }
  },
  computed: {
    ...mapState({
      settings: state => state.settings,
      webdavConfig: state => state.sync.webdavConfig,
      isSyncing: state => state.sync.isSyncing,
      lastWebDAVSync: state => state.sync.syncTimes.webdav
    }),
    // 添加缺失的计算属性
    syncStatusText() {
      switch (this.syncStatus.status) {
        case 'connected':
          return 'Connected';
        case 'disconnected':
          return 'Disconnected';
        case 'syncing':
          return 'Syncing...';
        case 'error':
          return 'Error';
        default:
          return 'Unknown';
      }
    },
    formatLastWebDAVSync() {
      if (!this.lastWebDAVSync) return '';
      const date = new Date(this.lastWebDAVSync);
      return date.toLocaleString();
    }
  },
  created() {
    // this.initSync()
    // 初始化暗黑模式
    this.isDarkMode = localStorage.getItem('darkMode') === 'true'
    // 初始化WebDAV自动同步
    // this.setupWebDAVAutoSync()
  },
  mounted() {
    // this.monitorSyncStatus()
  },
  beforeDestroy() {
    if (this.syncStatusInterval) {
      clearInterval(this.syncStatusInterval)
    }
  },
  methods: {
    ...mapActions([
      'updateSettings',
      'manualWebDAVSync',
      // 'setupWebDAVAutoSync'
    ]),
    async initSync() {
      try {
        await this.updateSyncStatus()
      } catch (error) {
        console.error('Failed to initialize sync:', error)
      }
    },
    async updateSyncStatus() {
      try {
        const status = await syncService.getStatus()
        this.syncStatus = status
      } catch (error) {
        console.error('Failed to update sync status:', error)
      }
    },
    monitorSyncStatus() {
      // Update status initially
      this.updateSyncStatus()

      // Set up periodic status checks
      this.syncStatusInterval = setInterval(() => {
        this.updateSyncStatus()
      }, 30000) // Check every 30 seconds
    },
    async handleSyncNow() {
      try {
        await syncService.syncNow()
        await this.updateSyncStatus()
      } catch (error) {
        console.error('Failed to sync:', error)
      }
    },
    // 添加缺失的方法
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode
      localStorage.setItem('darkMode', this.isDarkMode)
      document.documentElement.classList.toggle('dark-mode', this.isDarkMode)
    },
    showRemoteStorageWidget() {
      try {
        // 这里应该是显示RemoteStorage小部件的逻辑
        console.log('RemoteStorage widget functionality not implemented')
      } catch (error) {
        console.warn('Failed to show RemoteStorage widget:', error)
      }
    },
    savePouchDBConfig() {
      try {
        // 保存PouchDB配置的逻辑
        console.log('Saving PouchDB config:', this.pouchDBConfig)
        this.showPouchDBModal = false
      } catch (error) {
        console.error('Failed to save PouchDB config:', error)
      }
    },
    async saveWebDAVConfig() {
      try {
        this.isSaving = true
        
        // 保存WebDAV配置到localStorage
        localStorage.setItem('webdavConfig', JSON.stringify(this.webdavConfig))
        console.log('WebDAV config saved successfully:', this.webdavConfig)
        
        // 如果启用了WebDAV，初始化WebDAV客户端
        if (this.webdavConfig.enabled) {
          try {
            const { initializeWebDAV } = await import('../../services/webdav')
            await initializeWebDAV(this.webdavConfig)
            console.log('WebDAV client initialized successfully')
          } catch (initError) {
            console.error('Failed to initialize WebDAV client:', initError)
            // 显示初始化错误，但不阻止保存配置
            this.webdavStatus = {
              type: 'warning',
              message: `Configuration saved, but failed to initialize client: ${initError.message}`
            }
          }
        }
        
        setTimeout(() => {
          this.isSaving = false
          this.showWebDAVModal = false
        }, 500)
      } catch (error) {
        this.isSaving = false
        console.error('Failed to save WebDAV config:', error)
        this.webdavStatus = {
          type: 'error',
          message: `Failed to save configuration: ${error.message}`
        }
      }
    },
    async manualSync() {
      try {
        await this.manualWebDAVSync();
        this.webdavStatus = {
          type: 'success',
          message: 'Sync completed successfully'
        };
      } catch (error) {
        console.error('WebDAV sync failed:', error);
        this.webdavStatus = {
          type: 'error',
          message: `Sync failed: ${error.message || 'Unknown error'}`
        };
      }
    },

    async testWebDAVConnection() {
      if (!this.webdavConfig.url || !this.webdavConfig.username || !this.webdavConfig.password) {
        this.webdavStatus = {
          type: 'error',
          message: 'Please fill in all required fields (URL, username, and password)'
        }
        return
      }

      this.isTesting = true
      this.webdavStatus = null

      try {
        const { initializeWebDAV } = await import('../../services/webdav')
        
        // 使用当前配置测试连接
        await initializeWebDAV({
          url: this.webdavConfig.url,
          username: this.webdavConfig.username,
          password: this.webdavConfig.password,
          path: this.webdavConfig.path || '/tidemark'
        })

        this.webdavStatus = {
          type: 'success',
          message: 'Connection successful! WebDAV server is accessible.'
        }
      } catch (error) {
        console.error('WebDAV connection test failed:', error)
        this.webdavStatus = {
          type: 'error',
          message: `Connection failed: ${error.message || 'Unable to connect to WebDAV server'}`
        }
      } finally {
        this.isTesting = false
      }
    },
    exportBookmarks() {
      try {
        // 导出书签的逻辑
        console.log('Exporting bookmarks')
      } catch (error) {
        console.error('Failed to export bookmarks:', error)
      }
    },
    importBookmarks(event) {
      try {
        const file = event.target.files[0]
        if (!file) return
        // 导入书签的逻辑
        console.log('Importing bookmarks from file:', file.name)
        // 重置文件输入，以便可以再次选择同一文件
        event.target.value = ''
      } catch (error) {
        console.error('Failed to import bookmarks:', error)
      }
    },
    async importTags(event) {
      try {
        const file = event.target.files[0]
        if (!file) return
      

        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.onerror = e => reject(e)
          reader.readAsText(file)
        })
      
        const data = JSON.parse(content)
      
        // 检查是否为数组
        if (!Array.isArray(data)) {
          throw new Error('Invalid format: Expected an array of tags')
        }
        

        this.$store.dispatch('tags/importTags', data);

        // 重置文件输入
        event.target.value = ''
      } catch (error) {
        console.error('Failed to import tags:', error)
        this.$notify({
          title: 'Import Failed',
          message: error.message || 'Failed to import tags',
          type: 'error'
        })
      }
    },
    validateBookmarks() {
      try {
        this.loading = true
        // 验证书签的逻辑
        console.log('Validating bookmarks')
        setTimeout(() => {
          this.loading = false
        }, 1000)
      } catch (error) {
        this.loading = false
        console.error('Failed to validate bookmarks:', error)
      }
    },
    confirmReset() {
      this.showResetModal = true
    },
    resetApplication() {
      try {
        // 重置应用的逻辑
        console.log('Resetting application')
        this.showResetModal = false
      } catch (error) {
        console.error('Failed to reset application:', error)
      }
    }
  }
}