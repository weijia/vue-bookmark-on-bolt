import { SyncService } from '../../services/syncService';
const syncService = new SyncService();

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
    webdavConfig: {
      enabled: false,
      url: '',
      username: '',
      password: '',
      syncInterval: 30 // minutes
    },
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
            // 只在首次准备就绪时同步
            if (!state.lastSyncAttempt) {
              dispatch('debouncedSync', 'remoteStorage').catch(err => {
                console.warn('Initial sync failed:', err);
              });
            }
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

    // 使用防抖的同步操作
    debouncedSync: syncService.debounce(async function({ state, commit, dispatch }, backend) {
      // 检查是否已经在同步中
      if (state.isSyncing) {
        console.log('Sync already in progress, skipping...');
        return;
      }

      // 检查距离上次同步尝试是否太近（小于5秒）
      const now = Date.now();
      if (state.lastSyncAttempt && (now - state.lastSyncAttempt) < 5000) {
        console.log('Last sync attempt too recent, skipping...');
        return;
      }

      commit('setLastSyncAttempt', now);
      
      try {
        commit('setIsSyncing', true);
        commit('setSyncStatus', { backend, status: 'syncing' });

        if (backend === 'remoteStorage') {
          if (!state.remoteStorage) {
            console.warn('RemoteStorage not available for sync');
            commit('setSyncStatus', { backend, status: 'disconnected' });
            return;
          }
          
          try {
            const syncData = await debouncedSyncWithRemoteStorage(state);
            if (syncData.bookmarks) {
              await dispatch('bookmarks/syncWithRemote', syncData.bookmarks, { root: true });
            }
            if (syncData.tags) {
              await dispatch('tags/syncWithRemote', syncData.tags, { root: true });
            }
            commit('setSyncStatus', { backend, status: 'connected' });
            commit('setSyncTime', { backend, time: now });
          } catch (error) {
            console.warn('RemoteStorage sync error:', error);
            commit('setSyncStatus', { backend, status: 'error' });
          }
        } else {
          try {
            const syncFunction = getSyncFunction(backend);
            const syncData = await syncFunction.sync(state);
            // 处理其他后端的同步逻辑
            commit('setSyncStatus', { backend, status: 'connected' });
            commit('setSyncTime', { backend, time: now });
          } catch (error) {
            console.warn(`${backend} sync error:`, error);
            commit('setSyncStatus', { backend, status: 'error' });
          }
        }
      } catch (error) {
        console.warn(`Unexpected sync error:`, error);
        commit('setSyncStatus', { backend, status: 'error' });
      } finally {
        commit('setIsSyncing', false);
      }
    }, 1000),

    // 原始sync方法重定向到debouncedSync
    async sync({ dispatch }, backend) {
      return dispatch('debouncedSync', backend).catch(err => {
        console.warn('Sync operation failed:', err);
      });
    },

    async manualWebDAVSync({ commit, state, dispatch, rootState }) {
      if (state.isSyncing){
        console.log('Sync already in progress, skipping...');
        return;
      }
      try {
        commit('setIsSyncing', true);
        await syncService.syncWithWebDAV(rootState);
        
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