// 同步后端类型枚举
export const SyncBackend = {
  REMOTE_STORAGE: 'remoteStorage',
  WEBDAV: 'webdav',
  IMPORT: 'import'
};

// 同步状态枚举
export const SyncStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  ERROR: 'error'
};

// 获取同步函数
export function getSyncFunction(backend) {
  switch (backend) {
    case SyncBackend.REMOTE_STORAGE:
      return {
        init: initRemoteStorage,
        connect: connectRemoteStorage,
        sync: syncWithRemoteStorage,
        attachWidget: attachRemoteStorageWidget
      };
    case SyncBackend.WEBDAV:
      return {
        init: initWebDAV,
        connect: connectWebDAV,
        sync: syncWithWebDAV
      };
    case SyncBackend.IMPORT:
      return {
        import: importFromFile,
        export: exportToFile
      };
    default:
      throw new Error(`Unknown sync backend: ${backend}`);
  }
}

// RemoteStorage相关函数
function initRemoteStorage(vm) {
  if (!vm.remoteStorage) {
    console.warn('RemoteStorage instance not found');
    return null;
  }

  try {
    // 设置事件监听器，确保回调中的this正确
    vm.remoteStorage.on('ready', () => vm.onSyncReady(SyncBackend.REMOTE_STORAGE));
    vm.remoteStorage.on('connected', () => vm.onSyncConnected(SyncBackend.REMOTE_STORAGE));
    vm.remoteStorage.on('disconnected', () => vm.onSyncDisconnected(SyncBackend.REMOTE_STORAGE));
    vm.remoteStorage.on('error', (error) => vm.onSyncError(SyncBackend.REMOTE_STORAGE, error));

    return vm.remoteStorage;
  } catch (error) {
    console.warn('Failed to initialize RemoteStorage:', error);
    return null;
  }
}

function connectRemoteStorage(vm) {
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

async function attachRemoteStorageWidget(vm, elementId) {
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

// 添加防抖装饰器
function debounce(func, wait) {
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

async function syncWithRemoteStorage(state) {
  // 检查连接状态
  if (!state.remoteStorage?.remote?.connected) {
    console.warn('RemoteStorage not connected');
    return {
      bookmarks: {},
      tags: {},
      timestamp: new Date().toISOString()
    };
  }

  try {
    // 同步书签
    const bookmarksClient = state.remoteStorage.scope('/bookmarks/');
    const remoteBookmarks = await bookmarksClient.getAll();

    // 同步标签
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

// 使用防抖包装同步函数
export const debouncedSyncWithRemoteStorage = debounce(syncWithRemoteStorage, 1000);

// WebDAV相关函数
function initWebDAV(vm) {
  if (!vm.webdav) {
    vm.webdav = {
      client: null,
      config: null,
      isConnected: false
    };
  }
  return vm.webdav;
}

async function connectWebDAV(vm, config) {
  try {
    // 这里应该是实际的WebDAV连接逻辑
    vm.webdav.client = {
      // WebDAV客户端实例
    };
    vm.webdav.config = config;
    vm.webdav.isConnected = true;
    return vm.webdav;
  } catch (error) {
    vm.webdav.isConnected = false;
    throw error;
  }
}

async function syncWithWebDAV(vm) {
  if (!vm.webdav?.isConnected) {
    throw new Error('WebDAV not connected');
  }

  // 同步书签
  await vm.$store.dispatch('bookmarks/syncWithWebDAV', vm.webdav.client);
  // 同步标签
  await vm.$store.dispatch('tags/syncWithWebDAV', vm.webdav.client);
}

// 导入导出相关函数
async function importFromFile(vm, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const rawData = JSON.parse(event.target.result);
        let tagsCount = 0;
        let bookmarksCount = 0;
        let warnings = [];

        if (Array.isArray(rawData)) {
          // 简单格式 - 直接是书签数组
          const result = await vm.$store.dispatch('bookmarks/importBookmarks', rawData);
          bookmarksCount = result.importedCount;
          warnings = result.errors || [];
        } else {
          // 标准格式 - 包含bookmarks和tags
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

async function exportToFile(vm) {
  const data = {
    bookmarks: vm.$store.getters['bookmarks/all'],
    tags: vm.$store.getters['tags/all']
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

// 导出同步服务
export const syncService = {
  getStatus: async () => {
    // 获取同步状态的实现
    return {
      lastSync: localStorage.getItem('lastSync') || null,
      nextSync: null, // 可以根据需要计算下次同步时间
      status: localStorage.getItem('syncStatus') || SyncStatus.DISCONNECTED
    };
  },
  syncNow: async () => {
    try {
      localStorage.setItem('syncStatus', SyncStatus.SYNCING);
      // 执行实际的同步操作
      await debouncedSyncWithRemoteStorage();
      localStorage.setItem('lastSync', new Date().toISOString());
      localStorage.setItem('syncStatus', SyncStatus.CONNECTED);
    } catch (error) {
      console.warn('Sync failed:', error);
      localStorage.setItem('syncStatus', SyncStatus.ERROR);
      // 不抛出异常，而是返回空结果
      return {
        bookmarks: {},
        tags: {},
        timestamp: new Date().toISOString()
      };
    }
  }
};