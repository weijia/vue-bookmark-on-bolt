import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/css/styles.css'
// import { getSyncFunction } from './services/syncService'
import {
  isExtensionEnvironment,
  initExtensionMessageListener
} from './utils/extension'

Vue.config.productionTip = false

// 仅在浏览器扩展环境中初始化扩展相关功能
if (isExtensionEnvironment()) {
  initExtensionMessageListener(store);
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
    console.warn('Failed to initialize RemoteStorage:', error);
    // 不抛出异常，而是继续初始化应用
  }
};

const vm = new Vue({
  router,
  store,
  render: h => h(App),
  async beforeCreate() {
    try {
      await initRemoteStorage();
    } catch (error) {
      console.warn('RemoteStorage initialization failed:', error);
    }
    // 即使RemoteStorage初始化失败，也继续初始化同步
    await store.dispatch('sync/initializeSync')
      .catch(error => {
        console.warn('Failed to initialize sync:', error);
      });
  }
}).$mount('#app')