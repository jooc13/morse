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
  // Set authentication token
  setAuthToken(token) {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Token set:', token.substring(0, 20) + '...');
    } else {
      delete api.defaults.headers.common['Authorization'];
      console.log('Token cleared');
    }
  },

  // Authentication endpoints
  async register(passphrase) {
    const response = await api.post('/auth/register', { passphrase });
    return response.data;
  },

  async login(passphrase) {
    const response = await api.post('/auth/login', { passphrase });
    return response.data;
  },

  async getUserProfile() {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Device search and claiming
  async searchDevices(last4) {
    const response = await api.get(`/auth/devices/search/${last4}`);
    return response.data;
  },

  async getUnclaimedWorkouts(deviceUuid) {
    const response = await api.get(`/auth/devices/${deviceUuid}/workouts`);
    return response.data;
  },

  async claimWorkout(workoutId) {
    const response = await api.post(`/auth/workouts/${workoutId}/claim`);
    return response.data;
  },

  async getClaimedWorkouts(options = {}) {
    const { limit = 20, offset = 0 } = options;
    const response = await api.get(`/auth/workouts/claimed?limit=${limit}&offset=${offset}`);
    return response.data;
  },

  async deleteWorkout(workoutId) {
    const response = await api.delete(`/auth/workouts/${workoutId}`);
    return response.data;
  },

  // Legacy upload endpoint (for testing)
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

  async uploadAudioBatch(files) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('audio', file);
    });
    // Increase timeout for batch uploads - 15 files with 2s delays = ~30s + processing time
    const timeout = Math.max(120000, files.length * 5000); // At least 2 minutes, or 5s per file
    const response = await api.post('/upload/batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: timeout,
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

  // Legacy workout endpoints (kept for backward compatibility)
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

  // Teams endpoints
  async createTeam(teamData) {
    const response = await api.post('/teams/create', teamData);
    return response.data;
  },

  async joinTeam(inviteCode, displayName = null) {
    const response = await api.post(`/teams/join/${inviteCode}`, { displayName });
    return response.data;
  },

  async getMyTeams() {
    const response = await api.get('/teams/my-teams');
    return response.data;
  },

  async getTeamDetails(teamId) {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  },

  async getTeamMembers(teamId) {
    const response = await api.get(`/teams/${teamId}/members`);
    return response.data;
  },

  async updateTeamSettings(teamId, settings) {
    const response = await api.put(`/teams/${teamId}/settings`, settings);
    return response.data;
  },

  async updateMyDisplayName(teamId, displayName) {
    const response = await api.put(`/teams/${teamId}/my-display-name`, { displayName });
    return response.data;
  },

  async leaveTeam(teamId) {
    const response = await api.delete(`/teams/${teamId}/leave`);
    return response.data;
  },

  // Device Linking endpoints
  async getLinkedDevices() {
    const response = await api.get('/auth/devices/linked');
    return response.data;
  },

  async linkDevice(deviceUuid, deviceName = null) {
    const response = await api.post(`/auth/devices/${deviceUuid}/link`, { deviceName });
    return response.data;
  },

  async unlinkDevice(deviceUuid) {
    const response = await api.delete(`/auth/devices/${deviceUuid}/link`);
    return response.data;
  },

  async searchAvailableDevices(last4) {
    const response = await api.get(`/auth/devices/available/${last4}`);
    return response.data;
  },
};

export default apiService;