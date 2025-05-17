<template>
  <div class="section-header">
    <div class="header-title">
      <h1 class="desktop-only">Bookmarks</h1>
      <!-- 桌面端按钮 -->
      <div class="desktop-actions">
        <button 
          class="btn btn-icon view-toggle"
          @click="$emit('toggle-view')"
          :title="isCompactMode ? 'Switch to detailed view' : 'Switch to compact view'"
        >
          {{ isCompactMode ? '📑' : '📋' }}
        </button>
        <button class="btn btn-icon" @click="$emit('add')" title="Add Bookmark">
          ➕
        </button>
      </div>
      <div class="mobile-actions">
        <button 
          class="btn btn-icon view-toggle"
          @click="$emit('toggle-view')"
          :title="isCompactMode ? 'Switch to detailed view' : 'Switch to compact view'"
        >
          {{ isCompactMode ? '📑' : '📋' }}
        </button>
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
    }
  }
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