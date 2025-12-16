/**
 * SSE Service - Server-Sent Events for CityRun and CyberpunkCityDemo communication
 */

export interface RouteMessage {
  type: 'NEW_ROUTE';
  start: string;
  destination: string;
  routeData: any; // RouteResponse
  timestamp: number;
}

export interface VehicleStatusMessage {
  type: 'VEHICLE_STATUS';
  vehicleId: string;
  position: { x: number; y: number; z: number };
  progress: number;
}

export type SSEMessage = RouteMessage | VehicleStatusMessage;

class SSEService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private baseUrl = '';

  /**
   * Connect to SSE server
   */
  connect(url?: string): Promise<void> {
    // If already connected, return immediately
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      console.log('ℹ️ SSE already connected');
      return Promise.resolve();
    }

    // Get SSE URL
    if (!url) {
      const host = window.location.hostname || '10.0.0.249';
      const port = '9001';
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      
      this.baseUrl = `${protocol}//${host}:${port}`;
      url = `${this.baseUrl}/events`;
      
      console.log('🔗 SSE connection URL:', url);
      console.log('🔐 Protocol:', protocol === 'https:' ? 'HTTPS (Secure)' : 'HTTP (Standard)');
    } else {
      // Extract base URL from events endpoint
      this.baseUrl = url.replace(/\/events$/, '');
    }

    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          console.log('✅ SSE connected successfully');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message: SSEMessage = JSON.parse(event.data);
            
            // Skip CONNECTED message
            if (message.type === 'CONNECTED') {
              console.log('📡 SSE connection established');
              return;
            }
            
            console.log('📨 Received message:', message);
            this.notifyListeners(message.type, message);
          } catch (error) {
            console.error('❌ Failed to parse message:', error, 'Data:', event.data);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('❌ SSE error:', error);
          
          // Close current connection
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
          }
          
          // Attempt reconnect
          this.attemptReconnect(url);
          
          reject(error);
        };
      } catch (error) {
        console.error('❌ SSE connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect(url).catch(() => {
          console.log('⏳ Reconnect failed, waiting for next attempt...');
        });
      }, this.reconnectDelay);
    } else {
      console.log('❌ Max reconnect attempts reached, stopping');
    }
  }

  /**
   * Send message via HTTP POST
   */
  async send(message: SSEMessage): Promise<boolean> {
    if (!this.baseUrl) {
      console.warn('⚠️ SSE not connected, cannot send message');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📤 Message sent successfully:', message.type, 'Clients:', result.clients);
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  /**
   * Send new route message (used by CityRun)
   */
  async sendNewRoute(start: string, destination: string, routeData: any): Promise<boolean> {
    const message: RouteMessage = {
      type: 'NEW_ROUTE',
      start,
      destination,
      routeData,
      timestamp: Date.now()
    };
    return this.send(message);
  }

  /**
   * Subscribe to message type
   */
  on(messageType: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }
    this.listeners.get(messageType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(messageType)?.delete(callback);
    };
  }

  /**
   * Notify listeners
   */
  private notifyListeners(messageType: string, data: any) {
    const callbacks = this.listeners.get(messageType);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('🔌 SSE disconnected');
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

// Export singleton
export const websocketService = new SSEService();
