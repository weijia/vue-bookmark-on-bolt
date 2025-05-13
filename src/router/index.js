import Vue from 'vue'
import VueRouter from 'vue-router'
import BookmarkManager from '../views/BookmarkManager.vue'
import TagManager from '../views/TagManager.vue'
import Settings from '../views/Settings.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Home',
    component: BookmarkManager
  },
  {
    path: '/bookmarks',
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

const router = new VueRouter({
  mode: 'history',
  base: import.meta.env.BASE_URL,
  routes
})

export default router