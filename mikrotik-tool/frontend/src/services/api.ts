import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Add auth token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ success: boolean; data: { token: string; username: string } }>(
      '/auth/login', { username, password }
    ),
};

// ─── Connect ──────────────────────────────────────────────────────────────────

export interface ConnectPayload {
  host: string;
  port: number;
  username: string;
  password: string;
  method: 'rest' | 'ssh' | 'auto';
  rememberDevice?: boolean;
  label?: string;
}

export interface ConnectResponse {
  method: 'rest_api' | 'ssh';
  ros_version: string;
  sections_read: string[];
  config: Record<string, unknown>;
  device_id?: number;
}

export const connectApi = {
  connect: (payload: ConnectPayload) =>
    api.post<{ success: boolean; data: ConnectResponse }>('/connect', payload),
  disconnect: (host: string, username: string) =>
    api.delete(`/connect/${encodeURIComponent(host)}?username=${encodeURIComponent(username)}`),
};

// ─── Devices ──────────────────────────────────────────────────────────────────

export const devicesApi = {
  list: () => api.get('/devices'),
  get: (id: number) => api.get(`/devices/${id}`),
  delete: (id: number) => api.delete(`/devices/${id}`),
  listSnapshots: (deviceId: number) => api.get(`/devices/${deviceId}/snapshots`),
  saveSnapshot: (deviceId: number, label: string, snapshot_json: string) =>
    api.post(`/devices/${deviceId}/snapshots`, { label, snapshot_json }),
  getSnapshot: (deviceId: number, snapId: number) =>
    api.get(`/devices/${deviceId}/snapshots/${snapId}`),
  deleteSnapshot: (deviceId: number, snapId: number) =>
    api.delete(`/devices/${deviceId}/snapshots/${snapId}`),
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const configApi = {
  generate: (payload: Record<string, unknown>) =>
    api.post('/config/generate', payload),
};

// ─── Apply ────────────────────────────────────────────────────────────────────

export interface ApplyPayload {
  host: string;
  username: string;
  changes: Array<{
    action: string;
    path: string;
    id?: string;
    params?: Record<string, unknown>;
    rosCommand?: string;
    description?: string;
    featureGroup?: string;
  }>;
  featureGroup?: string;
  sessionId?: string;
}

export const applyApi = {
  apply: (payload: ApplyPayload) =>
    api.post('/apply', payload),
  rollback: (payload: {
    host: string;
    username: string;
    logId: number;
    action: string;
    path: string;
    id?: string;
    originalParams?: Record<string, unknown>;
  }) => api.post('/apply/rollback', payload),
};

// ─── Change Log ───────────────────────────────────────────────────────────────

export interface ChangeLogFilter {
  device_ip?: string;
  feature_group?: string;
  result?: string;
  session_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export const changelogApi = {
  list: (filter: ChangeLogFilter = {}) =>
    api.get('/changelog', { params: filter }),
  deleteOlderThan: (days: number) =>
    api.delete(`/changelog/older-than/${days}`),
  export: (format: 'csv' | 'json', filter: ChangeLogFilter = {}) => {
    const params = new URLSearchParams({ format, ...(filter as Record<string, string>) });
    window.open(`/api/changelog/export?${params}`, '_blank');
  },
  sessions: (device_ip?: string) =>
    api.get('/changelog/sessions', { params: device_ip ? { device_ip } : {} }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: (host: string, username: string) =>
    api.get(`/dashboard/${encodeURIComponent(host)}`, { params: { username } }),
};

// ─── Backup ───────────────────────────────────────────────────────────────────

export const backupApi = {
  export: (host: string, username: string) =>
    api.post('/backup/export', { host, username }, { responseType: 'blob' }),
  saveSnapshot: (device_id: number, label: string, config: Record<string, unknown>) =>
    api.post('/backup/snapshot', { device_id, label, config }),
  compareSnapshots: (snap1: number, snap2: number) =>
    api.get(`/backup/compare?snap1=${snap1}&snap2=${snap2}`),
};

export default api;
