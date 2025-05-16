<template>
  <div class="settings">
    <h1 class="settings-title">Settings</h1>
    
    <div class="card settings-section">
      <h2 class="section-title">Appearance</h2>
      
      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">Dark Mode</h3>
          <p class="setting-description">Toggle between light and dark theme</p>
        </div>
        <div class="setting-control">
          <button class="theme-toggle" @click="toggleDarkMode">
            <span v-if="isDarkMode">☀️ Light</span>
            <span v-else>🌙 Dark</span>
          </button>
        </div>
      </div>
    </div>

    <div class="card settings-section">
      <h2 class="section-title">Sync Settings</h2>
      
      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">PouchDB Remote Sync</h3>
          <p class="setting-description">Configure remote CouchDB/PouchDB server for syncing</p>
        </div>
        <div class="setting-control">
          <button 
            class="btn btn-outline" 
            @click="showPouchDBModal = true"
          >
            Configure
          </button>
        </div>
      </div>

      <div class="setting-item" id="remoteStorageElementId">
        <div class="setting-info">
          <h3 class="setting-name">RemoteStorage</h3>
          <p class="setting-description">Connect to your RemoteStorage provider</p>
        </div>
        <div class="setting-control">
          <button 
            class="btn btn-outline" 
            @click="showRemoteStorageWidget"
          >
            Configure
          </button>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">Sync Status</h3>
          <p class="setting-description">Current sync status and last sync time</p>
        </div>
        <div class="setting-control">
          <div class="sync-status">
            <span :class="['status-dot', syncStatus]"></span>
            {{ syncStatusText }}
          </div>
        </div>
      </div>
    </div>
    
    <div class="card settings-section">
      <h2 class="section-title">Data Management</h2>
      
      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">Export Bookmarks</h3>
          <p class="setting-description">Export all bookmarks as JSON</p>
        </div>
        <div class="setting-control">
          <button class="btn btn-outline" @click="exportBookmarks">
            Export
          </button>
        </div>
      </div>
      
      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">Import Bookmarks</h3>
          <p class="setting-description">Import bookmarks from JSON file</p>
        </div>
        <div class="setting-control">
          <label class="btn btn-outline import-label">
            Import
            <input 
              type="file" 
              accept=".json" 
              @change="importBookmarks" 
              class="file-input"
            />
          </label>
        </div>
      </div>
      
      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">Validate All Bookmarks</h3>
          <p class="setting-description">Check all bookmarks for validity</p>
        </div>
        <div class="setting-control">
          <button 
            class="btn btn-outline" 
            @click="validateBookmarks"
            :disabled="loading"
          >
            {{ loading ? 'Checking...' : 'Check Now' }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="card settings-section danger-zone">
      <h2 class="section-title">Danger Zone</h2>
      
      <div class="setting-item">
        <div class="setting-info">
          <h3 class="setting-name">Reset Application</h3>
          <p class="setting-description">Delete all bookmarks and tags</p>
        </div>
        <div class="setting-control">
          <button 
            class="btn btn-danger"
            @click="confirmReset"
          >
            Reset
          </button>
        </div>
      </div>
    </div>

    <!-- PouchDB Configuration Modal -->
    <div class="modal" v-if="showPouchDBModal">
      <div class="modal-backdrop" @click="showPouchDBModal = false"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>PouchDB Remote Sync Configuration</h2>
        </div>
        <div class="modal-body">
          <form @submit.prevent="savePouchDBConfig">
            <div class="form-group">
              <label for="remoteUrl">Remote URL</label>
              <input 
                type="url" 
                id="remoteUrl"
                v-model="pouchDBConfig.remoteUrl"
                placeholder="https://example.com/db"
                required
              />
            </div>
            
            <div class="form-group">
              <label for="username">Username</label>
              <input 
                type="text" 
                id="username"
                v-model="pouchDBConfig.username"
                placeholder="Username"
              />
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input 
                type="password" 
                id="password"
                v-model="pouchDBConfig.password"
                placeholder="Password"
              />
            </div>

            <div class="form-group">
              <label>
                <input 
                  type="checkbox"
                  v-model="pouchDBConfig.enableSync"
                /> Enable automatic sync
              </label>
            </div>

            <div class="form-group" v-if="pouchDBConfig.enableSync">
              <label for="syncInterval">Sync Interval (minutes)</label>
              <input 
                type="number" 
                id="syncInterval"
                v-model="pouchDBConfig.syncInterval"
                min="1"
                max="60"
              />
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-outline" @click="showPouchDBModal = false">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    
    <!-- Reset Confirmation Modal -->
    <div class="modal" v-if="showResetModal">
      <div class="modal-backdrop" @click="showResetModal = false"></div>
      <div class="modal-content">
        <div class="delete-confirmation">
          <h2>Reset Application</h2>
          <p>Are you sure you want to reset the application? This will delete all bookmarks and tags. This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="showResetModal = false">Cancel</button>
            <button class="btn btn-danger" @click="resetApplication">Reset Application</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import RemoteStorage from 'remotestoragejs';
import Widget from 'remotestorage-widget';
import { mapGetters } from 'vuex';
import { configurePouchDBSync, getSyncStatus } from '../services/storage';

export default {
  name: 'Settings',
  data() {
    return {
      isDarkMode: false,
      loading: false,
      showResetModal: false,
      showPouchDBModal: false,
      pouchDBConfig: {
        remoteUrl: '',
        username: '',
        password: '',
        enableSync: true,
        syncInterval: 5
      },
      syncStatus: 'disconnected', // disconnected, syncing, connected, error
      lastSyncTime: null
    }
  },
  computed: {
    ...mapGetters({
      allBookmarks: 'bookmarks/allBookmarks',
      allTags: 'tags/allTags'
    }),
    syncStatusText() {
      const statusMap = {
        disconnected: 'Not connected',
        syncing: 'Syncing...',
        connected: this.lastSyncTime ? `Last synced: ${this.formatTime(this.lastSyncTime)}` : 'Connected',
        error: 'Sync error'
      }
      return statusMap[this.syncStatus]
    }
  },
  created() {
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode) {
      this.isDarkMode = JSON.parse(savedMode)
    }

    // Load PouchDB config
    const savedConfig = localStorage.getItem('pouchDBConfig')
    if (savedConfig) {
      this.pouchDBConfig = JSON.parse(savedConfig)
    }

    // Start monitoring sync status
    this.monitorSyncStatus()
  },
  mounted() {
    // 初始化 RemoteStorage
    const remoteStorage = new RemoteStorage();
    // 声明访问权限
    remoteStorage.access.claim('bookmarks', 'rw');
    remoteStorage.access.claim('tags', 'rw');
    // 初始化 RemoteStorage Widget
    const widget = new Widget(remoteStorage);
    // 挂载 Widget
    //console.log(this.$refs.remoteStorageElement)
    widget.attach('remoteStorageElementId');
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode
      localStorage.setItem('darkMode', JSON.stringify(this.isDarkMode))
      this.$root.$children[0].isDarkMode = this.isDarkMode
    },
    
    async validateBookmarks() {
      this.loading = true
      await this.$store.dispatch('bookmarks/checkAllBookmarksValidity')
      this.loading = false
      this.$router.push('/bookmarks')
    },
    
    exportBookmarks() {
      const data = {
        bookmarks: this.allBookmarks,
        tags: this.allTags
      }
      
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `bookmarks_export_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    
    importBookmarks(event) {
      const file = event.target.files[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result)
          
          if (data.tags && Array.isArray(data.tags)) {
            for (const tag of data.tags) {
              if (!this.allTags.some(t => t.id === tag.id)) {
                this.$store.commit('tags/addTag', tag)
              }
            }
          }
          
          if (data.bookmarks && Array.isArray(data.bookmarks)) {
            this.$store.dispatch('bookmarks/importBookmarks', data.bookmarks)
          }
          
          event.target.value = null
          alert('Import successful!')
        } catch (error) {
          console.error('Import error:', error)
          alert('Failed to import bookmarks. Please check the file format.')
        }
      }
      reader.readAsText(file)
    },
    
    confirmReset() {
      this.showResetModal = true
    },
    
    resetApplication() {
      localStorage.removeItem('bookmarks')
      localStorage.removeItem('tags')
      window.location.reload()
    },

    async savePouchDBConfig() {
      try {
        await configurePouchDBSync(this.pouchDBConfig)
        localStorage.setItem('pouchDBConfig', JSON.stringify(this.pouchDBConfig))
        this.showPouchDBModal = false
        this.updateSyncStatus()
      } catch (error) {
        console.error('Failed to configure PouchDB sync:', error)
        alert('Failed to configure sync. Please check your settings and try again.')
      }
    },

    showRemoteStorageWidget() {
      remoteStorage.connect()
    },

    monitorSyncStatus() {
      // Update status initially
      this.updateSyncStatus()

      // Set up periodic status checks
      setInterval(() => {
        this.updateSyncStatus()
      }, 30000) // Check every 30 seconds
    },

    async updateSyncStatus() {
      const status = await getSyncStatus()
      this.syncStatus = status.status
      this.lastSyncTime = status.lastSync
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleString()
    }
  }
}
</script>

<style scoped>
.settings-title {
  margin-bottom: var(--space-4);
  font-size: 1.8rem;
  font-weight: 600;
}

.settings-section {
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-color);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
}

.setting-name {
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 var(--space-1) 0;
}

.setting-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.setting-control {
  margin-left: var(--space-3);
}

.theme-toggle {
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: var(--space-2) var(--space-3);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.theme-toggle:hover {
  background-color: var(--primary-dark);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.disconnected {
  background-color: var(--text-tertiary);
}

.status-dot.syncing {
  background-color: var(--warning-color);
  animation: pulse 1s infinite;
}

.status-dot.connected {
  background-color: var(--success-color);
}

.status-dot.error {
  background-color: var(--error-color);
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

.import-label {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.file-input {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  width: 0;
  height: 0;
}

.btn-danger {
  background-color: var(--error-color);
  color: white;
  border: none;
  border-radius: 8px;
  padding: var(--space-2) var(--space-3);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.danger-zone {
  border-left: 4px solid var(--error-color);
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 500px;
  z-index: 101;
  background-color: var(--card-color);
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.modal-body {
  padding: var(--space-4);
}

.form-group {
  margin-bottom: var(--space-3);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="url"],
.form-group input[type="password"],
.form-group input[type="number"] {
  width: 100%;
  padding: var(--space-2);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

@media (max-width: 768px) {
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .setting-control {
    margin-left: 0;
    margin-top: var(--space-2);
    width: 100%;
  }
  
  .setting-control button {
    width: 100%;
  }
  
  .modal-content {
    width: 95%;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .modal-actions button {
    width: 100%;
  }
}
</style>