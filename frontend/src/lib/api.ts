import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Authorization header
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { teamName: string; name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  updateMe: (data: Partial<{ name: string; avatar: string | null; status: 'online' | 'offline' | 'busy'; currentPassword: string; newPassword: string }>) =>
    api.patch('/auth/me', data),
}

// Contacts API
export const contactsApi = {
  list: (params?: { search?: string; tag?: string; page?: number; limit?: number }) =>
    api.get('/contacts', { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: { phone: string; name?: string; email?: string; tags?: string[] }) =>
    api.post('/contacts', data),
  update: (id: string, data: Partial<{ name: string; email: string; tags: string[]; customFields: Record<string, string> }>) =>
    api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  bulkDelete: (ids: string[]) => api.post('/contacts/bulk-delete', { ids }),
  import: (formData: FormData) =>
    api.post('/contacts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  export: () => api.get('/contacts/export', { responseType: 'blob' }),
  block: (id: string, blocked: boolean) => api.post(`/contacts/${id}/block`, { blocked }),
}

// Conversations API
export const conversationsApi = {
  list: (params?: { status?: string; assignedTo?: string; label?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/conversations', { params }),
  get: (id: string) => api.get(`/conversations/${id}`),
  create: (data: { contactId?: string; phone?: string; message?: string; templateId?: string; templateName?: string; templateLanguage?: string; templateVariables?: Record<string, string> }) =>
    api.post('/conversations', data),
  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId: string, data: { content?: string; type?: string; mediaUrl?: string; templateId?: string; variables?: Record<string, string>; isNote?: boolean }) =>
    api.post(`/conversations/${conversationId}/messages`, data),
  addNote: (conversationId: string, content: string) =>
    api.post(`/conversations/${conversationId}/notes`, { content }),
  getNotes: (conversationId: string) =>
    api.get(`/conversations/${conversationId}/notes`),
  addLabel: (conversationId: string, labelId: string) =>
    api.post(`/conversations/${conversationId}/labels`, { labelId }),
  removeLabel: (conversationId: string, labelId: string) =>
    api.delete(`/conversations/${conversationId}/labels/${labelId}`),
  assign: (conversationId: string, agentId: string | null) =>
    api.post(`/conversations/${conversationId}/assign`, { agentId }),
  resolve: (conversationId: string) =>
    api.post(`/conversations/${conversationId}/resolve`),
  reopen: (conversationId: string) =>
    api.post(`/conversations/${conversationId}/reopen`),
  markRead: (conversationId: string) =>
    api.post(`/conversations/${conversationId}/read`),
}

// Templates API
export const templatesApi = {
  list: (params?: { category?: string; status?: string }) =>
    api.get('/templates', { params }),
  get: (id: string) => api.get(`/templates/${id}`),
  create: (data: {
    name: string
    category: string
    language: string
    headerType?: string
    headerValue?: string
    body: string
    footer?: string
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
  }) => api.post('/templates', data),
  update: (id: string, data: any) => api.patch(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  submit: (id: string) => api.post(`/templates/${id}/submit`),
}

// Broadcasts API
export const broadcastsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/broadcasts', { params }),
  get: (id: string) => api.get(`/broadcasts/${id}`),
  create: (data: { name: string; templateId?: string; message?: string; tags?: string[]; contactIds?: string[] }) =>
    api.post('/broadcasts', data),
  send: (id: string) => api.post(`/broadcasts/${id}/send`),
  schedule: (id: string, scheduledAt: string) =>
    api.post(`/broadcasts/${id}/schedule`, { scheduledAt }),
  delete: (id: string) => api.delete(`/broadcasts/${id}`),
  getContacts: (id: string) => api.get(`/broadcasts/${id}/contacts`),
}

// Automations API
export const automationsApi = {
  list: () => api.get('/automations'),
  get: (id: string) => api.get(`/automations/${id}`),
  create: (data: { name: string; trigger: any; actions: any[] }) =>
    api.post('/automations', data),
  update: (id: string, data: any) => api.patch(`/automations/${id}`, data),
  delete: (id: string) => api.delete(`/automations/${id}`),
  toggle: (id: string, isActive: boolean) =>
    api.post(`/automations/${id}/toggle`, { isActive }),
}

// Analytics API
export const analyticsApi = {
  overview: (params?: { from?: string; to?: string }) =>
    api.get('/analytics/overview', { params }),
  conversations: (params?: { from?: string; to?: string; groupBy?: string }) =>
    api.get('/analytics/conversations', { params }),
  agents: (params?: { from?: string; to?: string }) =>
    api.get('/analytics/agents', { params }),
  labels: (params?: { from?: string; to?: string }) =>
    api.get('/analytics/labels', { params }),
  responseTimes: (params?: { from?: string; to?: string }) =>
    api.get('/analytics/response-times', { params }),
}

// Team API
export const teamApi = {
  get: () => api.get('/team'),
  update: (data: { name?: string; waPhoneNumberId?: string; waAccessToken?: string }) =>
    api.patch('/team', data),
  testConnection: () => api.post('/team/test-connection'),
  getAgents: () => api.get('/team/agents'),
  inviteAgent: (data: { email: string; name: string; role: string }) =>
    api.post('/team/agents/invite', data),
  updateAgent: (agentId: string, data: { name?: string; role?: string; status?: string }) =>
    api.patch(`/team/agents/${agentId}`, data),
  resetAgentPassword: (agentId: string) =>
    api.post(`/team/agents/${agentId}/reset-password`),
  removeAgent: (agentId: string) => api.delete(`/team/agents/${agentId}`),
  getLabels: () => api.get('/team/labels'),
  createLabel: (data: { name: string; color: string }) =>
    api.post('/team/labels', data),
  updateLabel: (labelId: string, data: { name?: string; color?: string }) =>
    api.patch(`/team/labels/${labelId}`, data),
  deleteLabel: (labelId: string) => api.delete(`/team/labels/${labelId}`),
  getCannedResponses: () => api.get('/team/canned-responses'),
  createCannedResponse: (data: { shortcut: string; content: string }) =>
    api.post('/team/canned-responses', data),
  updateCannedResponse: (id: string, data: { shortcut?: string; content?: string }) =>
    api.patch(`/team/canned-responses/${id}`, data),
  deleteCannedResponse: (id: string) => api.delete(`/team/canned-responses/${id}`),
}

// Media API
export const mediaApi = {
  uploadMedia: (formData: FormData) =>
    api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export default api
