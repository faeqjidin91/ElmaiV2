<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const ships = ref([])
const loading = ref(false)
const submitting = ref(false)
const showRegisterShipModal = ref(false)
const isEditing = ref(false)
const editingShipId = ref(null)
const alertMessage = ref('')
const alertColor = ref('success')
const alertTimerId = ref(null)
const shipSortKey = ref('shipName')
const shipSortDirection = ref('asc')
const currentPage = ref(1)
const shipSearchTerm = ref('')

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

const shipForm = reactive({
  shipName: '',
  shipCode: '',
  imoNumber: '',
  mmsiNumber: '',
  flagState: '',
  callSign: '',
  cargoType: 'General Cargo',
  grossTonnage: '',
  deadweightTonnage: '',
  yearBuilt: '',
  status: 'active',
  notes: '',
})

const totalShips = computed(() => ships.value.length)
const activeShips = computed(() => ships.value.filter((ship) => ship.status === 'active').length)
const cargoTypes = [
  { label: 'General Cargo', value: 'General Cargo' },
  { label: 'Bulk Carrier', value: 'Bulk Carrier' },
  { label: 'Container Ship', value: 'Container Ship' },
  { label: 'Ro-Ro Cargo', value: 'Ro-Ro Cargo' },
  { label: 'Reefer Ship', value: 'Reefer Ship' },
  { label: 'Heavy Lift Cargo', value: 'Heavy Lift Cargo' },
]
const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive', value: 'inactive' },
]

const filteredShipsTable = computed(() => {
  const query = shipSearchTerm.value.trim().toLowerCase()
  if (!query) {
    return ships.value
  }

  return ships.value.filter((ship) => {
    return [
      String(ship.id),
      ship.shipName,
      ship.shipCode,
      ship.imoNumber,
      ship.mmsiNumber,
      ship.cargoType,
      ship.flagState,
      ship.status,
    ].some((value) => String(value || '').toLowerCase().includes(query))
  })
})

const sortedShips = computed(() => {
  const direction = shipSortDirection.value === 'asc' ? 1 : -1

  return [...filteredShipsTable.value].sort((a, b) => {
    const key = shipSortKey.value

    let left = a[key]
    let right = b[key]

    if (key === 'id' || key === 'yearBuilt' || key === 'grossTonnage' || key === 'deadweightTonnage') {
      left = Number(left || 0)
      right = Number(right || 0)
      return (left - right) * direction
    }

    left = String(left || '').toLowerCase()
    right = String(right || '').toLowerCase()

    if (left === right) {
      return 0
    }

    return (left > right ? 1 : -1) * direction
  })
})

const totalShipPages = computed(() => Math.max(1, Math.ceil(sortedShips.value.length / MAX_TABLE_ROWS)))
const visibleShips = computed(() => {
  const startIndex = (currentPage.value - 1) * MAX_TABLE_ROWS
  return sortedShips.value.slice(startIndex, startIndex + MAX_TABLE_ROWS)
})

const goToShipPage = (page) => {
  currentPage.value = Math.min(Math.max(1, page), totalShipPages.value)
}

const setShipSort = (key) => {
  if (shipSortKey.value === key) {
    shipSortDirection.value = shipSortDirection.value === 'asc' ? 'desc' : 'asc'
    currentPage.value = 1
    return
  }

  shipSortKey.value = key
  shipSortDirection.value = 'asc'
  currentPage.value = 1
}

const sortIndicator = (key) => {
  if (shipSortKey.value !== key) {
    return ''
  }
  return shipSortDirection.value === 'asc' ? '↑' : '↓'
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

  throw new Error(fallbackMessage)
}

const fetchShips = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/ships', {
      headers: {
        ...auth.authHeaders(),
      },
    })

    ships.value = await parseApiResponse(response, 'Failed to load ships.')
    currentPage.value = 1
  } catch (error) {
    showError(error, 'Failed to load ships.')
  } finally {
    loading.value = false
  }
}

watch(totalShipPages, (pages) => {
  if (currentPage.value > pages) {
    currentPage.value = pages
  }
})

watch(shipSearchTerm, () => {
  currentPage.value = 1
})

const resetForm = () => {
  shipForm.shipName = ''
  shipForm.shipCode = ''
  shipForm.imoNumber = ''
  shipForm.mmsiNumber = ''
  shipForm.flagState = ''
  shipForm.callSign = ''
  shipForm.cargoType = 'General Cargo'
  shipForm.grossTonnage = ''
  shipForm.deadweightTonnage = ''
  shipForm.yearBuilt = ''
  shipForm.status = 'active'
  shipForm.notes = ''
}

const openRegisterShipModal = () => {
  alertMessage.value = ''
  resetForm()
  isEditing.value = false
  editingShipId.value = null
  showRegisterShipModal.value = true
}

const closeRegisterShipModal = () => {
  showRegisterShipModal.value = false
}

const openEditShipModal = (ship) => {
  shipForm.shipName = ship.shipName || ''
  shipForm.shipCode = ship.shipCode || ''
  shipForm.imoNumber = ship.imoNumber || ''
  shipForm.mmsiNumber = ship.mmsiNumber || ''
  shipForm.flagState = ship.flagState || ''
  shipForm.callSign = ship.callSign || ''
  shipForm.cargoType = ship.cargoType || 'General Cargo'
  shipForm.grossTonnage = ship.grossTonnage ?? ''
  shipForm.deadweightTonnage = ship.deadweightTonnage ?? ''
  shipForm.yearBuilt = ship.yearBuilt ?? ''
  shipForm.status = ship.status || 'active'
  shipForm.notes = ship.notes || ''
  isEditing.value = true
  editingShipId.value = ship.id
  showRegisterShipModal.value = true
}

const createShip = async () => {
  alertMessage.value = ''
  submitting.value = true

  try {
    const response = await fetch(isEditing.value ? `/api/ships/${editingShipId.value}` : '/api/ships', {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...auth.authHeaders(),
      },
      body: JSON.stringify({
        ...shipForm,
        grossTonnage: shipForm.grossTonnage ? Number(shipForm.grossTonnage) : null,
        deadweightTonnage: shipForm.deadweightTonnage ? Number(shipForm.deadweightTonnage) : null,
        yearBuilt: shipForm.yearBuilt ? Number(shipForm.yearBuilt) : null,
      }),
    })

    await parseApiResponse(response, isEditing.value ? 'Failed to update ship.' : 'Failed to register ship.')
    notify(isEditing.value ? 'Ship updated successfully.' : 'Ship registered successfully.')
    resetForm()
    isEditing.value = false
    editingShipId.value = null
    closeRegisterShipModal()
    await fetchShips()
  } catch (error) {
    showError(error, isEditing.value ? 'Failed to update ship.' : 'Failed to register ship.')
  } finally {
    submitting.value = false
  }
}

onMounted(fetchShips)
onBeforeUnmount(clearAlertTimer)
</script>

<template>
  <div class="container dashboard-page">
    <div class="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
      <div>
        <h2 class="dashboard-title mb-1">Ship Management</h2>
        <p class="text-body-secondary mb-0">
          Register cargo ships with operational and identification details for batch assignment.
        </p>
      </div>
      <CButton color="primary" @click="openRegisterShipModal">Register Cargo Ship</CButton>
    </div>

    <CRow class="g-3 mb-4">
      <CCol md="6">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Registered Ships</div>
            <div class="kpi-value">{{ totalShips }}</div>
          </CCardBody>
        </CCard>
      </CCol>
      <CCol md="6">
        <CCard class="kpi-card">
          <CCardBody>
            <div class="text-body-secondary small">Active Ships</div>
            <div class="kpi-value">{{ activeShips }}</div>
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
          <CCardHeader>Registered Ships</CCardHeader>
          <CCardBody>
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-2">
              <CFormInput
                v-model="shipSearchTerm"
                class="search-input"
                placeholder="Search by ship, code, IMO, MMSI, type, flag, or status"
              />
            <div class="small text-body-secondary">
              Showing {{ visibleShips.length }} of {{ sortedShips.length }} rows
            </div>
            </div>
            <div v-if="loading" class="text-body-secondary">Loading ships...</div>
            <CTable v-else hover responsive small class="compact-table align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setShipSort('shipName')">
                      Ship {{ sortIndicator('shipName') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setShipSort('imoNumber')">
                      IMO / MMSI {{ sortIndicator('imoNumber') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setShipSort('cargoType')">
                      Type {{ sortIndicator('cargoType') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setShipSort('flagState')">
                      Flag {{ sortIndicator('flagState') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>
                    <button type="button" class="table-sort-button" @click="setShipSort('status')">
                      Status {{ sortIndicator('status') }}
                    </button>
                  </CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="ship in visibleShips" :key="ship.id">
                  <CTableDataCell>
                    <div class="fw-semibold">{{ ship.shipName }}</div>
                    <div class="small text-body-secondary">{{ ship.shipCode }}</div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <div>{{ ship.imoNumber }}</div>
                    <div class="small text-body-secondary">{{ ship.mmsiNumber || 'N/A' }}</div>
                  </CTableDataCell>
                  <CTableDataCell>{{ ship.cargoType }}</CTableDataCell>
                  <CTableDataCell>{{ ship.flagState }}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="ship.status === 'active' ? 'success' : ship.status === 'maintenance' ? 'warning' : 'secondary'">
                      {{ ship.status }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton color="warning" variant="outline" size="sm" @click="openEditShipModal(ship)">
                      Edit
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
                <CTableRow v-if="visibleShips.length === 0">
                  <CTableDataCell colspan="6" class="text-center text-body-secondary py-4">
                    No ships registered yet.
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <div v-if="sortedShips.length > 0" class="d-flex justify-content-between align-items-center mt-3">
              <small class="text-body-secondary">Page {{ currentPage }} of {{ totalShipPages }}</small>
              <div class="d-flex gap-2">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  :disabled="currentPage <= 1"
                  @click="goToShipPage(currentPage - 1)"
                >
                  Previous
                </CButton>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  :disabled="currentPage >= totalShipPages"
                  @click="goToShipPage(currentPage + 1)"
                >
                  Next
                </CButton>
              </div>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <CModal :visible="showRegisterShipModal" @close="closeRegisterShipModal" size="xl" alignment="center">
      <CModalHeader>
        <CModalTitle>{{ isEditing ? 'Edit Cargo Ship' : 'Register Cargo Ship' }}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow class="g-3">
          <CCol md="12">
            <CFormInput v-model="shipForm.shipName" placeholder="Ship Name" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.shipCode" placeholder="Ship ID / Internal Code" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.imoNumber" placeholder="IMO Number" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.mmsiNumber" placeholder="MMSI Number" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.callSign" placeholder="Call Sign" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.flagState" placeholder="Flag State" />
          </CCol>
          <CCol md="6">
            <CFormSelect v-model="shipForm.cargoType" :options="cargoTypes" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.grossTonnage" type="number" placeholder="Gross Tonnage" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.deadweightTonnage" type="number" placeholder="Deadweight Tonnage" />
          </CCol>
          <CCol md="6">
            <CFormInput v-model="shipForm.yearBuilt" type="number" placeholder="Year Built" />
          </CCol>
          <CCol md="12">
            <CFormSelect v-model="shipForm.status" :options="statusOptions" />
          </CCol>
          <CCol md="12">
            <CFormTextarea v-model="shipForm.notes" rows="3" placeholder="Notes" />
          </CCol>
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" @click="closeRegisterShipModal">Cancel</CButton>
        <CButton color="primary" :disabled="submitting" @click="createShip">
          {{ submitting ? (isEditing ? 'Saving...' : 'Registering...') : (isEditing ? 'Save Changes' : 'Register Ship') }}
        </CButton>
      </CModalFooter>
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
  max-width: 480px;
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
