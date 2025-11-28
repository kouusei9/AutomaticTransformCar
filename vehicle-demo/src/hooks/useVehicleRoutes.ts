/**
 * 车辆管理相关的自定义 Hooks
 */

import { useState, useRef, useCallback } from 'react'
import type { VehicleRoute } from '../types/vehicle'
import type { RouteResponse } from '../types/routeAPI'
import { getInitialRouteIds } from '../config/vehicleRoutes'

/**
 * 车辆路线管理 Hook
 */
export function useVehicleRoutes(initialRoutes: VehicleRoute[]) {
  const [vehicleRoutes, setVehicleRoutes] = useState<VehicleRoute[]>(initialRoutes)
  const [activeVehicles, setActiveVehicles] = useState<Set<string>>(new Set(getInitialRouteIds()))
  const addedRouteIdsRef = useRef<Set<string>>(new Set(getInitialRouteIds()))

  /**
   * 从路线数据提取节点 ID 列表
   */
  const extractNodeIds = useCallback((route: VehicleRoute): string[] => {
    if (!route.nodes || route.nodes.length === 0) {
      return []
    }
    return route.nodes.map(node => node.id)
  }, [])

  /**
   * 添加新车辆
   */
  const addVehicle = useCallback((start: string, destination: string, routeResponse: RouteResponse) => {
    if (!routeResponse.nodes || routeResponse.nodes.length === 0) {
      console.warn('⚠️ 无效的路线数据，无法添加车辆')
      return false
    }

    const routeId = routeResponse.id

    // 检查是否已添加
    if (addedRouteIdsRef.current.has(routeId)) {
      console.warn(`⚠️ 车辆已存在，跳过添加: ID=${routeId}`)
      return false
    }

    // 标记为已添加
    addedRouteIdsRef.current.add(routeId)
    console.log('✅ 添加车辆到追踪列表:', routeId)

    const newRoute: VehicleRoute = {
      ...routeResponse,
      name: `${start} → ${destination}`,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      isCycle: false
    }

    setVehicleRoutes(prev => [...prev, newRoute])
    setActiveVehicles(prev => new Set([...prev, routeId]))

    console.log(`✅ 添加新车辆: ${newRoute.name}`)
    return true
  }, [])

  /**
   * 移除车辆
   */
  const removeVehicle = useCallback((vehicleId: string) => {
    setActiveVehicles(prev => {
      const newSet = new Set(prev)
      newSet.delete(vehicleId)
      return newSet
    })
    console.log(`🗑️ 移除车辆: ${vehicleId}`)
  }, [])

  /**
   * 获取车辆路线
   */
  const getVehicleRoute = useCallback((vehicleId: string): VehicleRoute | undefined => {
    return vehicleRoutes.find(r => r.id === vehicleId)
  }, [vehicleRoutes])

  return {
    vehicleRoutes,
    activeVehicles,
    extractNodeIds,
    addVehicle,
    removeVehicle,
    getVehicleRoute
  }
}
