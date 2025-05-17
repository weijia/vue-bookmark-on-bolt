<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Delete Bookmark</h3>
        <button class="btn btn-icon close-btn" @click="$emit('close')">✕</button>
      </div>
      
      <div class="modal-body">
        <p>Are you sure you want to delete this bookmark?</p>
        <div class="bookmark-preview">
          <img :src="bookmark.favicon" alt="favicon" class="favicon">
          <div class="bookmark-info">
            <div class="bookmark-title">{{ bookmark.title }}</div>
            <div class="bookmark-url">{{ bookmark.url }}</div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn" @click="$emit('close')">Cancel</button>
        <button class="btn btn-danger" @click="confirmDelete">Delete</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DeleteConfirmationModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    bookmark: {
      type: Object,
      required: true
    }
  },
  methods: {
    confirmDelete() {
      this.$emit('confirm', this.bookmark.id)
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--surface-color);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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