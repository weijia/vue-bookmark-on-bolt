/**
 * 管理应用数据同步的Vuex模块
 * 职责：
 * - 维护同步相关状态(RemoteStorage, WebDAV, PouchDB等)
 * - 提供同步操作接口
 * - 处理同步错误和状态更新
 */
import { SyncService } from '../../services/syncService';
const syncService = new SyncService();

// 从localStorage加载WebDAV配置
function loadWebDAVConfig() {
  try {
    const config = localStorage.getItem('webdavConfig');
    return config ? JSON.parse(config) : {
      enabled: false,
      url: '',
      username: '',
      password: '',
      syncInterval: 30
    };
  } catch (error) {
    console.warn('Failed to load WebDAV config:', error);
    return {
      enabled: false,
      url: '',
      username: '',
      password: '', 
      syncInterval: 30
    };
  }
}

export default {
  namespaced: true,
  state: {
    remoteStorage: null,
    syncBackends: {
      remoteStorage: 'disconnected',
      webdav: 'disconnected'
    },
    syncTimes: {
      remoteStorage: null,
      webdav: null
    },
    webdavConfig: loadWebDAVConfig(),
    currentBackend: null,
    isSyncing: false, // 新增：用于跟踪同步状态
    lastSyncAttempt: null // 新增：用于跟踪上次同步尝试时间
  },
  mutations: {
    setRemoteStorage(state, instance) {
      state.remoteStorage = instance;
    },
    setSyncStatus(state, { backend, status }) {
      state.syncBackends[backend] = status;
    },
    setSyncTime(state, { backend, time }) {
      state.syncTimes[backend] = time;
    },
    setCurrentBackend(state, backend) {
      state.currentBackend = backend;
    },
    setIsSyncing(state, value) {
      state.isSyncing = value;
    },
    setLastSyncAttempt(state, time) {
      state.lastSyncAttempt = time;
    },
    updateWebDAVConfig(state, config) {
      state.webdavConfig = {
        ...state.webdavConfig,
        ...config
      };
    }
  },
  actions: {
    async initializeSync({ commit, dispatch, state, rootState }) {
      try {
        // 使用全局RemoteStorage实例
        const remoteStorage = rootState.sync.remoteStorage;
        if (!remoteStorage) {
          console.warn('RemoteStorage instance not found');
          return null;
        }

        try {
          // 声明访问权限
          remoteStorage.access.claim('bookmarks', 'rw');
          remoteStorage.access.claim('tags', 'rw');

          commit('setRemoteStorage', remoteStorage);

          // 设置事件监听
          remoteStorage.on('ready', () => {
            commit('setSyncStatus', { backend: 'remoteStorage', status: 'connected' });
            commit('setCurrentBackend', 'remoteStorage');
          });

          remoteStorage.on('connected', () => {
            commit('setSyncStatus', { backend: 'remoteStorage', status: 'connected' });
            commit('setCurrentBackend', 'remoteStorage');
            // 不在连接时立即同步，而是等待用户操作或定时同步
          });

          remoteStorage.on('disconnected', () => {
            commit('setSyncStatus', { backend: 'remoteStorage', status: 'disconnected' });
            if (state.currentBackend === 'remoteStorage') {
              commit('setCurrentBackend', null);
            }
          });

          remoteStorage.on('error', (error) => {
            commit('setSyncStatus', { backend: 'remoteStorage', status: 'error' });
            console.warn('RemoteStorage error:', error);
          });

          return remoteStorage;
        } catch (error) {
          console.warn('Failed to initialize RemoteStorage events:', error);
          return null;
        }
      } catch (error) {
        console.warn('Failed to initialize sync:', error);
        return null;
      }
    },

    async manualWebDAVSync({ commit, state, dispatch, rootState }) {
      if (state.isSyncing){
        console.log('Sync already in progress, skipping...');
        return;
      }
      try {
        commit('setIsSyncing', true);
        await syncService.startSync();
        
        commit('setSyncStatus', { backend: 'webdav', status: 'connected' });
        commit('setSyncTime', { backend: 'webdav', time: new Date() });
      } catch (error) {
        console.error('WebDAV sync failed:', error);
        commit('setSyncStatus', { 
          backend: 'webdav', 
          status: 'error',
          message: error.message || 'Unknown error'
        });
      } finally {
        commit('setIsSyncing', false);
      }
    },

    setupWebDAVAutoSync({ commit, state, dispatch }) {
      if (state.syncTimer) {
        clearInterval(state.syncTimer);
      }
      
      if (state.webdavConfig.enabled && state.webdavConfig.syncInterval > 0) {
        const intervalMs = state.webdavConfig.syncInterval * 60 * 1000;
        state.syncTimer = setInterval(() => {
          if (!state.isSyncing) {
            dispatch('manualWebDAVSync');
          }
        }, intervalMs);
      }
    },

    async startSync({ commit, state, dispatch }) {
      if (state.isSyncing) {
        console.log('Sync already in progress, skipping...');
        return;
      }

      if (state.webdavConfig.enabled) {
        await dispatch('manualWebDAVSync');
      } else {
        console.warn('WebDAV sync is not enabled'); 
      }
    }
  },
  getters: {
    syncStatus: state => backend => state.syncBackends[backend],
    lastSyncTime: state => backend => state.syncTimes[backend],
    isSyncing: state => state.isSyncing,
    canSync: state => {
      return !state.isSyncing && 
             (!state.lastSyncAttempt || (Date.now() - state.lastSyncAttempt) >= 5000);
    }
  }
};