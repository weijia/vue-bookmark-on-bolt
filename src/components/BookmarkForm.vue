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
        <input
          type="text"
          v-model="tagSearch"
          placeholder="Search tags..."
          class="tag-search"
        />
        <div class="tags-container">
          <div class="tags-selector" :key="'tags-selector-' + form.tagIds.join()">
            <!-- 显示已有标签 -->
            <div 
              v-for="tag in filteredTags" 
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
        <!-- 新增创建标签的输入框和按钮 -->
        <div class="new-tag-input">
          <input 
            type="text" 
            v-model="newTagName" 
            placeholder="New tag name"
          />
          <input 
            type="color" 
            v-model="newTagColor"
          />
          <button 
            type="button" 
            class="btn btn-sm" 
            @click="createNewTag"
          >
            Add Tag
          </button>
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
import { mapGetters, mapActions } from 'vuex'
import { checkUrlValidity } from '../utils/urlValidator'

export default {
  name: 'BookmarkForm',
  props: {
    bookmark: {
      type: Object,
      default: null
    },
    isEdit: {
      type: Boolean,
      default: false
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
      urlError: null,
      newTagName: '', // 新增：新标签名称
      newTagColor: '#000000', // 新增：新标签颜色
      tagSearch: '' // 新增：标签搜索词
    }
  },
  computed: {
    ...mapGetters({
      allTags: 'tags/allTags'
    }),
    filteredTags() {
      const searchTerm = this.tagSearch.toLowerCase();
      const allTags = [...this.allTags];
      
      // 优先显示当前书签的标签
      const currentTags = allTags.filter(tag => 
        this.form.tagIds.includes(tag.id)
      );
      
      // 其他标签按名称排序
      const otherTags = allTags
        .filter(tag => 
          !this.form.tagIds.includes(tag.id) &&
          tag.name.toLowerCase().includes(searchTerm)
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return [...currentTags, ...otherTags];
    }
  },
  created() {
    if (this.isEdit && this.bookmark) {
      this.form = {
        title: this.bookmark.title || '',
        url: this.bookmark.url || '',
        description: this.bookmark.description || '',
        tagIds: [...(this.bookmark.tagIds || [])]
      }
    }
  },
  methods: {
    validateUrl(url) {
      try {
        new URL(url)
        this.urlError = null
        return true
      } catch (e) {
        this.urlError = 'Please enter a valid URL'
        return false
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
    // 新增：创建新标签的方法
    async createNewTag() {
      if (!this.newTagName.trim()) return

      try {
        const newTag = await this.$store.dispatch('tags/addTag', {
          name: this.newTagName.trim(),
          color: this.newTagColor
        })
        this.form.tagIds.push(newTag.id)
        this.newTagName = ''
      } catch (error) {
        console.error('Error creating tag:', error)
      }
    },
    
    async submitForm() {
      this.loading = true
      this.urlError = null
      
      // 验证URL格式
      if (!this.validateUrl(this.form.url)) {
        this.loading = false
        return
      }

      try {
        const bookmarkData = {
          title: this.form.title,
          url: this.form.url,
          description: this.form.description,
          tagIds: this.form.tagIds
        }

        if (this.isEdit && this.bookmark) {
          bookmarkData.id = this.bookmark.id
          await this.$store.dispatch('bookmarks/updateBookmark', bookmarkData)
        } else {
          await this.$store.dispatch('bookmarks/createBookmark', bookmarkData)
        }

        this.$emit('save', bookmarkData)
      } catch (error) {
        console.error('Error saving bookmark:', error)
      } finally {
        this.loading = false
      }
    },
    
    validateUrl(url) {
      try {
        new URL(url)
        return true
      } catch (e) {
        this.urlError = 'Please enter a valid URL'
        return false
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

.tags-container {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  background-color: var(--surface-color);
}

.tags-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 40px;
}

.tag-search {
  width: 100%;
  margin-bottom: 8px;
  padding: 8px 12px;
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

.new-tag-input {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.new-tag-input input[type="text"] {
  flex: 1;
}

.new-tag-input input[type="color"] {
  width: 32px;
  height: 32px;
  padding: 2px;
}

.new-tag-input button {
  padding: 4px 8px;
}
</style>