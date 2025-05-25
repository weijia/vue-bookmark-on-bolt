<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': isCollapsed, 'sidebar-mobile': isMobile }">
    <div class="sidebar-header" v-if="!isMobile">
      <button class="collapse-btn" @click="toggleCollapse">
        <span v-if="isCollapsed">▶</span>
        <span v-else>◀</span>
      </button>
    </div>

    <nav class="sidebar-nav">
      <router-link to="/" class="nav-item">
        <span class="nav-icon">🔖</span>
        <span class="nav-label" v-if="!isCollapsed">Bookmarks</span>
      </router-link>

      <router-link to="/tags" class="nav-item">
        <span class="nav-icon">🏷️</span>
        <span class="nav-label" v-if="!isCollapsed">Tags</span>
      </router-link>

      <router-link to="/settings" class="nav-item" active-class="active" exact-active-class="active" v-if="isMobile">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label" v-if="!isCollapsed">Settings</span>
      </router-link>

      <div class="nav-divider" v-if="!isMobile"></div>

      <div class="tag-section" v-if="!isCollapsed && !isMobile">
        <h3 class="tag-header">Tags</h3>
        <ul class="tag-list">
          <li v-for="tag in sortedTags" :key="tag.id" class="tag-item">
            <div class="tag-link" :class="{ 'active': currentTagId === tag.id }" @click="handleTagClick(tag.id)">
              <span class="tag-color" :style="{ backgroundColor: tag.color }"></span>
              <span class="tag-name">{{ tag.name }}</span>
              <span class="tag-count">{{ tag.count }}</span>
            </div>
          </li>
        </ul>
      </div>
    </nav>

    <div class="sidebar-footer" v-if="!isCollapsed && !isMobile">
      <router-link to="/settings" class="settings-link" active-class="active">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">Settings</span>
      </router-link>
    </div>
  </aside>
</template>

<script>
import { mapGetters } from 'vuex'
import { isExtensionEnvironment } from '../utils/environment'

export default {
  name: 'Sidebar',
  data() {
    return {
      isCollapsed: false,
      isMobile: false,
      isExtension: isExtensionEnvironment()
    }
  },
  computed: {
    ...mapGetters({
      allTags: 'tags/allTags'
    }),
    sortedTags() {
      return [...this.allTags]
        .sort((a, b) => {
          // 首先检查计数
          if (b.count !== a.count) {
            return b.count - a.count
          }
          // 检查name属性是否存在并且不为null/undefined
          if (!a.name && !b.name) return 0
          if (!a.name) return 1
          if (!b.name) return -1
          return a.name.localeCompare(b.name)
        })
    },
    currentTagId() {
      return this.$route.query.tag
    }
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
      localStorage.setItem('sidebarCollapsed', JSON.stringify(this.isCollapsed))
    },
    checkMobile() {
      this.isMobile = window.innerWidth <= 768
    },
    navigateTo(path, query = null) {
      console.log(`Navigating to ${path}`, query);
      
      // 如果是标签相关的导航，让父组件处理
      if (path === '/' && query && query.tag !== undefined) {
        return;
      }

      // 清除当前选中的标签
      if (path !== '/' && this.$store.state.bookmarks.selectedTags.length > 0) {
        this.$store.commit('bookmarks/setSelectedTags', []);
      }

      // 执行导航
      try {
        const route = query ? { path, query } : { path };
        this.$router.push(route).then(() => {
          console.log('Navigation successful');
          // 强制组件重新渲染
          this.$nextTick(() => {
            this.$forceUpdate();
            // 通知父组件路由已更改
            this.$emit('route-changed', path);
          });
        }).catch(err => {
          if (err.name !== 'NavigationDuplicated') {
            console.error('Navigation failed:', err);
            // 如果不是重复导航错误，尝试强制刷新
            window.location.href = path;
          }
        });
      } catch (error) {
        console.error('Navigation error:', error);
        window.location.href = path;
      }
    },
    handleTagClick(tagId) {
      if (this.currentTagId === tagId) {
        // 取消选中
        this.navigateTo('/', { ...this.$route.query, tag: undefined });
      } else {
        // 选中新标签
        this.navigateTo('/', { ...this.$route.query, tag: tagId });
        // 点击未选中的标签，选中该标签
        this.$emit('search-tag', tagId)
      }
    }
  },
  created() {
    const savedState = localStorage.getItem('sidebarCollapsed')
    if (savedState) {
      this.isCollapsed = JSON.parse(savedState)
    }
    this.checkMobile()
    window.addEventListener('resize', this.checkMobile)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.checkMobile)
  }
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100%;
  background-color: var(--surface-color);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
}

.sidebar-collapsed {
  width: 64px;
}

.sidebar-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border-color);
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.collapse-btn:hover {
  background-color: var(--hover-color);
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-3);
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: 8px;
  margin-bottom: var(--space-2);
  color: var(--text-primary);
  transition: background-color 0.2s;
  text-decoration: none;
}

.nav-item:hover {
  background-color: var(--hover-color);
}

.nav-item.router-link-exact-active {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
}

.nav-icon {
  margin-right: var(--space-2);
  font-size: 1.2rem;
}

.nav-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: var(--space-3) 0;
}

.tag-section {
  margin-top: var(--space-3);
}

.tag-header {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
  padding-left: var(--space-3);
}

.tag-list {
  list-style: none;
}

.tag-item {
  margin-bottom: 2px;
}

.tag-link {
  display: flex;
  align-items: center;
  padding: 6px var(--space-3);
  border-radius: 6px;
  color: var(--text-secondary);
  transition: background-color 0.2s;
  text-decoration: none;
  cursor: pointer;
}

.tag-link:hover {
  background-color: var(--hover-color);
  color: var(--text-primary);
}

.tag-link.active {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
}

.tag-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: var(--space-2);
}

.tag-name {
  flex: 1;
  font-size: 0.9rem;
}

.tag-count {
  background-color: var(--hover-color);
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.sidebar-footer {
  padding: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.settings-link {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: 8px;
  color: var(--text-secondary);
  transition: background-color 0.2s;
  text-decoration: none;
}

.settings-link:hover {
  background-color: var(--hover-color);
  color: var(--text-primary);
}

.settings-link.active {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--primary-color);
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    height: auto;
    position: fixed;
    bottom: 0;
    left: 0;
    border-right: none;
    border-top: 1px solid var(--border-color);
    z-index: 1000;
  }
  
  .sidebar-nav {
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    padding: var(--space-2);
  }
  
  .nav-item {
    flex-direction: column;
    align-items: center;
    margin: 0;
    padding: var(--space-2);
    text-align: center;
    flex: 1;
  }
  
  .nav-icon {
    margin: 0 0 4px 0;
  }
  
  .nav-label {
    font-size: 0.75rem;
  }
  
  .nav-divider, .tag-section, .sidebar-footer {
    display: none;
  }
}
</style>