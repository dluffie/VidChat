import { WS_URL } from './api';

type Listener = (payload: any) => void;

export class WebSocketClient {
  private static instance: WebSocketClient;
  private ws: WebSocket | null = null;
  private url: string = WS_URL;
  private listeners: Map<string, Set<Listener>> = new Map();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isConnecting: boolean = false;
  private pendingQueue: any[] = [];

  private constructor() {}

  static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  setUrl(url: string) {
    this.url = url;
  }

  connect(onOpenCallback?: () => void) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        this.startHeartbeat();
        this.dispatch('connection:change', { status: 'connected' });

        // Flush queued messages
        while (this.pendingQueue.length > 0) {
          const item = this.pendingQueue.shift();
          this.send(item);
        }

        if (onOpenCallback) onOpenCallback();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const action = data.action;
          if (action) {
            this.dispatch(action, data);
          }
          this.dispatch('*', data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.dispatch('connection:change', { status: 'disconnected' });
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
        this.dispatch('connection:error', error);
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ action: 'ping' });
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send(data: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    } else {
      // Queue for re-transmission if normal message (avoid queueing raw video chunks to save RAM)
      if (data.action !== 'video:chunk') {
        this.pendingQueue.push(data);
      }
      return false;
    }
  }

  on(action: string, callback: Listener) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(callback);
  }

  off(action: string, callback: Listener) {
    if (this.listeners.has(action)) {
      this.listeners.get(action)!.delete(callback);
    }
  }

  private dispatch(action: string, payload: any) {
    if (this.listeners.has(action)) {
      for (const listener of this.listeners.get(action)!) {
        try {
          listener(payload);
        } catch (e) {
          console.error(`Error in listener for ${action}:`, e);
        }
      }
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
