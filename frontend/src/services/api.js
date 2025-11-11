import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const apiService = {
  async uploadAudio(file) {
    const formData = new FormData();
    formData.append('audio', file);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  async getUploadStatus(jobId) {
    const response = await api.get(`/upload/status/${jobId}`);
    return response.data;
  },

  async getQueueStats() {
    const response = await api.get('/upload/queue/stats');
    return response.data;
  },

  async getWorkouts(deviceUuid, options = {}) {
    const { limit = 20, offset = 0, startDate, endDate } = options;
    
    let url = `/workouts/${deviceUuid}?limit=${limit}&offset=${offset}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    
    const response = await api.get(url);
    return response.data;
  },

  async getProgress(deviceUuid, options = {}) {
    const { exercise, days = 30 } = options;
    
    let url = `/workouts/${deviceUuid}/progress?days=${days}`;
    if (exercise) url += `&exercise=${encodeURIComponent(exercise)}`;
    
    const response = await api.get(url);
    return response.data;
  },

  async getUserStats(deviceUuid) {
    const response = await api.get(`/workouts/${deviceUuid}/stats`);
    return response.data;
  },

  async healthCheck() {
    const response = await api.get('/health', { baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000' });
    return response.data;
  },

  // Chart data endpoints
  async getWorkoutTrends(deviceUuid, options = {}) {
    const { period = 'weekly', days = 90 } = options;
    const response = await api.get(`/workouts/${deviceUuid}/charts/workout-trends?period=${period}&days=${days}`);
    return response.data;
  },

  async getMuscleGroupData(deviceUuid, options = {}) {
    const { days = 30 } = options;
    const response = await api.get(`/workouts/${deviceUuid}/charts/muscle-groups?days=${days}`);
    return response.data;
  },

  async getPerformanceData(deviceUuid, options = {}) {
    const { exercise, metric = 'weight', days = 90 } = options;
    let url = `/workouts/${deviceUuid}/charts/performance?metric=${metric}&days=${days}`;
    if (exercise) url += `&exercise=${encodeURIComponent(exercise)}`;
    const response = await api.get(url);
    return response.data;
  },

  async getLLMSummary(deviceUuid, options = {}) {
    const { days = 30 } = options;
    const response = await api.get(`/workouts/${deviceUuid}/llm-summary?days=${days}`);
    return response.data;
  },
};

export default apiService;