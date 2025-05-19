import Vue from 'vue'
import VueRouter from 'vue-router'
import BookmarkManager from '../views/BookmarkManager.vue'
import TagManager from '../views/TagManager.vue'
import Settings from '../views/Settings.vue'
import { getEnvironmentConfig } from '../utils/environment'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'BookmarkManager',
    component: BookmarkManager
  },
  {
    path: '/tags',
    name: 'TagManager',
    component: TagManager
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings
  }
]

// 在浏览器扩展中，始终使用 hash 模式
const router = new VueRouter({
  mode: 'hash',
  routes
})

export default router