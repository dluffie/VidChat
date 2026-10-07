import { create } from 'zustand';
import { TransferProgress } from '../types/transfers';

export interface TransferState {
  transfers: Record<string, TransferProgress>;
  selectedTransferId: string | null;
  upsertTransfer: (progress: TransferProgress) => void;
  setSelectedTransferId: (id: string | null) => void;
  clearTransfers: () => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: {},
  selectedTransferId: null,
  upsertTransfer: (progress) =>
    set((state) => ({
      transfers: {
        ...state.transfers,
        [progress.transferId]: progress,
      },
    })),
  setSelectedTransferId: (id) => set({ selectedTransferId: id }),
  clearTransfers: () => set({ transfers: {}, selectedTransferId: null }),
}));
