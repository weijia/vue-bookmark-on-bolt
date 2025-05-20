import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/css/styles.css'

Vue.config.productionTip = false

const vm = new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')

// 初始化同步
store.dispatch('sync/initializeSync')
  .catch(error => {
    console.error('Failed to initialize sync:', error)
  })