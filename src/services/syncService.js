/**
 * 同步服务类，负责管理不同后端的同步功能
 * 包括RemoteStorage、WebDAV和导入导出功能
 */
export class SyncService {
  // 同步后端类型枚举
  static Backend = {
    REMOTE_STORAGE: 'remoteStorage',
    WEBDAV: 'webdav',
    IMPORT: 'import'
  };

  // 同步状态枚举
  static Status = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    SYNCING: 'syncing',
    ERROR: 'error'
  };

  /**
   * 获取指定后端的同步函数
   * @param {string} backend - 同步后端类型
   * @returns {object} 包含init, connect, sync等方法的对象
   */
  getSyncFunction(backend) {
    switch (backend) {
      case SyncService.Backend.REMOTE_STORAGE:
        return {
          init: this.initRemoteStorage.bind(this),
          connect: this.connectRemoteStorage.bind(this),
          sync: this.syncWithRemoteStorage.bind(this),
          attachWidget: this.attachRemoteStorageWidget.bind(this)
        };
      case SyncService.Backend.WEBDAV:
        return {
          init: this.initWebDAV.bind(this),
          connect: this.connectWebDAV.bind(this),
          sync: this.syncWithWebDAV.bind(this)
        };
      case SyncService.Backend.IMPORT:
        return {
          import: this.importFromFile.bind(this),
          export: this.exportToFile.bind(this)
        };
      default:
        throw new Error(`Unknown sync backend: ${backend}`);
    }
  }

  /**
   * 从localStorage获取WebDAV配置
   * @returns {object|null} WebDAV配置对象，如果不存在则返回null
   */
  getWebDAVConfig() {
    try {
      const config = localStorage.getItem('webdavConfig');
      return config ? JSON.parse(config) : null;
    } catch (error) {
      console.warn('Failed to parse WebDAV config:', error);
      return null;
    }
  }

  /**
   * 初始化RemoteStorage
   * @param {object} vm - Vue实例
   * @returns {object|null} RemoteStorage实例或null
   */
  initRemoteStorage(vm) {
    if (!vm.remoteStorage) {
      console.warn('RemoteStorage instance not found');
      return null;
    }

    try {
      vm.remoteStorage.on('ready', () => vm.onSyncReady(SyncService.Backend.REMOTE_STORAGE));
      vm.remoteStorage.on('connected', () => vm.onSyncConnected(SyncService.Backend.REMOTE_STORAGE));
      vm.remoteStorage.on('disconnected', () => vm.onSyncDisconnected(SyncService.Backend.REMOTE_STORAGE));
      vm.remoteStorage.on('error', (error) => vm.onSyncError(SyncService.Backend.REMOTE_STORAGE, error));

      return vm.remoteStorage;
    } catch (error) {
      console.warn('Failed to initialize RemoteStorage:', error);
      return null;
    }
  }

  /**
   * 连接RemoteStorage
   * @param {object} vm - Vue实例
   */
  connectRemoteStorage(vm) {
    if (!vm.remoteStorage) {
      console.warn('RemoteStorage instance not found');
      return;
    }
    try {
      vm.remoteStorage.connect();
    } catch (error) {
      console.warn('Failed to connect RemoteStorage:', error);
    }
  }

  /**
   * 附加RemoteStorage小部件
   * @param {object} vm - Vue实例
   * @param {string} elementId - DOM元素ID
   * @returns {Promise<object|null>} 小部件实例或null
   */
  async attachRemoteStorageWidget(vm, elementId) {
    if (!vm.remoteStorage) {
      console.warn('RemoteStorage instance not found');
      return null;
    }

    try {
      const { default: Widget } = await import('remotestorage-widget');
      const widget = new Widget(vm.remoteStorage);
      widget.attach(elementId);
      return widget;
    } catch (error) {
      console.warn('Failed to attach RemoteStorage widget:', error);
      return null;
    }
  }

  /**
   * 防抖函数装饰器
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间(毫秒)
   * @returns {Function} 防抖后的函数
   */
  debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      return new Promise((resolve, reject) => {
        timeout = setTimeout(async () => {
          try {
            const result = await func.apply(this, args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, wait);
      });
    };
  }

  /**
   * 与RemoteStorage同步
   * @param {object} state - 应用状态
   * @returns {Promise<object>} 同步结果
   */
  async syncWithRemoteStorage(state) {
    if (!state.remoteStorage?.remote?.connected) {
      console.warn('RemoteStorage not connected');
      return {
        bookmarks: {},
        tags: {},
        timestamp: new Date().toISOString()
      };
    }

    try {
      const bookmarksClient = state.remoteStorage.scope('/bookmarks/');
      const remoteBookmarks = await bookmarksClient.getAll();

      const tagsClient = state.remoteStorage.scope('/tags/');
      const remoteTags = await tagsClient.getAll();

      return {
        bookmarks: remoteBookmarks,
        tags: remoteTags,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.warn('RemoteStorage sync error:', error);
      return {
        bookmarks: {},
        tags: {},
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 初始化WebDAV
   * @param {object} vm - Vue实例
   * @returns {object} WebDAV状态对象
   */
  initWebDAV(vm) {
    if (!vm.webdav) {
      vm.webdav = {
        client: null,
        config: null,
        isConnected: false
      };
    }
    return vm.webdav;
  }

  /**
   * 连接WebDAV
   * @param {object} vm - Vue实例
   * @param {object} config - WebDAV配置
   * @returns {Promise<object>} WebDAV状态对象
   */
  async connectWebDAV(vm, config) {
    try {
      vm.webdav.client = {}; // 实际WebDAV客户端实例
      vm.webdav.config = config;
      vm.webdav.isConnected = true;
      return vm.webdav;
    } catch (error) {
      vm.webdav.isConnected = false;
      throw error;
    }
  }

  /**
   * 从文件导入
   * @param {object} vm - Vue实例
   * @param {File} file - 要导入的文件
   * @returns {Promise<object>} 导入结果
   */
  async importFromFile(vm, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const rawData = JSON.parse(event.target.result);
          let tagsCount = 0;
          let bookmarksCount = 0;
          let warnings = [];

          if (Array.isArray(rawData)) {
            const result = await vm.$store.dispatch('bookmarks/importBookmarks', rawData);
            bookmarksCount = result.importedCount;
            warnings = result.errors || [];
          } else {
            if (rawData.tags && Array.isArray(rawData.tags)) {
              for (const tag of rawData.tags) {
                if (!vm.$store.getters['tags/all'].some(t => t.id === tag.id)) {
                  await vm.$store.dispatch('tags/addTag', tag);
                  tagsCount++;
                }
              }
            }

            if (rawData.bookmarks && Array.isArray(rawData.bookmarks)) {
              const result = await vm.$store.dispatch('bookmarks/importBookmarks', rawData.bookmarks);
              bookmarksCount = result.importedCount;
              warnings = result.errors || [];
            }
          }

          resolve({ bookmarksCount, tagsCount, warnings });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  /**
   * 导出到文件
   * @param {object} vm - Vue实例
   * @returns {Promise<string>} 对象URL
   */
  async exportToFile(vm) {
    const data = {
      bookmarks: vm.$store.getters['bookmarks/all'],
      tags: vm.$store.getters['tags/all']
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    return URL.createObjectURL(blob);
  }
}

// 导出单例实例
export const syncService = new SyncService();

// 导出防抖的同步函数
export const debouncedSyncWithRemoteStorage = syncService.debounce(
  syncService.syncWithRemoteStorage.bind(syncService),
  1000
);