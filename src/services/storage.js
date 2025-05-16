import PouchDB from 'pouchdb-browser';
import RemoteStorage from 'remotestoragejs';
import Widget from 'remotestorage-widget';

// Initialize PouchDB
const bookmarksDB = new PouchDB('bookmarks');
const tagsDB = new PouchDB('tags');

let remoteBookmarksDB = null;
let remoteTagsDB = null;
let syncHandler = null;
let lastSyncTime = null;
let syncStatus = 'disconnected';
let isConfigured = false; 

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
        await bookmarksDB.put({
          ...remoteBookmark,
          _id: remoteBookmark.id,
          _rev: localBookmark._rev
        });
      }
    } else {
      await bookmarksDB.put({
        ...remoteBookmark,
        _id: remoteBookmark.id
      });
    }
  }

  // Sync local bookmarks to remote
  for (const row of localBookmarks.rows) {
    const remoteBookmark = remoteBookmarks.find(b => b.id === row.id);
    if (!remoteBookmark) {
      await remoteStorage.bookmarks.save(row.doc);
    }
  }
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
        await tagsDB.put({
          ...remoteTag,
          _id: remoteTag.id,
          _rev: localTag._rev
        });
      }
    } else {
      await tagsDB.put({
        ...remoteTag,
        _id: remoteTag.id
      });
    }
  }

  // Sync local tags to remote
  for (const row of localTags.rows) {
    const remoteTag = remoteTags.find(t => t.id === row.id);
    if (!remoteTag) {
      await remoteStorage.tags.save(row.doc);
    }
  }
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

export {
  bookmarksDB,
  tagsDB,
  remoteStorage,
  startSync
};
