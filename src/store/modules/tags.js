import { tagsDB } from '../../services/storage';

const state = {
  tags: [],
  loading: false,
  error: null
};

const getters = {
  allTags: state => state.tags,
  
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
      const tag = {
        _id: Date.now().toString(),
        id: Date.now().toString(),
        name: tagData.name,
        color: tagData.color || '#3b82f6',
        createdAt: new Date().toISOString(),
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