/**
 * SSE Connection Management Hook (Server-Sent Events)
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
 * SSE Management Hook
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onNewRoute,
    autoConnect = true,
    wsUrl = 'http://localhost:9001/events'
  } = options

  const connect = useCallback(() => {
    return websocketService.connect(wsUrl).catch(err => {
      console.warn('⚠️ SSE connection failed, retrying in background:', err.message)
    })
  }, [wsUrl])

  useEffect(() => {
    if (!autoConnect) return

    connect()

    // Listen for new route messages
    const cleanup = websocketService.on('NEW_ROUTE', (message) => {
      console.log('📨 Received new route:', message)
      
      if (onNewRoute) {
        try {
          onNewRoute(message.start, message.destination, message.routeData)
        } catch (error) {
          console.error('❌ Failed to process new route:', error)
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
