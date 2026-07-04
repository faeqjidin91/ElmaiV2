<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const users = ref([])
const errorMessage = ref('')
const successMessage = ref('')

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

const fetchUsers = async () => {
  loading.value = true
  errorMessage.value = ''

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
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

const createUser = async () => {
  successMessage.value = ''
  errorMessage.value = ''

  if (!createUserForm.username || !createUserForm.password || !createUserForm.role) {
    errorMessage.value = 'Username, password and role are required.'
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
    successMessage.value = 'User created successfully.'
    await fetchUsers()
  } catch (error) {
    errorMessage.value = error.message
  }
}

const updateRole = async (userId, role) => {
  successMessage.value = ''
  errorMessage.value = ''

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

    successMessage.value = 'Role updated.'
    await fetchUsers()
  } catch (error) {
    errorMessage.value = error.message
  }
}

onMounted(fetchUsers)
</script>

<template>
  <div class="container dashboard-page">
    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
      <div>
        <h2 class="dashboard-title mb-1">System</h2>
        <p class="text-body-secondary mb-0">Manage users and access roles from the system panel.</p>
      </div>
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

    <CAlert v-if="successMessage" color="success">{{ successMessage }}</CAlert>
    <CAlert v-if="errorMessage" color="danger">{{ errorMessage }}</CAlert>

    <CCard class="mb-4 panel-card">
      <CCardHeader>Create User</CCardHeader>
      <CCardBody>
        <CRow class="g-3">
          <CCol md="4">
            <CFormInput v-model="createUserForm.username" placeholder="Username" />
          </CCol>
          <CCol md="4">
            <CFormInput
              type="password"
              v-model="createUserForm.password"
              placeholder="Password"
            />
          </CCol>
          <CCol md="2">
            <CFormSelect
              v-model="createUserForm.role"
              :options="isSuperadmin ? roleOptions : roleOptions.filter((r) => r.value !== 'superadmin')"
            />
          </CCol>
          <CCol md="2" class="d-grid">
            <CButton color="primary" @click="createUser">Create</CButton>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>

    <CCard class="panel-card">
      <CCardHeader>Existing Users</CCardHeader>
      <CCardBody>
        <div v-if="loading">Loading users...</div>
        <CTable v-else hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>Username</CTableHeaderCell>
              <CTableHeaderCell>Role</CTableHeaderCell>
              <CTableHeaderCell>Actions</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow v-for="user in users" :key="user.id">
              <CTableDataCell>{{ user.id }}</CTableDataCell>
              <CTableDataCell>{{ user.username }}</CTableDataCell>
              <CTableDataCell>{{ user.role }}</CTableDataCell>
              <CTableDataCell>
                <div class="d-flex gap-2">
                  <CButton
                    color="secondary"
                    size="sm"
                    :disabled="user.role === 'user' || user.role === 'superadmin'"
                    @click="updateRole(user.id, 'user')"
                  >
                    Make User
                  </CButton>
                  <CButton
                    color="warning"
                    size="sm"
                    :disabled="user.role === 'admin' || user.role === 'superadmin'"
                    @click="updateRole(user.id, 'admin')"
                  >
                    Make Admin
                  </CButton>
                  <CButton
                    v-if="isSuperadmin"
                    color="dark"
                    size="sm"
                    :disabled="user.role === 'superadmin'"
                    @click="updateRole(user.id, 'superadmin')"
                  >
                    Make Superadmin
                  </CButton>
                </div>
              </CTableDataCell>
            </CTableRow>
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
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
</style>
