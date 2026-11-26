import axios from 'axios';

// Ensure base URL properly routes to the backend's /api prefix
let rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
if (rawBase && !rawBase.endsWith('/api')) {
  rawBase = `${rawBase}/api`;
}
const API_BASE_URL = rawBase || '/api';

console.log('[Know Thyself AI] API Base URL configured as:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('know_thyself_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 405) {
      if (!error.response.data || typeof error.response.data !== 'object') {
        error.response.data = {};
      }
      error.response.data.detail = 'Backend URL is missing in Vercel. In Vercel Project Settings -> Environment Variables, add VITE_API_BASE_URL pointing to your Render backend URL, then Redeploy.';
    }

    if (error.response && error.response.status === 401) {
      const isAuthEndpoint = error.config.url?.includes('/auth/login') || error.config.url?.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('know_thyself_token');
        localStorage.removeItem('know_thyself_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  demoLogin: () => api.post('/auth/demo-login'),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updatePreferences: (data) => api.put('/auth/preferences', data),
  completeOnboarding: (data) => api.post('/auth/onboarding', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  resetFreshAccount: () => api.post('/auth/reset-fresh'),
};

export const dashboardService = {
  getDashboard: () => api.get('/dashboard'),
  getTrends: (days = 14) => api.get(`/dashboard/trends?days=${days}`),
};

export const recordsService = {
  getRecords: (params) => api.get('/records', { params }),
  createRecord: (data) => api.post('/records', data),
  syncLiveSteps: (increment = 150, steps = null) => {
    const params = new URLSearchParams();
    if (steps !== null) params.append('steps', steps);
    else if (increment !== null) params.append('increment', increment);
    return api.post(`/records/sync-steps?${params.toString()}`);
  },
  syncPhoneTelemetry: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.steps !== undefined && params.steps !== null) qs.append('steps', params.steps);
    if (params.screen_time !== undefined && params.screen_time !== null) qs.append('screen_time', params.screen_time);
    if (params.active_seconds !== undefined && params.active_seconds !== null) qs.append('active_seconds', params.active_seconds);
    return api.post(`/records/sync-phone?${qs.toString()}`);
  },
  updateRecord: (id, data) => api.put(`/records/${id}`, data),
  deleteRecord: (id) => api.delete(`/records/${id}`),
  uploadCSV: (formData) => api.post('/records/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  loadSampleData: (days = 30) => api.post(`/records/load-sample?days=${days}`),
};

export const insightsService = {
  getInsights: (limit = 25) => api.get(`/insights?limit=${limit}`),
  generateInsights: () => api.post('/insights/generate'),
};

export const aiService = {
  askChat: (question) => api.post('/ai/chat', { question }),
  getHistory: () => api.get('/ai/history'),
  clearHistory: () => api.delete('/ai/history'),
};

export const nudgesService = {
  getNudges: () => api.get('/nudges'),
  updateNudge: (id, status) => api.patch(`/nudges/${id}`, { status }),
};

export const goalsService = {
  getGoals: () => api.get('/goals'),
  createGoal: (data) => api.post('/goals', data),
  updateGoal: (id, data) => api.put(`/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/goals/${id}`),
};

export const privacyService = {
  exportData: () => api.get('/privacy/export'),
  deleteData: () => api.delete('/privacy/data'),
  deleteAccount: () => api.delete('/privacy/account'),
  updateConsent: (consent) => api.post(`/privacy/consent?consent=${consent}`),
};

export default api;
