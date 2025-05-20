import Vue from 'vue'
import Vuex from 'vuex'
import bookmarks from './modules/bookmarks'
import tags from './modules/tags'
import notification from './modules/notification'
import sync from './modules/sync'
import { syncFromWebDAV } from '../services/storage'

Vue.use(Vuex)

const store = new Vuex.Store({
  modules: {
    bookmarks,
    tags,
    notification
  }
})

// 初始化WebDAV同步
const initWebDAVSync = async () => {
  try {
    const webdavConfig = localStorage.getItem('webdavConfig')
    if (webdavConfig) {
      await syncFromWebDAV()
      console.log('WebDAV sync initialized')
    }
  } catch (error) {
    console.error('Failed to initialize WebDAV sync:', error)
  }
}

initWebDAVSync()

export default store