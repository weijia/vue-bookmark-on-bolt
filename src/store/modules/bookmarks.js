import { bookmarksDB, syncDataToWebDAV } from '../../services/storage';
import { checkUrlValidity } from '../../utils/urlValidator';
import { escapeId } from '../../utils/idEscape';

const state = {
  bookmarks: [],
  loading: false,
  error: null,
  isForceValid: true,
  searchQuery: '',
  selectedTags: []
};

const getters = {
  allBookmarks: state => state.bookmarks,
  
  bookmarkById: state => id => {
    const escapedId = escapeId(id);
    return state.bookmarks.find(bookmark => bookmark.id === escapedId);
  },
  
  bookmarksByTag: state => tagId => {
    const escapedTagId = escapeId(tagId);
    console.log('escapedTagId:', escapedTagId);
    return state.bookmarks.filter(bookmark => 
      bookmark.tagIds.includes(escapedTagId)
    );
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
  },
  
  filteredBookmarks: (state) => {
    const bookmarks = state.bookmarks || [];
    const searchQuery = state.searchQuery;
    const selectedTags = state.selectedTags;
    
    if (!searchQuery && (!selectedTags || selectedTags.length === 0)) {
      return bookmarks;
    }
    
    return bookmarks.filter(bookmark => {
      const matchesQuery = !searchQuery || 
        bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bookmark.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bookmark.description.toLowerCase().includes(searchQuery.toLowerCase());
        
      const matchesTags = !selectedTags || selectedTags.length === 0 || 
        selectedTags.some(tagId => bookmark.tagIds.includes(tagId));
      
      return matchesQuery && matchesTags;
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

  async addBookmark({ commit, dispatch }, bookmarkData) {
    try {
      commit('setLoading', true);
      const uuid = crypto.randomUUID(); // 生成 UUID
      const bookmark = {
        _id: uuid, // 使用 UUID 作为 _id
        id: uuid, // 使用 UUID 作为 id
        title: bookmarkData.title,
        url: bookmarkData.url,
        description: bookmarkData.description || '',
        favicon: `${new URL(bookmarkData.url).origin}/favicon.ico`,
        tagIds: bookmarkData.tagIds || [],
        folderId: bookmarkData.folderId || 'my', // 默认文件夹ID
        topUpTime: bookmarkData.topUpTime || 0, // 置顶时间
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastVisited: null,
        isValid: state.isForceValid ? true : await checkUrlValidity(bookmarkData.url),
        visitCount: 0
      };
      
      await bookmarksDB.put(bookmark);
      commit('addBookmark', bookmark);
      
      // 同步到WebDAV
      dispatch('syncToWebDAV');
      
      return bookmark;
    } catch (error) {
      commit('setError', error.message);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  async updateBookmark({ commit, state, dispatch }, { id, updates }) {
    try {
      commit('setLoading', true);
      
      const escapedId = escapeId(id);
      const doc = await bookmarksDB.get(escapedId);
      if (!doc) {
        throw new Error('Bookmark not found');
      }
      
      let isValid = state.isForceValid ? true : doc.isValid;
      if (!state.isForceValid && updates.url && updates.url !== doc.url) {
        isValid = await checkUrlValidity(updates.url);
      }
      
      const updatedBookmark = {
        ...doc,
        ...updates,
        isValid,
        updatedAt: new Date().toISOString()
      };
      
      await bookmarksDB.put(updatedBookmark);
      commit('updateBookmark', { id: escapedId, updatedBookmark });
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
      const escapedId = escapeId(id);
      const doc = await bookmarksDB.get(escapedId);
      await bookmarksDB.remove(doc);
      commit('deleteBookmark', escapedId);
    } catch (error) {
      commit('setError', error.message);
    }
  },
  
  async visitBookmark({ commit, state }, id) {
    try {
      const escapedId = escapeId(id);
      const doc = await bookmarksDB.get(escapedId);
      if (doc) {
        const updatedBookmark = {
          ...doc,
          lastVisited: new Date().toISOString(),
          visitCount: doc.visitCount + 1,
          updatedAt: new Date().toISOString()
        };
        await bookmarksDB.put(updatedBookmark);
        commit('updateBookmark', { id: escapedId, updatedBookmark });
      }
    } catch (error) {
      commit('setError', error.message);
    }
  },
  
  async syncToWebDAV({ state, rootState }) {
    try {
      // 获取所有书签，移除PouchDB特定字段
      const bookmarks = state.bookmarks.map(bookmark => {
        const { _id, _rev, ...cleanBookmark } = bookmark;
        return cleanBookmark;
      });

      // 获取所有标签
      const tags = rootState.tags.tags.map(tag => {
        const { _id, _rev, ...cleanTag } = tag;
        return cleanTag;
      });

      // 同步到WebDAV
      await syncDataToWebDAV(bookmarks, tags);
      
      return true;
    } catch (error) {
      console.error('Failed to sync to WebDAV:', error);
      throw error;
    }
  },

  async importBookmarks({ commit, state, dispatch }, bookmarks) {
    try {
      commit('setLoading', true);
      let importedCount = 0;
      const errors = [];
      
      // 处理每个书签
      for (const bookmarkData of bookmarks) {
        try {
          // 确保书签有必要的字段
          if (!bookmarkData.url) {
            errors.push(`Bookmark missing URL: ${bookmarkData.title || 'Untitled'}`);
            continue;
          }
          
          // 检查书签是否已存在
          const existingBookmark = state.bookmarks.find(b => 
            b.url === bookmarkData.url || (bookmarkData.id && b.id === bookmarkData.id)
          );
          
          if (existingBookmark) {
            // 如果已存在，可以选择更新或跳过
            continue;
          }
          
          // 准备书签数据
          const uuid = bookmarkData.id || crypto.randomUUID();
          
          // 处理时间戳 - 支持Unix时间戳（数字）或ISO字符串
          const createdAt = bookmarkData.createdAt 
            ? (typeof bookmarkData.createdAt === 'number' 
                ? new Date(bookmarkData.createdAt * 1000).toISOString() 
                : bookmarkData.createdAt)
            : new Date().toISOString();
            
          const updatedAt = bookmarkData.updatedAt
            ? (typeof bookmarkData.updatedAt === 'number'
                ? new Date(bookmarkData.updatedAt * 1000).toISOString()
                : bookmarkData.updatedAt)
            : new Date().toISOString();
          
          // 支持潮汐收藏格式（name -> title, icon -> favicon）
          const title = bookmarkData.title || bookmarkData.name || 'Untitled';
          const favicon = bookmarkData.favicon || bookmarkData.icon || `${new URL(bookmarkData.url).origin}/favicon.ico`;
          
          // 创建基本书签对象
          const bookmark = {
            _id: uuid,
            id: uuid,
            title: title,
            url: bookmarkData.url,
            description: bookmarkData.description || '',
            favicon: favicon,
            tagIds: bookmarkData.tagIds || [],
            folderId: bookmarkData.folderId || 'my',
            topUpTime: bookmarkData.topUpTime || 0,
            createdAt: createdAt,
            updatedAt: updatedAt,
            lastVisited: bookmarkData.lastVisited || null,
            isValid: bookmarkData.isValid !== undefined ? bookmarkData.isValid : await checkUrlValidity(bookmarkData.url),
            visitCount: bookmarkData.visitCount || 0
          };
          
          // 动态添加其他字段（排除已处理的基本字段）
          const processedFields = ['_id', 'id', 'title', 'name', 'url', 'description', 'favicon', 'icon', 
                                  'tagIds', 'folderId', 'topUpTime', 'createdAt', 'updatedAt', 
                                  'lastVisited', 'isValid', 'visitCount'];
          
          Object.keys(bookmarkData).forEach(key => {
            if (!processedFields.includes(key)) {
              bookmark[key] = bookmarkData[key];
            }
          });
          
          // 保存到数据库
          await bookmarksDB.put(bookmark);
          commit('addBookmark', bookmark);
          importedCount++;
        } catch (error) {
          errors.push(`Error importing bookmark: ${error.message}`);
        }
      }
      
      return { importedCount, errors };
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
  
  setBookmarks(state, bookmarks) {
    state.bookmarks = bookmarks || [];
  },
  
  addBookmark(state, bookmark) {
    state.bookmarks.push(bookmark);
  },
  
  updateBookmark(state, { id, updatedBookmark }) {
    const escapedId = escapeId(id);
    const index = state.bookmarks.findIndex(b => b.id === escapedId);
    if (index !== -1) {
      state.bookmarks.splice(index, 1, updatedBookmark);
    }
  },

  deleteBookmark(state, id) {
    const escapedId = escapeId(id);
    state.bookmarks = state.bookmarks.filter(b => b.id !== escapedId);
  },
  
  setIsForceValid(state, value) {
    state.isForceValid = value;
  },
  
  setSearchQuery(state, query) {
    state.searchQuery = query;
  },
  
  setSelectedTags(state, tags) {
    state.selectedTags = tags;
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};