<template>
  <div class="search-bar">
    <input
      type="text"
      v-model="searchQuery"
      @input="onSearch"
      :placeholder="placeholderText"
      class="search-input"
    />
  </div>
</template>

<script>
import debounce from 'lodash.debounce'
import { mapGetters } from 'vuex'

export default {
  name: 'SearchBar',
  props: {
    value: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      searchQuery: this.value,
      isExternalUpdate: false,
      isMobile: false,
      selectedTag: null
    }
  },
  computed: {
          ...mapGetters({
            tagById: 'tags/tagById'
          }),
    placeholderText() {
      return this.isMobile && this.selectedTag 
        ? `Tag: ${this.selectedTag.name}` 
        : 'Search bookmarks...'
    }
  },
  watch: {
    value(newVal) {
      if (newVal !== this.searchQuery) {
        this.isExternalUpdate = true
        this.searchQuery = newVal
        this.$nextTick(() => {
          this.isExternalUpdate = false
        })
      }
    }
  },
  created() {
    // console.log('SearchBar created - initializing component')
    // Create debounced search function
    this.debouncedSearch = debounce(this.emitSearch, 300)
    // console.log('Debounced search function created')
    this.handleResize()
    window.addEventListener('resize', this.handleResize)
    // console.log('Registered resize event listener')
    this.$root.$on('search-tag', this.onTagSelected)
    // console.log('Registered search-tag event listener on $root')
  },
  methods: {
    onSearch() {
      this.debouncedSearch()
    },
    emitSearch() {
      if (!this.isExternalUpdate) {
        this.$emit('input', this.searchQuery)
        this.$emit('search', this.searchQuery)
      }
    },
    handleResize() {
      this.isMobile = window.innerWidth <= 768
      if (!this.isMobile) {
        this.selectedTag = null
      }
    },
    onTagSelected(tagId) {
      console.log('SearchBar received search-tag event with tagId:', tagId)
      console.log('Current isMobile state:', this.isMobile)
      console.log('Processing tag selection for mobile view')
      this.selectedTag = this.tagById(tagId)
      console.log('Selected tag object:', this.selectedTag)
      this.searchQuery = `#${this.selectedTag.name}`
      console.log('Updated searchQuery:', this.searchQuery)
      this.emitSearch()
    }
  },
  beforeDestroy() {
    // Cancel any pending debounced calls
    this.debouncedSearch.cancel()
    window.removeEventListener('resize', this.handleResize)
    this.$root.$off('search-tag', this.onTagSelected)
  }
}
</script>

<style scoped>
.search-bar {
  margin: 1rem 0;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background-color: var(--surface-color);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .search-bar {
    margin: 0.5rem 0 1rem;
  }
  
  .search-input {
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
  }
}
</style>