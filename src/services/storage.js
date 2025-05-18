import PouchDB from 'pouchdb-browser';
import RemoteStorage from 'remotestoragejs';
import Widget from 'remotestorage-widget';
import store from '../store'; // 导入 Vuex store
import { configureWebDAV, syncToWebDAV } from './webdav';

// Initialize PouchDB
const bookmarksDB = new PouchDB('bookmarks');
const tagsDB = new PouchDB('tags');

let remoteBookmarksDB = null;
let remoteTagsDB = null;
let syncHandler = null;
let lastSyncTime = null;
let syncStatus = 'disconnected';
let isConfigured = false;
let webdavEnabled = false;
let webdavConfig = null;

// Initialize RemoteStorage
const remoteStorage = new RemoteStorage({
  modules: [
    {
      name: 'bookmarks',
      builder: (privateClient) => {
        privateClient.declareType('bookmark', {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            url: { type: 'string' },
            description: { type: 'string' },
            favicon: { type: 'string' },
            tagIds: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string' },
            lastVisited: {"type": ["string", "null"]}, // 这里允许 'title' 字段为 string 或 null
            isValid: { type: 'boolean' },
            visitCount: { type: 'number' }
          }
        });

        return {
          exports: {
            async save(bookmark) {
              try {
                console.log('Saving bookmark with parameters:', 'bookmark', bookmark.id, bookmark);
                await privateClient.storeObject('bookmark', bookmark.id, bookmark);
                console.log('Bookmark saved successfully:', bookmark);
              } catch (error) {
                if (error.name === 'NetworkError') {
                  console.error('Network error while saving bookmark:', error);
                } else if (error.name === 'ValidationError') {
                  console.error('Validation error while saving bookmark:', error);
                } else {
                  console.error('Unexpected error while saving bookmark:', error);
                }
                console.error('Bookmark data:', bookmark);
              }
            },
            async get(id) {
              return await privateClient.getObject(id);
            },
            async list() {
              try {
                // 尝试获取所有书签
                const bookmarks = await privateClient.getAll('');
                return Object.values(bookmarks);
              } catch (error) {
                // 捕获异常并打印错误信息
                console.error('Error fetching bookmarks from RemoteStorage:', error);
                // 返回空数组
                return [];
              }
            }
          }
        };
      }
    },
    {
      name: 'tags',
      builder: (privateClient) => {
        privateClient.declareType('tag', {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            color: { type: 'string' }
          }
        });

        return {
          exports: {
            async save(tag) {
              await privateClient.storeObject('tag', tag.id, tag);
            },
            async get(id) {
              return await privateClient.getObject(id);
            },
            async list() {
              const tags = await privateClient.getAll('');
              return Object.values(tags);
            }
          }
        };
      }
    }
  ]
});

// 声明访问权限
remoteStorage.access.claim('bookmarks', 'rw');
remoteStorage.access.claim('tags', 'rw');

// Initialize RemoteStorage Widget
// const widget = new Widget(remoteStorage);
// widget.attach();


// Sync functions
async function syncBookmarks() {
  const localBookmarks = await bookmarksDB.allDocs({ include_docs: true });
  const remoteBookmarks = await remoteStorage.bookmarks.list();

  // Handle conflicts
  const conflicts = new Map();
  
  for (const remoteBookmark of remoteBookmarks) {
    const localBookmark = localBookmarks.rows.find(row => row.id === remoteBookmark.id)?.doc;
    
    if (localBookmark) {
      const localUpdatedAt = new Date(localBookmark.updatedAt || localBookmark.createdAt);
      const remoteUpdatedAt = new Date(remoteBookmark.updatedAt || remoteBookmark.createdAt);
      
      if (localUpdatedAt > remoteUpdatedAt) {
        await remoteStorage.bookmarks.save(localBookmark);
      } else if (remoteUpdatedAt > localUpdatedAt) {
        try {
          await bookmarksDB.put({
            ...remoteBookmark,
            _id: remoteBookmark.id,
            _rev: localBookmark._rev
          });
          console.log('Bookmark updated successfully:', remoteBookmark.id);
        } catch (error) {
          console.error('Error updating bookmark:', remoteBookmark.id, error);
          // 可以在这里添加更多的错误处理逻辑，比如重试
        }
      }
    } else {
      try {
        // 使用 bulkDocs 方法并设置 new_edits: false
        const result = await bookmarksDB.bulkDocs([{
          ...remoteBookmark,
          _id: remoteBookmark.id,
          // 假设 remoteBookmark 包含 _rev 字段，如果没有，需要根据实际情况处理
          _rev: remoteBookmark._rev 
        }], { new_edits: false });

        // 检查 result 数组是否为空
        if (result.length > 0 && result[0].ok) {
          console.log('Bookmark added successfully with specified rev:', remoteBookmark.id);
        } else {
          const errorMessage = result.length > 0 ? result[0].error : 'Empty result from bulkDocs';
          console.warn('Failed to add bookmark:', errorMessage);
        }
      } catch (error) {
        console.error('Error adding bookmark:', remoteBookmark.id, error);
        // 可以在这里添加更多的错误处理逻辑，比如重试
      }
    }
  }

  // Sync local bookmarks to remote
  for (const row of localBookmarks.rows) {
    const remoteBookmark = remoteBookmarks.find(b => b.id === row.id);
    if (!remoteBookmark) {
      await remoteStorage.bookmarks.save(row.doc);
    }
  }

  // 同步完成后，获取最新的本地书签数据
  const updatedLocalBookmarks = await bookmarksDB.allDocs({ include_docs: true });
  const bookmarksArray = updatedLocalBookmarks.rows.map(row => row.doc);
  // 提交 mutation 更新 Vuex 状态
  store.commit('bookmarks/setBookmarks', bookmarksArray);
}

async function syncTags() {
  const localTags = await tagsDB.allDocs({ include_docs: true });
  const remoteTags = await remoteStorage.tags.list();

  // Similar conflict resolution as bookmarks
  for (const remoteTag of remoteTags) {
    const localTag = localTags.rows.find(row => row.id === remoteTag.id)?.doc;
    
    if (localTag) {
      const localUpdatedAt = new Date(localTag.updatedAt || localTag.createdAt);
      const remoteUpdatedAt = new Date(remoteTag.updatedAt || remoteTag.createdAt);
      
      if (localUpdatedAt > remoteUpdatedAt) {
        await remoteStorage.tags.save(localTag);
      } else if (remoteUpdatedAt > localUpdatedAt) {
        try {
          await tagsDB.put({
            ...remoteTag,
            _id: remoteTag.id,
            _rev: localTag._rev
          });
          // 更新单个标签时，提交更新到 Vuex
          store.commit('tags/updateTag', { id: remoteTag.id, updatedTag: { ...remoteTag, _rev: localTag._rev } });
        } catch (error) {
          console.error('Error updating tag:', remoteTag.id, error);
        }
      }
    } else {
      try {
        // 使用 bulkDocs 方法并设置 new_edits: false
        const result = await tagsDB.bulkDocs([{
          ...remoteTag,
          _id: remoteTag.id,
          // 假设 remoteTag 包含 _rev 字段，如果没有，需要根据实际情况处理
          _rev: remoteTag._rev 
        }], { new_edits: false });

        // 检查 result 数组是否为空
        if (result.length > 0 && result[0].ok) {
          console.log('Tag added successfully with specified rev:', remoteTag.id);
        } else {
          const errorMessage = result.length > 0 ? result[0].error : 'Empty result from bulkDocs';
          console.error('Failed to add tag:', errorMessage);
        }
      } catch (error) {
        console.error('Error adding tag:', remoteTag.id, error);
        // 可以在这里添加更多的错误处理逻辑，比如重试
      }
    }
  }

  // Sync local tags to remote
  for (const row of localTags.rows) {
    const remoteTag = remoteTags.find(t => t.id === row.id);
    if (!remoteTag) {
      await remoteStorage.tags.save(row.doc);
    }
  }

  // 同步完成后，获取最新的本地标签数据
  const updatedLocalTags = await tagsDB.allDocs({ include_docs: true });
  const tagsArray = updatedLocalTags.rows.map(row => row.doc);
  // 提交 mutation 更新 Vuex 状态
  store.commit('tags/setTags', tagsArray);
}

// Configure PouchDB sync
export async function configurePouchDBSync(config) {
  try {
    // Stop existing sync if any
    if (syncHandler) {
      syncHandler.cancel();
    }

    // Create remote connections
    const remoteBookmarksUrl = `${config.remoteUrl}/bookmarks`;
    const remoteTagsUrl = `${config.remoteUrl}/tags`;

    const options = {};
    if (config.username && config.password) {
      options.auth = {
        username: config.username,
        password: config.password
      };
    }

    remoteBookmarksDB = new PouchDB(remoteBookmarksUrl, options);
    remoteTagsDB = new PouchDB(remoteTagsUrl, options);

    // Test connection
    await remoteBookmarksDB.info();
    await remoteTagsDB.info();

    // Start sync
    if (config.enableSync) {
      startSync(config.syncInterval);
    }

    syncStatus = 'connected';
    lastSyncTime = new Date();
    isConfigured = true; 
  } catch (error) {
    console.error('PouchDB sync configuration error:', error);
    syncStatus = 'error';
    throw error;
  }
}

// Set up periodic sync
let syncInterval;

// Start sync process
function startSync(intervalMinutes = 5) {
  // Initial sync
  syncBookmarks();
  syncTags();
  
  // Set up periodic sync every 5 minutes
  syncInterval = setInterval(() => {
    syncBookmarks();
    syncTags();
  }, 5 * 60 * 1000);

  // 检查是否已经配置
  if (!isConfigured) {
    console.warn('configurePouchDBSync must be called before startSync. Sync process will not start.');
    syncStatus = 'not_configured';
    return;
  }
  // Cancel existing sync if any
  if (syncHandler) {
    syncHandler.cancel();
  }

  // Start new sync
  syncHandler = PouchDB.sync(bookmarksDB, remoteBookmarksDB, {
    live: true,
    retry: true
  }).on('change', (info) => {
    console.log('Sync change:', info);
    lastSyncTime = new Date();
    syncStatus = 'syncing';
  }).on('complete', () => {
    console.log('Sync completed');
    lastSyncTime = new Date();
    syncStatus = 'connected';
  }).on('error', (err) => {
    console.error('Sync error:', err);
    syncStatus = 'error';
  });

  // Also sync tags
  PouchDB.sync(tagsDB, remoteTagsDB, {
    live: true,
    retry: true
  });

}


// Stop sync process
export function stopSync() {
  if (syncHandler) {
    syncHandler.cancel();
  }
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  syncStatus = 'disconnected';
}

// Get current sync status
export function getSyncStatus() {
  return {
    status: syncStatus,
    lastSync: lastSyncTime
  };
}

// Setup WebDAV sync configuration
export async function setupWebDAVSync(config) {
  try {
    webdavConfig = config;
    webdavEnabled = config.enabled || false;
    
    if (webdavEnabled) {
      await configureWebDAV(config);
      
      // 保存配置到本地存储
      localStorage.setItem('webdavConfig', JSON.stringify(config));
      
      // 初始双向同步
      await syncFromWebDAV(); // 先从服务器加载
      await syncDataToWebDAV(); // 再将本地变更同步到服务器
      
      return true;
    } else {
      localStorage.removeItem('webdavConfig');
      return false;
    }
  } catch (error) {
    console.error('WebDAV configuration error:', error);
    webdavEnabled = false;
    throw error;
  }
}

// 从WebDAV服务器加载数据
export async function syncFromWebDAV() {
  if (!webdavEnabled || !webdavConfig) {
    console.warn('WebDAV is not enabled or configured');
    return false;
  }
  
  try {
    // 从WebDAV加载书签和标签
    const [remoteBookmarks, remoteTags] = await Promise.all([
      loadFromWebDAV('collection.json'),
      loadFromWebDAV('tag.json')
    ]);
    
    if (remoteBookmarks) {
      // 合并书签到本地
      const localBookmarks = await bookmarksDB.allDocs({ include_docs: true });
      await mergeData(localBookmarks.rows, remoteBookmarks, bookmarksDB);
      
      // 更新Vuex状态
      const updatedBookmarks = await bookmarksDB.allDocs({ include_docs: true });
      store.commit('bookmarks/setBookmarks', updatedBookmarks.rows.map(row => row.doc));
    }
    
    if (remoteTags) {
      // 合并标签到本地
      const localTags = await tagsDB.allDocs({ include_docs: true });
      await mergeData(localTags.rows, remoteTags, tagsDB);
      
      // 更新Vuex状态
      const updatedTags = await tagsDB.allDocs({ include_docs: true });
      store.commit('tags/setTags', updatedTags.rows.map(row => row.doc));
    }
    
    console.log('WebDAV data loaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to sync from WebDAV:', error);
    throw error;
  }
}

// 合并数据策略
async function mergeData(localItems, remoteItems, db) {
  const localMap = new Map(localItems.map(item => [item.doc.id, item.doc]));
  const remoteMap = new Map(remoteItems.map(item => [item.id, item]));
  
  // 处理新增和更新的项目
  for (const [id, remoteItem] of remoteMap) {
    if (!localMap.has(id)) {
      // 新增项目
      await db.put({ ...remoteItem, _id: id });
    } else {
      const localItem = localMap.get(id);
      // 保留本地创建时间，使用最新的更新时间
      const createdAt = localItem.createdAt || new Date().toISOString();
      const updatedAt = remoteItem.updatedAt > localItem.updatedAt ? 
        remoteItem.updatedAt : localItem.updatedAt;
      
      // 合并项目，远程优先
      await db.put({ 
        ...localItem,
        ...remoteItem,
        _id: id,
        _rev: localItem._rev,
        createdAt,
        updatedAt
      });
    }
  }
  
  // 保留本地有但远程没有的项目
  for (const [id, localItem] of localMap) {
    if (!remoteMap.has(id)) {
      await db.put(localItem);
    }
  }
}

// Sync data to WebDAV
export async function syncDataToWebDAV() {
  if (!webdavEnabled || !webdavConfig) {
    console.warn('WebDAV is not enabled or configured');
    return false;
  }
  
  try {
    // 获取最新的书签和标签数据
    const bookmarksResponse = await bookmarksDB.allDocs({ include_docs: true });
    const tagsResponse = await tagsDB.allDocs({ include_docs: true });
    
    // 转换数据格式
    const bookmarks = bookmarksResponse.rows.map(row => {
      const { _id, _rev, ...bookmark } = row.doc;
      return {
        id: bookmark.id || _id,
        name: bookmark.title || bookmark.name || '',
        url: bookmark.url || '',
        description: bookmark.description || '',
        folderId: bookmark.folderId || 'my',
        tagIds: bookmark.tagIds || [],
        createdAt: bookmark.createdAt || new Date().toISOString(),
        updatedAt: bookmark.updatedAt || new Date().toISOString(),
        ...bookmark
      };
    });

    const tags = tagsResponse.rows.map(row => {
      const { _id, _rev, ...tag } = row.doc;
      return {
        id: tag.id || _id,
        name: tag.name || '',
        createdAt: tag.createdAt || new Date().toISOString(),
        updatedAt: tag.updatedAt || new Date().toISOString(),
        ...tag
      };
    });

    // 同步到WebDAV
    await syncToWebDAV(bookmarks, tags);
    
    lastSyncTime = new Date();
    console.log('Data synced to WebDAV successfully');
    return true;
  } catch (error) {
    console.error('Failed to sync data to WebDAV:', error);
    throw error;
  }
}

export {
  bookmarksDB,
  tagsDB,
  remoteStorage,
  startSync,
  syncTags, // 导出 syncTags 函数
  syncBookmarks // 导出 syncBookmarks 函数以保持一致性
};