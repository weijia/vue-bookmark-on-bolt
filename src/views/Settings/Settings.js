import { SyncBackend, getSyncFunction } from '../../services/syncService';
import { mapGetters } from 'vuex';
import { configurePouchDBSync, getSyncStatus, syncTags, syncBookmarks, setupWebDAVSync, syncDataToWebDAV } from '../../services/storage';
import { escapeId } from '../../utils/idEscape';

export default {
  name: 'Settings',
  data() {
    return {
      isDarkMode: false,
      loading: false,
      showResetModal: false,
      showPouchDBModal: false,
      showWebDAVModal: false,
      webdav: null,
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
      syncBackends: {
        [SyncBackend.REMOTE_STORAGE]: 'disconnected',
        [SyncBackend.WEBDAV]: 'disconnected',
        [SyncBackend.IMPORT]: 'disconnected'
      },
      currentBackend: null,
      syncTimes: {}
    }
  },
  computed: {
    ...mapGetters({
      allBookmarks: 'bookmarks/allBookmarks',
      allTags: 'tags/allTags'
    }),
    syncStatus() {
      return this.$store.getters['sync/syncStatus']('remoteStorage')
    },
    syncStatusText() {
      const statusMap = {
        disconnected: 'Not connected',
        syncing: 'Syncing...',
        connected: this.$store.getters['sync/lastSyncTime']('remoteStorage') ? 
          `Last synced: ${this.formatTime(this.$store.getters['sync/lastSyncTime']('remoteStorage'))}` : 'Connected',
        error: 'Sync error'
      }
      return statusMap[this.$store.getters['sync/syncStatus']('remoteStorage')]
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
  async mounted() {
    // 初始化同步后端
    this.remoteStorageSync = getSyncFunction(SyncBackend.REMOTE_STORAGE);
    this.webdavSync = getSyncFunction(SyncBackend.WEBDAV);
    this.importSync = getSyncFunction(SyncBackend.IMPORT);

    // 使用全局RemoteStorage实例并附加widget
    if (this.remoteStorageSync && this.$remoteStorage) {
      try {
        this.remoteStorage = this.$remoteStorage;
        
        // 附加widget
        if (this.remoteStorageSync.attachWidget) {
          this.remoteStorageSync.attachWidget(this, 'remoteStorageElementId');
        }
      } catch (error) {
        console.error('Failed to attach RemoteStorage widget:', error);
        this.$store.commit('notification/setNotification', {
          type: 'error',
          message: 'Failed to attach RemoteStorage widget: ' + error.message
        });
      }
    }

    // 加载保存的WebDAV配置
    const savedWebDAVConfig = localStorage.getItem('webdavConfig');
    if (savedWebDAVConfig) {
      try {
        const config = JSON.parse(savedWebDAVConfig);
        if (config.enabled) {
          this.webdavConfig = config;
          this.webdavSync.init(this);
          // 尝试连接WebDAV
          this.connectWebDAV(config).catch(error => {
            console.error('Failed to reconnect to WebDAV:', error);
            this.$store.commit('notification/setNotification', {
              type: 'warning',
              message: 'WebDAV重连失败，请检查配置'
            });
          });
        }
      } catch (error) {
        console.error('Failed to load WebDAV config:', error);
        localStorage.removeItem('webdavConfig');
      }
    }
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
    
    async exportBookmarks() {
      try {
        const url = await this.importSync.export(this);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        this.$store.commit('notification/setNotification', {
          type: 'error',
          message: `导出失败: ${error.message}`
        });
      }
    },
    
    async importBookmarks(event) {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const result = await this.importSync.import(this, file);
        
        // 同步到当前活动的后端
        if (this.currentBackend) {
          try {
            await this.sync(this.currentBackend);
            this.$store.commit('notification/setNotification', {
              type: 'success',
              message: `导入成功！已导入 ${result.bookmarksCount} 个书签和 ${result.tagsCount} 个标签，并已同步到${this.currentBackend}`
            });
          } catch (syncError) {
            console.error('Sync error:', syncError);
            this.$store.commit('notification/setNotification', {
              type: 'warning',
              message: `导入成功但同步失败！已导入 ${result.bookmarksCount} 个书签和 ${result.tagsCount} 个标签，但同步到${this.currentBackend}失败`
            });
          }
        } else {
          this.$store.commit('notification/setNotification', {
            type: 'success',
            message: `导入成功！已导入 ${result.bookmarksCount} 个书签和 ${result.tagsCount} 个标签`
          });
        }

        if (result.warnings && result.warnings.length > 0) {
          console.warn('Import warnings:', result.warnings);
          this.$store.commit('notification/setNotification', {
            type: 'info',
            message: `导入过程中有 ${result.warnings.length} 个警告，请查看控制台了解详情`
          });
        }
      } catch (error) {
        console.error('Import error:', error);
        this.$store.commit('notification/setNotification', {
          type: 'error',
          message: `导入失败: ${error.message}`
        });
      } finally {
        // 清除文件选择，允许重复导入相同文件
        event.target.value = '';
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

    // 同步状态处理方法
    onSyncReady(backend) {
      this.syncBackends[backend] = 'connected';
      this.currentBackend = backend;
      this.$store.commit('notification/setNotification', {
        type: 'success',
        message: `${backend}已就绪`
      });
      
      // 使用try-catch包装同步调用
      try {
        this.sync(backend);
      } catch (error) {
        console.error(`Sync error in onSyncReady for ${backend}:`, error);
        this.onSyncError(backend, error);
      }
    },

    onSyncConnected(backend) {
      this.syncBackends[backend] = 'connected';
      this.currentBackend = backend;
      this.$store.commit('notification/setNotification', {
        type: 'success',
        message: `${backend}已连接`
      });
      
      // 使用try-catch包装同步调用
      try {
        this.sync(backend);
      } catch (error) {
        console.error(`Sync error in onSyncConnected for ${backend}:`, error);
        this.onSyncError(backend, error);
      }
    },

    onSyncDisconnected(backend) {
      this.syncBackends[backend] = 'disconnected';
      if (this.currentBackend === backend) {
        this.currentBackend = null;
      }
      this.$store.commit('notification/setNotification', {
        type: 'info',
        message: `${backend}已断开连接`
      });
    },

    onSyncError(backend, error) {
      console.error(`${backend} sync error:`, error);
      this.syncBackends[backend] = 'error';
      this.$store.commit('notification/setNotification', {
        type: 'error',
        message: `${backend}错误: ${error.message}`
      });
    },

    // RemoteStorage方法
    showRemoteStorageWidget() {
      try {
        if (!this.remoteStorageSync) {
          throw new Error('RemoteStorage sync service not available');
        }
        
        // Ensure RemoteStorage is initialized
        if (!this.remoteStorage) {
          this.remoteStorage = this.remoteStorageSync.init(this);
        }
        
        // Connect and show widget
        this.remoteStorageSync.connect(this);
        
      } catch (error) {
        console.error('Failed to show RemoteStorage widget:', error);
        this.$store.commit('notification/setNotification', {
          type: 'error',
          message: 'Failed to connect RemoteStorage: ' + error.message
        });
      }
    },

    // 统一的同步方法
    async sync(backend) {
      if (this.syncBackends[backend] !== 'connected') {
        return;
      }

      try {
        this.syncBackends[backend] = 'syncing';
        const syncFunction = getSyncFunction(backend);
        await syncFunction.sync(this);
        this.syncBackends[backend] = 'connected';
        this.syncTimes[backend] = Date.now();
        
        this.$store.commit('notification/setNotification', {
          type: 'success',
          message: `${backend}同步成功`
        });
      } catch (error) {
        console.error(`${backend} sync error:`, error);
        this.syncBackends[backend] = 'error';
        this.$store.commit('notification/setNotification', {
          type: 'error',
          message: `${backend}同步失败: ${error.message}`
        });
      }
    },

    // WebDAV方法
    async connectWebDAV(config) {
      try {
        await this.webdavSync.connect(this, config);
        this.onSyncConnected(SyncBackend.WEBDAV);
      } catch (error) {
        this.onSyncError(SyncBackend.WEBDAV, error);
      }
    },

    // 导入导出方法
    async importFromFile(file) {
      try {
        await this.importSync.import(this, file);
        this.$store.commit('notification/setNotification', {
          type: 'success',
          message: '导入成功'
        });
      } catch (error) {
        this.$store.commit('notification/setNotification', {
          type: 'error',
          message: '导入失败: ' + error.message
        });
      }
    },
    
    async testWebDAVConnection() {
      this.isTesting = true;
      this.webdavStatus = null;
      
      try {
        await this.webdavSync.connect(this, { ...this.webdavConfig, test: true });
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
          await this.connectWebDAV(this.webdavConfig);
          localStorage.setItem('webdavConfig', JSON.stringify(this.webdavConfig));
          this.webdavStatus = {
            type: 'success',
            message: 'WebDAV configuration saved and enabled!'
          };
          
          // 初始同步
          await this.sync(SyncBackend.WEBDAV);
        } else {
          // 禁用WebDAV
          localStorage.removeItem('webdavConfig');
          this.syncBackends.webdav = 'disconnected';
          this.syncTimes.webdav = null;
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
      try {
        const status = await getSyncStatus();
        this.$store.commit('sync/setSyncStatus', { 
          backend: 'remoteStorage', 
          status: status.status 
        });
        this.$store.commit('sync/setSyncTime', { 
          backend: 'remoteStorage', 
          time: status.lastSync 
        });
      } catch (error) {
        console.error('Failed to update sync status:', error);
      }
    },

    formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      return date.toLocaleString()
    }
  }
}