/**
 * 车辆相关类型定义
 */

import type { RouteResponse } from './routeAPI'
import * as THREE from 'three'

/**
 * 车辆路线类型（扩展 RouteResponse）
 */
export interface VehicleRoute extends RouteResponse {
  name: string      // 显示名称
  color: string     // 车辆颜色
  isCycle: boolean  // 是否循环路线
}

/**
 * 车辆跟踪状态
 */
export interface VehicleFollowState {
  isFollowing: boolean
  vehicleId: string | null
  position: THREE.Vector3 | null
  forward: THREE.Vector3 | null
}
