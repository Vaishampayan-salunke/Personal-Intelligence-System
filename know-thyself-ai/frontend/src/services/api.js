import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
