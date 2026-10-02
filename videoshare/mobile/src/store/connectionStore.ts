import { create } from 'zustand';

export interface ConnectionState {
  status: 'connected' | 'connecting' | 'disconnected';
  peerStatus: 'online' | 'offline';
  serverUrl: string;
  error: string | null;
  setStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  setPeerStatus: (peerStatus: 'online' | 'offline') => void;
  setServerUrl: (url: string) => void;
  setError: (error: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  peerStatus: 'offline',
  serverUrl: 'http://10.0.2.2:3000',
  error: null,
  setStatus: (status) => set({ status }),
  setPeerStatus: (peerStatus) => set({ peerStatus }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setError: (error) => set({ error }),
}));
