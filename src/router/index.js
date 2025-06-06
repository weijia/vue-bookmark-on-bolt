import Vue from 'vue'
import VueRouter from 'vue-router'
import BookmarkManager from '../views/BookmarkManager.vue'
import TagManager from '../views/TagManager.vue'
import Settings from '../views/Settings/index.vue'
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

// Always use hash mode in browser extension
const router = new VueRouter({
  mode: 'hash',
  routes
})

export default router