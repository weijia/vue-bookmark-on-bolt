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