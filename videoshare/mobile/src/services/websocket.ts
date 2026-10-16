import { WS_URL } from './api';

type Listener = (payload: any) => void;

/**
 * A ping every 15 s keeps NAT mappings alive on mobile carriers and gives a
 * fresh round-trip-time sample. On 2G that is ~30 bytes of traffic — noise
 * compared to a single chunk.
 */
const HEARTBEAT_INTERVAL_MS = 15000;
/** Missed pings before the socket is considered dead and rebuilt. */
const PONG_TIMEOUT_MS = 45000;
/** Backoff between reconnect attempts. Deliberately never gives up. */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 15000;
/** Cap on buffered non-chunk messages while offline. */
const MAX_QUEUED_MESSAGES = 300;

export interface ConnectionChange {
  status: 'connected' | 'disconnected';
  roundTripMs: number;
  /** False on the very first connect, true on every reconnect. */
  reconnected: boolean;
}

/**
 * Resilient WebSocket client.
 *
 * Transfers can legitimately run for tens of minutes on a poor mobile link, so
 * this client never permanently stops reconnecting, measures how slow the link
 * actually is, and tears down sockets that have silently died (a very common
 * failure on 2G/3G, where a half-open socket stops delivering data without ever
 * firing `onclose`).
 */
export class WebSocketClient {
  private static instance: WebSocketClient;
  private ws: WebSocket | null = null;
  private url: string = WS_URL;
  private listeners: Map<string, Set<Listener>> = new Map();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private pongWatchdogTimer: any = null;
  private isConnecting: boolean = false;
  private pendingQueue: any[] = [];
  private reconnectAttempts: number = 0;
  private everConnected: boolean = false;
  /** Set when the caller explicitly disconnects, to stop the reconnect loop. */
  private manualClose: boolean = false;

  private lastPingAt: number = 0;
  private lastPongAt: number = 0;
  private roundTripMs: number = 0;

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

  /** Latest measured round-trip time in ms (0 until the first pong arrives). */
  getRoundTripMs(): number {
    return this.roundTripMs;
  }

  connect(onOpenCallback?: () => void) {
    this.manualClose = false;

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        const wasConnectedBefore = this.everConnected;
        this.everConnected = true;
        this.reconnectAttempts = 0;
        this.lastPongAt = Date.now();

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        this.startHeartbeat();

        // Flush buffered non-video messages (acks, auth, completion notices).
        const queued = this.pendingQueue;
        this.pendingQueue = [];
        for (const item of queued) {
          this.send(item);
        }

        this.dispatch('connection:change', {
          status: 'connected',
          roundTripMs: this.roundTripMs,
          reconnected: wasConnectedBefore,
        } satisfies ConnectionChange);

        if (onOpenCallback) onOpenCallback();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const action = data.action;

          if (action === 'pong') {
            this.lastPongAt = Date.now();
            if (this.lastPingAt > 0) {
              // Smooth the estimate so one unlucky sample cannot skew timeouts.
              const sample = this.lastPongAt - this.lastPingAt;
              this.roundTripMs =
                this.roundTripMs === 0 ? sample : Math.round(this.roundTripMs * 0.6 + sample * 0.4);
            }
          }

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
        this.dispatch('connection:change', {
          status: 'disconnected',
          roundTripMs: this.roundTripMs,
          reconnected: false,
        } satisfies ConnectionChange);
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        // `onclose` always follows, which is where the reconnect is scheduled.
        console.warn('WebSocket error:', error);
        this.dispatch('connection:error', error);
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Reconnect forever with a capped exponential backoff. An in-flight transfer
   * may run for the better part of an hour on a bad link, so giving up after a
   * fixed number of attempts (the previous behaviour) guaranteed failure.
   */
  private scheduleReconnect() {
    if (this.manualClose || this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      BACKOFF_BASE_MS * Math.pow(1.6, Math.min(this.reconnectAttempts - 1, 8)),
      BACKOFF_MAX_MS
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();

    this.heartbeatTimer = setInterval(() => {
      this.lastPingAt = Date.now();
      this.send({ action: 'ping' });
    }, HEARTBEAT_INTERVAL_MS);

    // A half-open socket never fires `onclose`, so watch for missing pongs and
    // rebuild the connection ourselves.
    this.pongWatchdogTimer = setInterval(() => {
      if (Date.now() - this.lastPongAt > PONG_TIMEOUT_MS) {
        console.warn('[WS] No pong received — rebuilding stale connection');
        this.forceReconnect();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongWatchdogTimer) {
      clearInterval(this.pongWatchdogTimer);
      this.pongWatchdogTimer = null;
    }
  }

  /**
   * Tear down the current socket and reconnect immediately. Safe to call from
   * anywhere (e.g. a transfer watchdog that just had a send fail).
   */
  forceReconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.ws;
    this.ws = null;
    try {
      socket?.close();
    } catch {
      // already gone
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  send(data: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }

    // Video chunks are never queued: they are far too large to buffer and the
    // receiver can always re-request what it missed.
    if (data.action !== 'video:chunk') {
      if (this.pendingQueue.length >= MAX_QUEUED_MESSAGES) {
        this.pendingQueue.shift();
      }
      this.pendingQueue.push(data);
    }
    return false;
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
    this.manualClose = true;
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
