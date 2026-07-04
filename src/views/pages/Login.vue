<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})

const loading = ref(false)
const errorMessage = ref('')

const onSubmit = async () => {
  loading.value = true
  errorMessage.value = ''

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
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}
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

                <CAlert v-if="errorMessage" color="danger">{{ errorMessage }}</CAlert>

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
