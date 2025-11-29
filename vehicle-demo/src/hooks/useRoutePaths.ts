/**
 * 路径生成管理 Hook
 */

import { useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { VehicleRoute } from '../types/vehicle'
import { createRoutePathFromNodeIds } from '../utils/routePathGenerator'

/**
 * 路径生成 Hook
 */
export function useRoutePaths(
  vehicleRoutes: VehicleRoute[],
  routeData: any,
  extractNodeIds: (route: VehicleRoute) => string[],
  onNewPathGenerated?: (vehicleId: string) => void // 新增：路径生成完成回调
) {
  const [routePaths, setRoutePaths] = useState<Map<string, THREE.CurvePath<THREE.Vector3>>>(new Map())

  // 将 vehicleRoutes 转换为 ID 字符串，用于依赖比较
  const vehicleIdsString = useMemo(() => {
    return vehicleRoutes.map(r => r.id).join(',')
  }, [vehicleRoutes])

  useEffect(() => {
    if (!routeData) return
    
    // 使用函数式更新来确保获取最新的 routePaths
    setRoutePaths(currentPaths => {
      // 检查是否有新车辆需要生成路径
      const missingVehicles = vehicleRoutes.filter(route => !currentPaths.has(route.id))
      
      if (missingVehicles.length === 0) {
        return currentPaths
      }

      console.log(`🚗 生成 ${missingVehicles.length} 个新车辆路径:`, missingVehicles.map(r => r.id))
      
      const newPaths = new Map(currentPaths)

      missingVehicles.forEach((route: VehicleRoute) => {
        const nodeIds = extractNodeIds(route)
        const path = createRoutePathFromNodeIds(
          routeData.nodes,
          routeData.edges,
          nodeIds,
          route.edges
        )
        
        if (path) {
          newPaths.set(route.id, path)
          console.log(`✅ 路径生成: ${route.name} (${route.id})`)
          
          // 通知外部：路径生成完成
          if (onNewPathGenerated) {
            setTimeout(() => onNewPathGenerated(route.id), 0)
          }
        }
      })
      return newPaths
    })
  }, [routeData, vehicleIdsString, extractNodeIds, vehicleRoutes, onNewPathGenerated])

  return routePaths
}
