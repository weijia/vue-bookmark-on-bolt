<template>
  <div class="tag-manager">
    <div class="section-header">
      <h1>Tags</h1>
      <button class="btn btn-primary" @click="showAddModal = true">
        Add Tag
      </button>
    </div>
    
    <div class="tags-container">
      <div v-if="tags.length === 0" class="empty-state">
        <p>You don't have any tags yet.</p>
        <button class="btn btn-primary" @click="showAddModal = true">
          Create your first tag
        </button>
      </div>
      
      <div v-else class="tags-grid">
        <div 
          v-for="tag in tags" 
          :key="tag.id"
          class="tag-card"
        >
          <div class="tag-header">
            <div 
              class="tag-color" 
              :style="{ backgroundColor: tag.color }"
            ></div>
            <h3 class="tag-name">{{ tag.name }}</h3>
          </div>
          
          <div class="tag-count">
            {{ getBookmarkCountForTag(tag.id) }} bookmarks
          </div>
          
          <div class="tag-actions">
            <button 
              class="btn btn-outline"
              @click="viewTagBookmarks(tag.id)"
            >
              View
            </button>
            <button 
              class="btn btn-outline"
              @click="editTag(tag.id)"
            >
              Edit
            </button>
            <button 
              class="btn btn-outline"
              @click="confirmDelete(tag.id)"
              :disabled="getBookmarkCountForTag(tag.id) > 0"
              :title="getBookmarkCountForTag(tag.id) > 0 ? 'Remove this tag from all bookmarks first' : ''"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add Modal -->
    <div class="modal" v-if="showAddModal">
      <div class="modal-backdrop" @click="showAddModal = false"></div>
      <div class="modal-content">
        <TagForm 
          @added="onTagAdded"
          @cancel="showAddModal = false"
        />
      </div>
    </div>
    
    <!-- Edit Modal -->
    <div class="modal" v-if="showEditModal">
      <div class="modal-backdrop" @click="showEditModal = false"></div>
      <div class="modal-content">
        <TagForm 
          :tagId="selectedTagId"
          @updated="onTagUpdated"
          @cancel="showEditModal = false"
        />
      </div>
    </div>
    
    <!-- Delete Confirmation Modal -->
    <div class="modal" v-if="showDeleteModal">
      <div class="modal-backdrop" @click="showDeleteModal = false"></div>
      <div class="modal-content">
        <div class="delete-confirmation">
          <h2>Delete Tag</h2>
          <p>Are you sure you want to delete this tag? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="showDeleteModal = false">Cancel</button>
            <button class="btn btn-primary delete-btn" @click="deleteTag">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import TagForm from '../components/TagForm.vue'
import { escapeId } from '../utils/idEscape'

export default {
  name: 'TagManager',
  components: {
    TagForm
  },
  data() {
    return {
      showAddModal: false,
      showEditModal: false,
      showDeleteModal: false,
      selectedTagId: null
    }
  },
  computed: {
    ...mapGetters({
      tags: 'tags/allTags',
      bookmarksByTag: 'bookmarks/bookmarksByTag'
    })
  },
  methods: {
    getBookmarkCountForTag(tagId) {
      return this.bookmarksByTag(tagId).length
    },
    
    viewTagBookmarks(tagId) {
      const escapedId = escapeId(tagId);
      this.$router.push({ 
        path: '/bookmarks',
        query: { tag: escapedId }
      })
    },
    
    editTag(id) {
      this.selectedTagId = escapeId(id)
      this.showEditModal = true
    },
    
    confirmDelete(id) {
      const escapedId = escapeId(id);
      // Only allow deletion if no bookmarks use this tag
      if (this.getBookmarkCountForTag(escapedId) === 0) {
        this.selectedTagId = escapedId
        this.showDeleteModal = true
      }
    },
    
    deleteTag() {
      const escapedId = escapeId(this.selectedTagId);
      this.$store.dispatch('tags/deleteTag', escapedId)
      this.showDeleteModal = false
      this.selectedTagId = null
    },
    
    onTagAdded() {
      this.showAddModal = false
    },
    
    onTagUpdated() {
      this.showEditModal = false
    }
  }
}
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.section-header h1 {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
}

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

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-3);
}

.tag-card {
  background-color: var(--card-color);
  border-radius: 12px;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  transition: transform 0.2s, box-shadow 0.2s;
}

.tag-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.tag-header {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-3);
}

.tag-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  margin-right: var(--space-2);
}

.tag-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.tag-count {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-3);
}

.tag-actions {
  display: flex;
  gap: var(--space-2);
}

.tag-actions button {
  flex: 1;
  padding: 6px 0;
  font-size: 0.85rem;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 101;
}

.delete-confirmation {
  background-color: var(--card-color);
  border-radius: 12px;
  padding: var(--space-4);
}

.delete-confirmation h2 {
  margin-top: 0;
  margin-bottom: var(--space-3);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.delete-btn {
  background-color: var(--error-color);
}

.delete-btn:hover {
  background-color: #dc2626;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .modal-content {
    width: 95%;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .modal-actions button {
    width: 100%;
  }
}
</style>