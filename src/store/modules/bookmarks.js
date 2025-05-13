import { checkUrlValidity } from '../../utils/urlValidator'

// Initial state with some demo bookmarks
const initialState = {
  bookmarks: [
    {
      id: '1',
      title: 'Google',
      url: 'https://www.google.com',
      description: 'Search engine',
      favicon: 'https://www.google.com/favicon.ico',
      tagIds: ['1', '4'],
      createdAt: new Date('2025-01-10').toISOString(),
      lastVisited: new Date('2025-03-15').toISOString(),
      isValid: true,
      visitCount: 42
    },
    {
      id: '2',
      title: 'GitHub',
      url: 'https://github.com',
      description: 'Code hosting platform',
      favicon: 'https://github.com/favicon.ico',
      tagIds: ['2'],
      createdAt: new Date('2025-01-15').toISOString(),
      lastVisited: new Date('2025-03-10').toISOString(),
      isValid: true,
      visitCount: 28
    },
    {
      id: '3',
      title: 'Vue.js',
      url: 'https://vuejs.org',
      description: 'Progressive JavaScript Framework',
      favicon: 'https://vuejs.org/logo.png',
      tagIds: ['2', '3'],
      createdAt: new Date('2025-02-05').toISOString(),
      lastVisited: new Date('2025-03-01').toISOString(),
      isValid: true,
      visitCount: 15
    }
  ],
  loading: false,
  error: null
}

// Load bookmarks from localStorage if available
const savedBookmarks = localStorage.getItem('bookmarks')
const state = savedBookmarks ? JSON.parse(savedBookmarks) : initialState

const getters = {
  allBookmarks: state => state.bookmarks,
  
  bookmarkById: state => id => {
    return state.bookmarks.find(bookmark => bookmark.id === id)
  },
  
  bookmarksByTag: state => tagId => {
    return state.bookmarks.filter(bookmark => bookmark.tagIds.includes(tagId))
  },
  
  recentBookmarks: state => {
    return [...state.bookmarks]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
  },
  
  frequentBookmarks: state => {
    return [...state.bookmarks]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 5)
  },
  
  searchBookmarks: state => (query, tagFilter) => {
    if (!query && !tagFilter) return state.bookmarks
    
    return state.bookmarks.filter(bookmark => {
      const matchesQuery = !query || 
        bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.url.toLowerCase().includes(query.toLowerCase()) ||
        bookmark.description.toLowerCase().includes(query.toLowerCase())
        
      const matchesTag = !tagFilter || bookmark.tagIds.includes(tagFilter)
      
      return matchesQuery && matchesTag
    })
  }
}

const actions = {
  async addBookmark({ commit }, bookmarkData) {
    try {
      commit('setLoading', true)
      
      // Generate id and default values
      const bookmark = {
        id: Date.now().toString(),
        title: bookmarkData.title,
        url: bookmarkData.url,
        description: bookmarkData.description || '',
        favicon: `${new URL(bookmarkData.url).origin}/favicon.ico`,
        tagIds: bookmarkData.tagIds || [],
        createdAt: new Date().toISOString(),
        lastVisited: null,
        isValid: await checkUrlValidity(bookmarkData.url),
        visitCount: 0
      }
      
      commit('addBookmark', bookmark)
      return bookmark
    } catch (error) {
      commit('setError', error.message)
      throw error
    } finally {
      commit('setLoading', false)
    }
  },
  
  async updateBookmark({ commit, state }, { id, updates }) {
    try {
      commit('setLoading', true)
      
      // Find the bookmark
      const bookmark = state.bookmarks.find(b => b.id === id)
      if (!bookmark) {
        throw new Error('Bookmark not found')
      }
      
      // Check URL validity if URL is being updated
      let isValid = bookmark.isValid
      if (updates.url && updates.url !== bookmark.url) {
        isValid = await checkUrlValidity(updates.url)
      }
      
      const updatedBookmark = {
        ...bookmark,
        ...updates,
        isValid
      }
      
      commit('updateBookmark', { id, updatedBookmark })
      return updatedBookmark
    } catch (error) {
      commit('setError', error.message)
      throw error
    } finally {
      commit('setLoading', false)
    }
  },
  
  deleteBookmark({ commit }, id) {
    commit('deleteBookmark', id)
  },
  
  visitBookmark({ commit, state }, id) {
    const bookmark = state.bookmarks.find(b => b.id === id)
    if (bookmark) {
      const updatedBookmark = {
        ...bookmark,
        lastVisited: new Date().toISOString(),
        visitCount: bookmark.visitCount + 1
      }
      commit('updateBookmark', { id, updatedBookmark })
    }
  },
  
  async checkAllBookmarksValidity({ commit, state }) {
    try {
      commit('setLoading', true)
      
      // Check each bookmark's URL validity
      for (const bookmark of state.bookmarks) {
        const isValid = await checkUrlValidity(bookmark.url)
        if (isValid !== bookmark.isValid) {
          commit('updateBookmark', { 
            id: bookmark.id, 
            updatedBookmark: { ...bookmark, isValid } 
          })
        }
      }
    } catch (error) {
      commit('setError', error.message)
    } finally {
      commit('setLoading', false)
    }
  },
  
  importBookmarks({ commit }, bookmarks) {
    commit('importBookmarks', bookmarks)
  }
}

const mutations = {
  setLoading(state, status) {
    state.loading = status
  },
  
  setError(state, error) {
    state.error = error
  },
  
  addBookmark(state, bookmark) {
    state.bookmarks.push(bookmark)
    localStorage.setItem('bookmarks', JSON.stringify(state))
  },
  
  updateBookmark(state, { id, updatedBookmark }) {
    const index = state.bookmarks.findIndex(b => b.id === id)
    if (index !== -1) {
      state.bookmarks.splice(index, 1, updatedBookmark)
      localStorage.setItem('bookmarks', JSON.stringify(state))
    }
  },
  
  deleteBookmark(state, id) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== id)
    localStorage.setItem('bookmarks', JSON.stringify(state))
  },
  
  importBookmarks(state, bookmarks) {
    state.bookmarks = [...state.bookmarks, ...bookmarks]
    localStorage.setItem('bookmarks', JSON.stringify(state))
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}