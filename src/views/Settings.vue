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
          <h3 class="setting-name">WebDAV Sync</h3>
          <p class="setting-description">Configure WebDAV server for syncing bookmarks and tags</p>
        </div>
        <div class="setting-control">
          <button 
            class="btn btn-outline" 
            @click="showWebDAVModal = true"
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
          <h3 class="setting-name">Import Tags</h3>
          <p class="setting-description">Import tags from JSON file</p>
        </div>
        <div class="setting-control">
          <label class="btn btn-outline import-label">
            Import
            <input 
              type="file" 
              accept=".json" 
              @change="importTags" 
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
    
    <!-- WebDAV Configuration Modal -->
    <div class="modal" v-if="showWebDAVModal">
      <div class="modal-backdrop" @click="showWebDAVModal = false"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>WebDAV Sync Configuration</h2>
        </div>
        <div class="modal-body">
          <form @submit.prevent="saveWebDAVConfig">
            <div class="form-group">
              <label>
                <input 
                  type="checkbox"
                  v-model="webdavConfig.enabled"
                /> Enable WebDAV sync
              </label>
            </div>

            <div v-if="webdavConfig.enabled">
              <div class="form-group">
                <label for="webdavUrl">WebDAV Server URL</label>
                <input 
                  type="url" 
                  id="webdavUrl"
                  v-model="webdavConfig.url"
                  placeholder="https://example.com/webdav/"
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="webdavUsername">Username</label>
                <input 
                  type="text" 
                  id="webdavUsername"
                  v-model="webdavConfig.username"
                  placeholder="Username"
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="webdavPassword">Password</label>
                <input 
                  type="password" 
                  id="webdavPassword"
                  v-model="webdavConfig.password"
                  placeholder="Password"
                  required
                />
              </div>

              <div class="form-group">
                <label for="webdavPath">Save Path</label>
                <input 
                  type="text" 
                  id="webdavPath"
                  v-model="webdavConfig.path"
                  placeholder="/bookmarks"
                  required
                />
                <small class="help-text">Directory path where files will be saved (e.g., /bookmarks)</small>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-outline" @click="showWebDAVModal = false">
                Cancel
              </button>
              <button type="button" class="btn btn-secondary" @click="testWebDAVConnection" :disabled="isTesting">
                {{ isTesting ? 'Testing...' : 'Test Connection' }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving">
                {{ isSaving ? 'Saving...' : 'Save Configuration' }}
              </button>
            </div>

            <div v-if="webdavStatus" :class="['status-message', webdavStatus.type]">
              {{ webdavStatus.message }}
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
import { configurePouchDBSync, getSyncStatus, syncTags, syncBookmarks, setupWebDAVSync, syncDataToWebDAV } from '../services/storage';
import { escapeId } from '../utils/idEscape';

export default {
  name: 'Settings',
  data() {
    return {
      isDarkMode: false,
      loading: false,
      showResetModal: false,
      showPouchDBModal: false,
      showWebDAVModal: false,
      remoteStorage: null,
      syncStatus: 'disconnected', // 'disconnected', 'connecting', 'connected', 'syncing', 'error'
      lastSyncTime: null,
      pouchDBConfig: {
        remoteUrl: '',
        username: '',
        password: '',
        enableSync: true,
        syncInterval: 5
      },
      webdavConfig: {
        enabled: false,
        url: '',
        username: '',
        password: '',
        path: '/bookmarks'
      },
      webdavStatus: null,
      isTesting: false,
      isSaving: false,
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

    // Load WebDAV config
    const webdavConfig = localStorage.getItem('webdavConfig')
    if (webdavConfig) {
      try {
        this.webdavConfig = JSON.parse(webdavConfig)
      } catch (error) {
        console.error('Failed to parse WebDAV config:', error)
      }
    }

    // Start monitoring sync status
    this.monitorSyncStatus()
  },
  mounted() {
    // 初始化 RemoteStorage
    this.remoteStorage = new RemoteStorage({
      logging: false,
      cache: true
    });
    
    // 声明访问权限
    this.remoteStorage.access.claim('bookmarks', 'rw');
    this.remoteStorage.access.claim('tags', 'rw');

    // 设置事件监听器
    this.remoteStorage.on('ready', () => {
      console.log('RemoteStorage ready');
      this.syncStatus = 'connected';
      this.syncWithRemoteStorage();
    });

    this.remoteStorage.on('connected', () => {
      console.log('RemoteStorage connected');
      this.syncStatus = 'connected';
      this.syncWithRemoteStorage();
    });

    this.remoteStorage.on('disconnected', () => {
      console.log('RemoteStorage disconnected');
      this.syncStatus = 'disconnected';
    });

    this.remoteStorage.on('error', (err) => {
      console.error('RemoteStorage error:', err);
      this.syncStatus = 'error';
    });

    // 获取 URL 中的 access_token
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');

    if (accessToken) {
      // 让 remotestorage 处理 access_token
      this.remoteStorage.remote.connect(accessToken);
      // 移除 URL 中的 access_token，避免泄露
      const newUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, document.title, newUrl);
    }

    // 初始化 RemoteStorage Widget
    const widget = new Widget(this.remoteStorage);
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
    
    async importBookmarks(event) {
      const file = event.target.files[0]
      if (!file) return
    
      try {
        // 使用Promise处理文件读取
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.onerror = e => reject(e)
          reader.readAsText(file)
        })
      
        // 解析导入的数据
        const rawData = JSON.parse(content)
        let tagsImported = 0
        let bookmarksImported = 0
        let result = { errors: [] }
      
        // 检查数据格式
        // 1. 标准格式: { bookmarks: [...], tags: [...] }
        // 2. 潮汐收藏格式: [ { name, url, ... }, ... ]
      
        if (Array.isArray(rawData)) {
          // 潮汐收藏格式 - 直接是书签数组
          result = await this.$store.dispatch('bookmarks/importBookmarks', rawData)
          bookmarksImported = result.importedCount
        
          if (result.errors && result.errors.length > 0) {
            console.warn('Bookmark import warnings:', result.errors)
          }
        } else {
          // 标准格式 - 包含bookmarks和tags的对象
          // 导入标签
          if (rawData.tags && Array.isArray(rawData.tags)) {
            for (const tag of rawData.tags) {
              if (!this.allTags.some(t => t.id === tag.id)) {
                await this.$store.dispatch('tags/addTag', tag)
                tagsImported++
              }
            }
          }
        
          // 导入书签
          if (rawData.bookmarks && Array.isArray(rawData.bookmarks)) {
            result = await this.$store.dispatch('bookmarks/importBookmarks', rawData.bookmarks)
            bookmarksImported = result.importedCount
          
            if (result.errors && result.errors.length > 0) {
              console.warn('Bookmark import warnings:', result.errors)
            }
          }
        }
      
        // 同步到远程存储
        try {
          let syncMessages = [];
        
          if (tagsImported > 0) {
            await syncTags();
            syncMessages.push(`${tagsImported} tags`);
          }
          if (bookmarksImported > 0) {
            await syncBookmarks();
            syncMessages.push(`${bookmarksImported} bookmarks`);
          }
        
          event.target.value = null;
        
          if (syncMessages.length > 0) {
            if (result.errors && result.errors.length > 0) {
              alert(
                `Import completed with warnings!\n\n` +
                `Successfully imported and synced:\n${syncMessages.join('\n')}\n\n` +
                `There were ${result.errors.length} warnings during import.\n` +
                `Check the console for details.`
              );
            } else {
              alert(
                `Import successful!\n\n` +
                `Successfully imported and synced:\n${syncMessages.join('\n')}`
              );
            }
          } else {
            alert('No new items were imported.');
          }
        } catch (syncError) {
          console.error('Sync error:', syncError);
          event.target.value = null;
        
          let message = 'Import completed but sync failed!\n\n';
          if (tagsImported > 0 || bookmarksImported > 0) {
            message += `Successfully imported:\n`;
            if (tagsImported > 0) message += `${tagsImported} tags\n`;
            if (bookmarksImported > 0) message += `${bookmarksImported} bookmarks\n`;
            message += `\nWarning: Failed to sync with remote storage.`;
          
            if (result.errors && result.errors.length > 0) {
              message += `\n\nThere were also ${result.errors.length} warnings during import.\n`;
              message += `Check the console for details.`;
            }
          }
        
          alert(message);
        }
      } catch (error) {
        console.error('Import error:', error)
        event.target.value = null
        alert('Failed to import bookmarks. Please check the file format.')
      }
    },
    
    async importTags(event) {
      const file = event.target.files[0]
      if (!file) return
    
      try {
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
      
        let importedCount = 0
        const errors = []
      
        // 处理每个标签
        await Promise.all(data.map(async tag => {
          try {
            // 验证标签格式
            if (!tag.id || !tag.name) {
              throw new Error(`Invalid tag format: missing id or name`)
            }
          
            // 检查标签是否已存在
            const escapedId = escapeId(tag.id);
            if (!this.allTags.some(t => t.id === escapedId)) {
              await this.$store.dispatch('tags/addTag', {
                id: escapedId,
                name: tag.name,
                color: tag.color || '#3b82f6',
                createdAt: tag.createdAt // 保留原始创建时间
              })
              importedCount++
            }
          } catch (err) {
            errors.push(`Failed to import tag "${tag.name || 'unknown'}": ${err.message}`)
          }
      }))
    
      event.target.value = null
    
      // 导入完成后立即触发同步
      if (importedCount > 0) {
        try {
          await syncTags()
          
          if (errors.length > 0) {
            console.warn('Import warnings:', errors)
            alert(`Imported ${importedCount} tags with ${errors.length} errors.\nCheck console for details.\nTags have been synced to remote storage.`)
          } else {
            alert(`Successfully imported ${importedCount} tags!\nTags have been synced to remote storage.`)
          }
        } catch (syncError) {
          console.error('Error syncing tags:', syncError)
          if (errors.length > 0) {
            alert(`Imported ${importedCount} tags with ${errors.length} errors.\nCheck console for details.\nWarning: Failed to sync with remote storage.`)
          } else {
            alert(`Successfully imported ${importedCount} tags!\nWarning: Failed to sync with remote storage.`)
          }
        }
      } else {
        if (errors.length > 0) {
          console.warn('Import warnings:', errors)
          alert(`No tags were imported. Found ${errors.length} errors.\nCheck console for details.`)
        } else {
          alert('No new tags were imported.')
        }
      }
      } catch (error) {
        console.error('Import tags error:', error)
        alert('Failed to import tags. Please check the file format.')
      }
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
      if (this.remoteStorage) {
        this.remoteStorage.connect();
      }
    },

    async syncWithRemoteStorage() {
      if (!this.remoteStorage || !this.remoteStorage.remote.connected) {
        return;
      }

      try {
        this.syncStatus = 'syncing';
        
        // 同步书签
        const bookmarksClient = this.remoteStorage.scope('/bookmarks');
        const remoteBookmarks = await bookmarksClient.getAll();
        await this.$store.dispatch('bookmarks/syncWithRemote', remoteBookmarks);
        
        // 同步标签
        const tagsClient = this.remoteStorage.scope('/tags');
        const remoteTags = await tagsClient.getAll();
        await this.$store.dispatch('tags/syncWithRemote', remoteTags);
        
        // 更新同步状态
        this.syncStatus = 'connected';
        this.lastSyncTime = Date.now();
      } catch (error) {
        console.error('Sync error:', error);
        this.syncStatus = 'error';
      }
    },
    
    async testWebDAVConnection() {
      this.isTesting = true;
      this.webdavStatus = null;
      
      try {
        await setupWebDAVSync({
          ...this.webdavConfig,
          test: true
        });
        
        this.webdavStatus = {
          type: 'success',
          message: 'WebDAV connection successful!'
        };
      } catch (error) {
        this.webdavStatus = {
          type: 'error',
          message: `WebDAV connection failed: ${error.message}`
        };
      } finally {
        this.isTesting = false;
      }
    },
    
    async saveWebDAVConfig() {
      this.isSaving = true;
      this.webdavStatus = null;
      
      try {
        if (this.webdavConfig.enabled) {
          await setupWebDAVSync(this.webdavConfig);
          this.webdavStatus = {
            type: 'success',
            message: 'WebDAV configuration saved and enabled!'
          };
        } else {
          // 禁用WebDAV
          localStorage.removeItem('webdavConfig');
          this.webdavStatus = {
            type: 'success',
            message: 'WebDAV sync disabled'
          };
        }
        
        // 关闭模态框
        setTimeout(() => {
          this.showWebDAVModal = false;
        }, 1500);
      } catch (error) {
        this.webdavStatus = {
          type: 'error',
          message: `Failed to save WebDAV configuration: ${error.message}`
        };
      } finally {
        this.isSaving = false;
      }
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
    max-height: calc(100vh - 120px); /* 考虑顶部和底部空间 */
    overflow-y: auto;
    padding-bottom: 60px; /* 为底部tab栏预留空间 */
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .modal-actions button {
    width: 100%;
  }
}
</style>