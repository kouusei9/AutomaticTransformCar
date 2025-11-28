/**
 * WebSocket 连接管理 Hook
 */

import { useEffect, useCallback } from 'react'
import { websocketService } from '../services/websocketService'
import type { RouteResponse } from '../types/routeAPI'

export interface UseWebSocketOptions {
  onNewRoute?: (start: string, destination: string, routeData: RouteResponse) => void
  autoConnect?: boolean
  wsUrl?: string
}

/**
 * WebSocket 管理 Hook
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onNewRoute,
    autoConnect = true,
    wsUrl = 'ws://localhost:8080'
  } = options

  const connect = useCallback(() => {
    return websocketService.connect(wsUrl).catch(err => {
      console.warn('⚠️ WebSocket 连接失败，将在后台重试:', err.message)
    })
  }, [wsUrl])

  useEffect(() => {
    if (!autoConnect) return

    connect()

    // 监听新路线消息
    const cleanup = websocketService.on('NEW_ROUTE', (message) => {
      console.log('📨 收到新路线:', message)
      
      if (onNewRoute) {
        try {
          onNewRoute(message.start, message.destination, message.routeData)
        } catch (error) {
          console.error('❌ 处理新路线失败:', error)
        }
      }
    })

    return () => {
      cleanup()
      websocketService.disconnect()
    }
  }, [autoConnect, connect, onNewRoute])

  return {
    connect,
    disconnect: () => websocketService.disconnect(),
    send: (message: any) => websocketService.send(message),
    isConnected: () => websocketService.isConnected()
  }
}
