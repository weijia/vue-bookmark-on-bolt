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
    return state.tags.find(tag => tag.id === id);
  }
};

const actions = {
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

  async addTag({ commit }, tagData) {
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
      return tag;
    } catch (error) {
      commit('setError', error.message);
      throw error;
    }
  },
  
  async updateTag({ commit }, { id, updates }) {
    try {
      const doc = await tagsDB.get(id);
      const updatedTag = {
        ...doc,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await tagsDB.put(updatedTag);
      commit('updateTag', { id, updatedTag });
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
    } catch (error) {
      commit('setError', error.message);
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