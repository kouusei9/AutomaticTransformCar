/**
 * WebSocket 服务 - 用于 CityRun 和 CyberpunkCityDemo 之间的通信
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

export type WebSocketMessage = RouteMessage | VehicleStatusMessage;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * 连接到WebSocket服务器
   */
  connect(url: string = 'ws://localhost:8080'): Promise<void> {
    // 如果已经连接，直接返回
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('ℹ️ WebSocket 已连接');
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket 连接成功');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            let data = event.data;
            
            // 如果是 Blob，先转换为文本
            if (data instanceof Blob) {
              data = await data.text();
            }
            
            const message: WebSocketMessage = JSON.parse(data);
            console.log('📨 收到消息:', message);
            // 直接传递整个消息对象，不再提取 data 字段
            this.notifyListeners(message.type, message);
          } catch (error) {
            console.error('❌ 解析消息失败:', error, '原始数据类型:', typeof event.data, '内容:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket 错误:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket 连接关闭');
          this.attemptReconnect(url);
        };
      } catch (error) {
        console.error('❌ WebSocket 连接失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 尝试重新连接
   */
  private attemptReconnect(url: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect(url).catch(() => {
          console.log('⏳ 重连失败，等待下次尝试...');
        });
      }, this.reconnectDelay);
    } else {
      console.log('❌ 达到最大重连次数，停止尝试');
    }
  }

  /**
   * 发送消息
   */
  send(message: WebSocketMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        console.log('📤 发送消息:', message);
        return true;
      } catch (error) {
        console.error('❌ 发送消息失败:', error);
        return false;
      }
    } else {
      console.warn('⚠️ WebSocket 未连接');
      return false;
    }
  }

  /**
   * 发送新路线消息（CityRun使用）
   */
  sendNewRoute(start: string, destination: string, routeData: any): boolean {
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
   * 订阅消息类型
   */
  on(messageType: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }
    this.listeners.get(messageType)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(messageType)?.delete(callback);
    };
  }

  /**
   * 通知监听器
   */
  private notifyListeners(messageType: string, data: any) {
    const callbacks = this.listeners.get(messageType);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 导出单例
export const websocketService = new WebSocketService();
