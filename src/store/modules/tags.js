// Initial state with some demo tags
const initialState = {
  tags: [
    { id: '1', name: 'Work', color: '#3b82f6' },
    { id: '2', name: 'Development', color: '#10b981' },
    { id: '3', name: 'Learning', color: '#f97316' },
    { id: '4', name: 'Personal', color: '#8b5cf6' }
  ]
}

// Load tags from localStorage if available
const savedTags = localStorage.getItem('tags')
const state = savedTags ? JSON.parse(savedTags) : initialState

const getters = {
  allTags: state => state.tags,
  
  tagById: state => id => {
    return state.tags.find(tag => tag.id === id)
  }
}

const actions = {
  addTag({ commit }, tagData) {
    const tag = {
      id: Date.now().toString(),
      name: tagData.name,
      color: tagData.color || '#3b82f6'
    }
    
    commit('addTag', tag)
    return tag
  },
  
  updateTag({ commit }, { id, updates }) {
    commit('updateTag', { id, updates })
  },
  
  deleteTag({ commit, rootState }, id) {
    // Remove tag from all bookmarks first
    const bookmarks = rootState.bookmarks.bookmarks
    const updatedBookmarks = bookmarks.map(bookmark => {
      if (bookmark.tagIds.includes(id)) {
        return {
          ...bookmark,
          tagIds: bookmark.tagIds.filter(tagId => tagId !== id)
        }
      }
      return bookmark
    })
    
    // Update bookmarks
    for (const bookmark of updatedBookmarks) {
      if (!bookmark.tagIds.includes(id)) {
        commit('bookmarks/updateBookmark', 
          { id: bookmark.id, updatedBookmark: bookmark }, 
          { root: true }
        )
      }
    }
    
    // Then delete the tag
    commit('deleteTag', id)
  }
}

const mutations = {
  addTag(state, tag) {
    state.tags.push(tag)
    localStorage.setItem('tags', JSON.stringify(state))
  },
  
  updateTag(state, { id, updates }) {
    const index = state.tags.findIndex(t => t.id === id)
    if (index !== -1) {
      state.tags[index] = { ...state.tags[index], ...updates }
      localStorage.setItem('tags', JSON.stringify(state))
    }
  },
  
  deleteTag(state, id) {
    state.tags = state.tags.filter(t => t.id !== id)
    localStorage.setItem('tags', JSON.stringify(state))
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}