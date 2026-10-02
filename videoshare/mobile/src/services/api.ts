// Environment-based API and WebSocket URLs
// For production, replace these with your deployed Render URL.
// In dev mode, 10.0.2.2 is the Android emulator's alias for localhost.
// For a physical device on the same LAN, use your machine's local IP (e.g. 192.168.x.x).

const DEV_API_URL = 'http://10.0.2.2:3000';
const PROD_API_URL = 'https://your-render-app.onrender.com'; // TODO: replace before shipping

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const WS_URL = __DEV__
  ? 'ws://10.0.2.2:3000/ws'
  : 'wss://your-render-app.onrender.com/ws'; // TODO: replace before shipping

export class ApiService {
  private static baseUrl = API_URL;

  static setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  static getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health check verification
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Fetch chat message history
   */
  static async getMessageHistory(
    sessionId: string,
    sessionToken: string,
    deviceId: string
  ): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/messages`, {
      headers: {
        'x-session-id': sessionId,
        'x-session-token': sessionToken,
        'x-device-id': deviceId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch message history: ${response.statusText}`);
    }

    const json = await response.json();
    return json.messages || [];
  }
}
