<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const showShell = computed(() => route.name !== 'Login' && auth.isAuthenticated)
const isSidebarOpen = ref(true)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const onLogout = () => {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <div v-if="showShell" class="app-layout">
      <aside class="app-sidebar" :class="{ collapsed: !isSidebarOpen }">
        <div class="sidebar-brand">
          <div class="brand-dot" />
          <strong v-if="isSidebarOpen" class="text-white">Operations</strong>
        </div>

        <nav class="sidebar-nav">
          <RouterLink to="/user" class="app-link" active-class="app-link-active">
            <span class="app-link-icon">
              <CIcon icon="cil-user" />
            </span>
            <span v-if="isSidebarOpen" class="app-link-text">User</span>
          </RouterLink>
          <RouterLink
            v-if="['admin', 'superadmin'].includes(auth.userRole)"
            to="/system"
            class="app-link"
            active-class="app-link-active"
          >
            <span class="app-link-icon">
              <CIcon icon="cil-settings" />
            </span>
            <span v-if="isSidebarOpen" class="app-link-text">System</span>
          </RouterLink>
          <RouterLink
            v-if="['admin', 'superadmin'].includes(auth.userRole)"
            to="/batches"
            class="app-link"
            active-class="app-link-active"
          >
            <span class="app-link-icon">
              <CIcon icon="cil-layers" />
            </span>
            <span v-if="isSidebarOpen" class="app-link-text">Batches</span>
          </RouterLink>
          <RouterLink
            v-if="['admin', 'superadmin'].includes(auth.userRole)"
            to="/ships"
            class="app-link"
            active-class="app-link-active"
          >
            <span class="app-link-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="ferry-icon">
                <path
                  d="M6,6H18V9.96L12,8L6,9.96M3.94,19H4C5.6,19 7,18.12 8,17C9,18.12 10.4,19 12,19C13.6,19 15,18.12 16,17C17,18.12 18.4,19 20,19H20.05L21.95,12.31C22.03,12.06 22,11.78 21.89,11.54C21.76,11.3 21.55,11.12 21.29,11.04L20,10.62V6C20,4.89 19.1,4 18,4H15V1H9V4H6A2,2 0 0,0 4,6V10.62L2.71,11.04C2.45,11.12 2.24,11.3 2.11,11.54C2,11.78 1.97,12.06 2.05,12.31M20,21C18.61,21 17.22,20.53 16,19.67C13.56,21.38 10.44,21.38 8,19.67C6.78,20.53 5.39,21 4,21H2V23H4C5.37,23 6.74,22.65 8,22C10.5,23.3 13.5,23.3 16,22C17.26,22.65 18.62,23 20,23H22V21H20Z"
                />
              </svg>
            </span>
            <span v-if="isSidebarOpen" class="app-link-text">Ships</span>
          </RouterLink>
        </nav>
      </aside>

      <div class="app-content">
        <header class="app-header border-bottom">
          <div class="container-fluid app-header-inner">
            <div class="d-flex align-items-center gap-3">
              <CButton color="light" variant="outline" size="sm" @click="toggleSidebar">
                <span class="burger-icon" aria-hidden="true">☰</span>
              </CButton>
              <strong class="fs-5 text-white">Operations Dashboard</strong>
            </div>

            <div class="d-flex gap-3 align-items-center ms-auto">
              <span class="text-white-50 small">{{ auth.username }} ({{ auth.userRole }})</span>
              <CButton color="light" variant="outline" size="sm" @click="onLogout">Logout</CButton>
            </div>
          </div>
        </header>

        <main class="app-main">
          <router-view />
        </main>
      </div>
    </div>

    <main v-else class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style lang="scss">
@use 'styles/style';

.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% -10%, rgba(42, 124, 219, 0.18), transparent 35%),
    radial-gradient(circle at 90% 0%, rgba(15, 76, 129, 0.22), transparent 30%),
    #f2f6fb;
}

.app-layout {
  min-height: 100vh;
}

.app-sidebar {
  width: 250px;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 1100;
  background: linear-gradient(180deg, #0e3f6a 0%, #123f66 55%, #0a2a45 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  transition: width 0.2s ease;
  overflow: hidden;
}

.app-sidebar.collapsed {
  width: 76px;
}

.sidebar-brand {
  min-height: 72px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.app-content {
  margin-left: 250px;
  width: calc(100% - 250px);
  min-width: 0;
  transition: margin-left 0.2s ease, width 0.2s ease;
}

.app-sidebar.collapsed + .app-content {
  margin-left: 76px;
  width: calc(100% - 76px);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: linear-gradient(110deg, #0f4c81 0%, #2667a6 48%, #1b365d 100%);
}

.app-header-inner {
  min-height: 72px;
  display: flex;
  align-items: center;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background-color: #4ad0ff;
  box-shadow: 0 0 0 5px rgba(74, 208, 255, 0.2);
}

.app-main {
  padding: 24px 0 40px;
}

.app-link {
  text-decoration: none;
  color: rgba(255, 255, 255, 0.76);
  padding: 10px 12px;
  border-radius: 10px;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-link-icon {
  width: 20px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

.ferry-icon {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.app-link-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-sidebar.collapsed .sidebar-brand {
  justify-content: center;
  padding: 0;
}

.app-sidebar.collapsed .app-link {
  justify-content: center;
  padding: 10px 0;
}

.app-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
}

.app-link-active {
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
}

.burger-icon {
  font-size: 1rem;
  line-height: 1;
}

@media (max-width: 991.98px) {
  .app-sidebar {
    transform: translateX(0);
  }

  .app-sidebar.collapsed {
    transform: translateX(-100%);
    width: 250px;
  }

  .app-content {
    width: 100%;
    margin-left: 0;
  }

  .app-sidebar.collapsed + .app-content {
    width: 100%;
    margin-left: 0;
  }
}
</style>
