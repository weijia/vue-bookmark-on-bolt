<template>
  <div>
    <!-- 添加/编辑书签表单 -->
    <div v-if="showAddForm" class="modal-overlay" @click="closeForm">
      <div class="modal-content" @click.stop>
        <BookmarkForm
          :bookmark="currentBookmark"
          :isEdit="isEditing"
          @close="closeForm"
          @save="saveBookmark"
        />
      </div>
    </div>
    
    <!-- 删除确认对话框 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click="closeDeleteConfirm">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Delete Bookmark</h3>
          <button class="btn btn-icon close-btn" @click="closeDeleteConfirm">✕</button>
        </div>
        
        <div class="modal-body">
          <p>Are you sure you want to delete this bookmark?</p>
          <div class="bookmark-preview">
            <img :src="bookmarkToDelete.favicon" alt="favicon" class="favicon">
            <div class="bookmark-info">
              <div class="bookmark-title">{{ bookmarkToDelete.title }}</div>
              <div class="bookmark-url">{{ bookmarkToDelete.url }}</div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn" @click="closeDeleteConfirm">Cancel</button>
          <button class="btn btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BookmarkForm from '../BookmarkForm.vue'

export default {
  name: 'BookmarkModals',
  components: {
    BookmarkForm
  },
  props: {
    showAddForm: {
      type: Boolean,
      required: true
    },
    showDeleteConfirm: {
      type: Boolean,
      required: true
    },
    currentBookmark: {
      type: Object,
      default: null
    },
    isEditing: {
      type: Boolean,
      required: true
    },
    bookmarkToDelete: {
      type: Object,
      default: () => ({})
    }
  },
  methods: {
    closeForm() {
      this.$emit('update:showAddForm', false)
      this.$emit('close-form')
    },
    closeDeleteConfirm() {
      this.$emit('update:showDeleteConfirm', false)
    },
    saveBookmark(bookmarkData) {
      this.$emit('save', bookmarkData)
    },
    confirmDelete() {
      this.$emit('delete', this.bookmarkToDelete.id)
      this.closeDeleteConfirm()
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex !important;
  align-items: center;
  justify-content: center;
  z-index: 99999 !important;
  overflow: visible !important;
  transform: none !important;
  will-change: transform;
  margin: 0 !important;
  padding: 0 !important;
}

.modal-content {
  position: relative;
  z-index: 100000 !important;
  background-color: var(--surface-color);
  padding: var(--space-4);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: none !important;
}

.modal-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.modal-body {
  padding: var(--space-4);
}

.modal-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.close-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 1.2rem;
}

.bookmark-preview {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background-color: var(--surface-color-hover);
  border-radius: 8px;
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.favicon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.bookmark-info {
  flex: 1;
  min-width: 0;
}

.bookmark-title {
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-url {
  font-size: 0.875rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-danger {
  background-color: var(--danger-color);
  color: white;
}

.btn-danger:hover {
  background-color: var(--danger-color-hover);
}
</style>