<template>
  <div class="section-header">
    <div class="header-title">
      <h1 class="desktop-only">Bookmarks</h1>
      <!-- 桌面端按钮 -->
      <div class="desktop-actions">
        <div class="action-group">
          <select 
            v-model="sortBy"
            @change="$emit('update:sortBy', $event.target.value)"
            class="sort-select"
          >
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="lastAccessedAt">Accessed</option>
            <option value="isValid">Validity</option>
          </select>
          <button 
            class="btn btn-icon"
            @click="$emit('update:sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')"
            :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
          >
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </button>
          <button 
            class="btn btn-icon view-toggle"
            @click="$emit('toggle-view')"
            :title="isCompactMode ? 'Switch to detailed view' : 'Switch to compact view'"
          >
            {{ isCompactMode ? '📑' : '📋' }}
          </button>
        </div>
        <button class="btn btn-icon" @click="$emit('add')" title="Add Bookmark">
          ➕
        </button>
      </div>
      <div class="mobile-actions">
        <div class="action-group">
          <select 
            v-model="sortBy"
            @change="$emit('update:sortBy', $event.target.value)"
            class="sort-select mobile-sort-select"
          >
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="lastAccessedAt">Accessed</option>
            <option value="isValid">Validity</option>
          </select>
          <button 
            class="btn btn-icon"
            @click="$emit('update:sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')"
            :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
          >
            {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </button>
          <button 
            class="btn btn-icon view-toggle"
            @click="$emit('toggle-view')"
            :title="isCompactMode ? 'Switch to detailed view' : 'Switch to compact view'"
          >
            {{ isCompactMode ? '📑' : '📋' }}
          </button>
        </div>
        <button class="btn btn-icon" @click="$emit('add')" title="Add Bookmark">
          ➕
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BookmarkHeader',
  props: {
    isCompactMode: {
      type: Boolean,
      required: true
    },
    sortBy: {
      type: String,
      default: 'createdAt'
    },
    sortOrder: {
      type: String,
      default: 'desc'
    }
  },
  emits: ['toggle-view', 'add', 'update:sortBy', 'update:sortOrder']
}
</script>

<style scoped>
.section-header {
  margin-bottom: var(--space-4);
}

.header-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
}

.desktop-actions {
  display: none;
}

@media (min-width: 769px) {
  .desktop-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .mobile-actions {
    display: none;
  }
}

.mobile-actions {
  display: none;
}

.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.action-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sort-select {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--surface-color);
  color: var(--text-primary);
}

.mobile-sort-select {
  max-width: 120px;
  font-size: 0.9rem;
  padding: var(--space-1);
}

@media (max-width: 768px) {
  .action-group {
    gap: var(--space-1);
  }
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
  
  .mobile-actions {
    display: flex;
    gap: var(--space-2);
  }
}
</style>