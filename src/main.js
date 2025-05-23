import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/css/styles.css'
import { getSyncFunction } from './services/syncService'

Vue.config.productionTip = false

// 从chrome.storage.local同步书签到IndexedDB
async function syncBookmarksFromChromeStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      // 等待store初始化完成
      await store.dispatch('bookmarks/loadBookmarks');
      
      // 获取chrome.storage.local中的书签
      chrome.storage.local.get(['bookmarks'], async (result) => {
        if (result.bookmarks && Array.isArray(result.bookmarks)) {
          console.log('Syncing bookmarks from chrome.storage.local to IndexedDB');
          
          // 获取当前IndexedDB中的所有书签
          const currentBookmarks = store.getters['bookmarks/allBookmarks'];
          
          // 处理每个书签
          for (const bookmark of result.bookmarks) {
            // 检查书签是否已存在
            const existingBookmark = currentBookmarks.find(b => b.url === bookmark.url);
            
            if (existingBookmark) {
              // 更新现有书签
              await store.dispatch('bookmarks/updateBookmark', {
                id: existingBookmark.id,
                updates: {
                  title: bookmark.title,
                  description: bookmark.description || '',
                  tagIds: bookmark.tags || [], // 注意：chrome.storage中使用tags，而store中使用tagIds
                  updatedAt: bookmark.updatedAt || new Date().toISOString()
                }
              });
            } else {
              // 添加新书签
              const bookmarkData = {
                title: bookmark.title,
                url: bookmark.url,
                description: bookmark.description || '',
                tagIds: bookmark.tags ? bookmark.tags.map(tag => typeof tag === 'string' ? tag : tag.id || tag) : [],
              };
              await store.dispatch('bookmarks/addBookmark', bookmarkData);
            }
          }
          
          console.log('Sync completed');
        }
      });
    } catch (error) {
      console.error('Failed to sync bookmarks from chrome.storage.local:', error);
    }
  }
}

// 监听书签更新通知
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'BOOKMARKS_UPDATED') {
      // 当收到书签更新通知时，同步书签
      syncBookmarksFromChromeStorage();
    }
  });
  
  // 页面加载时同步一次
  syncBookmarksFromChromeStorage();
}

// 初始化全局RemoteStorage实例
const initRemoteStorage = async () => {
  try {
    const RemoteStorage = (await import('remotestoragejs')).default;
    Vue.prototype.$remoteStorage = new RemoteStorage({
      logging: false,
      cache: true,
      changeEvents: ['local', 'window', 'remote']
    });
    
    // 声明访问权限
    Vue.prototype.$remoteStorage.access.claim('bookmarks', 'rw');
    Vue.prototype.$remoteStorage.access.claim('tags', 'rw');
    
    // 将实例添加到store的state
    store.commit('sync/setRemoteStorage', Vue.prototype.$remoteStorage);
  } catch (error) {
    console.error('Failed to initialize RemoteStorage:', error);
  }
};

const vm = new Vue({
  router,
  store,
  render: h => h(App),
  async beforeCreate() {
    await initRemoteStorage();
    // 确保RemoteStorage实例可用后再初始化同步
    await store.dispatch('sync/initializeSync')
      .catch(error => {
        console.error('Failed to initialize sync:', error)
      });
  }
}).$mount('#app')