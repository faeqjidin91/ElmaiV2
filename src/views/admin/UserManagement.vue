<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const users = ref([])
const showCreateUserModal = ref(false)
const selectedRoles = reactive({})
const alertMessage = ref('')
const alertColor = ref('success')
const alertTimerId = ref(null)
const userSortKey = ref('id')
const userSortDirection = ref('asc')
const currentPage = ref(1)
const userSearchTerm = ref('')

const MAX_TABLE_ROWS = 25

const clearAlertTimer = () => {
  if (alertTimerId.value) {
    clearTimeout(alertTimerId.value)
    alertTimerId.value = null
  }
}

const dismissAlert = () => {
  alertMessage.value = ''
  clearAlertTimer()
}

const notify = (message, color = 'success') => {
  clearAlertTimer()
  alertColor.value = color
  alertMessage.value = message
  alertTimerId.value = setTimeout(() => {
    alertMessage.value = ''
    alertTimerId.value = null
  }, 3000)
}

const showError = (error, fallbackMessage = 'Unexpected error.') => {
  notify(error?.message || fallbackMessage, 'danger')
}

const createUserForm = reactive({
  username: '',
  password: '',
  role: 'user',
})

const roleOptions = [
  { label: 'User', value: 'user' },
  { label: 'Admin', value: 'admin' },
  { label: 'Superadmin', value: 'superadmin' },
]

const totalUsers = computed(() => users.value.length)
const totalAdmins = computed(() => users.value.filter((user) => user.role === 'admin').length)
const totalStandardUsers = computed(() => users.value.filter((user) => user.role === 'user').length)
const totalSuperadmins = computed(() => users.value.filter((user) => user.role === 'superadmin').length)
const isSuperadmin = computed(() => auth.userRole === 'superadmin')

const filteredUsers = computed(() => {
  const query = userSearchTerm.value.trim().toLowerCase()
  if (!query) {
    return users.value
  }

  return users.value.filter((user) => {
    return [String(user.id), user.username, user.role].some((value) =>
      String(value || '').toLowerCase().includes(query),
    )
  })
})

const sortedUsers = computed(() => {
  const direction = userSortDirection.value === 'asc' ? 1 : -1

  return [...filteredUsers.value].sort((a, b) => {
    if (userSortKey.value === 'id') {
      return (Number(a.id) - Number(b.id)) * direction
    }

    const left = String(a[userSortKey.value] || '').toLowerCase()
    const right = String(b[userSortKey.value] || '').toLowerCase()
    if (left === right) {
      return 0
    }
    return (left > right ? 1 : -1) * direction
  })
})

const totalUserPages = computed(() => Math.max(1, Math.ceil(sortedUsers.value.length / MAX_TABLE_ROWS)))
const visibleUsers = computed(() => {
  const startIndex = (currentPage.value - 1) * MAX_TABLE_ROWS
  return sortedUsers.value.slice(startIndex, startIndex + MAX_TABLE_ROWS)
})

const goToUserPage = (page) => {
  currentPage.value = Math.min(Math.max(1, page), totalUserPages.value)
}

const setUserSort = (key) => {
  if (userSortKey.value === key) {
    userSortDirection.value = userSortDirection.value === 'asc' ? 'desc' : 'asc'
    currentPage.value = 1
    return
  }

  userSortKey.value = key
  userSortDirection.value = 'asc'
  currentPage.value = 1
}

const userSortIndicator = (key) => {
  if (userSortKey.value !== key) {
    return ''
  }
  return userSortDirection.value === 'asc' ? '↑' : '↓'
}

const canEditUserRole = (user) => isSuperadmin.value || user.role !== 'superadmin'

const getRoleOptionsForUser = (user) => {
  if (isSuperadmin.value) {
    return roleOptions
  }

  if (user.role === 'superadmin') {
    return roleOptions.filter((item) => item.value === 'superadmin')
  }

  return roleOptions.filter((item) => item.value !== 'superadmin')
}

const fetchUsers = async () => {
  loading.value = true

  try {
    const response = await fetch('/api/users', {
      headers: {
        ...auth.authHeaders(),
      },
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to fetch users.')
    }

    users.value = await response.json()
    Object.keys(selectedRoles).forEach((key) => {
      delete selectedRoles[key]
    })
    users.value.forEach((user) => {
      selectedRoles[user.id] = user.role
    })
    currentPage.value = 1
  } catch (error) {
    showError(error, 'Failed to fetch users.')
  } finally {
    loading.value = false
  }
}

watch(totalUserPages, (pages) => {
  if (currentPage.value > pages) {
    currentPage.value = pages
  }
})

watch(userSearchTerm, () => {
  currentPage.value = 1
})

const createUser = async () => {
  alertMessage.value = ''

  if (!createUserForm.username || !createUserForm.password || !createUserForm.role) {
    notify('Username, password and role are required.', 'danger')
    return
  }

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.authHeaders(),
      },
      body: JSON.stringify(createUserForm),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to create user.')
    }

    createUserForm.username = ''
    createUserForm.password = ''
    createUserForm.role = 'user'
    showCreateUserModal.value = false
    notify('User created successfully.')
    await fetchUsers()
  } catch (error) {
    showError(error, 'Failed to create user.')
  }
}

const updateRole = async (userId, role) => {
  alertMessage.value = ''

  try {
    const response = await fetch(`/api/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...auth.authHeaders(),
      },
      body: JSON.stringify({ role }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update role.')
    }

    notify('Role updated.')
    await fetchUsers()
  } catch (error) {
    showError(error, 'Failed to update role.')
  }
}

onMounted(fetchUsers)
onBeforeUnmount(clearAlertTimer)
</script>

<template>
  <div class="container dashboard-page">
    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
      <div>
        <h2 class="dashboard-title mb-1">System</h2>
        <p class="text-body-secondary mb-0">Manage users and access roles from the system panel.</p>
      </div>
      <CButton color="primary" @click="showCreateUserModal = true">Add User</CButton>
    </div>

    <CRow class="g-3 mb-4">
      <CCol md="3">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Total Users</div>
            <div class="kpi-value">{{ totalUsers }}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md="3">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Superadmins</div>
            <div class="kpi-value">{{ totalSuperadmins }}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md="3">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Admins</div>
            <div class="kpi-value">{{ totalAdmins }}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md="3">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Standard Users</div>
            <div class="kpi-value">{{ totalStandardUsers }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CAlert v-if="alertMessage" class="floating-alert" :color="alertColor" dismissible @close="dismissAlert">
      {{ alertMessage }}
    </CAlert>

    <CCard class="panel-card">
      <CCardHeader>Existing Users</CCardHeader>
      <CCardBody>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-2">
          <CFormInput
            v-model="userSearchTerm"
            class="search-input"
            placeholder="Search by ID, username, or role"
          />
        <div class="small text-body-secondary">
          Showing {{ visibleUsers.length }} of {{ sortedUsers.length }} rows
        </div>
        </div>
        <div v-if="loading">Loading users...</div>
        <CTable v-else hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setUserSort('id')">
                  ID {{ userSortIndicator('id') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setUserSort('username')">
                  Username {{ userSortIndicator('username') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setUserSort('role')">
                  Role {{ userSortIndicator('role') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>Change Role</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow v-for="user in visibleUsers" :key="user.id">
              <CTableDataCell>{{ user.id }}</CTableDataCell>
              <CTableDataCell>{{ user.username }}</CTableDataCell>
              <CTableDataCell>{{ user.role }}</CTableDataCell>
              <CTableDataCell>
                <div class="d-flex gap-2 align-items-center">
                  <CFormSelect
                    v-model="selectedRoles[user.id]"
                    size="sm"
                    :options="getRoleOptionsForUser(user)"
                    :disabled="!canEditUserRole(user)"
                  />
                  <CButton
                    color="primary"
                    size="sm"
                    :disabled="!canEditUserRole(user) || selectedRoles[user.id] === user.role"
                    @click="updateRole(user.id, selectedRoles[user.id])"
                  >
                    Update
                  </CButton>
                </div>
              </CTableDataCell>
            </CTableRow>
            <CTableRow v-if="visibleUsers.length === 0">
              <CTableDataCell colspan="4" class="text-center text-body-secondary py-4">
                No users found.
              </CTableDataCell>
            </CTableRow>
          </CTableBody>
        </CTable>

        <div v-if="sortedUsers.length > 0" class="d-flex justify-content-between align-items-center mt-3">
          <small class="text-body-secondary">Page {{ currentPage }} of {{ totalUserPages }}</small>
          <div class="d-flex gap-2">
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              @click="goToUserPage(currentPage - 1)"
            >
              Previous
            </CButton>
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalUserPages"
              @click="goToUserPage(currentPage + 1)"
            >
              Next
            </CButton>
          </div>
        </div>
      </CCardBody>
    </CCard>

    <CModal :visible="showCreateUserModal" @close="showCreateUserModal = false">
      <CModalHeader>
        <CModalTitle>Add User</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow class="g-3">
          <CCol md="12">
            <CFormInput v-model="createUserForm.username" placeholder="Username" />
          </CCol>
          <CCol md="12">
            <CFormInput
              type="password"
              v-model="createUserForm.password"
              placeholder="Password"
            />
          </CCol>
          <CCol md="12">
            <CFormSelect
              v-model="createUserForm.role"
              :options="isSuperadmin ? roleOptions : roleOptions.filter((r) => r.value !== 'superadmin')"
            />
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" @click="showCreateUserModal = false">Cancel</CButton>
        <CButton color="primary" @click="createUser">Create User</CButton>
      </CModalFooter>
    </CModal>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1200px;
}

.dashboard-title {
  font-weight: 700;
  color: #16395e;
}

.kpi-card {
  border: 0;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(16, 58, 94, 0.08);
}

.kpi-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: #184f82;
}

.panel-card {
  border: 0;
  border-radius: 14px;
  box-shadow: 0 10px 26px rgba(17, 61, 97, 0.1);
}

.table-sort-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font-weight: 600;
}

.search-input {
  max-width: 380px;
}

.floating-alert {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(560px, calc(100vw - 2rem));
}
</style>
