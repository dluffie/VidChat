import { create } from 'zustand';
import { ChatMessage, MessageStatus } from '../types/messages.js';

export interface ChatState {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  updateMultipleStatuses: (messageIds: string[], status: MessageStatus) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => {
      // Avoid duplicate messages
      if (state.messages.some((m) => m.messageId === message.messageId)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),
  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.messageId === messageId ? { ...m, status } : m
      ),
    })),
  updateMultipleStatuses: (messageIds, status) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        messageIds.includes(m.messageId) ? { ...m, status } : m
      ),
    })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
}));
