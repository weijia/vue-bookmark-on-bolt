<template>
  <div class="search-bar">
    <input
      type="text"
      v-model="searchQuery"
      @input="onSearch"
      placeholder="Search bookmarks..."
      class="search-input"
    />
  </div>
</template>

<script>
import debounce from 'lodash.debounce'

export default {
  name: 'SearchBar',
  data() {
    return {
      searchQuery: ''
    }
  },
  created() {
    // Create debounced search function
    this.debouncedSearch = debounce(this.emitSearch, 300)
  },
  methods: {
    onSearch() {
      this.debouncedSearch()
    },
    emitSearch() {
      this.$emit('search', this.searchQuery)
    }
  },
  beforeDestroy() {
    // Cancel any pending debounced calls
    this.debouncedSearch.cancel()
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