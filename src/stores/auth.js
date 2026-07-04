import { defineStore } from 'pinia'

const TOKEN_KEY = 'rbac_demo_token'
const USER_KEY = 'rbac_demo_user'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    userRole: (state) => state.user?.role || '',
    username: (state) => state.user?.username || '',
  },
  actions: {
    setSession(payload) {
      this.token = payload.token
      this.user = payload.user
      localStorage.setItem(TOKEN_KEY, payload.token)
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
    authHeaders() {
      return this.token ? { Authorization: `Bearer ${this.token}` } : {}
    },
  },
})
