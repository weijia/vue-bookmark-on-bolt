import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/css/styles.css'
import { getSyncFunction } from './services/syncService'

Vue.config.productionTip = false

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