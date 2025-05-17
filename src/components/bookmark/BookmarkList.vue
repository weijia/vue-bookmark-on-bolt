<template>
  <div class="bookmarks-container">
    <div v-if="loading" class="loading-state">
      Loading bookmarks...
    </div>
    
    <div v-else-if="(!bookmarks || bookmarks.length === 0)" class="empty-state">
      <p v-if="searchQuery || selectedTag">No matching bookmarks found.</p>
      <p v-else>You don't have any bookmarks yet.</p>
      <button class="btn btn-primary" @click="$emit('add')">
        Add your first bookmark
      </button>
    </div>
    
    <div v-else 
         class="bookmarks-list" 
         :data-view-mode="isCompactMode ? 'compact' : 'detailed'">
      <BookmarkItem 
        v-for="bookmark in bookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        :isCompact="isCompactMode"
        :isForceValid="isForceValid"
        @edit="$emit('edit', bookmark)"
        @delete="$emit('delete', $event)"
        @search-tag="$emit('search-tag', $event)"
      />
    </div>
  </div>
</template>

<script>
import BookmarkItem from '../BookmarkItem.vue'

export default {
  name: 'BookmarkList',
  components: {
    BookmarkItem
  },
  props: {
    bookmarks: {
      type: Array,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    isCompactMode: {
      type: Boolean,
      default: true
    },
    isForceValid: {
      type: Boolean,
      default: true
    },
    searchQuery: {
      type: String,
      default: ''
    },
    selectedTag: {
      type: String,
      default: null
    }
  }
}
</script>

<style scoped>
.empty-state {
  padding: var(--space-5);
  text-align: center;
  background-color: var(--surface-color);
  border-radius: 12px;
  border: 1px dashed var(--border-color);
}

.empty-state p {
  margin-bottom: var(--space-3);
  color: var(--text-tertiary);
}

.bookmarks-list {
  /* 默认移动端布局 */
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (min-width: 769px) {
  /* 电脑端 grid 布局 */
  .bookmarks-list {
    display: grid;
    gap: var(--space-3);
  }

  /* 紧凑模式布局 */
  .bookmarks-list[data-view-mode="compact"] {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  /* 详细模式布局 */
  .bookmarks-list[data-view-mode="detailed"] {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}

.loading-state {
  padding: var(--space-5);
  text-align: center;
  color: var(--text-tertiary);
}
</style>