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
import { escapeId, unescapeId } from '../utils/idEscape';

// 字段名映射配置
const FIELD_MAPPING = {
  pouchToWebDAV: {
    'title': 'name'
  },
  webDAVToPouch: {
    'name': 'title'
  }
};

export default class PouchDBWebDAVSync {
  constructor(pouchDB, webDAVManager) {
    this.pouchDB = pouchDB;
    this.webDAVManager = webDAVManager;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncListeners = [];
  }

  // 将PouchDB文档转换为WebDAV格式
  #convertToWebDAVFormat(pouchDoc) {
    const webDAVDoc = {};
    // 转换字段名
    for (const key in pouchDoc) {
      if (FIELD_MAPPING.pouchToWebDAV[key]) {
        webDAVDoc[FIELD_MAPPING.pouchToWebDAV[key]] = pouchDoc[key];
      } else {
        webDAVDoc[key] = pouchDoc[key];
      }
    }
    // 处理ID转义
    if (webDAVDoc.id) {
      webDAVDoc.id = unescapeId(webDAVDoc.id);
    }
    return webDAVDoc;
  }

  // 将WebDAV文档转换为PouchDB格式
  #convertToPouchDBFormat(webDAVDoc) {
    const pouchDoc = {};
    // 转换字段名
    for (const key in webDAVDoc) {
      if (FIELD_MAPPING.webDAVToPouch[key]) {
        pouchDoc[FIELD_MAPPING.webDAVToPouch[key]] = webDAVDoc[key];
      } else {
        pouchDoc[key] = webDAVDoc[key];
      }
    }
    // 处理ID转义
    if (pouchDoc._id) {
      pouchDoc._id = escapeId(pouchDoc._id);
    }
    return pouchDoc;
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

  // 从PouchDB获取所有数据
  async #getAllFromPouchDB() {
    try {
      const result = await this.pouchDB.allDocs({
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
  async #saveToPouchDB(docs) {
    try {
      const result = await this.pouchDB.bulkDocs(docs);
      return result;
    } catch (error) {
      console.error('Error saving data to PouchDB:', error);
      throw error;
    }
  }

  // 同步数据到WebDAV
  async syncToWebDAV(filename = 'data.json') {
    if (this.isSyncing) {
      console.warn('Sync already in progress');
      return false;
    }

    this.isSyncing = true;
    this.#notifyListeners({ type: 'syncStart', direction: 'toWebDAV' });

    try {
      // 1. 从PouchDB获取数据(已转义的ID)
      const pouchData = await this.#getAllFromPouchDB();
      
      // 2. 转换数据格式为WebDAV格式
      const webDAVData = pouchData.map(doc => this.#convertToWebDAVFormat(doc));

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
  async syncFromWebDAV(filename = 'data.json') {
    if (this.isSyncing) {
      console.warn('Sync already in progress');
      return false;
    }

    this.isSyncing = true;
    this.#notifyListeners({ type: 'syncStart', direction: 'fromWebDAV' });

    try {
      // 1. 从WebDAV获取原始数据
      const webDAVData = await this.webDAVManager.load(filename);

      // 2. 转换数据格式为PouchDB格式
      const pouchData = webDAVData.map(doc => this.#convertToPouchDBFormat(doc));

      // 3. 获取当前PouchDB数据用于冲突检测
      const currentData = await this.#getAllFromPouchDB();
      const currentMap = new Map(currentData.map(doc => [doc._id, doc]));

      // 4. 合并数据
      const docsToSave = pouchData.map(remoteDoc => {
        const localDoc = currentMap.get(remoteDoc._id);
        
        // 冲突解决策略：保留最新修改的文档
        if (localDoc) {
          const remoteModified = remoteDoc._rev ? parseInt(remoteDoc._rev.split('-')[0]) : 0;
          const localModified = parseInt(localDoc._rev.split('-')[0]);
          
          if (localModified > remoteModified) {
            return localDoc; // 保留本地版本
          }
        }
        
        return remoteDoc;
      });

      // 4. 保存到PouchDB
      const result = await this.#saveToPouchDB(docsToSave);
      console.log(`Saved ${result.length} items to PouchDB`);

      this.lastSyncTime = new Date();
      this.#notifyListeners({ 
        type: 'syncComplete', 
        direction: 'fromWebDAV',
        count: docsToSave.length,
        timestamp: this.lastSyncTime
      });

      return true;
    } catch (error) {
      console.error('Error syncing from WebDAV:', error);
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

  // 双向同步
  // async fullSync(filename = 'data.json') {
  //   try {
  //     await this.syncFromWebDAV(filename);
  //     await this.syncToWebDAV(filename);
  //     return true;
  //   } catch (error) {
  //     console.error('Error during full sync:', error);
  //     throw error;
  //   }
  // }

  // 获取同步状态
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    };
  }
}