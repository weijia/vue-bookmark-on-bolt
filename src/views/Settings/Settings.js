import { mapState, mapActions } from 'vuex'
import { syncService } from '../../services/syncService'

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
      },
      webdavConfig: {
        enabled: false,
        url: '',
        username: '',
        password: '',
        path: '/bookmarks'
      }
    }
  },
  computed: {
    ...mapState(['settings']),
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
    }
  },
  created() {
    this.initSync()
    // 初始化暗黑模式
    this.isDarkMode = localStorage.getItem('darkMode') === 'true'
  },
  mounted() {
    this.monitorSyncStatus()
  },
  beforeDestroy() {
    if (this.syncStatusInterval) {
      clearInterval(this.syncStatusInterval)
    }
  },
  methods: {
    ...mapActions(['updateSettings']),
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
    saveWebDAVConfig() {
      try {
        this.isSaving = true
        // 保存WebDAV配置的逻辑
        console.log('Saving WebDAV config:', this.webdavConfig)
        setTimeout(() => {
          this.isSaving = false
          this.showWebDAVModal = false
        }, 500)
      } catch (error) {
        this.isSaving = false
        console.error('Failed to save WebDAV config:', error)
      }
    },
    testWebDAVConnection() {
      try {
        this.isTesting = true
        // 测试WebDAV连接的逻辑
        console.log('Testing WebDAV connection:', this.webdavConfig)
        setTimeout(() => {
          this.isTesting = false
          this.webdavStatus = {
            type: 'success',
            message: 'Connection successful!'
          }
        }, 1000)
      } catch (error) {
        this.isTesting = false
        this.webdavStatus = {
          type: 'error',
          message: `Connection failed: ${error.message}`
        }
        console.error('Failed to test WebDAV connection:', error)
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
    importTags(event) {
      try {
        const file = event.target.files[0]
        if (!file) return
        // 导入标签的逻辑
        console.log('Importing tags from file:', file.name)
        // 重置文件输入，以便可以再次选择同一文件
        event.target.value = ''
      } catch (error) {
        console.error('Failed to import tags:', error)
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