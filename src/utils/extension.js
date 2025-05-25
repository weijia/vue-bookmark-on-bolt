/**
 * 浏览器扩展工具函数
 */

// 防抖函数 - 通用工具
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 检查是否在浏览器扩展环境中运行
export function isExtensionEnvironment() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.runtime;
}

// 从chrome.storage.local获取书签数据
export async function getBookmarksFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      resolve(result.bookmarks || []);
    });
  });
}

// 更新单个书签到IndexedDB
export async function updateBookmarkInDB(store, bookmark) {
  const currentBookmarks = store.getters['bookmarks/allBookmarks'];
  const existingBookmark = currentBookmarks.find(b => b.url === bookmark.url);
  
  if (existingBookmark) {
    await store.dispatch('bookmarks/updateBookmark', {
      id: existingBookmark.id,
      updates: {
        title: bookmark.title,
        description: bookmark.description || '',
        tagIds: bookmark.tags || [],
        updatedAt: bookmark.updatedAt || new Date().toISOString()
      }
    });
  } else {
    const bookmarkData = {
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description || '',
      tagIds: bookmark.tags ? bookmark.tags.map(tag => typeof tag === 'string' ? tag : tag.id || tag) : [],
    };
    await store.dispatch('bookmarks/addBookmark', bookmarkData);
  }
}

// 批量同步所有书签到IndexedDB (高效版本)
export async function syncAllBookmarksFromChromeStorage(store) {
  try {
    await store.dispatch('bookmarks/loadBookmarks');
    const bookmarks = await getBookmarksFromStorage();
    
    if (Array.isArray(bookmarks)) {
      console.log('Bulk syncing bookmarks from chrome.storage.local to IndexedDB');
      
      // 批量添加/更新书签
      // await store.dispatch('bookmarks/bulkUpdateBookmarks', bookmarks);
      
      console.log('Bulk sync completed');
    }
  } catch (error) {
    console.warn('Failed to bulk sync bookmarks from chrome.storage.local:', error);
    throw error;
  }
}


// 初始化浏览器扩展消息监听
export function initExtensionMessageListener(store) {
  const debouncedSync = debounce(() => syncAllBookmarksFromChromeStorage(store), 1000);
  let isInitialSync = true;
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'BOOKMARKS_UPDATED') {
      debouncedSync();
    }
  });
  
  // 仅在页面首次加载时同步一次
  if (isInitialSync) {
    isInitialSync = false;
    debouncedSync();
  }
}