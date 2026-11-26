import axios from 'axios';

// Get backend API URL dynamically from localStorage override, env var, or production default
export function getApiBaseUrl() {
  const custom = typeof window !== 'undefined' ? localStorage.getItem('know_thyself_api_base_url') : null;
  if (custom && custom.trim()) {
    let clean = custom.trim().replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }

  let envBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (envBase) {
    return envBase.endsWith('/api') ? envBase : `${envBase}/api`;
  }

  // If deployed on Vercel without environment variables, default to the Render backend service
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://personal-intelligence-system.onrender.com/api';
  }

  return '/api';
}

export function setCustomApiBaseUrl(url) {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem('know_thyself_api_base_url');
  } else {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api') && clean.startsWith('http')) {
      clean = `${clean}/api`;
    }
    localStorage.setItem('know_thyself_api_base_url', clean);
  }
}

export function getWsBaseUrl() {
  const apiBase = getApiBaseUrl();
  if (apiBase.startsWith('http')) {
    return apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
  }
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${typeof window !== 'undefined' ? window.location.host : 'localhost:8000'}`;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
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
      error.response.data.detail = 'Backend URL is missing or not responding. Click "Configure Backend URL" below to set your Render API URL.';
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
    if (params.sleep_hours !== undefined && params.sleep_hours !== null) qs.append('sleep_hours', params.sleep_hours);
    if (params.exercise_minutes !== undefined && params.exercise_minutes !== null) qs.append('exercise_minutes', params.exercise_minutes);
    if (params.water_intake !== undefined && params.water_intake !== null) qs.append('water_intake', params.water_intake);
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

export const mobileService = {
  getPairingCode: () => api.post('/mobile/pair-code'),
  getStatus: () => api.get('/mobile/status'),
  getLatest: () => api.get('/mobile/latest'),
  getHistory: (limit = 20) => api.get(`/mobile/history?limit=${limit}`),
  disconnectDevice: (deviceId) => api.delete(`/mobile/disconnect?device_id=${encodeURIComponent(deviceId)}`),
  getWsTicket: () => api.post('/mobile/ws-ticket'),
  verifyPhone: (countryCode, phoneNumber) => api.post('/mobile/verify-phone', { country_code: countryCode, phone_number: phoneNumber }),
  verifyOtp: (countryCode, phoneNumber, otpCode) => api.post('/mobile/verify-otp', { country_code: countryCode, phone_number: phoneNumber, otp_code: otpCode }),
  createPairing: (phoneNumber = null) => api.post('/mobile/pairing/create', { phone_number: phoneNumber }),
  getPairingStatus: (pairingId) => api.get(`/mobile/pairing/status/${pairingId}`),
  claimPairing: (data) => api.post('/mobile/pairing/claim', data),
  approvePairing: (data) => api.post('/mobile/pairing/approve', data),
  syncTelemetry: (data, token) => api.post('/mobile/sync', data, token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
};

export default api;
