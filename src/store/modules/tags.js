import { escapeId } from '../../utils/idEscape';
import StorageService from '../../services/StorageService';
import { tagsDB } from '../../services/storage';

const state = {
  tags: [],
  loading: false,
  error: null
};

const getters = {
  allTags: (state, getters, rootState) => {
    // 统计每个标签的使用次数
    const tagCounts = {}
    rootState.bookmarks.bookmarks?.forEach(bookmark => {
      bookmark.tagIds?.forEach(tagId => {
        tagCounts[tagId] = (tagCounts[tagId] || 0) + 1
      })
    })
    
    // 返回带使用次数的标签列表
    return [...state.tags].map(tag => ({
      ...tag,
      count: tagCounts[tag.id] || 0
    }))
  },
  tagById: state => id => {
    // const escapedId = escapeId(id)
    return state.tags.find(tag => tag.id === id);
  },
  tagsInFilteredBookmarks: (state, getters, rootState, rootGetters) => {
    // 获取当前过滤出的书签
    const filteredBookmarks = rootGetters['bookmarks/filteredBookmarks'];
    
    // 如果没有过滤出书签，返回所有标签
    if (!filteredBookmarks || filteredBookmarks.length === 0) {
      return getters.allTags;
    }
    
    // 从过滤出的书签中提取所有唯一的标签ID
    const tagCounts = {};
    filteredBookmarks.forEach(bookmark => {
      if (bookmark.tagIds && Array.isArray(bookmark.tagIds)) {
        bookmark.tagIds.forEach(tagId => {
          tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
        });
      }
    });
    
    // 返回这些标签的详细信息
    return state.tags
      .filter(tag => tagCounts[tag.id])
      .map(tag => ({
        ...tag,
        count: tagCounts[tag.id] || 0
      }));
  }
};

const actions = {
  async syncWithRemote({ commit, state }, remoteTags) {
    try {
      commit('setLoading', true);
      console.log('Syncing tags with RemoteStorage:', remoteTags);
      
      // 如果remoteTags是空的，直接返回
      if (!remoteTags || Object.keys(remoteTags).length === 0) {
        console.log('No remote tags to sync');
        return { added: 0, updated: 0, unchanged: 0 };
      }
      
      // 处理远程标签数据
      const remoteTagsArray = Object.values(remoteTags);
      console.log(`Processing ${remoteTagsArray.length} remote tags`);
      
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      
      // 处理每个远程标签
      for (const remoteTag of remoteTagsArray) {
        try {
          // 检查标签数据是否有效
          if (!remoteTag.id) {
            console.warn('Skipping invalid remote tag (missing id):', remoteTag);
            continue;
          }
          
          // 检查标签是否已存在
          const existingTag = state.tags.find(t => t.id === remoteTag.id);
          
          if (!existingTag) {
            // 添加新标签 - 确保所有必需字段都存在
            const newTag = {
              _id: remoteTag.id,
              id: remoteTag.id,
              name: remoteTag.name || '未命名标签',
              color: remoteTag.color || '#3b82f6',
              createdAt: remoteTag.createdAt || Math.floor(Date.now() / 1000),
              updatedAt: remoteTag.updatedAt || Math.floor(Date.now() / 1000)
            };
            
            await tagsDB.put(newTag);
            commit('addTag', newTag);
            added++;
          } else {
            // 比较更新时间，决定是否更新
            const remoteUpdatedAt = typeof remoteTag.updatedAt === 'number' 
              ? remoteTag.updatedAt 
              : Math.floor(new Date(remoteTag.updatedAt || 0).getTime() / 1000);
            const localUpdatedAt = typeof existingTag.updatedAt === 'number'
              ? existingTag.updatedAt
              : Math.floor(new Date(existingTag.updatedAt || 0).getTime() / 1000);
            
            if (remoteUpdatedAt > localUpdatedAt) {
              // 远程版本更新，更新本地
              const updatedTag = {
                ...existingTag,
                ...remoteTag,
                _id: existingTag._id,
                _rev: existingTag._rev
              };
              
              await tagsDB.put(updatedTag);
              commit('updateTag', { id: updatedTag.id, updatedTag });
              updated++;
            } else {
              unchanged++;
            }
          }
        } catch (error) {
          console.error(`Error syncing tag ${remoteTag.id}:`, error);
        }
      }
      
      console.log(`Sync complete: ${added} added, ${updated} updated, ${unchanged} unchanged`);
      return { added, updated, unchanged };
    } catch (error) {
      console.error('Failed to sync with RemoteStorage:', error);
      commit('setError', `Failed to sync with RemoteStorage: ${error.message}`);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },

  async loadTags({ commit }) {
    try {
      commit('setLoading', true);
      const result = await tagsDB.allDocs({ include_docs: true });
      const tags = result.rows.map(row => row.doc);
      commit('setTags', tags);
    } catch (error) {
      commit('setError', error.message);
    } finally {
      commit('setLoading', false);
    }
  },

  async addTag({ commit, dispatch }, tagData) {
    try {
      // 如果提供了id，就使用它，否则生成新的UUID
      const uuid = tagData.id || crypto.randomUUID();
      const tag = {
        _id: uuid,
        id: uuid,
        name: tagData.name,
        color: tagData.color || '#3b82f6',
        createdAt: tagData.createdAt || Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000)
      };

      await tagsDB.put(tag);
      commit('addTag', tag);
      
      // 同步到WebDAV
      dispatch('syncToWebDAV');
      
      return tag;
    } catch (error) {
      commit('setError', error.message);
      throw error;
    }
  },
  
  async updateTag({ commit, dispatch }, { id, updates }) {
    try {
      const doc = await tagsDB.get(id);
      const updatedTag = {
        ...doc,
        ...updates,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      
      await tagsDB.put(updatedTag);
      commit('updateTag', { id, updatedTag });
      
      // 同步到WebDAV
      dispatch('syncToWebDAV');
    } catch (error) {
      commit('setError', error.message);
    }
  },
  
  async deleteTag({ commit, dispatch }, id) {
    try {
      const doc = await tagsDB.get(id);
      await tagsDB.remove(doc);
      
      // Remove tag from all bookmarks
      const bookmarks = await dispatch('bookmarks/loadBookmarks', null, { root: true });
      for (const bookmark of bookmarks) {
        if (bookmark.tagIds.includes(id)) {
          await dispatch('bookmarks/updateBookmark', {
            id: bookmark.id,
            updates: {
              tagIds: bookmark.tagIds.filter(tagId => tagId !== id)
            }
          }, { root: true });
        }
      }
      
      commit('deleteTag', id);
      
      // 同步到WebDAV
      dispatch('syncToWebDAV');
    } catch (error) {
      commit('setError', error.message);
    }
  },

  async importTags({ commit, state, dispatch }, tags) {
    try {
      commit('setLoading', true);
      let importedCount = 0;
      const errors = [];

      // 检查重复名称的tag
      const uniqueTags = [];
      tags.forEach(tag => {
        const existingTag = state.tags.find(t => t.name === tag.name);
        if (existingTag) {
          errors.push({
            tag,
            reason: `Tag with name "${tag.name}" already exists`
          });
        } else {
          uniqueTags.push(tag);
        }
      });

      let storageService = new StorageService();
      let result = await storageService.importTags(uniqueTags);

      console.log('Import result:', result);
      importedCount = result.savedCount || 0;
      if(result.errors) errors.push(...result.errors);

      let allTags = await storageService.getAllTags();
      commit('setTags', allTags);

      console.log({ importedCount, errors });
      return { 
        importedCount, 
        errors,
        skippedCount: tags.length - uniqueTags.length
      };
    } catch (error) {
      commit('setError', error.message);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  }
};

const mutations = {
  setLoading(state, status) {
    state.loading = status;
  },
  
  setError(state, error) {
    state.error = error;
  },
  
  setTags(state, tags) {
    state.tags = tags;
    // 同步到chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ tags: state.tags });
      } catch (error) {
        console.error('Error syncing to chrome.storage.local:', error);
      }
    }
    console.log('setTags: ', tags);
  },
  
  addTag(state, tag) {
    state.tags.push(tag);
  },
  
  updateTag(state, { id, updatedTag }) {
    const index = state.tags.findIndex(t => t.id === id);
    if (index !== -1) {
      state.tags.splice(index, 1, updatedTag);
    }
  },
  
  deleteTag(state, id) {
    state.tags = state.tags.filter(t => t.id !== id);
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};