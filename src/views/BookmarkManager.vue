<template>
  <div class="bookmark-manager">
    <!-- 搜索栏 -->
    <SearchBar 
      @search="handleSearch"
      class="search-bar-container"
    />
    
    <!-- 书签头部 -->
    <BookmarkHeader 
      :isCompactMode="isCompactMode"
      @toggle-view="toggleViewMode"
      @add="showAddForm = true"
    />
    
    <!-- 无效书签提示 -->
    <InvalidNotice
      v-if="invalidCount > 0"
      :invalidCount="invalidCount"
      :isForceValid="$store.state.bookmarks.isForceValid"
      @toggle-invalid="$store.commit('bookmarks/setIsForceValid', !$store.state.bookmarks.isForceValid)"
    />
    
    <!-- 书签列表 -->
    <BookmarkList
      :bookmarks="filteredBookmarks || []"
      :loading="loading"
      :isCompactMode="isCompactMode"
      :isForceValid="$store.state.bookmarks.isForceValid"
      :searchQuery="searchQuery"
      :selectedTag="selectedTags && selectedTags.length > 0 ? selectedTags[0] : null"
      @edit="editBookmark"
      @delete="confirmDelete"
      @add="showAddForm = true"
    />
    
    <!-- 模态框组件 -->
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
      bookmarkToDelete: {}
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
    toggleViewMode() {
      this.isCompactMode = !this.isCompactMode;
      localStorage.setItem('bookmarkViewMode', this.isCompactMode ? 'compact' : 'detailed');
    },
    editBookmark(bookmark) {
      this.currentBookmark = { ...bookmark };
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
          bookmarkData
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
    // 从本地存储加载视图模式设置
    const savedViewMode = localStorage.getItem('bookmarkViewMode');
    if (savedViewMode) {
      this.isCompactMode = savedViewMode === 'compact';
    }
  }
};
</script>

<style scoped>
.search-bar-container {
  margin-bottom: var(--space-4);
}

.bookmark-manager {
  padding: var(--space-4);
}
</style>