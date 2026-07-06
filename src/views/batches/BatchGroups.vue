<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const submissionUsers = ref([])
const ships = ref([])
const batches = ref([])
const loadingUsers = ref(false)
const loadingShips = ref(false)
const loadingBatches = ref(false)
const creatingBatch = ref(false)
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
const alertMessage = ref('')
const alertColor = ref('success')
const alertTimerId = ref(null)
const batchSortKey = ref('createdAt')
const batchSortDirection = ref('desc')
const currentPage = ref(1)
const batchSearchTerm = ref('')

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

const formatLocalDate = (value) => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value))
}

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

const filteredBatchRows = computed(() => {
  const query = batchSearchTerm.value.trim().toLowerCase()
  if (!query) {
    return batches.value
  }

  return batches.value.filter((batch) => {
    return [
      String(batch.id),
      batch.batchName,
      batch.shipName,
      batch.shipCode,
      batch.createdBy,
      batch.memberNames,
      String(batch.memberCount),
      batch.isActive ? 'active' : 'expired',
    ].some((value) => String(value || '').toLowerCase().includes(query))
  })
})

const sortedBatches = computed(() => {
  const direction = batchSortDirection.value === 'asc' ? 1 : -1

  return [...filteredBatchRows.value].sort((a, b) => {
    const key = batchSortKey.value

    if (key === 'memberCount') {
      return (Number(a.memberCount || 0) - Number(b.memberCount || 0)) * direction
    }

    if (key === 'isActive') {
      return (Number(a.isActive) - Number(b.isActive)) * direction
    }

    if (key === 'createdAt' || key === 'expiryDate') {
      return (new Date(a[key]).getTime() - new Date(b[key]).getTime()) * direction
    }

    const left = String(a[key] || '').toLowerCase()
    const right = String(b[key] || '').toLowerCase()
    if (left === right) {
      return 0
    }

    return (left > right ? 1 : -1) * direction
  })
})

const totalBatchPages = computed(() => Math.max(1, Math.ceil(sortedBatches.value.length / MAX_TABLE_ROWS)))
const visibleBatches = computed(() => {
  const startIndex = (currentPage.value - 1) * MAX_TABLE_ROWS
  return sortedBatches.value.slice(startIndex, startIndex + MAX_TABLE_ROWS)
})

const goToBatchPage = (page) => {
  currentPage.value = Math.min(Math.max(1, page), totalBatchPages.value)
}

const setBatchSort = (key) => {
  if (batchSortKey.value === key) {
    batchSortDirection.value = batchSortDirection.value === 'asc' ? 'desc' : 'asc'
    currentPage.value = 1
    return
  }

  batchSortKey.value = key
  batchSortDirection.value = 'asc'
  currentPage.value = 1
}

const batchSortIndicator = (key) => {
  if (batchSortKey.value !== key) {
    return ''
  }
  return batchSortDirection.value === 'asc' ? '↑' : '↓'
}

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
    showError(error, 'Failed to load submitted users.')
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
    showError(error, 'Failed to load ships.')
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
    currentPage.value = 1
  } catch (error) {
    showError(error, 'Failed to load batch groups.')
  } finally {
    loadingBatches.value = false
  }
}

watch(totalBatchPages, (pages) => {
  if (currentPage.value > pages) {
    currentPage.value = pages
  }
})

watch(batchSearchTerm, () => {
  currentPage.value = 1
})

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
  alertMessage.value = ''
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
  alertMessage.value = ''

  if (!batchForm.batchName || !batchForm.shipId || !batchForm.expiryDate || batchForm.submissionIds.length === 0) {
    notify('Batch name, ship, expiry date, and at least one selected submitted user are required.', 'danger')
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
    notify(
      wasEditing
      ? 'Batch group updated successfully.'
      : 'Batch group created successfully.',
    )
    batchFilter.value = 'active'
    await fetchBatches()
  } catch (error) {
    showError(error, isEditing.value ? 'Failed to update batch group.' : 'Failed to create batch group.')
  } finally {
    creatingBatch.value = false
  }
}

const onFilterChange = async () => {
  currentPage.value = 1
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
    showError(error, 'Failed to load batch details.')
    showBatchDetailsModal.value = false
  } finally {
    loadingBatchDetails.value = false
  }
}

const startEditBatch = async (batchId) => {
  alertMessage.value = ''

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
    showError(error, 'Failed to load batch for editing.')
  }
}

const deleteBatch = async (batchId) => {
  alertMessage.value = ''

  if (!window.confirm('Are you sure you want to remove this batch group?')) {
    return
  }

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
    notify('Batch group removed successfully.')
    await fetchBatches()
  } catch (error) {
    showError(error, 'Failed to remove batch group.')
  }
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  await Promise.all([fetchUsers(), fetchShips(), fetchBatches()])
})

onBeforeUnmount(() => {
  clearAlertTimer()
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

    <CAlert v-if="alertMessage" class="floating-alert" :color="alertColor" dismissible @close="dismissAlert">
      {{ alertMessage }}
    </CAlert>

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
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-2">
              <CFormInput
                v-model="batchSearchTerm"
                class="search-input"
                placeholder="Search by batch, ship, creator, members, status"
              />
            <div class="small text-body-secondary">
              Showing {{ visibleBatches.length }} of {{ sortedBatches.length }} rows
            </div>
            </div>
            <div v-if="loadingBatches" class="text-body-secondary">Loading batch groups...</div>
            <CTable v-else hover responsive small class="compact-table align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setBatchSort('batchName')">
                      Batch {{ batchSortIndicator('batchName') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setBatchSort('memberCount')">
                      Members {{ batchSortIndicator('memberCount') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setBatchSort('expiryDate')">
                      Expiry {{ batchSortIndicator('expiryDate') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setBatchSort('createdBy')">
                      Created By {{ batchSortIndicator('createdBy') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setBatchSort('isActive')">
                      Status {{ batchSortIndicator('isActive') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="batch in visibleBatches" :key="batch.id">
                  <CTableDataCell>
                    <div class="fw-semibold">{{ batch.batchName }}</div>
                    <div class="small text-body-secondary">
                      {{ batch.shipName || 'No ship selected' }} | Created {{ formatLocalDateTime(batch.createdAt) }}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div>{{ batch.memberCount }} users</div>
                    <div class="small text-body-secondary member-text">{{ batch.memberNames }}</div>
                  </CTableDataCell>
                  <CTableDataCell>{{ formatLocalDate(batch.expiryDate) }}</CTableDataCell>
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
                <CTableRow v-if="visibleBatches.length === 0">
                  <CTableDataCell colspan="6" class="text-center text-body-secondary py-4">
                    No batch groups found for this view.
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <div v-if="sortedBatches.length > 0" class="d-flex justify-content-between align-items-center mt-3">
              <small class="text-body-secondary">Page {{ currentPage }} of {{ totalBatchPages }}</small>
              <div class="d-flex gap-2">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  :disabled="currentPage <= 1"
                  @click="goToBatchPage(currentPage - 1)"
                >
                  Previous
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  :disabled="currentPage >= totalBatchPages"
                  @click="goToBatchPage(currentPage + 1)"
                >
                  Next
                </CButton>
              </div>
            </div>
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

              <div class="d-flex justify-content-end mt-2">
                <CButton color="secondary" variant="outline" size="sm" @click="closeCandidatePicker">
                  Close
                </CButton>
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
              Ship {{ selectedBatch.shipName || 'N/A' }} | Expires {{ formatLocalDate(selectedBatch.expiryDate) }} | Created by {{ selectedBatch.createdBy }}
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
                        {{ formatLocalDateTime(member.createdAt) }}
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
  background: #fff;
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
  background: #fff;
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

.table-sort-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font-weight: 600;
}

.search-input {
  max-width: 460px;
}

.floating-alert {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(560px, calc(100vw - 2rem));
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
