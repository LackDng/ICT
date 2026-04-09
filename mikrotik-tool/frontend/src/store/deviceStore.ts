import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeviceConfig, ConnectionMethod } from '../../../shared/types';

export interface ActiveDevice {
  host: string;
  port: number;
  username: string;
  method: 'rest_api' | 'ssh';
  ros_version: string;
  device_id?: number;
  connected_at: string;
}

interface DeviceState {
  activeDevice: ActiveDevice | null;
  config: DeviceConfig | null;
  configLoading: boolean;
  connectionError: string | null;

  setActiveDevice: (device: ActiveDevice | null) => void;
  setConfig: (config: DeviceConfig | null) => void;
  setConfigLoading: (loading: boolean) => void;
  setConnectionError: (error: string | null) => void;
  clearDevice: () => void;
  updateConfigSection: <K extends keyof DeviceConfig>(section: K, data: DeviceConfig[K]) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      activeDevice: null,
      config: null,
      configLoading: false,
      connectionError: null,

      setActiveDevice: (device) => set({ activeDevice: device, connectionError: null }),
      setConfig: (config) => set({ config }),
      setConfigLoading: (loading) => set({ configLoading: loading }),
      setConnectionError: (error) => set({ connectionError: error }),
      clearDevice: () => set({ activeDevice: null, config: null, connectionError: null }),
      updateConfigSection: (section, data) =>
        set((state) => ({
          config: state.config ? { ...state.config, [section]: data } : null,
        })),
    }),
    {
      name: 'mikrotik-device-storage',
      partialize: (state) => ({
        activeDevice: state.activeDevice,
      }),
    }
  )
);

// ─── Connection form state (not persisted) ────────────────────────────────────

interface ConnectionFormState {
  host: string;
  port: number;
  username: string;
  password: string;
  method: ConnectionMethod;
  rememberDevice: boolean;
  label: string;

  setField: <K extends keyof Omit<ConnectionFormState, 'setField' | 'reset'>>(
    key: K,
    value: ConnectionFormState[K]
  ) => void;
  reset: () => void;
}

const defaultForm: Omit<ConnectionFormState, 'setField' | 'reset'> = {
  host: '',
  port: 8728,
  username: 'admin',
  password: '',
  method: 'auto',
  rememberDevice: false,
  label: '',
};

export const useConnectionForm = create<ConnectionFormState>((set) => ({
  ...defaultForm,
  setField: (key, value) => set({ [key]: value }),
  reset: () => set(defaultForm),
}));
