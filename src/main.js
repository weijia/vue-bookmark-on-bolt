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

// Initialize extension-related features only in browser extension environment
if (isExtensionEnvironment()) {
  initExtensionMessageListener(store);
}

// Initialize global RemoteStorage instance
const initRemoteStorage = async () => {
  try {
    const RemoteStorage = (await import('remotestoragejs')).default;
    Vue.prototype.$remoteStorage = new RemoteStorage({
      logging: false,
      cache: true,
      changeEvents: ['local', 'window', 'remote']
    });
    
    // Declare access permissions
    Vue.prototype.$remoteStorage.access.claim('bookmarks', 'rw');
    Vue.prototype.$remoteStorage.access.claim('tags', 'rw');
    
          // Add instance to store's state
    store.commit('sync/setRemoteStorage', Vue.prototype.$remoteStorage);
  } catch (error) {
    console.warn('Failed to initialize RemoteStorage:', error);
    // Don't throw exception, continue app initialization
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
    // Continue sync initialization even if RemoteStorage init fails
    await store.dispatch('sync/initializeSync')
      .catch(error => {
        console.warn('Failed to initialize sync:', error);
      });
  }
}).$mount('#app')