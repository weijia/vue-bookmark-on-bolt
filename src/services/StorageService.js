/**
 * StorageService - 负责管理书签和标签的本地及远程存储
 * 功能包括：
 * - 初始化本地PouchDB数据库
 * - 配置远程存储(RemoteStorage和WebDAV)
 * - 处理数据同步
 * - 提供数据库实例访问
 */
import PouchDB from 'pouchdb-browser';
import { escapeId, unescapeId } from '../utils/idEscape';
import RemoteStorage from 'remotestoragejs';
import store from '../store';
import WebDAVManager from './WebDAVManager';
import PouchDBWebDAVSync from './PouchDBWebDAVSync';

export default class StorageService {
  constructor() {
    // 初始化本地数据库
    this.bookmarksDB = new PouchDB('bookmarks');
    this.tagsDB = new PouchDB('tags');

    // 远程数据库和同步状态
    this.remoteBookmarksDB = null;
    this.remoteTagsDB = null;
    this.syncHandler = null;
    this.lastSyncTime = null;
    this.syncStatus = 'disconnected';
    this.isConfigured = false;
    this.webdavEnabled = false;
    this.webdavConfig = null;
    this.webDAVManager = null;
    this.pouchDBWebDAVSync = null;

    // 初始化RemoteStorage
    // this.remoteStorage = this._initRemoteStorage();
  }

  /**
   * 初始化RemoteStorage配置
   * @returns {RemoteStorage} RemoteStorage实例
   */
  _initRemoteStorage() {
    const remoteStorage = new RemoteStorage({
      modules: [
        {
          name: 'bookmarks',
          builder: (privateClient) => this._buildBookmarksModule(privateClient)
        },
        {
          name: 'tags',
          builder: (privateClient) => this._buildTagsModule(privateClient)
        }
      ]
    });

    // 声明访问权限
    remoteStorage.access.claim('bookmarks', 'rw');
    remoteStorage.access.claim('tags', 'rw');

    return remoteStorage;
  }

  /**
   * 构建书签模块
   * @param {Object} privateClient RemoteStorage私有客户端
   * @returns {Object} 书签模块导出对象
   */
  _buildBookmarksModule(privateClient) {
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
        lastVisited: { type: ['string', 'null'] },
        isValid: { type: 'boolean' },
        visitCount: { type: 'number' }
      }
    });

    return {
      exports: {
        save: async (bookmark) => this._saveBookmark(privateClient, bookmark),
        get: async (id) => privateClient.getObject(id),
        list: async () => this._listBookmarks(privateClient)
      }
    };
  }

  /**
   * 保存书签到RemoteStorage
   * @param {Object} privateClient RemoteStorage私有客户端
   * @param {Object} bookmark 书签对象
   */
  async _saveBookmark(privateClient, bookmark) {
    try {
      await privateClient.storeObject('bookmark', bookmark.id, bookmark);
    } catch (error) {
      if (error.name === 'NetworkError') {
        console.error('Network error while saving bookmark:', error);
      } else if (error.name === 'ValidationError') {
        console.error('Validation error while saving bookmark:', error);
      } else {
        console.error('Unexpected error while saving bookmark:', error);
      }
    }
  }

  /**
   * 从RemoteStorage获取书签列表
   * @param {Object} privateClient RemoteStorage私有客户端
   * @returns {Array} 书签数组
   */
  async _listBookmarks(privateClient) {
    try {
      const bookmarks = await privateClient.getAll('');
      return Object.values(bookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks from RemoteStorage:', error);
      return [];
    }
  }

  /**
   * 构建标签模块
   * @param {Object} privateClient RemoteStorage私有客户端
   * @returns {Object} 标签模块导出对象
   */
  _buildTagsModule(privateClient) {
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
        save: async (tag) => privateClient.storeObject('tag', tag.id, tag),
        get: async (id) => privateClient.getObject(id),
        list: async () => this._listTags(privateClient)
      }
    };
  }

  /**
   * 从RemoteStorage获取标签列表
   * @param {Object} privateClient RemoteStorage私有客户端
   * @returns {Array} 标签数组
   */
  async _listTags(privateClient) {
    try {
      const tags = await privateClient.getAll('');
      return Object.values(tags);
    } catch (error) {
      console.error('Error fetching tags from RemoteStorage:', error);
      return [];
    }
  }

  /**
   * 配置PouchDB同步
   * @param {Object} config 同步配置
   */
  async configurePouchDBSync(config) {
    try {
      // 停止现有同步
      if (this.syncHandler) {
        this.syncHandler.cancel();
      }

      // 创建远程连接
      const remoteBookmarksUrl = `${config.remoteUrl}/bookmarks`;
      const remoteTagsUrl = `${config.remoteUrl}/tags`;

      const options = {};
      if (config.username && config.password) {
        options.auth = {
          username: config.username,
          password: config.password
        };
      }

      this.remoteBookmarksDB = new PouchDB(remoteBookmarksUrl, options);
      this.remoteTagsDB = new PouchDB(remoteTagsUrl, options);

      // 测试连接
      await this.remoteBookmarksDB.info();
      await this.remoteTagsDB.info();

      // 启动同步
      if (config.enableSync) {
        this.startSync(config.syncInterval);
      }

      this.syncStatus = 'connected';
      this.lastSyncTime = new Date();
      this.isConfigured = true;
    } catch (error) {
      console.error('PouchDB sync configuration error:', error);
      this.syncStatus = 'error';
      throw error;
    }
  }

  /**
   * 启动同步进程
   * @param {number} intervalMinutes 同步间隔(分钟)
   */
  startSync(intervalMinutes = 5) {
    // 初始同步
    this._syncBookmarks();
    this._syncTags();

    // 设置定时同步
    this.syncInterval = setInterval(() => {
      this._syncBookmarks();
      this._syncTags();
    }, intervalMinutes * 60 * 1000);

    if (!this.isConfigured) {
      console.warn('configurePouchDBSync must be called before startSync');
      this.syncStatus = 'not_configured';
      return;
    }

    // 启动PouchDB实时同步
    this.syncHandler = PouchDB.sync(this.bookmarksDB, this.remoteBookmarksDB, {
      live: true,
      retry: true
    }).on('change', (info) => {
      this.lastSyncTime = new Date();
      this.syncStatus = 'syncing';
    }).on('complete', () => {
      this.lastSyncTime = new Date();
      this.syncStatus = 'connected';
    }).on('error', (err) => {
      console.error('Sync error:', err);
      this.syncStatus = 'error';
    });

    // 同步标签
    PouchDB.sync(this.tagsDB, this.remoteTagsDB, {
      live: true,
      retry: true
    });
  }

  /**
   * 停止同步进程
   */
  stopSync() {
    if (this.syncHandler) {
      this.syncHandler.cancel();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncStatus = 'disconnected';
  }

  /**
   * 获取当前同步状态
   * @returns {Object} 同步状态对象
   */
  getSyncStatus() {
    return {
      status: this.syncStatus,
      lastSync: this.lastSyncTime
    };
  }

  /**
   * 配置WebDAV同步 (setup是setupWebDAVSync的别名)
   * @param {Object} config WebDAV配置
   */
  async setup(config) {
    // return this.setupWebDAVSync(config);
  }

  /**
   * 配置WebDAV同步
   * @param {Object} config WebDAV配置
   */
  // async setupWebDAVSync(config) {
  //   try {
  //     this.webdavConfig = config;
  //     this.webdavEnabled = config.enabled || false;

  //     if (this.webdavEnabled) {
  //       this.webDAVManager = new WebDAVManager();
  //       await this.webDAVManager.configure(config);

  //       this.pouchDBWebDAVSync = new PouchDBWebDAVSync(this.bookmarksDB, this.webDAVManager);

  //       localStorage.setItem('webdavConfig', JSON.stringify(config));

  //       await this.pouchDBWebDAVSync.syncFromWebDAV('collection.json');
  //       await this.pouchDBWebDAVSync.syncToWebDAV('collection.json');

  //       return true;
  //     } else {
  //       this.webDAVManager = null;
  //       this.pouchDBWebDAVSync = null;
  //       localStorage.removeItem('webdavConfig');
  //       return false;
  //     }
  //   } catch (error) {
  //     console.error('WebDAV configuration error:', error);
  //     this.webdavEnabled = false;
  //     this.webDAVManager = null;
  //     this.pouchDBWebDAVSync = null;
  //     throw error;
  //   }
  // }

  /**
   * 从WebDAV服务器同步数据
   */
  // async syncFromWebDAV() {
  //   if (!this.webdavEnabled || !this.webdavConfig || !this.pouchDBWebDAVSync) {
  //     console.warn('WebDAV is not enabled or configured');
  //     return false;
  //   }

  //   try {
  //     await this.pouchDBWebDAVSync.syncFromWebDAV('collection.json');

  //     const updatedBookmarks = await this.bookmarksDB.allDocs({ include_docs: true });
  //     store.commit('bookmarks/setBookmarks', updatedBookmarks.rows.map(row => row.doc));

  //     const updatedTags = await this.tagsDB.allDocs({ include_docs: true });
  //     store.commit('tags/setTags', updatedTags.rows.map(row => row.doc));

  //     return true;
  //   } catch (error) {
  //     console.error('Failed to sync from WebDAV:', error);
  //     throw error;
  //   }
  // }

  /**
   * 同步数据到WebDAV服务器
   */
  // async syncDataToWebDAV() {
  //   if (!this.webdavEnabled || !this.webdavConfig || !this.pouchDBWebDAVSync) {
  //     console.warn('WebDAV is not enabled or configured');
  //     return false;
  //   }

  //   try {
  //     await this.pouchDBWebDAVSync.syncToWebDAV('collection.json');
  //     this.lastSyncTime = new Date();
  //     return true;
  //   } catch (error) {
  //     console.error('Failed to sync data to WebDAV:', error);
  //     throw error;
  //   }
  // }

  /**
   * 同步书签数据
   */
  async _syncBookmarks() {
    const localBookmarks = await this.bookmarksDB.allDocs({ include_docs: true });
    const remoteBookmarks = await this.remoteStorage.bookmarks.list();

    // 处理冲突和同步
    for (const remoteBookmark of remoteBookmarks) {
      const localBookmark = localBookmarks.rows.find(row => row.id === remoteBookmark.id)?.doc;

      if (localBookmark) {
        const localUpdatedAt = new Date(localBookmark.updatedAt || localBookmark.createdAt);
        const remoteUpdatedAt = new Date(remoteBookmark.updatedAt || remoteBookmark.createdAt);

        if (localUpdatedAt > remoteUpdatedAt) {
          await this.remoteStorage.bookmarks.save(localBookmark);
        } else if (remoteUpdatedAt > localUpdatedAt) {
          try {
            await this.bookmarksDB.put({
              ...remoteBookmark,
              _id: remoteBookmark.id,
              _rev: localBookmark._rev
            });
          } catch (error) {
            console.error('Error updating bookmark:', remoteBookmark.id, error);
          }
        }
      } else {
        try {
          await this.bookmarksDB.bulkDocs([{
            ...remoteBookmark,
            _id: remoteBookmark.id,
            _rev: remoteBookmark._rev
          }], { new_edits: false });
        } catch (error) {
          console.error('Error adding bookmark:', remoteBookmark.id, error);
        }
      }
    }

    // 同步本地书签到远程
    for (const row of localBookmarks.rows) {
      const remoteBookmark = remoteBookmarks.find(b => b.id === row.id);
      if (!remoteBookmark) {
        await this.remoteStorage.bookmarks.save(row.doc);
      }
    }

    // 更新Vuex状态
    const updatedLocalBookmarks = await this.bookmarksDB.allDocs({ include_docs: true });
    store.commit('bookmarks/setBookmarks', updatedLocalBookmarks.rows.map(row => row.doc));
  }

  /**
   * 同步标签数据
   */
  async _syncTags() {
    const localTags = await this.tagsDB.allDocs({ include_docs: true });
    const remoteTags = await this.remoteStorage.tags.list();

    // 处理冲突和同步
    for (const remoteTag of remoteTags) {
      const localTag = localTags.rows.find(row => row.id === remoteTag.id)?.doc;

      if (localTag) {
        const localUpdatedAt = new Date(localTag.updatedAt || localTag.createdAt);
        const remoteUpdatedAt = new Date(remoteTag.updatedAt || remoteTag.createdAt);

        if (localUpdatedAt > remoteUpdatedAt) {
          await this.remoteStorage.tags.save(localTag);
        } else if (remoteUpdatedAt > localUpdatedAt) {
          try {
            await this.tagsDB.put({
              ...remoteTag,
              _id: remoteTag.id,
              _rev: localTag._rev
            });
            store.commit('tags/updateTag', { id: remoteTag.id, updatedTag: { ...remoteTag, _rev: localTag._rev } });
          } catch (error) {
            console.error('Error updating tag:', remoteTag.id, error);
          }
        }
      } else {
        try {
          const escapedId = escapeId(remoteTag.id);
          await this.tagsDB.bulkDocs([{
            ...remoteTag,
            _id: escapedId,
            id: escapedId,
            _rev: remoteTag._rev
          }], { new_edits: false });
        } catch (error) {
          console.error('Error adding tag:', remoteTag.id, error);
        }
      }
    }

    // 同步本地标签到远程
    for (const row of localTags.rows) {
      const remoteTag = remoteTags.find(t => t.id === row.id);
      if (!remoteTag) {
        await this.remoteStorage.tags.save(row.doc);
      }
    }

    // 更新Vuex状态
    const updatedLocalTags = await this.tagsDB.allDocs({ include_docs: true });
    store.commit('tags/setTags', updatedLocalTags.rows.map(row => row.doc));
  }

  // 从PouchDB获取所有数据
  async #getAllFromPouchDB(pouchDB) {
    try {
      const result = await pouchDB.allDocs({
        include_docs: true,
        attachments: true
      });
      return result.rows.map(row => row.doc);
    } catch (error) {
      console.error('Error getting data from PouchDB:', error);
      throw error;
    }
  }

  async importData(pouchDb, data) {
    try {
      // 3. 获取当前PouchDB数据用于冲突检测
      const currentData = await this.#getAllFromPouchDB(pouchDb);
      // console.log('currentData: ', currentData);
      const currentMap = new Map(currentData.map(doc => [doc.id, doc]));

      // 4. 合并数据
      const docsToSave = pouchData.map(remoteDoc => {
        const localDoc = currentMap.get(remoteDoc.id);
        
        // 冲突解决策略：保留最新修改的文档
        if (localDoc) {
          const remoteModified = remoteDoc.updatedAt ? parseInt(remoteDoc.updatedAt) : 0;
          const localModified = parseInt(localDoc.updatedAt);
          
          if (localModified > remoteModified) {
            return localDoc; // 保留本地版本
          }
        }
        // console.log('remoteDoc: ', remoteDoc);
        return remoteDoc;
      });

      // console.log('syncFromWebDAV: ', docsToSave)

      // 4. 保存到PouchDB
      const result = await this.#saveToPouchDB(pouchDB, docsToSave);
    }
    catch (error) {
      console.error('Error importing bookmarks:', error);
      throw error; 
    }
  }
}