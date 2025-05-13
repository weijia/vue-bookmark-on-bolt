<template>
  <div 
    class="bookmark-item" 
    :class="{ 'invalid': !bookmark.isValid, 'compact': isCompact }"
    @touchstart="isMobile() ? touchStart($event) : null"
    @touchmove="isMobile() ? touchMove($event) : null"
    @touchend="isMobile() ? touchEnd() : null"
  >
    <div class="bookmark-content" :style="swipeStyle">
      <div class="bookmark-favicon" v-if="!isCompact">
        <img 
          :src="bookmark.favicon" 
          :alt="bookmark.title"
          @error="onFaviconError"
          class="favicon-img"
        />
      </div>
      
      <div class="bookmark-details">
        <div class="bookmark-header">
          <h3 class="bookmark-title">
            <a 
              :href="bookmark.url" 
              target="_blank" 
              rel="noopener noreferrer"
              @click="visitBookmark"
            >{{ bookmark.title }}</a>
          </h3>
          
          <div class="bookmark-actions desktop-actions">
            <button 
              class="action-btn edit-btn" 
              @click="$emit('edit', bookmark.id)"
              title="Edit"
            >
              ✏️
            </button>
            <button 
              class="action-btn delete-btn" 
              @click="$emit('delete', bookmark.id)"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
        
        <div class="bookmark-url">{{ formatUrl(bookmark.url) }}</div>
        
        <p v-if="bookmark.description && !isCompact" class="bookmark-description">
          {{ bookmark.description }}
        </p>
        
        <div class="bookmark-tags">
          <span 
            v-for="tagId in bookmark.tagIds" 
            :key="tagId"
            class="tag"
            :style="{ backgroundColor: getTagColor(tagId) + '20', 
                      color: getTagColor(tagId) }"
          >
            {{ getTagName(tagId) }}
          </span>
        </div>
        
        <div class="bookmark-meta" v-if="!isCompact">
          <span v-if="bookmark.lastVisited" class="meta-item">
            Last visited: {{ formatDate(bookmark.lastVisited) }}
          </span>
          <span class="meta-item">
            Added: {{ formatDate(bookmark.createdAt) }}
          </span>
          <span v-if="bookmark.visitCount > 0" class="meta-item">
            {{ bookmark.visitCount }} visits
          </span>
        </div>
      </div>
    </div>
    
    <!-- Mobile swipe actions -->
    <div class="swipe-actions" :style="actionsStyle">
      <button 
        class="swipe-btn edit-btn" 
        @click="$emit('edit', bookmark.id)"
      >
        ✏️
      </button>
      <button 
        class="swipe-btn delete-btn" 
        @click="$emit('delete', bookmark.id)"
      >
        🗑️
      </button>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { extractDomain } from '../utils/urlValidator'

export default {
  name: 'BookmarkItem',
  props: {
    bookmark: {
      type: Object,
      required: true
    },
    isCompact: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      touchStartClientX: null,
      swipeOffset: 0,
      isSwiping: false
    }
  },
  computed: {
    ...mapGetters({
      tagById: 'tags/tagById'
    }),
    swipeStyle() {
      return {
        transform: `translateX(${this.swipeOffset}px)`,
        transition: this.isSwiping ? 'none' : 'transform 0.3s'
      }
    },
    actionsStyle() {
      return {
        transform: `translateX(${this.swipeOffset + 100}px)`,
        transition: this.isSwiping ? 'none' : 'transform 0.3s'
      }
    }
  },
  methods: {
    formatUrl(url) {
      return extractDomain(url)
    },
    
    formatDate(dateString) {
      const date = new Date(dateString)
      const now = new Date()
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        return 'Today'
      } else if (diffDays === 1) {
        return 'Yesterday'
      } else if (diffDays < 7) {
        return `${diffDays} days ago`
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7)
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
      } else {
        return date.toLocaleDateString()
      }
    },
    
    getTagName(tagId) {
      const tag = this.tagById(tagId)
      return tag ? tag.name : ''
    },
    
    getTagColor(tagId) {
      const tag = this.tagById(tagId)
      return tag ? tag.color : '#cccccc'
    },
    
    onFaviconError(e) {
      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'
    },
    
    visitBookmark() {
      this.$store.dispatch('bookmarks/visitBookmark', this.bookmark.id)
    },
    
    touchStart(e) {
      if (!this.isMobile()) return
      this.touchStartClientX = e.touches[0].clientX
      this.isSwiping = true
    },
    
    touchMove(e) {
      if (!this.isMobile() || !this.touchStartClientX) return
      const currentX = e.touches[0].clientX
      const diff = currentX - this.touchStartClientX
      
      // Only allow right-to-left swipe
      if (diff < 0) {
        this.swipeOffset = Math.max(diff, -100) // Limit swipe to -100px
      } else {
        this.swipeOffset = 0
      }
    },
    
    touchEnd() {
      if (!this.isMobile()) return
      this.touchStartClientX = null
      this.isSwiping = false
      
      // Snap to position
      if (this.swipeOffset < -50) {
        this.swipeOffset = -100 // Fully open
      } else {
        this.swipeOffset = 0 // Close
      }
    },
    
    isMobile() {
      return window.innerWidth <= 768
    }
  }
}
</script>

<style scoped>
.bookmark-item {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-3);
  border-radius: 12px;
  background-color: var(--card-color);
  border: 1px solid var(--border-color);
  margin-bottom: var(--space-3);
  transition: transform 0.2s, box-shadow 0.2s;
}

.bookmark-item.compact {
  padding: var(--space-2);
  margin-bottom: var(--space-2);
}

.bookmark-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.bookmark-item.invalid {
  border-left: 3px solid var(--error-color);
}

.bookmark-content {
  display: flex;
  flex: 1;
  position: relative;
  z-index: 1;
  background-color: var(--card-color);
}

.bookmark-favicon {
  margin-right: var(--space-3);
}

.favicon-img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.bookmark-details {
  flex: 1;
}

.bookmark-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.bookmark-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.compact .bookmark-title {
  display: inline;
  margin-right: var(--space-2);
}

.bookmark-title a {
  color: var(--text-primary);
  text-decoration: none;
  transition: color 0.2s;
}

.bookmark-title a:hover {
  color: var(--primary-color);
}

.bookmark-url {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.compact .bookmark-url {
  display: inline;
  margin-bottom: 0;
  margin-right: var(--space-2);
}

.bookmark-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.bookmark-tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.compact .bookmark-tags {
  display: inline-flex;
  margin-bottom: 0;
}

.bookmark-meta {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.meta-item {
  margin-right: 12px;
}

.desktop-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: var(--hover-color);
}

/* Mobile swipe actions */
.swipe-actions {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  display: none;
  gap: 1px;
}

.swipe-btn {
  width: 50px;
  height: 100%;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swipe-btn.edit-btn {
  background-color: var(--primary-color);
}

.swipe-btn.delete-btn {
  background-color: var(--error-color);
}

@media (max-width: 768px) {
  .bookmark-favicon {
    margin-right: var(--space-2);
  }
  
  .bookmark-title {
    font-size: 0.95rem;
  }
  
  .bookmark-description {
    font-size: 0.85rem;
  }
  
  .desktop-actions {
    display: none;
  }
  
  .swipe-actions {
    display: flex;
  }
}
</style>