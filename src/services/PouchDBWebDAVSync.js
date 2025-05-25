/**
 * PouchDB与WebDAV双向同步服务
 * 
 * 职责：
 * 1. 处理本地PouchDB与远程WebDAV存储间的数据同步
 * 2. 数据转换处理：
 *    - PouchDB -> WebDAV: 
 *      * 反转义ID(unescapeId)
 *      * 字段名转换(如_id→id)
 *    - WebDAV -> PouchDB: 
 *      * 转义ID(escapeId) 
 *      * 字段名转换(如id→_id)
 * 3. 冲突解决(基于修订版本号)
 * 4. 同步状态通知
 * 
 * 注意：所有数据转换逻辑都集中在此服务中处理，
 * WebDAVManager保持原始数据通信。
 */

import PouchDbTideMarkSync from './PouchDbTideMarkSync';


export default class PouchDBWebDAVSync {
  constructor(webDAVManager) {
    this.webDAVManager = webDAVManager;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncListeners = [];
    // Initialize PouchDB
    // this.bookmarksDB = new PouchDB('bookmarks');
    // this.tagsDB = new PouchDB('tags');
    this.pouchDbTideMarkSync = new PouchDbTideMarkSync();
  }

  // 添加同步状态监听器
  addSyncListener(listener) {
    this.syncListeners.push(listener);
  }

  // 移除同步状态监听器
  removeSyncListener(listener) {
    this.syncListeners = this.syncListeners.filter(l => l !== listener);
  }

  // 通知监听器
  #notifyListeners(event) {
    this.syncListeners.forEach(listener => listener(event));
  }

  // 同步数据到WebDAV
  async syncToWebDAV(filename, transformFunc = null, loadFunc = null) {
    if (this.isSyncing) {
      console.warn('Sync already in progress');
      return false;
    }

    this.isSyncing = true;
    this.#notifyListeners({ type: 'syncStart', direction: 'toWebDAV' });

    try {
      // 1. 从PouchDB获取数据(已转义的ID)
      const pouchData = await loadFunc();
      
      // 2. 转换数据格式为WebDAV格式
      const webDAVData = pouchData.map(doc => transformFunc(doc));

      // 3. 保存到WebDAV
      await this.webDAVManager.save(filename, webDAVData);
      console.log('Data successfully synced to WebDAV');

      this.lastSyncTime = new Date();
      this.#notifyListeners({ 
        type: 'syncComplete', 
        direction: 'toWebDAV',
        count: pouchData.length,
        timestamp: this.lastSyncTime
      });

      return true;
    } catch (error) {
      console.error('Error syncing to WebDAV:', error);
      this.#notifyListeners({ 
        type: 'syncError', 
        direction: 'toWebDAV',
        error: error.message
      });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // 从WebDAV同步数据
  async syncFromWebDAV(filename, importFunc) {
    if (this.isSyncing) {
      console.warn('Sync already in progress');
      return false;
    }

    this.isSyncing = true;
    this.#notifyListeners({ type: 'syncStart', direction: 'fromWebDAV' });

    try {
      // 1. 从WebDAV获取原始数据
      const webDAVData = await this.webDAVManager.load(filename);
      // console.log('webDAVData: ', webDAVData);

      let result = await importFunc(webDAVData, importFunc);

      console.log(`Saved ${result.length} items to PouchDB`);

      this.lastSyncTime = new Date();
      this.#notifyListeners({ 
        type: 'syncComplete', 
        direction: 'fromWebDAV',
        count: result.length,
        timestamp: this.lastSyncTime
      });

      return true;
    } catch (error) {
      console.warn('Error syncing from WebDAV, possiblely CORS issue:', error);
      this.#notifyListeners({ 
        type: 'syncError', 
        direction: 'fromWebDAV',
        error: error.message
      });
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  双向同步
  async fullSync() {
    try {
      await this.syncFromWebDAV('tag.json', this.pouchDbTideMarkSync.importTags.bind(this.pouchDbTideMarkSync));
      // await this.syncToWebDAV('tag.json', this.pouchDbTideMarkSync.convertToWebDAVFormat.bind(this.pouchDbTideMarkSync), 
        // this.pouchDbTideMarkSync.getAllTags.bind(this.pouchDbTideMarkSync));
      await this.syncFromWebDAV('collection.json', this.pouchDbTideMarkSync.importBookmarks.bind(this.pouchDbTideMarkSync));
      // await this.syncToWebDAV('collection.json', this.pouchDbTideMarkSync.convertToWebDAVFormat.bind(this.pouchDbTideMarkSync), 
        // this.pouchDbTideMarkSync.getAllBookmarks.bind(this.pouchDbTideMarkSync));
      return true;
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    }
  }

  // 获取同步状态
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    };
  }
}