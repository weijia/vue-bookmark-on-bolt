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

  bookmarkByUrl: state => url => {
    return state.bookmarks.find(bookmark => bookmark.url === url);
  },
  
  bookmarksByTag: state => tagId => {
    const escapedTagId = escapeId(tagId);
    // console.log('escapedTagId:', escapedTagId);
    return state.bookmarks.filter(bookmark => 
      bookmark.tagIds?bookmark.tagIds.includes(escapedTagId):false
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
      
      // 同步到chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const bookmarks = state.bookmarks;
        console.log('[addBookmark] Syncing to chrome.storage.local', bookmarks.length, 'bookmarks');
        try {
          await chrome.storage.local.set({ bookmarks });
          const result = await chrome.storage.local.get('bookmarks');
          console.log('[addBookmark] Storage verification', result.bookmarks?.length || 0, 'bookmarks stored');
        } catch (error) {
          console.error('[addBookmark] Storage sync error:', error);
        }
      }
      
      // 通知service worker更新图标状态
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'BOOKMARKS_UPDATED' });
      }
      
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
      
      // 同步到chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const bookmarks = state.bookmarks;
        console.log('[updateBookmark] Syncing to chrome.storage.local', {
          bookmarksCount: bookmarks.length,
          firstBookmark: bookmarks[0] ? {id: bookmarks[0].id, url: bookmarks[0].url} : null,
          storageAvailable: !!chrome.storage.local
        });
        
        try {
          await chrome.storage.local.set({ bookmarks });
          console.log('[updateBookmark] Successfully stored bookmarks in chrome.storage.local');
          
          // 验证存储
          const result = await chrome.storage.local.get('bookmarks');
          console.log('[updateBookmark] Storage verification result:', {
            storedCount: result.bookmarks?.length || 0,
            firstStored: result.bookmarks?.[0] ? {id: result.bookmarks[0].id, url: result.bookmarks[0].url} : null,
            keysInStorage: Object.keys(result)
          });
        } catch (error) {
          console.error('[updateBookmark] Error syncing to chrome.storage.local:', error);
        }
      }
      
      // 通知service worker更新图标状态
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'BOOKMARKS_UPDATED' });
      }
      
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
      
      // 同步到chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const bookmarks = state.bookmarks;
        console.log('[deleteBookmark] Syncing to chrome.storage.local', {
          bookmarksCount: bookmarks.length,
          firstBookmark: bookmarks[0] ? {id: bookmarks[0].id, url: bookmarks[0].url} : null,
          storageAvailable: !!chrome.storage.local
        });
        
        try {
          await chrome.storage.local.set({ bookmarks });
          console.log('[deleteBookmark] Successfully stored bookmarks in chrome.storage.local');
          
          // 验证存储
          const result = await chrome.storage.local.get('bookmarks');
          console.log('[deleteBookmark] Storage verification result:', {
            storedCount: result.bookmarks?.length || 0,
            firstStored: result.bookmarks?.[0] ? {id: result.bookmarks[0].id, url: result.bookmarks[0].url} : null,
            keysInStorage: Object.keys(result)
          });
        } catch (error) {
          console.error('[deleteBookmark] Error syncing to chrome.storage.local:', error);
        }
      }
      
      // 通知service worker更新图标状态
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'BOOKMARKS_UPDATED' });
      }
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

  async syncToWebDAV({ state, rootState, dispatch }) {
    try {
      // 获取本地数据，移除PouchDB特定字段
      const localBookmarks = state.bookmarks.map(bookmark => {
        const { _id, _rev, ...cleanBookmark } = bookmark;
        return cleanBookmark;
      });

      const localTags = rootState.tags.tags.map(tag => {
        const { _id, _rev, ...cleanTag } = tag;
        return cleanTag;
      });

      // 从WebDAV加载远程数据
      let remoteBookmarks = [];
      let remoteTags = [];
      try {
        const remoteData = await dispatch('loadFromWebDAV');
        remoteBookmarks = remoteData?.bookmarks || [];
        remoteTags = remoteData?.tags || [];
      } catch (error) {
        console.warn('Error loading from WebDAV:', error);
      }

      // 合并数据
      const mergeItems = (localItems, remoteItems) => {
        const mergedMap = new Map();

        // 先添加远程数据
        remoteItems.forEach(item => {
          if (item && item.id) {
            mergedMap.set(item.id, { ...item });
          }
        });

        // 然后添加或更新本地数据
        localItems.forEach(item => {
          if (item && item.id) {
            const existingItem = mergedMap.get(item.id);
            if (!existingItem ||
                (item.updatedAt && existingItem.updatedAt &&
                 new Date(item.updatedAt) > new Date(existingItem.updatedAt))) {
              mergedMap.set(item.id, { ...item });
            }
          }
        });

        return Array.from(mergedMap.values());
      };

      const mergedBookmarks = mergeItems(localBookmarks, remoteBookmarks);
      const mergedTags = mergeItems(localTags, remoteTags);

      console.log(`Merged data: bookmarks(${localBookmarks.length} local + ${remoteBookmarks.length} remote = ${mergedBookmarks.length} merged)`);
      console.log(`Merged data: tags(${localTags.length} local + ${remoteTags.length} remote = ${mergedTags.length} merged)`);

      // 保存合并后的数据到WebDAV
      await syncDataToWebDAV(mergedBookmarks, mergedTags);

      return true;
    } catch (error) {
      console.error('Failed to sync to WebDAV:', error);
      throw error;
    }
  },

  async syncWithRemote({ commit, state }, remoteBookmarks) {
    try {
      commit('setLoading', true);
      console.log('Syncing bookmarks with RemoteStorage:', remoteBookmarks);
      
      // 如果remoteBookmarks是空的，直接返回
      if (!remoteBookmarks || Object.keys(remoteBookmarks).length === 0) {
        console.log('No remote bookmarks to sync');
        return { added: 0, updated: 0, unchanged: 0 };
      }
      
      // 处理远程书签数据
      const remoteBookmarksArray = Object.values(remoteBookmarks);
      console.log(`Processing ${remoteBookmarksArray.length} remote bookmarks`);
      
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      
      // 处理每个远程书签
      for (const remoteBookmark of remoteBookmarksArray) {
        try {
          // 检查书签数据是否有效
          if (!remoteBookmark.id) {
            console.warn('Skipping invalid remote bookmark (missing id):', remoteBookmark);
            continue;
          }
          
          // 检查书签是否已存在
          const existingBookmark = state.bookmarks.find(b => b.id === remoteBookmark.id);
          
          if (!existingBookmark) {
            // 添加新书签 - 确保所有必需字段都存在
            const newBookmark = {
              _id: remoteBookmark.id,
              id: remoteBookmark.id,
              title: remoteBookmark.title || '未命名书签',
              url: remoteBookmark.url || '',
              tags: remoteBookmark.tags || [],
              createdAt: remoteBookmark.createdAt || new Date().toISOString(),
              updatedAt: remoteBookmark.updatedAt || new Date().toISOString()
            };
            
            await bookmarksDB.put(newBookmark);
            commit('addBookmark', newBookmark);
            added++;
          } else {
            // 比较更新时间，决定是否更新
            const remoteUpdatedAt = new Date(remoteBookmark.updatedAt || 0);
            const localUpdatedAt = new Date(existingBookmark.updatedAt || 0);
            
            if (remoteUpdatedAt > localUpdatedAt) {
              // 远程版本更新，更新本地
              const updatedBookmark = {
                ...existingBookmark,
                ...remoteBookmark,
                _id: existingBookmark._id,
                _rev: existingBookmark._rev
              };
              
              await bookmarksDB.put(updatedBookmark);
              commit('updateBookmark', { id: updatedBookmark.id, updatedBookmark });
              updated++;
            } else {
              unchanged++;
            }
          }
        } catch (error) {
          console.error(`Error syncing bookmark ${remoteBookmark.id}:`, error);
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
  
  async importBookmarks({ commit, state, dispatch }, bookmarks) {
    try {
      commit('setLoading', true);
      let importedCount = 0;
      const errors = [];
      
      dispatch('bulkUpdateBookmarks', bookmarks);
      
      return { importedCount, errors };
    } catch (error) {
      commit('setError', error.message);
      throw error;
    } finally {
      commit('setLoading', false);
    }
  },
  
  async bulkUpdateBookmarks({ commit, state }, bookmarks) {
    try {
      commit('setLoading', true);
      
      // 获取当前书签映射(以id为key)
      const currentBookmarks = state.bookmarks;
      const bookmarksMap = new Map(currentBookmarks.map(b => [b.id, b]));
      
      const updates = [];
      const newBookmarks = [];
      
      // 处理批量书签
      for (const bookmark of bookmarks) {
        if (!bookmark.id) continue;
        
        const existing = bookmarksMap.get(bookmark.id);
        if (existing) {
          // 更新现有书签
          const updated = {
            ...existing,
            ...bookmark,
            _id: existing._id,
            _rev: existing._rev,
            updatedAt: new Date().toISOString()
          };
          updates.push(updated);
          commit('updateBookmark', { id: existing.id, updatedBookmark: updated });
        } else {
          // 添加新书签
          const newId = bookmark.id || crypto.randomUUID();
          const newBookmark = {
            _id: newId,
            id: newId,
            title: bookmark.title || '未命名书签',
            url: bookmark.url,
            description: bookmark.description || '',
            favicon: bookmark.favicon || `${new URL(bookmark.url).origin}/favicon.ico`,
            tagIds: bookmark.tagIds || [],
            folderId: bookmark.folderId || 'my',
            topUpTime: bookmark.topUpTime || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastVisited: null,
            isValid: state.isForceValid ? true : await checkUrlValidity(bookmark.url),
            visitCount: 0
          };
          updates.push(newBookmark);
          newBookmarks.push(newBookmark);
        }
      }
      
      // 批量写入IndexedDB
      if (updates.length > 0) {
        await bookmarksDB.bulkDocs(updates);
      }
      
      // 批量添加新书签
      if (newBookmarks.length > 0) {
        commit('setBookmarks', [...currentBookmarks, ...newBookmarks]);
      }
      
      // 同步到chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          await chrome.storage.local.set({ bookmarks: state.bookmarks });
        } catch (error) {
          console.error('Error syncing to chrome.storage.local:', error);
        }
      }
      
      return { updated: updates.length - newBookmarks.length, added: newBookmarks.length };
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