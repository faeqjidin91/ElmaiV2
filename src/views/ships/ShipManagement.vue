<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const ships = ref([])
const loading = ref(false)
const submitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

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
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}

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

const createShip = async () => {
  successMessage.value = ''
  errorMessage.value = ''
  submitting.value = true

  try {
    const response = await fetch('/api/ships', {
      method: 'POST',
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

    await parseApiResponse(response, 'Failed to register ship.')
    successMessage.value = 'Ship registered successfully.'
    resetForm()
    await fetchShips()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    submitting.value = false
  }
}

onMounted(fetchShips)
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

    <CAlert v-if="successMessage" color="success">{{ successMessage }}</CAlert>
    <CAlert v-if="errorMessage" color="danger">{{ errorMessage }}</CAlert>

    <CRow class="g-4">
      <CCol xl="5">
        <CCard class="panel-card h-100">
          <CCardHeader>Register Cargo Ship</CCardHeader>
          <CCardBody>
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
            <div class="d-flex justify-content-end mt-3">
              <CButton color="primary" :disabled="submitting" @click="createShip">
                {{ submitting ? 'Registering...' : 'Register Ship' }}
              </CButton>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xl="7">
        <CCard class="panel-card h-100">
          <CCardHeader>Registered Ships</CCardHeader>
          <CCardBody>
            <div v-if="loading" class="text-body-secondary">Loading ships...</div>
            <CTable v-else hover responsive small class="compact-table align-middle">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Ship</CTableHeaderCell>
                  <CTableHeaderCell>IMO / MMSI</CTableHeaderCell>
                  <CTableHeaderCell>Type</CTableHeaderCell>
                  <CTableHeaderCell>Flag</CTableHeaderCell>
                  <CTableHeaderCell>Status</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="ship in ships" :key="ship.id">
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
                </CTableRow>
                <CTableRow v-if="ships.length === 0">
                  <CTableDataCell colspan="5" class="text-center text-body-secondary py-4">
                    No ships registered yet.
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
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
</style>
