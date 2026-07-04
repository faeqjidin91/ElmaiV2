/**
 * router/index.js - Vue Router Configuration
 *
 * This file configures the application routing using Vue Router 5.
 * It defines all routes and navigation structure for the SPA.
 *
 * Routing Features:
 * - Hash-based routing (createWebHashHistory) for static hosting compatibility
 * - Lazy loading for all route components (code splitting)
 * - Nested routes for layout-based navigation
 * - Automatic scroll to top on navigation
 *
 * Route Structure:
 * - Protected routes: Wrapped in DefaultLayout with sidebar and header
 * - Public routes: Login, Register, 404, 500 pages without layout
 *
 * Adding New Routes:
 * 1. Import component (use dynamic import for code splitting)
 * 2. Add route object to appropriate section
 * 3. Update _nav.js for sidebar navigation (if needed)
 *
 * @see https://router.vuejs.org/
 */

import { createRouter, createWebHashHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

/**
 * Application routes configuration
 * @type {Array<Object>}
 */
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/pages/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/user',
    name: 'User',
    component: () => import('@/views/forms/SubmissionForm.vue'),
  },
  {
    path: '/system',
    name: 'System',
    component: () => import('@/views/admin/UserManagement.vue'),
    meta: { roles: ['admin', 'superadmin'] },
  },
  {
    path: '/batches',
    name: 'Batches',
    component: () => import('@/views/batches/BatchGroups.vue'),
    meta: { roles: ['admin', 'superadmin'] },
  },
  {
    path: '/ships',
    name: 'Ships',
    component: () => import('@/views/ships/ShipManagement.vue'),
    meta: { roles: ['admin', 'superadmin'] },
  },
  {
    path: '/',
    redirect: '/user',
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/user',
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    // always scroll to top
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (auth.isAuthenticated && to.path === '/login') {
      return '/user'
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return '/login'
  }

  const allowedRoles = to.meta.roles
  if (allowedRoles && !allowedRoles.includes(auth.userRole)) {
    return '/user'
  }

  return true
})

export default router
