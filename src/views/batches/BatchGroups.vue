<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const submissionUsers = ref([])
const ships = ref([])
const batches = ref([])
const loadingUsers = ref(false)
const loadingShips = ref(false)
const loadingBatches = ref(false)
const creatingBatch = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const batchFilter = ref('active')
const candidateSearch = ref('')
const candidatePickerOpen = ref(false)
const shipSearch = ref('')
const shipPickerOpen = ref(false)
const candidateComboboxRef = ref(null)
const shipComboboxRef = ref(null)
const isEditing = ref(false)
const editingBatchId = ref(null)
const showBatchFormModal = ref(false)
const showBatchDetailsModal = ref(false)
const loadingBatchDetails = ref(false)
const selectedBatch = ref(null)

const batchForm = reactive({
  batchName: '',
  shipId: '',
  expiryDate: '',
  submissionIds: [],
})

const selectedUsers = computed(() => {
  const selectedIdSet = new Set(batchForm.submissionIds)
  return submissionUsers.value.filter((user) => selectedIdSet.has(user.id))
})

const selectedShip = computed(() => {
  return ships.value.find((ship) => String(ship.id) === String(batchForm.shipId)) || null
})

const filteredShips = computed(() => {
  const query = shipSearch.value.trim().toLowerCase()
  if (!query) {
    return ships.value
  }

  return ships.value.filter((ship) => {
    return [ship.shipName, ship.shipCode, ship.imoNumber, ship.flagState, ship.cargoType].some((value) =>
      String(value || '').toLowerCase().includes(query),
    )
  })
})

const filteredCandidates = computed(() => {
  const query = candidateSearch.value.trim().toLowerCase()
  if (!query) {
    return submissionUsers.value
  }

  return submissionUsers.value.filter((user) => {
    return [user.fullName, user.icPassportNumber, user.submittedBy, String(user.id)].some((value) =>
      String(value || '').toLowerCase().includes(query),
    )
  })
})

const activeCount = computed(() => batches.value.filter((batch) => batch.isActive).length)
const historicalCount = computed(() => batches.value.filter((batch) => !batch.isActive).length)

const parseApiResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || fallbackMessage)
    }
    return data
  }

  const text = await response.text()
  if (!response.ok) {
    throw new Error(fallbackMessage)
  }

  throw new Error(
    text.startsWith('<!DOCTYPE')
      ? 'API returned HTML instead of JSON. Check that the backend server is running.'
      : fallbackMessage,
  )
}

const fetchUsers = async () => {
  loadingUsers.value = true
  try {
    const response = await fetch('/api/batch-candidates', {
      headers: {
        ...auth.authHeaders(),
      },
    })

    submissionUsers.value = await parseApiResponse(response, 'Failed to load submitted users.')
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loadingUsers.value = false
  }
}

const fetchShips = async () => {
  loadingShips.value = true
  try {
    const response = await fetch('/api/ships', {
      headers: {
        ...auth.authHeaders(),
      },
    })

    ships.value = await parseApiResponse(response, 'Failed to load ships.')
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loadingShips.value = false
  }
}

const fetchBatches = async () => {
  loadingBatches.value = true
  try {
    const response = await fetch(`/api/batches?status=${batchFilter.value}`, {
      headers: {
        ...auth.authHeaders(),
      },
    })

    batches.value = await parseApiResponse(response, 'Failed to load batch groups.')
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loadingBatches.value = false
  }
}

const toggleUserSelection = (submissionId, checked) => {
  if (checked) {
    if (!batchForm.submissionIds.includes(submissionId)) {
      batchForm.submissionIds = [...batchForm.submissionIds, submissionId]
    }
    return
  }

  batchForm.submissionIds = batchForm.submissionIds.filter((id) => id !== submissionId)
}

const clearSelection = () => {
  batchForm.submissionIds = []
}

const openCandidatePicker = () => {
  candidatePickerOpen.value = true
}

const closeCandidatePicker = () => {
  candidatePickerOpen.value = false
}

const onCandidateSearchInput = (event) => {
  candidateSearch.value = event.target.value
  candidatePickerOpen.value = true
}

const handleDocumentPointerDown = (event) => {
  const candidateRoot = candidateComboboxRef.value
  const shipRoot = shipComboboxRef.value
  const target = event.target

  if (candidateRoot && !candidateRoot.contains(target)) {
    closeCandidatePicker()
  }

  if (shipRoot && !shipRoot.contains(target)) {
    closeShipPicker()
  }
}

const openShipPicker = () => {
  shipPickerOpen.value = true
  if (!shipSearch.value && selectedShip.value) {
    shipSearch.value = `${selectedShip.value.shipName} ${selectedShip.value.shipCode}`
  }
}

const closeShipPicker = () => {
  shipPickerOpen.value = false
  shipSearch.value = selectedShip.value ? `${selectedShip.value.shipName} ${selectedShip.value.shipCode}` : shipSearch.value
}

const selectShip = (shipId) => {
  batchForm.shipId = String(shipId)
  const ship = ships.value.find((item) => String(item.id) === String(shipId))
  shipSearch.value = ship ? `${ship.shipName} (${ship.shipCode})` : ''
  closeShipPicker()
}

const onShipSearchInput = (event) => {
  shipSearch.value = event.target.value
  if (selectedShip.value) {
    const selectedLabel = `${selectedShip.value.shipName} (${selectedShip.value.shipCode})`
    if (shipSearch.value !== selectedLabel) {
      batchForm.shipId = ''
    }
  }
  shipPickerOpen.value = true
}

const removeSelectedUser = (submissionId) => {
  batchForm.submissionIds = batchForm.submissionIds.filter((id) => id !== submissionId)
}

const resetBatchForm = () => {
  batchForm.batchName = ''
  batchForm.shipId = ''
  batchForm.expiryDate = ''
  batchForm.submissionIds = []
  candidateSearch.value = ''
  candidatePickerOpen.value = false
  shipSearch.value = ''
  shipPickerOpen.value = false
  isEditing.value = false
  editingBatchId.value = null
  showBatchFormModal.value = false
}

const openCreateBatchModal = () => {
  successMessage.value = ''
  errorMessage.value = ''
  batchForm.batchName = ''
  batchForm.shipId = ''
  batchForm.expiryDate = ''
  batchForm.submissionIds = []
  candidateSearch.value = ''
  candidatePickerOpen.value = false
  shipSearch.value = ''
  shipPickerOpen.value = false
  isEditing.value = false
  editingBatchId.value = null
  showBatchFormModal.value = true
}

const createBatch = async () => {
  successMessage.value = ''
  errorMessage.value = ''

  if (!batchForm.batchName || !batchForm.shipId || !batchForm.expiryDate || batchForm.submissionIds.length === 0) {
    errorMessage.value = 'Batch name, ship, expiry date, and at least one selected submitted user are required.'
    return
  }

  creatingBatch.value = true
  try {
    const response = await fetch(isEditing.value ? `/api/batches/${editingBatchId.value}` : '/api/batches', {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.authHeaders(),
      },
      body: JSON.stringify({
        batchName: batchForm.batchName,
        shipId: Number(batchForm.shipId),
        expiryDate: batchForm.expiryDate,
        submissionIds: batchForm.submissionIds,
      }),
    })

    await parseApiResponse(response, isEditing.value ? 'Failed to update batch group.' : 'Failed to create batch group.')
    const wasEditing = isEditing.value
    resetBatchForm()
    successMessage.value = wasEditing
      ? 'Batch group updated successfully.'
      : 'Batch group created successfully.'
    batchFilter.value = 'active'
    await fetchBatches()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    creatingBatch.value = false
  }
}

const onFilterChange = async () => {
  await fetchBatches()
}

const openBatchDetails = async (batchId) => {
  loadingBatchDetails.value = true
  showBatchDetailsModal.value = true
  selectedBatch.value = null

  try {
    const response = await fetch(`/api/batches/${batchId}`, {
      headers: {
        ...auth.authHeaders(),
      },
    })

    selectedBatch.value = await parseApiResponse(response, 'Failed to load batch details.')
  } catch (error) {
    errorMessage.value = error.message
    showBatchDetailsModal.value = false
  } finally {
    loadingBatchDetails.value = false
  }
}

const startEditBatch = async (batchId) => {
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/batches/${batchId}`, {
      headers: {
        ...auth.authHeaders(),
      },
    })

    const batch = await parseApiResponse(response, 'Failed to load batch for editing.')
    batchForm.batchName = batch.batchName
    batchForm.shipId = String(batch.shipId || '')
    batchForm.expiryDate = new Date(batch.expiryDate).toISOString().slice(0, 10)
    batchForm.submissionIds = batch.members.map((member) => member.id)
    candidateSearch.value = ''
    candidatePickerOpen.value = false
    shipSearch.value = batch.shipName && batch.shipCode ? `${batch.shipName} (${batch.shipCode})` : ''
    shipPickerOpen.value = false
    isEditing.value = true
    editingBatchId.value = batch.id
    showBatchFormModal.value = true
  } catch (error) {
    errorMessage.value = error.message
  }
}

const deleteBatch = async (batchId) => {
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'DELETE',
      headers: {
        ...auth.authHeaders(),
      },
    })

    await parseApiResponse(response, 'Failed to remove batch group.')
    if (editingBatchId.value === batchId) {
      resetBatchForm()
    }
    successMessage.value = 'Batch group removed successfully.'
    await fetchBatches()
  } catch (error) {
    errorMessage.value = error.message
  }
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  await Promise.all([fetchUsers(), fetchShips(), fetchBatches()])
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>

<template>
  <div class="container dashboard-page">
    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
      <div>
        <h2 class="dashboard-title mb-1">Batch Monitoring</h2>
        <p class="text-body-secondary mb-0">
          Create batch groups from submitted biodata records and monitor active versus historical sets.
        </p>
      </div>
      <CButton color="primary" @click="openCreateBatchModal">Create Batch</CButton>
    </div>

    <CRow class="g-3 mb-4">
      <CCol md="4">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Selected Users</div>
            <div class="kpi-value">{{ batchForm.submissionIds.length }}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md="4">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Active Batches</div>
            <div class="kpi-value">{{ activeCount }}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md="4">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Historical Batches</div>
            <div class="kpi-value">{{ historicalCount }}</div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CAlert v-if="successMessage" color="success">{{ successMessage }}</CAlert>
    <CAlert v-if="errorMessage" color="danger">{{ errorMessage }}</CAlert>

    <CRow class="g-4">
      <CCol xl="12">
        <CCard class="panel-card h-100">
          <CCardHeader class="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <span>Batch Monitoring</span>
            <div class="d-flex gap-2">
              <CButton
                size="sm"
                :color="batchFilter === 'active' ? 'primary' : 'secondary'"
                :variant="batchFilter === 'active' ? undefined : 'outline'"
                @click="batchFilter = 'active'; onFilterChange()"
              >
                Active
              </CButton>
              <CButton
                size="sm"
                :color="batchFilter === 'historical' ? 'primary' : 'secondary'"
                :variant="batchFilter === 'historical' ? undefined : 'outline'"
                @click="batchFilter = 'historical'; onFilterChange()"
              >
                Historical
              </CButton>
            </div>
          </CCardHeader>
          <CCardBody>
            <div v-if="loadingBatches" class="text-body-secondary">Loading batch groups...</div>
            <CTable v-else hover responsive small class="compact-table align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Batch</CTableHeaderCell>
                  <CTableHeaderCell>Members</CTableHeaderCell>
                  <CTableHeaderCell>Expiry</CTableHeaderCell>
                  <CTableHeaderCell>Created By</CTableHeaderCell>
                  <CTableHeaderCell>Status</CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="batch in batches" :key="batch.id">
                  <CTableDataCell>
                    <div class="fw-semibold">{{ batch.batchName }}</div>
                    <div class="small text-body-secondary">
                      {{ batch.shipName || 'No ship selected' }} | Created {{ new Date(batch.createdAt).toLocaleString() }}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div>{{ batch.memberCount }} users</div>
                    <div class="small text-body-secondary member-text">{{ batch.memberNames }}</div>
                  </CTableDataCell>
                  <CTableDataCell>{{ new Date(batch.expiryDate).toLocaleDateString() }}</CTableDataCell>
                  <CTableDataCell>{{ batch.createdBy }}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="batch.isActive ? 'success' : 'secondary'">
                      {{ batch.isActive ? 'Active' : 'Expired' }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div class="d-flex gap-2 flex-wrap">
                      <CButton color="info" variant="outline" size="sm" @click="openBatchDetails(batch.id)">
                        Details
                      </CButton>
                      <CButton color="warning" variant="outline" size="sm" @click="startEditBatch(batch.id)">
                        Edit
                      </CButton>
                      <CButton color="danger" variant="outline" size="sm" @click="deleteBatch(batch.id)">
                        Remove
                      </CButton>
                    </div>
                  </CTableDataCell>
                </CTableRow>
                <CTableRow v-if="batches.length === 0">
                  <CTableDataCell colspan="6" class="text-center text-body-secondary py-4">
                    No batch groups found for this view.
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CModal :visible="showBatchFormModal" @close="resetBatchForm" size="xl" alignment="center">
      <CModalHeader>
        <CModalTitle>{{ isEditing ? 'Edit Batch Group' : 'Create Batch Group' }}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div class="mb-3">
          <CFormLabel>Batch Name</CFormLabel>
          <CFormInput v-model="batchForm.batchName" placeholder="Enter batch group name" />
        </div>

        <div class="mb-3">
          <CFormLabel>Ship</CFormLabel>
          <div ref="shipComboboxRef" class="ship-combobox">
            <CFormInput
              :model-value="shipSearch || (selectedShip ? `${selectedShip.shipName} (${selectedShip.shipCode})` : '')"
              placeholder="Select or search cargo ship"
              autocomplete="off"
              @focus="openShipPicker"
              @click="openShipPicker"
              @input="onShipSearchInput"
            />

            <div v-if="shipPickerOpen" class="ship-picker-panel">
              <div class="ship-picker-list">
                <div v-if="loadingShips" class="text-body-secondary small p-2">Loading ships...</div>
                <button
                  v-for="ship in filteredShips"
                  :key="ship.id"
                  type="button"
                  class="ship-option"
                  :class="{ selected: String(ship.id) === String(batchForm.shipId) }"
                  @click="selectShip(ship.id)"
                >
                  <span class="d-flex flex-column text-start">
                    <span>{{ ship.shipName }}</span>
                    <small class="text-body-secondary">
                      {{ ship.shipCode }} | IMO {{ ship.imoNumber }} | {{ ship.cargoType }}
                    </small>
                  </span>
                </button>
                <div v-if="!loadingShips && filteredShips.length === 0" class="text-body-secondary small p-2">
                  No ships match the current search.
                </div>
              </div>

              <div class="d-flex justify-content-end mt-2">
                <CButton color="secondary" variant="outline" size="sm" @click="closeShipPicker">
                  Close
                </CButton>
              </div>
            </div>
          </div>

          <small v-if="selectedShip" class="text-body-secondary d-block mt-2">
            Selected ship: {{ selectedShip.shipName }} ({{ selectedShip.shipCode }})
          </small>
        </div>

        <div class="mb-3">
          <CFormLabel>Expiry Date</CFormLabel>
          <CFormInput v-model="batchForm.expiryDate" type="date" />
        </div>

        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <CFormLabel class="mb-0">Select Users</CFormLabel>
            <small class="text-body-secondary">From submitted biodata only</small>
          </div>

          <div ref="candidateComboboxRef" class="candidate-combobox">
            <CFormInput
              :model-value="candidateSearch"
              class="candidate-search-input"
              placeholder="Search submitted users"
              autocomplete="off"
              @focus="openCandidatePicker"
              @click="openCandidatePicker"
              @input="onCandidateSearchInput"
            />

            <div v-if="candidatePickerOpen" class="candidate-picker-panel">
              <div class="d-flex justify-content-end mb-2">
                <CButton color="secondary" variant="outline" size="sm" class="icon-only-button" @click="closeCandidatePicker">
                  <CIcon icon="cil-x-circle" />
                </CButton>
              </div>

              <div class="user-picker">
                <div v-if="loadingUsers" class="text-body-secondary">Loading submitted users...</div>
                <label v-for="user in filteredCandidates" :key="user.id" class="user-option">
                  <input
                    type="checkbox"
                    :checked="batchForm.submissionIds.includes(user.id)"
                    @change="toggleUserSelection(user.id, $event.target.checked)"
                  />
                  <span class="d-flex flex-column">
                    <span>{{ user.fullName }}</span>
                    <small class="text-body-secondary">
                      {{ user.icPassportNumber }} | submitted by {{ user.submittedBy }}
                    </small>
                  </span>
                </label>
                <div v-if="!loadingUsers && filteredCandidates.length === 0" class="text-body-secondary small p-2">
                  No submitted users match the current search.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="selectedUsers.length > 0" class="selected-users mb-3">
          <div class="small text-body-secondary mb-2">Current selection</div>
          <div class="d-flex flex-wrap gap-2">
            <span v-for="user in selectedUsers" :key="user.id" class="selected-chip">
              <span>{{ user.fullName }}</span>
              <button type="button" class="chip-remove" @click="removeSelectedUser(user.id)">x</button>
            </span>
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" @click="resetBatchForm">
          {{ isEditing ? 'Cancel Edit' : 'Cancel' }}
        </CButton>
        <CButton color="primary" :disabled="creatingBatch" @click="createBatch">
          {{ creatingBatch ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Batch') }}
        </CButton>
      </CModalFooter>
    </CModal>

    <CModal :visible="showBatchDetailsModal" @close="showBatchDetailsModal = false" size="xl" alignment="center">
      <CModalHeader>
        <CModalTitle>Batch Member Details</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div v-if="loadingBatchDetails" class="text-body-secondary">Loading batch details...</div>
        <div v-else-if="selectedBatch">
          <div class="mb-3">
            <div class="fw-semibold fs-5">{{ selectedBatch.batchName }}</div>
            <div class="small text-body-secondary">
              Ship {{ selectedBatch.shipName || 'N/A' }} | Expires {{ new Date(selectedBatch.expiryDate).toLocaleDateString() }} | Created by {{ selectedBatch.createdBy }}
            </div>
          </div>

          <CRow class="g-3">
            <CCol md="6" v-for="member in selectedBatch.members" :key="member.id">
              <CCard class="member-card">
                <CCardBody>
                  <div class="d-flex gap-3 align-items-start">
                    <img :src="member.imageBase64" alt="Member" class="member-image" />
                    <div>
                      <div class="fw-semibold">{{ member.fullName }}</div>
                      <div class="small text-body-secondary">{{ member.icPassportNumber }}</div>
                      <div class="small text-body-secondary">Submitted by {{ member.submittedBy }}</div>
                      <div class="small text-body-secondary">
                        {{ new Date(member.createdAt).toLocaleString() }}
                      </div>
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </div>
      </CModalBody>
    </CModal>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1320px;
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

.user-picker {
  max-height: 320px;
  overflow: auto;
  border: 1px solid rgba(22, 57, 94, 0.12);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.7);
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.ship-combobox {
  position: relative;
}

.candidate-combobox {
  position: relative;
}

.candidate-search-input {
  width: 100%;
}

.candidate-picker-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  border: 1px solid rgba(22, 57, 94, 0.12);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 30px rgba(17, 61, 97, 0.14);
}

.ship-picker-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  border: 1px solid rgba(22, 57, 94, 0.12);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 14px 30px rgba(17, 61, 97, 0.14);
}

.ship-picker-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.candidate-search {
  flex: 1 1 auto;
}

.icon-only-button {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 8px;
}

.user-option:hover {
  background: rgba(24, 79, 130, 0.06);
}

.ship-option {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(22, 57, 94, 0.1);
  background: #fff;
}

.ship-option.selected {
  border-color: rgba(24, 79, 130, 0.45);
  background: rgba(24, 79, 130, 0.08);
}

.selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(24, 79, 130, 0.1);
  color: #184f82;
}

.chip-remove {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 0.9rem;
  line-height: 1;
}

.compact-table :deep(th),
.compact-table :deep(td) {
  padding-top: 0.65rem;
  padding-bottom: 0.65rem;
  font-size: 0.93rem;
}

.member-text {
  max-width: 320px;
}

.member-card {
  border: 1px solid rgba(22, 57, 94, 0.08);
}

.member-image {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
}

@media (min-width: 992px) {
  .user-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
