import { SyncBackend, getSyncFunction } from '../../services/syncService';
import RemoteStorage from 'remotestoragejs';

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
    currentBackend: null
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
    }
  },
  actions: {
    async initializeSync({ commit, dispatch }) {
      try {
        // 初始化RemoteStorage
        const remoteStorage = new RemoteStorage({
          logging: false,
          cache: true
        });
        
        // 声明访问权限
        remoteStorage.access.claim('/bookmarks', 'rw');
        remoteStorage.access.claim('/tags', 'rw');
        
        commit('setRemoteStorage', remoteStorage);
        
        // 设置事件监听
        remoteStorage.on('ready', () => {
          commit('setSyncStatus', { backend: 'remoteStorage', status: 'connected' });
          commit('setCurrentBackend', 'remoteStorage');
          dispatch('sync', 'remoteStorage');
        });
        
        remoteStorage.on('connected', () => {
          commit('setSyncStatus', { backend: 'remoteStorage', status: 'connected' });
          commit('setCurrentBackend', 'remoteStorage');
          dispatch('sync', 'remoteStorage');
        });
        
        remoteStorage.on('disconnected', () => {
          commit('setSyncStatus', { backend: 'remoteStorage', status: 'disconnected' });
          if (state.currentBackend === 'remoteStorage') {
            commit('setCurrentBackend', null);
          }
        });
        
        remoteStorage.on('error', (error) => {
          commit('setSyncStatus', { backend: 'remoteStorage', status: 'error' });
          console.error('RemoteStorage error:', error);
        });
        
        return remoteStorage;
      } catch (error) {
        console.error('Failed to initialize sync:', error);
        throw error;
      }
    },
    async sync({ state, commit }, backend) {
      try {
        commit('setSyncStatus', { backend, status: 'syncing' });
        
        const syncFunction = getSyncFunction(backend);
        await syncFunction.sync(state);
        
        commit('setSyncStatus', { backend, status: 'connected' });
        commit('setSyncTime', { backend, time: Date.now() });
      } catch (error) {
        commit('setSyncStatus', { backend, status: 'error' });
        console.error(`${backend} sync error:`, error);
        throw error;
      }
    }
  },
  getters: {
    syncStatus: state => backend => state.syncBackends[backend],
    lastSyncTime: state => backend => state.syncTimes[backend]
  }
};