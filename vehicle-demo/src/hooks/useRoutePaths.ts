/**
 * 路径生成管理 Hook
 */

import { useState, useEffect } from 'react'
import * as THREE from 'three'
import type { VehicleRoute } from '../types/vehicle'
import { createRoutePathFromNodeIds } from '../utils/routePathGenerator'

/**
 * 路径生成 Hook
 */
export function useRoutePaths(
  vehicleRoutes: VehicleRoute[],
  routeData: any,
  extractNodeIds: (route: VehicleRoute) => string[]
) {
  const [routePaths, setRoutePaths] = useState<Map<string, THREE.CurvePath<THREE.Vector3>>>(new Map())

  useEffect(() => {
    if (!routeData) return
    if (routePaths.size === vehicleRoutes.length) return

    console.log('🛣️ 开始生成路径，车辆数量:', vehicleRoutes.length)
    const newPaths = new Map(routePaths)

    vehicleRoutes.forEach((route: VehicleRoute) => {
      if (newPaths.has(route.id)) return

      const nodeIds = extractNodeIds(route)
      console.log(`🚗 生成车辆 ID ${route.id} (${route.name}) 的路径，节点:`, nodeIds)

      const path = createRoutePathFromNodeIds(
        routeData.nodes,
        routeData.edges,
        nodeIds,
        route.edges
      )

      if (true && path) {
        // 打印详细的路径信息
        console.log(`🛣️ 生成的路径 [车辆ID: ${route.id}]:`)
        console.log('  📊 路径对象:', path)
        console.log('  📐 曲线数量:', path.curves.length)
        console.log('  📏 总长度:', path.getLength().toFixed(2), 'units')

        // 打印每个曲线段的详细信息
        path.curves.forEach((curve: any, index: number) => {
          const startPoint = curve.getPoint(0)
          const endPoint = curve.getPoint(1)
          const edgeType = curve.userData?.edgeType || 'unknown'
          const cost = curve.userData?.cost || 0
          const curveLength = curve.getLength()

          console.log(`  🔗 曲线段 ${index + 1}/${path.curves.length}:`)
          console.log(`    📌 类型: ${edgeType}`)
          console.log(`    ⏱️  Cost: ${cost}ms (${(cost / 1000).toFixed(1)}s)`)
          console.log(`    📏 长度: ${curveLength.toFixed(2)} units`)
          console.log(`    📍 起点: (${startPoint.x.toFixed(2)}, ${startPoint.y.toFixed(2)}, ${startPoint.z.toFixed(2)})`)
          console.log(`    📍 终点: (${endPoint.x.toFixed(2)}, ${endPoint.y.toFixed(2)}, ${endPoint.z.toFixed(2)})`)
          console.log(`    📈 高度变化: ${startPoint.y.toFixed(2)}m → ${endPoint.y.toFixed(2)}m`)
        })
      }
      if (path) {
        newPaths.set(route.id, path)
        console.log(`✅ 车辆 ID ${route.id} 路径生成成功`)
      } else {
        console.warn(`❌ 车辆 ID ${route.id} 路径生成失败`)
      }
    })

    console.log(`✅ 总共生成 ${newPaths.size} 条路径`)
    setRoutePaths(newPaths)
  }, [routeData, vehicleRoutes, extractNodeIds, routePaths])

  return routePaths
}
