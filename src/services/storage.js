import PouchDB from 'pouchdb-browser';
import RemoteStorage from 'remotestoragejs';
import Widget from 'remotestorage-widget';

// Initialize PouchDB
const bookmarksDB = new PouchDB('bookmarks');
const tagsDB = new PouchDB('tags');

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
            lastVisited: { type: 'string' },
            isValid: { type: 'boolean' },
            visitCount: { type: 'number' }
          }
        });

        return {
          exports: {
            async save(bookmark) {
              await privateClient.storeObject('bookmark', bookmark.id, bookmark);
            },
            async get(id) {
              return await privateClient.getObject(id);
            },
            async list() {
              const bookmarks = await privateClient.getAll('');
              return Object.values(bookmarks);
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

// Initialize RemoteStorage Widget
const widget = new Widget(remoteStorage);
widget.attach();

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

// Set up periodic sync
let syncInterval;

function startSync() {
  // Initial sync
  syncBookmarks();
  syncTags();
  
  // Set up periodic sync every 5 minutes
  syncInterval = setInterval(() => {
    syncBookmarks();
    syncTags();
  }, 5 * 60 * 1000);
}

function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
}

export {
  bookmarksDB,
  tagsDB,
  remoteStorage,
  startSync,
  stopSync
};