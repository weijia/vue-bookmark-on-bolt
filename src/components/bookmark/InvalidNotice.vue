<template>
  <div v-if="invalidCount > 0" class="invalid-notice">
    <div class="notice-content">
      <div class="notice-icon">⚠️</div>
      <div class="notice-text">
        <p>
          {{ invalidCount }} bookmark{{ invalidCount > 1 ? 's' : '' }} 
          {{ invalidCount > 1 ? 'are' : 'is' }} invalid.
        </p>
      </div>
      <div class="notice-actions">
        <button 
          class="btn btn-sm" 
          @click="$emit('toggle-invalid')"
        >
          {{ isForceValid ? 'Show Invalid' : 'Hide Invalid' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InvalidNotice',
  props: {
    invalidCount: {
      type: Number,
      required: true
    }
  },
  computed: {
    isForceValid() {
      return this.$store.state.bookmarks.isForceValid;
    }
  }
}
</script>

<style scoped>
.invalid-notice {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background-color: var(--warning-bg);
  border-radius: 8px;
  border: 1px solid var(--warning-border);
}

.notice-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.notice-icon {
  font-size: 1.5rem;
}

.notice-text {
  flex: 1;
}

.notice-text p {
  margin: 0;
  color: var(--warning-text);
}

.btn-sm {
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
}
</style>