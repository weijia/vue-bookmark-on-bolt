const state = {
  notification: null
}

const mutations = {
  setNotification(state, payload) {
    state.notification = payload
  },
  clearNotification(state) {
    state.notification = null
  }
}

const actions = {
  showNotification({ commit }, payload) {
    commit('notification/setNotification', payload)
    setTimeout(() => {
      commit('clearNotification')
    }, 5000)
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}