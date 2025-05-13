<template>
  <div class="bookmark-form">
    <h2 class="form-title">{{ isEdit ? 'Edit Bookmark' : 'Add Bookmark' }}</h2>
    
    <form @submit.prevent="submitForm">
      <div class="form-group">
        <label for="title">Title</label>
        <input 
          type="text" 
          id="title" 
          v-model="form.title" 
          required
          placeholder="Enter bookmark title"
        />
      </div>
      
      <div class="form-group">
        <label for="url">URL</label>
        <input 
          type="url" 
          id="url" 
          v-model="form.url" 
          required
          placeholder="https://example.com"
          @blur="validateUrl"
        />
        <div v-if="urlError" class="error-message">{{ urlError }}</div>
      </div>
      
      <div class="form-group">
        <label for="description">Description</label>
        <textarea 
          id="description" 
          v-model="form.description"
          rows="3"
          placeholder="Add a description (optional)"
        ></textarea>
      </div>
      
      <div class="form-group">
        <label>Tags</label>
        <div class="tags-selector">
          <div 
            v-for="tag in allTags" 
            :key="tag.id"
            class="tag-option"
            :class="{ 'selected': form.tagIds.includes(tag.id) }"
            :style="{ 
              borderColor: tag.color,
              backgroundColor: form.tagIds.includes(tag.id) ? tag.color + '20' : 'transparent'
            }"
            @click="toggleTag(tag.id)"
          >
            <span 
              class="tag-color" 
              :style="{ backgroundColor: tag.color }"
            ></span>
            <span class="tag-name">{{ tag.name }}</span>
          </div>
        </div>
      </div>
      
      <div class="form-actions">
        <button 
          type="button" 
          class="btn btn-outline" 
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ isEdit ? 'Update' : 'Add' }} Bookmark
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { checkUrlValidity } from '../utils/urlValidator'

export default {
  name: 'BookmarkForm',
  props: {
    bookmarkId: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      form: {
        title: '',
        url: '',
        description: '',
        tagIds: []
      },
      loading: false,
      urlError: null
    }
  },
  computed: {
    ...mapGetters({
      allTags: 'tags/allTags',
      bookmarkById: 'bookmarks/bookmarkById'
    }),
    isEdit() {
      return !!this.bookmarkId
    }
  },
  created() {
    if (this.isEdit) {
      const bookmark = this.bookmarkById(this.bookmarkId)
      if (bookmark) {
        this.form = {
          title: bookmark.title,
          url: bookmark.url,
          description: bookmark.description,
          tagIds: [...bookmark.tagIds]
        }
      }
    }
  },
  methods: {
    async validateUrl() {
      if (!this.form.url) return
      
      try {
        // Check URL format
        new URL(this.form.url)
        this.urlError = null
        
        // Check if URL is accessible (but don't block UI)
        this.checkAccessibility()
      } catch (e) {
        this.urlError = 'Invalid URL format. Please enter a valid URL.'
      }
    },
    
    async checkAccessibility() {
      const isValid = await checkUrlValidity(this.form.url)
      if (!isValid) {
        this.urlError = 'Warning: This URL might not be accessible.'
      }
    },
    
    toggleTag(tagId) {
      if (this.form.tagIds.includes(tagId)) {
        this.form.tagIds = this.form.tagIds.filter(id => id !== tagId)
      } else {
        this.form.tagIds.push(tagId)
      }
    },
    
    async submitForm() {
      this.loading = true
      
      try {
        if (this.isEdit) {
          await this.$store.dispatch('bookmarks/updateBookmark', {
            id: this.bookmarkId,
            updates: this.form
          })
          this.$emit('updated')
        } else {
          await this.$store.dispatch('bookmarks/addBookmark', this.form)
          this.$emit('added')
        }
      } catch (error) {
        console.error('Error saving bookmark:', error)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.bookmark-form {
  background-color: var(--card-color);
  border-radius: 12px;
  padding: var(--space-4);
  border: 1px solid var(--border-color);
}

.form-title {
  margin-top: 0;
  margin-bottom: var(--space-4);
  font-size: 1.5rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: var(--space-3);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 500;
  color: var(--text-primary);
}

input, textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--surface-color);
  color: var(--text-primary);
  font-family: var(--font-family);
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.error-message {
  color: var(--error-color);
  font-size: 0.85rem;
  margin-top: var(--space-1);
}

.tags-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-option {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
}

.tag-option:hover {
  transform: translateY(-1px);
}

.tag-option.selected {
  font-weight: 500;
}

.tag-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.tag-name {
  font-size: 0.9rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>