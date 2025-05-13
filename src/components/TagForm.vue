<template>
  <div class="tag-form">
    <h2 class="form-title">{{ isEdit ? 'Edit Tag' : 'Add Tag' }}</h2>
    
    <form @submit.prevent="submitForm">
      <div class="form-group">
        <label for="name">Name</label>
        <input 
          type="text" 
          id="name" 
          v-model="form.name" 
          required
          placeholder="Enter tag name"
        />
      </div>
      
      <div class="form-group">
        <label>Color</label>
        <div class="color-options">
          <div 
            v-for="color in colorOptions" 
            :key="color"
            class="color-option"
            :style="{ backgroundColor: color }"
            :class="{ 'selected': form.color === color }"
            @click="form.color = color"
          ></div>
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
        >
          {{ isEdit ? 'Update' : 'Add' }} Tag
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'TagForm',
  props: {
    tagId: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      form: {
        name: '',
        color: '#3b82f6'
      },
      colorOptions: [
        '#3b82f6', // blue
        '#10b981', // green
        '#f97316', // orange
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#14b8a6', // teal
        '#ef4444', // red
        '#f59e0b', // amber
        '#6366f1', // indigo
        '#64748b'  // slate
      ]
    }
  },
  computed: {
    ...mapGetters({
      tagById: 'tags/tagById'
    }),
    isEdit() {
      return !!this.tagId
    }
  },
  created() {
    if (this.isEdit) {
      const tag = this.tagById(this.tagId)
      if (tag) {
        this.form = {
          name: tag.name,
          color: tag.color
        }
      }
    }
  },
  methods: {
    async submitForm() {
      if (this.isEdit) {
        await this.$store.dispatch('tags/updateTag', {
          id: this.tagId,
          updates: this.form
        })
        this.$emit('updated')
      } else {
        await this.$store.dispatch('tags/addTag', this.form)
        this.$emit('added')
      }
    }
  }
}
</script>

<style scoped>
.tag-form {
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

input {
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

input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: var(--space-2);
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}

.color-option.selected {
  border-color: var(--text-primary);
  transform: scale(1.1);
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