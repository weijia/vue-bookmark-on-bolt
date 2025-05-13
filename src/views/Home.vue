<template>
  <div class="home">
    <h1 class="welcome-title">Welcome to BookmarkHub</h1>
    
    <div class="dashboard-summary">
      <div class="summary-card">
        <h3 class="summary-title">Bookmarks</h3>
        <div class="summary-count">{{ bookmarksCount }}</div>
        <router-link to="/bookmarks" class="summary-link">View all</router-link>
      </div>
      
      <div class="summary-card">
        <h3 class="summary-title">Tags</h3>
        <div class="summary-count">{{ tagsCount }}</div>
        <router-link to="/tags" class="summary-link">View all</router-link>
      </div>
      
      <div class="summary-card">
        <h3 class="summary-title">Invalid Links</h3>
        <div class="summary-count" :class="{ 'count-error': invalidCount > 0 }">
          {{ invalidCount }}
        </div>
        <button @click="checkAllLinks" class="summary-link" :disabled="loading">
          {{ loading ? 'Checking...' : 'Check all' }}
        </button>
      </div>
    </div>
    
    <SearchBar @search="onSearch" />
    
    <div class="dashboard-sections">
      <div class="dashboard-section">
        <h2 class="section-title">Recently Added</h2>
        <div class="bookmarks-list" v-if="recentBookmarks.length > 0">
          <BookmarkItem 
            v-for="bookmark in recentBookmarks"
            :key="bookmark.id"
            :bookmark="bookmark"
            @edit="editBookmark"
            @delete="confirmDelete"
          />
        </div>
        <div class="empty-state" v-else>
          <p>No bookmarks added yet</p>
          <router-link to="/bookmarks" class="btn btn-primary">
            Add your first bookmark
          </router-link>
        </div>
      </div>
      
      <div class="dashboard-section">
        <h2 class="section-title">Frequently Visited</h2>
        <div class="bookmarks-list" v-if="frequentBookmarks.length > 0">
          <BookmarkItem 
            v-for="bookmark in frequentBookmarks"
            :key="bookmark.id"
            :bookmark="bookmark"
            @edit="editBookmark"
            @delete="confirmDelete"
          />
        </div>
        <div class="empty-state" v-else>
          <p>Visit some bookmarks to see them here</p>
        </div>
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
import { mapGetters } from 'vuex'
import BookmarkItem from '../components/BookmarkItem.vue'
import BookmarkForm from '../components/BookmarkForm.vue'
import SearchBar from '../components/SearchBar.vue'

export default {
  name: 'Home',
  components: {
    BookmarkItem,
    BookmarkForm,
    SearchBar
  },
  data() {
    return {
      showEditModal: false,
      showDeleteModal: false,
      selectedBookmarkId: null,
      loading: false,
      searchResults: null
    }
  },
  computed: {
    ...mapGetters({
      allBookmarks: 'bookmarks/allBookmarks',
      recentBookmarksGetter: 'bookmarks/recentBookmarks',
      frequentBookmarksGetter: 'bookmarks/frequentBookmarks',
      allTags: 'tags/allTags',
      searchBookmarks: 'bookmarks/searchBookmarks'
    }),
    
    bookmarksCount() {
      return this.allBookmarks.length
    },
    
    tagsCount() {
      return this.allTags.length
    },
    
    invalidCount() {
      return this.allBookmarks.filter(b => !b.isValid).length
    },
    
    recentBookmarks() {
      if (this.searchResults) {
        return this.searchResults.slice(0, 5)
      }
      return this.recentBookmarksGetter
    },
    
    frequentBookmarks() {
      if (this.searchResults) {
        return []
      }
      return this.frequentBookmarksGetter
    }
  },
  methods: {
    onSearch({ query, tagId }) {
      if (query || tagId) {
        this.searchResults = this.searchBookmarks(query, tagId)
      } else {
        this.searchResults = null
      }
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
    
    onBookmarkUpdated() {
      this.showEditModal = false
    },
    
    async checkAllLinks() {
      this.loading = true
      await this.$store.dispatch('bookmarks/checkAllBookmarksValidity')
      this.loading = false
    }
  }
}
</script>

<style scoped>
.welcome-title {
  margin-bottom: var(--space-4);
  font-size: 1.8rem;
  font-weight: 600;
}

.dashboard-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.summary-card {
  background-color: var(--card-color);
  border-radius: 12px;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  text-align: center;
  transition: transform 0.2s;
}

.summary-card:hover {
  transform: translateY(-2px);
}

.summary-title {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: var(--space-2);
  color: var(--text-secondary);
}

.summary-count {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: var(--space-2);
  color: var(--primary-color);
}

.count-error {
  color: var(--error-color);
}

.summary-link {
  display: inline-block;
  font-size: 0.9rem;
  color: var(--primary-color);
  text-decoration: none;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
}

.summary-link:hover {
  text-decoration: underline;
}

.dashboard-sections {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .dashboard-sections {
    grid-template-columns: 1fr 1fr;
  }
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: var(--space-3);
}

.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.empty-state {
  padding: var(--space-4);
  text-align: center;
  background-color: var(--surface-color);
  border-radius: 12px;
  border: 1px dashed var(--border-color);
}

.empty-state p {
  margin-bottom: var(--space-3);
  color: var(--text-tertiary);
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