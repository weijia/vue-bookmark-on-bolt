import { tagsDB, syncDataToWebDAV } from '../../services/storage';
import { escapeId } from '../../utils/idEscape';

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
    const escapedId = escapeId(id)
    return state.tags.find(tag => tag.id === escapedId);
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
              createdAt: remoteTag.createdAt || new Date().toISOString(),
              updatedAt: remoteTag.updatedAt || new Date().toISOString()
            };
            
            await tagsDB.put(newTag);
            commit('addTag', newTag);
            added++;
          } else {
            // 比较更新时间，决定是否更新
            const remoteUpdatedAt = new Date(remoteTag.updatedAt || 0);
            const localUpdatedAt = new Date(existingTag.updatedAt || 0);
            
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

  async syncToWebDAV({ state, rootState }) {
    try {
      // 获取所有标签，移除PouchDB特定字段
      const tags = state.tags.map(tag => {
        const { _id, _rev, ...cleanTag } = tag;
        return cleanTag;
      });

      // 获取所有书签
      const bookmarks = rootState.bookmarks.bookmarks.map(bookmark => {
        const { _id, _rev, ...cleanBookmark } = bookmark;
        return cleanBookmark;
      });

      // 同步到WebDAV
      await syncDataToWebDAV(bookmarks, tags);
      
      return true;
    } catch (error) {
      console.error('Failed to sync tags to WebDAV:', error);
      throw error;
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
        createdAt: tagData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        updatedAt: new Date().toISOString()
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
      const importedTags = [];
      const processedFields = ['_id', 'id', 'name', 'color', 'createdAt', 'updatedAt'];

      for (const tagData of tags) {
        // 使用现有ID或生成新的UUID
        const uuid = tagData.id?escapeId(tagData.id):crypto.randomUUID();
        
        // 处理时间戳 - 支持Unix时间戳（数字）或ISO字符串
        const createdAt = tagData.createdAt 
          ? (typeof tagData.createdAt === 'number' 
              ? new Date(tagData.createdAt * 1000).toISOString() 
              : tagData.createdAt)
          : new Date().toISOString();
          
        const updatedAt = tagData.updatedAt
          ? (typeof tagData.updatedAt === 'number'
              ? new Date(tagData.updatedAt * 1000).toISOString()
              : tagData.updatedAt)
          : new Date().toISOString();

        // 创建基本标签对象
        const tag = {
          _id: uuid,
          id: uuid,
          name: tagData.name,
          color: tagData.color || '#3b82f6',
          createdAt: createdAt,
          updatedAt: updatedAt
        };

        // 动态添加其他字段
        Object.keys(tagData).forEach(key => {
          if (!processedFields.includes(key)) {
            tag[key] = tagData[key];
          }
        });

        // 检查标签是否已存在
        const existingTag = state.tags.find(t => t.id === uuid);
        if (existingTag) {
          // 更新现有标签
          await tagsDB.put({
            ...existingTag,
            ...tag,
            updatedAt: new Date().toISOString()
          });
          commit('updateTag', { id: uuid, updatedTag: tag });
        } else {
          // 添加新标签
          await tagsDB.put(tag);
          commit('addTag', tag);
        }
        
        importedTags.push(tag);
      }

      return importedTags;
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