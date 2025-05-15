import { bookmarksDB } from '../../services/storage';
import { checkUrlValidity } from '../../utils/urlValidator';

const state = {
  bookmarks: [],
  loading: false,
  error: null
};

const getters = {
  allBookmarks: state => state.bookmarks,
  
  bookmarkById: state => id => {
    return state.bookmarks.find(bookmark => bookmark.id === id);
  },
  
  bookmarksByTag: state => tagId => {
    return state.bookmarks.filter(bookmark => bookmark.tagIds.includes(tagId));
  },
  
  recentBookmarks: state => {
    return [...state.bookmarks]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  },
  
  frequentBookmarks: state => {
    return [...state.bookmarks]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 5);
  },
  
  searchBookmarks: state => (query, tagFilter) => {
    if (!query && !tagFilter) return state.bookmarks;
    
    return state.bookmarks.filter(bookmark => {
      const matchesQuery = !query || 
        bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.description.toLowerCase().includes(query.toLowerCase());
        
      const matchesTag = !tagFilter || bookmark.tagIds.includes(tagFilter);
      
      return matchesQuery && matchesTag;
    });
  }
};

const actions = {
  async loadBookmarks({ commit }) {
    try {
      commit('setLoading', true);
      const result = await bookmarksDB.allDocs({ include_docs: true });
      const bookmarks = result.rows.map(row => row.doc);
      commit('setBookmarks', bookmarks);
    } catch (error) {
      commit('setError', error.message);
    } finally {
      commit('setLoading', false);
    }
  },

  async addBookmark({ commit }, bookmarkData) {
    try {
      commit('setLoading', true);
      
      const bookmark = {
        _id: Date.now().toString(),
        id: Date.now().toString(),
        title: bookmarkData.title,
        url: bookmarkData.url,
        description: bookmarkData.description || '',
        favicon: `${new URL(bookmarkData.url).origin}/favicon.ico`,
        tagIds: bookmarkData.tagIds || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastVisited: null,
        isValid: await checkUrlValidity(bookmarkData.url),
        visitCount: 0
      };
      
      await bookmarksDB.put(bookmark);
      commit('addBookmark', bookmark);
      return bookmark;
    } catch (error) {
      commit('setError', error.message);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  async updateBookmark({ commit, state }, { id, updates }) {
    try {
      commit('setLoading', true);
      
      const doc = await bookmarksDB.get(id);
      if (!doc) {
        throw new Error('Bookmark not found');
      }
      
      let isValid = doc.isValid;
      if (updates.url && updates.url !== doc.url) {
        isValid = await checkUrlValidity(updates.url);
      }
      
      const updatedBookmark = {
        ...doc,
        ...updates,
        isValid,
        updatedAt: new Date().toISOString()
      };
      
      await bookmarksDB.put(updatedBookmark);
      commit('updateBookmark', { id, updatedBookmark });
      return updatedBookmark;
    } catch (error) {
      commit('setError', error.message);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  async deleteBookmark({ commit }, id) {
    try {
      const doc = await bookmarksDB.get(id);
      await bookmarksDB.remove(doc);
      commit('deleteBookmark', id);
    } catch (error) {
      commit('setError', error.message);
    }
  },
  
  async visitBookmark({ commit, state }, id) {
    try {
      const doc = await bookmarksDB.get(id);
      if (doc) {
        const updatedBookmark = {
          ...doc,
          lastVisited: new Date().toISOString(),
          visitCount: doc.visitCount + 1,
          updatedAt: new Date().toISOString()
        };
        await bookmarksDB.put(updatedBookmark);
        commit('updateBookmark', { id, updatedBookmark });
      }
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
  
  setBookmarks(state, bookmarks) {
    state.bookmarks = bookmarks;
  },
  
  addBookmark(state, bookmark) {
    state.bookmarks.push(bookmark);
  },
  
  updateBookmark(state, { id, updatedBookmark }) {
    const index = state.bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      state.bookmarks.splice(index, 1, updatedBookmark);
    }
  },
  
  deleteBookmark(state, id) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== id);
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};