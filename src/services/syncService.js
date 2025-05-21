// 同步后端类型枚举
export const SyncBackend = {
  REMOTE_STORAGE: 'remoteStorage',
  WEBDAV: 'webdav',
  IMPORT: 'import'
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
    throw new Error('RemoteStorage instance not found');
    return;
  }

  try {
    // 设置事件监听器，确保回调中的this正确
    vm.remoteStorage.on('ready', () => vm.onSyncReady(SyncBackend.REMOTE_STORAGE));
    vm.remoteStorage.on('connected', () => vm.onSyncConnected(SyncBackend.REMOTE_STORAGE));
    vm.remoteStorage.on('disconnected', () => vm.onSyncDisconnected(SyncBackend.REMOTE_STORAGE));
    vm.remoteStorage.on('error', (error) => vm.onSyncError(SyncBackend.REMOTE_STORAGE, error));

    return vm.remoteStorage;
  } catch (error) {
    console.error('Failed to initialize RemoteStorage:', error);
    throw error;
  }
}

function connectRemoteStorage(vm) {
  if (!vm.remoteStorage) {
    throw new Error('RemoteStorage instance not found');
  }
  vm.remoteStorage.connect();
}

async function attachRemoteStorageWidget(vm, elementId) {
  if (!vm.remoteStorage) {
    throw new Error('RemoteStorage instance not found');
  }
  
  try {
    const { default: Widget } = await import('remotestorage-widget');
    const widget = new Widget(vm.remoteStorage);
    widget.attach(elementId);
    return widget;
  } catch (error) {
    console.error('Failed to attach RemoteStorage widget:', error);
    throw new Error(`Failed to attach RemoteStorage widget: ${error.message}`);
  }
}

async function syncWithRemoteStorage(state) {
  if (!state.remoteStorage?.remote.connected) {
    console.warn('RemoteStorage not connected');
    // throw new Error('RemoteStorage not connected');
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
      tags: remoteTags
    };
  } catch (error) {
    console.error('RemoteStorage sync error:', error);
    throw new Error(`RemoteStorage sync failed: ${error.message}`);
  }
}

// 确保远程文件夹存在
async function ensureRemoteFolder(remoteStorage, folderName) {
  try {
    const client = remoteStorage.scope(`/${folderName}/`);
    // 使用storeFile代替storeObject，避免schema验证
    await client.storeFile('application/json', '.info', JSON.stringify({
      created: new Date().toISOString(),
      type: 'folder-info'
    }));
    console.log(`Ensured folder exists: /${folderName}/`);
  } catch (error) {
    console.error(`Failed to ensure folder exists: /${folderName}/`, error);
    throw error;
  }
}

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
  try {
    const data = {
      bookmarks: vm.$store.getters['bookmarks/all'],
      tags: vm.$store.getters['tags/all']
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    return URL.createObjectURL(blob);
  } catch (error) {
    throw error;
  }
}