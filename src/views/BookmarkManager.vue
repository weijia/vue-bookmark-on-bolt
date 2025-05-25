<template>
  <div class="bookmark-manager">
    <!-- Search bar -->
    <SearchBar 
      @search="handleSearch"
      class="search-bar-container"
    />
    
    <!-- Bookmark header -->
    <BookmarkHeader 
      :isCompactMode="isCompactMode"
      :sortBy="sortBy"
      :sortOrder="sortOrder"
      @toggle-view="toggleViewMode"
      @add="showAddForm = true"
      @update:sortBy="val => sortBy = val"
      @update:sortOrder="val => sortOrder = val"
    />
    
    <!-- Invalid bookmarks notice -->
    <InvalidNotice
      v-if="invalidCount > 0"
      :invalidCount="invalidCount"
      :isForceValid="$store.state.bookmarks.isForceValid"
      @toggle-invalid="$store.commit('bookmarks/setIsForceValid', !$store.state.bookmarks.isForceValid)"
    />
    
    <!-- Bookmark list -->
    <BookmarkList
      :bookmarks="sortedBookmarks"
      :loading="loading"
      :isCompactMode="isCompactMode"
      :isForceValid="$store.state.bookmarks.isForceValid"
      :searchQuery="searchQuery"
      :selectedTag="selectedTags && selectedTags.length > 0 ? selectedTags[0] : null"
      @edit="editBookmark"
      @delete="confirmDelete"
      @add="showAddForm = true"
      @search-tag="handleTagSearch"
    />
    
    <!-- Modal components -->
    <BookmarkModals
      :showAddForm="showAddForm"
      :showDeleteConfirm="showDeleteConfirm"
      :currentBookmark="currentBookmark"
      :isEditing="isEditing"
      :bookmarkToDelete="bookmarkToDelete"
      @update:showAddForm="val => showAddForm = val"
      @update:showDeleteConfirm="val => showDeleteConfirm = val"
      @close-form="closeForm"
      @save="saveBookmark"
      @delete="deleteBookmark"
    />
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import SearchBar from '../components/SearchBar.vue';
import BookmarkHeader from '../components/bookmark/BookmarkHeader.vue';
import BookmarkList from '../components/bookmark/BookmarkList.vue';
import InvalidNotice from '../components/bookmark/InvalidNotice.vue';
import BookmarkModals from '../components/bookmark/BookmarkModals.vue';

export default {
  name: 'BookmarkManager',
  components: {
    SearchBar,
    BookmarkHeader,
    BookmarkList,
    InvalidNotice,
    BookmarkModals
  },
  data() {
    return {
      showAddForm: false,
      isEditing: false,
      currentBookmark: null,
      isCompactMode: true,
      showDeleteConfirm: false,
      bookmarkToDelete: {},
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
  },
  computed: {
    ...mapState({
      bookmarks: state => state.bookmarks.bookmarks,
      loading: state => state.bookmarks.loading,
      searchQuery: state => state.bookmarks.searchQuery,
      selectedTags: state => state.bookmarks.selectedTags
    }),
    ...mapGetters({
      filteredBookmarks: 'bookmarks/filteredBookmarks'
    }),
    sortedBookmarks() {
      const bookmarks = [...(this.filteredBookmarks || [])]; // Create new array to ensure reactivity
      const order = this.sortOrder === 'asc' ? 1 : -1;
      
      const sorted = bookmarks.sort((a, b) => {
        if (this.sortBy === 'isValid') {
          return (a.isValid === b.isValid) ? 0 : (a.isValid ? -1 : 1) * order;
        }
        
        const dateA = new Date(a[this.sortBy] || 0);
        const dateB = new Date(b[this.sortBy] || 0);
        return (dateA - dateB) * order;
      });
      
      // Return new array to ensure reactive updates
      return [...sorted];
    },
    ...mapState({
      isForceValid: state => state.bookmarks.isForceValid
    }),
    invalidCount() {
      return this.$store.state.bookmarks.isForceValid ? 0 : (this.bookmarks || []).filter(b => !b.isValid).length;
    },
    hasFilters() {
      return this.searchQuery || this.selectedTags.length > 0;
    }
  },
  methods: {
    handleSearch(query) {
      this.$store.commit('bookmarks/setSearchQuery', query);
    },
    handleTagSearch(tagId) {
      this.$store.commit('bookmarks/setSelectedTags', [tagId]);
      this.$router.replace({
        query: {
          ...this.$route.query,
          tag: tagId
        }
      });
    },
    toggleViewMode() {
      this.isCompactMode = !this.isCompactMode;
      localStorage.setItem('bookmarkViewMode', this.isCompactMode ? 'compact' : 'detailed');
    },
    editBookmark(bookmark) {
      this.currentBookmark = { 
        ...bookmark,
        tagIds: bookmark.tagIds || [] // Ensure tagIds exists
      };
      this.isEditing = true;
      this.showAddForm = true;
    },
    closeForm() {
      this.showAddForm = false;
      this.isEditing = false;
      this.currentBookmark = null;
    },
    saveBookmark(bookmarkData) {
      if (this.isEditing) {
        this.$store.dispatch('bookmarks/updateBookmark', {
          id: this.currentBookmark.id,
          updates: bookmarkData
        });
      } else {
        this.$store.dispatch('bookmarks/addBookmark', bookmarkData);
      }
      this.closeForm();
    },
    confirmDelete(bookmark) {
      this.bookmarkToDelete = bookmark;
      this.showDeleteConfirm = true;
    },
    deleteBookmark(id) {
      this.$store.dispatch('bookmarks/deleteBookmark', id);
      this.showDeleteConfirm = false;
    }
  },
  created() {
    // Load view mode settings from local storage
    const savedViewMode = localStorage.getItem('bookmarkViewMode');
    if (savedViewMode) {
      this.isCompactMode = savedViewMode === 'compact';
    }
  }
};
</script>

<style scoped>
.search-bar-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-background);
  padding: var(--space-4) 0;
  margin-bottom: var(--space-4);
}

.bookmark-manager {
  padding: var(--space-4);
}
</style>