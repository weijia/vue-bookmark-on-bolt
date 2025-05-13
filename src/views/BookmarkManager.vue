<template>
  <div class="bookmark-manager">
    <div class="section-header">
      <div class="header-title">
        <h1 class="desktop-only">Bookmarks</h1>
        <div class="mobile-actions">
          <button 
            class="btn btn-icon view-toggle"
            @click="toggleViewMode"
            :title="isCompactMode ? 'Switch to detailed view' : 'Switch to compact view'"
          >
            {{ isCompactMode ? '📑' : '📋' }}
          </button>
          <button class="btn btn-icon" @click="showAddModal = true" title="Add Bookmark">
            ➕
          </button>
        </div>
      </div>
    </div>
    
    <div class="desktop-only">
      <SearchBar @search="onSearch" />
    </div>
    
    <div class="bookmarks-container">
      <div v-if="loading" class="loading-state">
        Loading bookmarks...
      </div>
      
      <div v-else-if="displayedBookmarks.length === 0" class="empty-state">
        <p v-if="searchQuery || selectedTag">No matching bookmarks found.</p>
        <p v-else>You don't have any bookmarks yet.</p>
        <button class="btn btn-primary" @click="showAddModal = true">
          Add your first bookmark
        </button>
      </div>
      
      <div v-else class="bookmarks-list">
        <BookmarkItem 
          v-for="bookmark in displayedBookmarks"
          :key="bookmark.id"
          :bookmark="bookmark"
          :isCompact="isCompactMode"
          @edit="editBookmark"
          @delete="confirmDelete"
        />
      </div>
    </div>
    
    <div v-if="hasInvalidBookmarks" class="invalid-notice">
      <p>
        <span class="notice-icon">⚠️</span>
        You have {{ invalidCount }} invalid bookmark(s).
        <button class="link-button" @click="checkAllLinks">
          Check all links
        </button>
      </p>
    </div>
    
    <!-- Add Modal -->
    <div class="modal" v-if="showAddModal">
      <div class="modal-backdrop" @click="showAddModal = false"></div>
      <div class="modal-content">
        <BookmarkForm 
          @added="onBookmarkAdded"
          @cancel="showAddModal = false"
        />
      </div>
    </div>
    
    <!-- Edit Modal -->
    <div class="modal" v-if="showEditModal">
      <div class="modal-backdrop" @click="showEditModal = false"></div>
      <div class="modal-content">
        <BookmarkForm 
          :bookmarkId="selectedBookmarkId"
          @updated="onBookmarkUpdated"
          @cancel="showEditModal = false"
        />
      </div>
    </div>
    
    <!-- Delete Confirmation Modal -->
    <div class="modal" v-if="showDeleteModal">
      <div class="modal-backdrop" @click="showDeleteModal = false"></div>
      <div class="modal-content">
        <div class="delete-confirmation">
          <h2>Delete Bookmark</h2>
          <p>Are you sure you want to delete this bookmark? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="showDeleteModal = false">Cancel</button>
            <button class="btn btn-primary delete-btn" @click="deleteBookmark">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import BookmarkItem from '../components/BookmarkItem.vue'
import BookmarkForm from '../components/BookmarkForm.vue'
import SearchBar from '../components/SearchBar.vue'

export default {
  name: 'BookmarkManager',
  components: {
    BookmarkItem,
    BookmarkForm,
    SearchBar
  },
  data() {
    return {
      showAddModal: false,
      showEditModal: false,
      showDeleteModal: false,
      selectedBookmarkId: null,
      searchQuery: '',
      selectedTag: null,
      loading: false,
      isCompactMode: true // Default to compact mode
    }
  },
  computed: {
    ...mapGetters({
      allBookmarks: 'bookmarks/allBookmarks',
      searchBookmarks: 'bookmarks/searchBookmarks'
    }),
    ...mapState({
      bookmarksLoading: state => state.bookmarks.loading
    }),
    
    displayedBookmarks() {
      return this.searchBookmarks(this.searchQuery, this.selectedTag)
    },
    
    hasInvalidBookmarks() {
      return this.allBookmarks.some(bookmark => !bookmark.isValid)
    },
    
    invalidCount() {
      return this.allBookmarks.filter(bookmark => !bookmark.isValid).length
    }
  },
  created() {
    // Check if there's a tag filter in the URL
    if (this.$route.query.tag) {
      this.selectedTag = this.$route.query.tag
    }
    
    // Load view mode preference
    const savedMode = localStorage.getItem('bookmarkViewMode')
    if (savedMode !== null) {
      this.isCompactMode = JSON.parse(savedMode)
    }
  },
  methods: {
    onSearch({ query, tagId }) {
      this.searchQuery = query
      this.selectedTag = tagId
    },
    
    editBookmark(id) {
      this.selectedBookmarkId = id
      this.showEditModal = true
    },
    
    confirmDelete(id) {
      this.selectedBookmarkId = id
      this.showDeleteModal = true
    },
    
    deleteBookmark() {
      this.$store.dispatch('bookmarks/deleteBookmark', this.selectedBookmarkId)
      this.showDeleteModal = false
      this.selectedBookmarkId = null
    },
    
    onBookmarkAdded() {
      this.showAddModal = false
    },
    
    onBookmarkUpdated() {
      this.showEditModal = false
    },
    
    async checkAllLinks() {
      this.loading = true
      await this.$store.dispatch('bookmarks/checkAllBookmarksValidity')
      this.loading = false
    },
    
    toggleViewMode() {
      this.isCompactMode = !this.isCompactMode
      localStorage.setItem('bookmarkViewMode', JSON.stringify(this.isCompactMode))
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
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.loading-state {
  padding: var(--space-5);
  text-align: center;
  color: var(--text-tertiary);
}

.invalid-notice {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border-left: 4px solid var(--error-color);
}

.notice-icon {
  margin-right: var(--space-2);
}

.link-button {
  background: none;
  border: none;
  color: var(--primary-color);
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.link-button:hover {
  color: var(--primary-dark);
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

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
  
  .mobile-actions {
    display: flex;
    gap: var(--space-2);
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