// Environment-based API and WebSocket URLs
// For production, replace these with your deployed Render URL.
// In dev mode with Expo Go, use 'localhost' (Metro tunnels it for both Android & iOS).
// For a physical device on the same LAN, use your machine's local IP (e.g. 192.168.x.x).

const PROD_API_URL = 'https://vidchat-6pdb.onrender.com';
const PROD_WS_URL = 'wss://vidchat-6pdb.onrender.com/ws';

// Default to live Render backend for testing on real internet and APK builds
export const API_URL = PROD_API_URL;
export const WS_URL = PROD_WS_URL;

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
