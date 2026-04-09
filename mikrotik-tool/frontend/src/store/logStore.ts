import { create } from 'zustand';

export interface LogMessage {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

interface LogState {
  messages: LogMessage[];
  isOpen: boolean;
  wsStatus: 'disconnected' | 'connecting' | 'connected';

  addMessage: (msg: Omit<LogMessage, 'id'>) => void;
  clearMessages: () => void;
  setIsOpen: (open: boolean) => void;
  setWsStatus: (status: LogState['wsStatus']) => void;
}

export const useLogStore = create<LogState>((set) => ({
  messages: [],
  isOpen: true,
  wsStatus: 'disconnected',

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages.slice(-499), // Keep last 500
        { ...msg, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ],
    })),

  clearMessages: () => set({ messages: [] }),
  setIsOpen: (open) => set({ isOpen: open }),
  setWsStatus: (status) => set({ wsStatus: status }),
}));
