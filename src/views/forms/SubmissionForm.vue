<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const submitting = ref(false)
const loadingList = ref(false)
const searchTerm = ref('')
const formEntries = ref([])
const showImageModal = ref(false)
const showAddFormModal = ref(false)
const selectedEntry = ref(null)
const newImagePreview = ref('')
const alertMessage = ref('')
const alertColor = ref('success')
const alertTimerId = ref(null)
const entrySortKey = ref('createdAt')
const entrySortDirection = ref('desc')
const currentPage = ref(1)

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

const formatLocalDateTime = (value) => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const formData = reactive({
  fullName: '',
  icPassportNumber: '',
  imageBase64: '',
})

const totalEntries = computed(() => formEntries.value.length)
const filteredEntries = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()
  const rows = query
    ? formEntries.value.filter((entry) => {
        return [
          entry.fullName,
          entry.icPassportNumber,
          entry.submittedBy,
          String(entry.id),
        ].some((value) => String(value || '').toLowerCase().includes(query))
      })
    : formEntries.value

  const direction = entrySortDirection.value === 'asc' ? 1 : -1
  const sortedRows = [...rows].sort((a, b) => {
    if (entrySortKey.value === 'id') {
      return (Number(a.id) - Number(b.id)) * direction
    }

    if (entrySortKey.value === 'createdAt') {
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction
    }

    const left = String(a[entrySortKey.value] || '').toLowerCase()
    const right = String(b[entrySortKey.value] || '').toLowerCase()
    if (left === right) {
      return 0
    }

    return (left > right ? 1 : -1) * direction
  })

  return sortedRows
})

const totalEntryPages = computed(() => Math.max(1, Math.ceil(filteredEntries.value.length / MAX_TABLE_ROWS)))
const visibleEntries = computed(() => {
  const startIndex = (currentPage.value - 1) * MAX_TABLE_ROWS
  return filteredEntries.value.slice(startIndex, startIndex + MAX_TABLE_ROWS)
})

const goToEntryPage = (page) => {
  currentPage.value = Math.min(Math.max(1, page), totalEntryPages.value)
}

const setEntrySort = (key) => {
  if (entrySortKey.value === key) {
    entrySortDirection.value = entrySortDirection.value === 'asc' ? 'desc' : 'asc'
    currentPage.value = 1
    return
  }

  entrySortKey.value = key
  entrySortDirection.value = 'asc'
  currentPage.value = 1
}

const entrySortIndicator = (key) => {
  if (entrySortKey.value !== key) {
    return ''
  }
  return entrySortDirection.value === 'asc' ? '↑' : '↓'
}

const fetchForms = async () => {
  loadingList.value = true
  try {
    const response = await fetch('/api/forms', {
      headers: {
        ...auth.authHeaders(),
      },
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to load form submissions.')
    }

    formEntries.value = await response.json()
    currentPage.value = 1
  } catch (error) {
    showError(error, 'Failed to load form submissions.')
  } finally {
    loadingList.value = false
  }
}

watch(searchTerm, () => {
  currentPage.value = 1
})

watch(totalEntryPages, (pages) => {
  if (currentPage.value > pages) {
    currentPage.value = pages
  }
})

const openImagePreview = (entry) => {
  selectedEntry.value = entry
  showImageModal.value = true
}

const onFileSelected = (event) => {
  const file = event.target.files?.[0]
  if (!file) {
    formData.imageBase64 = ''
    newImagePreview.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    formData.imageBase64 = String(reader.result || '')
    newImagePreview.value = formData.imageBase64
  }
  reader.readAsDataURL(file)
}

const resetForm = () => {
  formData.fullName = ''
  formData.icPassportNumber = ''
  formData.imageBase64 = ''
  newImagePreview.value = ''
}

const openAddForm = () => {
  alertMessage.value = ''
  resetForm()
  showAddFormModal.value = true
}

const onSubmit = async () => {
  alertMessage.value = ''

  if (!formData.fullName || !formData.icPassportNumber || !formData.imageBase64) {
    notify('All fields are required.', 'danger')
    return
  }

  submitting.value = true
  try {
    const response = await fetch('/api/forms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.authHeaders(),
      },
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to submit form.')
    }

    resetForm()
    showAddFormModal.value = false
    notify('Form submitted successfully.')
    await fetchForms()
  } catch (error) {
    showError(error, 'Failed to submit form.')
  } finally {
    submitting.value = false
  }
}

onMounted(fetchForms)
onBeforeUnmount(clearAlertTimer)
</script>

<template>
  <div class="container dashboard-page">
    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
      <div>
        <h2 class="dashboard-title mb-1">User</h2>
        <p class="text-body-secondary mb-0">Review submitted records and preview uploaded images.</p>
      </div>
      <CButton color="primary" @click="openAddForm">Add Form</CButton>
    </div>

    <CRow class="g-3 mb-4">
      <CCol md="4">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Counts</div>
            <div class="kpi-value">{{ totalEntries }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CAlert v-if="alertMessage" class="floating-alert" :color="alertColor" dismissible @close="dismissAlert">
      {{ alertMessage }}
    </CAlert>

    <CCard class="panel-card mt-4">
      <CCardHeader>User Submission List</CCardHeader>
      <CCardBody>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          <CFormInput
            v-model="searchTerm"
            class="search-input"
            placeholder="Search by ID, name, IC/passport, or submitted by"
          />
          <small class="text-body-secondary">Showing {{ visibleEntries.length }} of {{ filteredEntries.length }} rows</small>
        </div>
        <div v-if="loadingList">Loading form submissions...</div>
        <CTable v-else hover responsive small class="compact-table align-middle">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setEntrySort('id')">
                  ID {{ entrySortIndicator('id') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setEntrySort('fullName')">
                  Name {{ entrySortIndicator('fullName') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setEntrySort('icPassportNumber')">
                  IC/Passport {{ entrySortIndicator('icPassportNumber') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setEntrySort('submittedBy')">
                  Submitted By {{ entrySortIndicator('submittedBy') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>
                <button type="button" class="table-sort-button" @click="setEntrySort('createdAt')">
                  Created At {{ entrySortIndicator('createdAt') }}
                </button>
              </CTableHeaderCell>
              <CTableHeaderCell>Image</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow v-for="entry in visibleEntries" :key="entry.id">
              <CTableDataCell>{{ entry.id }}</CTableDataCell>
              <CTableDataCell>{{ entry.fullName }}</CTableDataCell>
              <CTableDataCell>{{ entry.icPassportNumber }}</CTableDataCell>
              <CTableDataCell>{{ entry.submittedBy }}</CTableDataCell>
              <CTableDataCell>{{ formatLocalDateTime(entry.createdAt) }}</CTableDataCell>
              <CTableDataCell>
                <CButton color="info" size="sm" @click="openImagePreview(entry)">Preview</CButton>
              </CTableDataCell>
            </CTableRow>
            <CTableRow v-if="visibleEntries.length === 0">
              <CTableDataCell colspan="6" class="text-center text-body-secondary py-4">
                No matching submissions found.
              </CTableDataCell>
            </CTableRow>
          </CTableBody>
        </CTable>

        <div v-if="filteredEntries.length > 0" class="d-flex justify-content-between align-items-center mt-3">
          <small class="text-body-secondary">Page {{ currentPage }} of {{ totalEntryPages }}</small>
          <div class="d-flex gap-2">
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              @click="goToEntryPage(currentPage - 1)"
            >
              Previous
            </CButton>
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalEntryPages"
              @click="goToEntryPage(currentPage + 1)"
            >
              Next
            </CButton>
          </div>
        </div>
      </CCardBody>
    </CCard>

    <CModal :visible="showImageModal" @close="showImageModal = false" size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Full Biodata Preview</CModalTitle>
      </CModalHeader>
      <CModalBody v-if="selectedEntry">
        <CRow class="g-4 align-items-start">
          <CCol md="7">
            <div class="biodata-grid">
              <div class="biodata-label">ID</div>
              <div>{{ selectedEntry.id }}</div>
              <div class="biodata-label">Name</div>
              <div>{{ selectedEntry.fullName }}</div>
              <div class="biodata-label">IC/Passport</div>
              <div>{{ selectedEntry.icPassportNumber }}</div>
              <div class="biodata-label">Submitted By</div>
              <div>{{ selectedEntry.submittedBy }}</div>
              <div class="biodata-label">Created At</div>
              <div>{{ formatLocalDateTime(selectedEntry.createdAt) }}</div>
            </div>
          </CCol>
          <CCol md="5" class="text-center">
            <img
              :src="selectedEntry.imageBase64"
              alt="Submission Preview"
              class="preview-modal-image"
            />
          </CCol>
        </CRow>
      </CModalBody>
    </CModal>

    <CModal :visible="showAddFormModal" @close="showAddFormModal = false" size="lg" alignment="center">
      <CModalHeader>
        <CModalTitle>Add Form</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CForm @submit.prevent="onSubmit">
          <div class="mb-3">
            <CFormLabel>Name</CFormLabel>
            <CFormInput v-model="formData.fullName" placeholder="Enter full name" />
          </div>

          <div class="mb-3">
            <CFormLabel>IC/Passport Number</CFormLabel>
            <CFormInput
              v-model="formData.icPassportNumber"
              placeholder="Enter IC or Passport Number"
            />
          </div>

          <div class="mb-3">
            <CFormLabel>Image</CFormLabel>
            <CFormInput type="file" accept="image/*" @change="onFileSelected" />
            <small class="text-body-secondary d-block mt-2">Image is stored as base64 in MySQL.</small>
          </div>

          <div v-if="newImagePreview" class="mb-3 text-center">
            <img :src="newImagePreview" alt="New form preview" class="img-thumbnail preview-image" />
          </div>

          <div class="d-flex gap-2 justify-content-end">
            <CButton color="secondary" variant="outline" @click="showAddFormModal = false">Cancel</CButton>
            <CButton type="submit" color="primary" :disabled="submitting">
              {{ submitting ? 'Submitting...' : 'Submit' }}
            </CButton>
          </div>
        </CForm>
      </CModalBody>
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
  max-width: 280px;
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

.search-input {
  max-width: 420px;
}

.compact-table :deep(th),
.compact-table :deep(td) {
  padding-top: 0.55rem;
  padding-bottom: 0.55rem;
  font-size: 0.92rem;
}

.table-sort-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font-weight: 600;
}

.floating-alert {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(560px, calc(100vw - 2rem));
}

.preview-image {
  max-height: 260px;
  width: 100%;
  object-fit: cover;
}

.biodata-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px 14px;
}

.biodata-label {
  font-weight: 700;
  color: #16395e;
}

.preview-modal-image {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}
</style>
