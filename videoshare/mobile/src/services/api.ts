// Environment-based API and WebSocket URLs
// For production, replace these with your deployed Render URL.
// In dev mode with Expo Go, use 'localhost' (Metro tunnels it for both Android & iOS).
// For a physical device on the same LAN, use your machine's local IP (e.g. 192.168.x.x).

const DEV_API_URL = 'http://localhost:3000';
const PROD_API_URL = 'https://vidchat-6pdb.onrender.com';

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
export const WS_URL = __DEV__
  ? 'ws://localhost:3000/ws'
  : 'wss://vidchat-6pdb.onrender.com/ws';

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
