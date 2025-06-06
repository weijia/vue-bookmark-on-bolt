import StorageService from './StorageService'
import { escapeId, unescapeId } from '../utils/idEscape';

  // 字段名映射配置
const FIELD_MAPPING = {
    pouchToWebDAV: {
      'title': 'name',
      'favicon': 'icon'
    },
    webDAVToPouch: {
      'name': 'title',
      'icon': 'favicon'
    }
  };
  
export default class PouchDbTideMarkSync {
  constructor() {
    this.storage = new StorageService();
    this.bookmarksDB = null;
    this.tagsDB = null;
  }

  escapeDocId(doc) {
    if (doc.id) {
      doc._id = escapeId(doc.id);
    }
    return doc;
  }

  unescapeDocId(doc) {
  if (doc._id) {
      doc.id = unescapeId(doc._id);
    }
    return doc;
  }
  // 将PouchDB文档转换为WebDAV格式
  convertToWebDAVFormat(pouchDoc) {
    const webDAVDoc = {};
    // 转换字段名
    for (const key in pouchDoc) {
      if (FIELD_MAPPING.pouchToWebDAV[key]) {
        webDAVDoc[FIELD_MAPPING.pouchToWebDAV[key]] = pouchDoc[key];
      } else {
        webDAVDoc[key] = pouchDoc[key];
      }
    }
    return this.unescapeDocId(webDAVDoc);
  }

  // 将WebDAV文档转换为PouchDB格式
  convertToPouchDBFormat(webDAVDoc) {
    const pouchDoc = {};
    // 转换字段名
    for (const key in webDAVDoc) {
      if (FIELD_MAPPING.webDAVToPouch[key]) {
        pouchDoc[FIELD_MAPPING.webDAVToPouch[key]] = webDAVDoc[key];
      } else {
        pouchDoc[key] = webDAVDoc[key];
      }
    }
    // pouchDoc['_id'] = webDAVDoc.id;
    return this.escapeDocId(pouchDoc);
  }

  async importBookmarks(webDavData) {
    const pouchData = webDavData.map(doc => this.convertToPouchDBFormat(doc));
    return this.storage.importBookmarks(pouchData);
  }

  async importTags(webDavData) {
    const pouchData = webDavData.map(doc => this.escapeDocId(doc));
    return this.storage.importTags(pouchData);
  }

  async getAllTags() {
    return await this.storage.getAllTags();
  }

  async getAllBookmarks() {
    return await this.storage.getAllBookmarks();
  }
}
