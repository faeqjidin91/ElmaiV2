<script setup>
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})

const loading = ref(false)
const alertMessage = ref('')
const alertTimerId = ref(null)

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

const notifyError = (message) => {
  clearAlertTimer()
  alertMessage.value = message
  alertTimerId.value = setTimeout(() => {
    alertMessage.value = ''
    alertTimerId.value = null
  }, 3000)
}

const onSubmit = async () => {
  loading.value = true
  alertMessage.value = ''

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Invalid credentials.')
    }

    const data = await response.json()
    auth.setSession(data)
    router.push('/form')
  } catch (error) {
    notifyError(error?.message || 'Invalid credentials.')
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(clearAlertTimer)
</script>

<template>
  <div class="wrapper min-vh-100 d-flex align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol :md="5">
          <CCard class="p-4">
            <CCardBody>
              <CForm @submit.prevent="onSubmit">
                <h1>Login</h1>
                <p class="text-body-secondary">Sign in to continue</p>

                <CAlert v-if="alertMessage" class="floating-alert" color="danger" dismissible @close="dismissAlert">
                  {{ alertMessage }}
                </CAlert>

                <CInputGroup class="mb-3">
                  <CInputGroupText>
                    <CIcon icon="cil-user" />
                  </CInputGroupText>
                  <CFormInput
                    v-model="form.username"
                    placeholder="Username"
                    autocomplete="username"
                  />
                </CInputGroup>

                <CInputGroup class="mb-4">
                  <CInputGroupText>
                    <CIcon icon="cil-lock-locked" />
                  </CInputGroupText>
                  <CFormInput
                    v-model="form.password"
                    type="password"
                    placeholder="Password"
                    autocomplete="current-password"
                  />
                </CInputGroup>

                <CButton color="primary" type="submit" class="px-4" :disabled="loading">
                  {{ loading ? 'Signing in...' : 'Login' }}
                </CButton>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  </div>
</template>

<style scoped>
.floating-alert {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(560px, calc(100vw - 2rem));
}
</style>
