<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const submitting = ref(false)
const loadingList = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const searchTerm = ref('')
const formEntries = ref([])
const showImageModal = ref(false)
const showAddFormModal = ref(false)
const selectedEntry = ref(null)
const newImagePreview = ref('')

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

  return rows.slice(0, 50)
})

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
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loadingList.value = false
  }
}

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
  errorMessage.value = ''
  successMessage.value = ''
  resetForm()
  showAddFormModal.value = true
}

const onSubmit = async () => {
  successMessage.value = ''
  errorMessage.value = ''

  if (!formData.fullName || !formData.icPassportNumber || !formData.imageBase64) {
    errorMessage.value = 'All fields are required.'
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
    successMessage.value = 'Form submitted successfully.'
    await fetchForms()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}

onMounted(fetchForms)
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

    <CAlert v-if="successMessage" color="success">{{ successMessage }}</CAlert>
    <CAlert v-if="errorMessage" color="danger">{{ errorMessage }}</CAlert>

    <CCard class="panel-card mt-4">
      <CCardHeader>User Submission List</CCardHeader>
      <CCardBody>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
          <CFormInput
            v-model="searchTerm"
            class="search-input"
            placeholder="Search by ID, name, IC/passport, or submitted by"
          />
          <small class="text-body-secondary">Showing up to 50 rows</small>
        </div>
        <div v-if="loadingList">Loading form submissions...</div>
        <CTable v-else hover responsive small class="compact-table align-middle">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>ID</CTableHeaderCell>
              <CTableHeaderCell>Name</CTableHeaderCell>
              <CTableHeaderCell>IC/Passport</CTableHeaderCell>
              <CTableHeaderCell>Submitted By</CTableHeaderCell>
              <CTableHeaderCell>Created At</CTableHeaderCell>
              <CTableHeaderCell>Image</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            <CTableRow v-for="entry in filteredEntries" :key="entry.id">
              <CTableDataCell>{{ entry.id }}</CTableDataCell>
              <CTableDataCell>{{ entry.fullName }}</CTableDataCell>
              <CTableDataCell>{{ entry.icPassportNumber }}</CTableDataCell>
              <CTableDataCell>{{ entry.submittedBy }}</CTableDataCell>
              <CTableDataCell>{{ new Date(entry.createdAt).toLocaleString() }}</CTableDataCell>
              <CTableDataCell>
                <CButton color="info" size="sm" @click="openImagePreview(entry)">Preview</CButton>
              </CTableDataCell>
            </CTableRow>
            <CTableRow v-if="filteredEntries.length === 0">
              <CTableDataCell colspan="6" class="text-center text-body-secondary py-4">
                No matching submissions found.
              </CTableDataCell>
            </CTableRow>
          </CTableBody>
        </CTable>
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
              <div>{{ new Date(selectedEntry.createdAt).toLocaleString() }}</div>
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
