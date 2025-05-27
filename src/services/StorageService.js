/**
 * StorageService - 负责管理书签和标签的本地及远程存储
 * 功能包括：
 * - 初始化本地PouchDB数据库
 * - 配置远程存储(RemoteStorage和WebDAV)
 * - 处理数据同步
 * - 提供数据库实例访问
 */
import PouchDB from 'pouchdb-browser';
import RemoteStorage from 'remotestoragejs';
import store from '../store';
import { escapeId } from '../utils/idEscape';

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
  
  // 保存数据到PouchDB
  async #saveToPouchDB(pouchDb, docs) {
    try {
      // 分离有_rev和无_rev的文档
      const docsWithRev = docs.filter(doc => doc._rev);
      const docsWithoutRev = docs.filter(doc => !doc._rev);
      
      let results = [];
      
      // 处理有_rev的文档（使用new_edits: false避免本地无文档时报错）
      if (docsWithRev.length > 0) {
        const revResults = await pouchDb.bulkDocs(docsWithRev, { new_edits: false });
        results = results.concat(revResults);
      }
      
      // 处理无_rev的文档（正常bulkDocs调用）
      if (docsWithoutRev.length > 0) {
        const noRevResults = await pouchDb.bulkDocs(docsWithoutRev);
        results = results.concat(noRevResults);
      }
      
      return results;
    } catch (error) {
      console.error('Error saving data to pouchDb:', error);
      throw error;
    }
  }

  async getAllBookmarks() {
    return this.#getAllFromPouchDB(this.bookmarksDB);
  }

  async getAllTags() {
    return this.#getAllFromPouchDB(this.tagsDB);
  }

  async importBookmarks(data) {
    return this.importData(this.bookmarksDB, data);
  }

  async importTags(data) {
    return this.importData(this.tagsDB, data);
  }

  /**
   * 导入数据到PouchDB，检查并处理数据冲突
   * @param {PouchDB} pouchDb - 目标PouchDB实例
   * @param {Array} data - 要导入的数据数组
   * @returns {Object} 包含导入结果和冲突信息的对象
   */
  async importData(pouchDb, data) {
    try {
      // 获取当前PouchDB数据用于冲突检测
      const currentData = await this.#getAllFromPouchDB(pouchDb);
      const currentMap = new Map(currentData.map(doc => [doc.id, doc]));

      // 分离有冲突、完全相同和需要更新的数据
      const conflicts = [];
      const docsToSave = [];
      const skippedDocs = [];

      for (const remoteDoc of data) {
        const localDoc = currentMap.get(remoteDoc.id);
        
        if (localDoc) {

          // 检查文档是否完全相同
          if (this.#areDocsIdentical(localDoc, remoteDoc)) {
            skippedDocs.push({
              id: remoteDoc.id,
              reason: 'Document is identical to local version'
            });
            continue; // 跳过完全相同的文档
          }
          
          // 检查是否存在冲突
          const hasConflict = this.#checkConflict(localDoc, remoteDoc);
          
          if (hasConflict) {
            conflicts.push({
              remote: remoteDoc,
              local: localDoc,
              reason: 'Data conflict detected'
            });
            continue; // 跳过有冲突的数据
          }
          
        }
        
        // 无冲突且不完全相同的数据添加到待保存列表
        docsToSave.push(remoteDoc);
      }

      // 只保存需要更新的数据
      let saveResult = [];
      if (docsToSave.length > 0) {
        saveResult = await this.#saveToPouchDB(pouchDb, docsToSave);
      }

      // 返回导入结果，包括成功导入的数量和冲突信息
      return {
        success: true,
        savedCount: docsToSave.length,
        conflicts: conflicts,
        skipped: skippedDocs,
        saveResult: saveResult
      };
    }
    catch (error) {
      console.error('Error importing data:', error);
      return {
        success: false,
        error: error.message,
        conflicts: [],
        skipped: []
      };
    }
  }

  /**
   * 检查两个文档是否完全相同
   * @param {Object} doc1 - 第一个文档
   * @param {Object} doc2 - 第二个文档
   * @returns {boolean} 如果文档完全相同则返回true
   */
  #areDocsIdentical(doc1, doc2) {
    // 忽略PouchDB内部字段和修订版本
    const ignoreFields = ['_rev'];
    
    // 获取所有字段名（除了忽略字段）
    const allFields = new Set([
      ...Object.keys(doc1),
      ...Object.keys(doc2)
    ].filter(field => !ignoreFields.includes(field)));

    // 比较每个字段的值
    for (const field of allFields) {
      const value1 = doc1[field];
      const value2 = doc2[field];

      // 如果字段只存在于其中一个文档中
      if ((!value1 && value2) || (value1 && !value2)) {
        return false;
      }

      // 比较字段值（使用JSON.stringify处理对象和数组）
      if (JSON.stringify(value1) !== JSON.stringify(value2)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查两个文档之间是否存在冲突
   * @param {Object} localDoc - 本地文档
   * @param {Object} remoteDoc - 远程文档
   * @returns {boolean} 是否存在冲突
   */
  #checkConflict(localDoc, remoteDoc) {
    // 如果本地文档比远程文档新，视为冲突
    if (localDoc.updatedAt && remoteDoc.updatedAt) {
      const localModified = parseInt(localDoc.updatedAt);
      const remoteModified = parseInt(remoteDoc.updatedAt);
      if (localModified > remoteModified) {
        return true;
      }
    }

    // 如果时间戳相同，比较所有字段（除了特殊字段）
    if (localDoc.updatedAt === remoteDoc.updatedAt) {
      // 获取所有字段名（除了特殊字段）
      const specialFields = ['_id', '_rev', 'id', 'updatedAt', 'createdAt'];
      const allFields = new Set([
        ...Object.keys(localDoc),
        ...Object.keys(remoteDoc)
      ].filter(field => !specialFields.includes(field)));

      // 比较每个字段的值
      for (const field of allFields) {
        const localValue = localDoc[field];
        const remoteValue = remoteDoc[field];

        // 如果字段只存在于其中一个文档中
        if ((!localValue && remoteValue) || (localValue && !remoteValue)) {
          return true;
        }

        // 比较字段值（使用JSON.stringify处理对象和数组）
        if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
          return true;
        }
      }
    }

    return false;
  }
}