<template>
  <div class="search-bar">
    <div
      class="search-input"
      @click="focusInput"
      :class="{ 'is-focused': isInputFocused }"
    >
      <template v-if="hasTag">
        <span 
          class="tag"
          :style="{ 
            backgroundColor: `${tagColor}20`,
            color: tagColor
          }"
          @click.stop="handleTagClick"
        >
          {{ displayTag }}
          <span class="tag-remove" @click.stop="removeTag">&times;</span>
        </span>
        <input
          ref="searchInput"
          type="text"
          v-model="nonTagText"
          @input="onNonTagInput"
          @focus="isInputFocused = true"
          @blur="isInputFocused = false"
          :placeholder="hasTag ? '' : placeholderText"
          class="non-tag-input"
        />
      </template>
      <input
        v-else
        ref="searchInput"
        type="text"
        v-model="searchQuery"
        @input="onSearch"
        @focus="isInputFocused = true"
        @blur="isInputFocused = false"
        :placeholder="placeholderText"
        class="search-input-field"
      />
    </div>
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
      selectedTag: null,
      isInputFocused: false,
      nonTagText: ''
    }
  },
  computed: {
    ...mapGetters({
      tagById: 'tags/tagById',
      tagByName: 'tags/tagByName'
    }),
    placeholderText() {
      return this.isMobile && this.selectedTag 
        ? `Tag: ${this.selectedTag.name}` 
        : 'Search bookmarks...'
    },
    hasTag() {
      return this.searchQuery.startsWith('#')
    },
    displayTag() {
      if (!this.hasTag) return ''
      const tagText = this.searchQuery.split(' ')[0]
      return tagText.substring(1) // 移除#符号
    },
    tagColor() {
      if (!this.hasTag) return ''
      const tagName = this.displayTag
      const tag = this.tagByName(tagName)
      return tag ? tag.color : '#666666'
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
    onNonTagInput() {
      this.searchQuery = `#${this.displayTag} ${this.nonTagText}`
      this.debouncedSearch()
    },
    emitSearch() {
      if (!this.isExternalUpdate) {
        this.$emit('input', this.searchQuery)
        this.$emit('search', this.searchQuery)
      }
    },
    removeTag() {
      // 移除标签，保留非标签文本
      this.searchQuery = this.nonTagText.trim()
      this.nonTagText = ''
      this.emitSearch()
      this.$nextTick(() => {
        this.$refs.searchInput?.focus()
      })
    },
    handleResize() {
      this.isMobile = window.innerWidth <= 768
      if (!this.isMobile) {
        this.selectedTag = null
      }
    },
    onTagSelected(tagId) {
      this.selectedTag = this.tagById(tagId)
      this.searchQuery = `#${this.selectedTag.name}`
      this.nonTagText = ''
      this.emitSearch()
    },
    handleTagClick() {
      // 当点击标签时，触发搜索该标签
      const tagName = this.displayTag
      const tag = this.tagByName(tagName)
      if (tag) {
        this.onTagSelected(tag.id)
      }
    },
    focusInput() {
      this.$refs.searchInput.focus()
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
  min-height: 42px;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  background-color: var(--surface-color);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: text;
}

.search-input.is-focused {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.search-input-field,
.non-tag-input {
  flex: 1;
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  font-size: inherit;
  color: inherit;
  outline: none;
}

.search-input-field::placeholder,
.non-tag-input::placeholder {
  color: var(--text-tertiary);
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;
  position: relative;
}

.tag:hover {
  opacity: 0.8;
}

.tag-remove {
  margin-left: 0.4rem;
  font-size: 1.1rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.tag-remove:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
  .search-bar {
    margin: 0.5rem 0 1rem;
  }
  
  .search-input {
    padding: 0.375rem 0.75rem;
    font-size: 0.9rem;
  }
  
  .tag {
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
  }
}
</style>