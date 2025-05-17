<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <div class="app-container">
      <Sidebar />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import Sidebar from './components/Sidebar.vue';

export default {
  name: 'App',
  components: {
    Sidebar
  },
  data() {
    return {
      isDarkMode: false
    };
  },
  methods: {
    toggleDarkMode() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);
      document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
    }
  },
  created() {
    // 从本地存储加载暗黑模式设置
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      this.isDarkMode = savedDarkMode === 'true';
      document.documentElement.classList.toggle('dark-theme', this.isDarkMode);
    }
  }
};
</script>

<style>
.app-container {
  display: flex;
  height: 100vh;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
  
  .main-content {
    height: auto;
  }
}
</style>