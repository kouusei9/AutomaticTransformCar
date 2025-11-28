/**
 * 车辆路线配置
 * 集中管理初始路线数据
 */

import type { VehicleRoute } from '../types/vehicle'

export const INITIAL_VEHICLE_ROUTES: VehicleRoute[] = [
  {
    id: 'initial-route-1',
    timestamp: Date.now(),
    nodes: [
      { id: 'D1', coordinates: { lat: 34.9671, lng: 135.7726 }, node_type: 'station' },
      { id: 'H1', coordinates: { lat: 34.9500, lng: 135.7900 }, node_type: 'airport' },
      { id: 'OUT_H1', coordinates: { lat: 34.9300, lng: 135.8200 }, node_type: 'airport' }
    ],
    edges: [
      { seq: 1, from: 'D1', to: 'H1', speed_limit: 100, type: 'road', mode: 1, length: 3000, cost: 120000 },
      { seq: 2, from: 'H1', to: 'OUT_H1', speed_limit: 300, type: 'sky', mode: 4, length: 5000, cost: 6000 }
    ],
    name: 'テストルート1 (Airplane)',
    color: '#00ff00',
    isCycle: true
  },
  {
    id: 'initial-route-2',
    timestamp: Date.now(),
    nodes: [
      { id: 'A2', coordinates: { lat: 34.9805, lng: 135.7476 }, node_type: 'station' },
      { id: 'A1', coordinates: { lat: 35.0141, lng: 135.7684 }, node_type: 'station' },
      { id: 'A3', coordinates: { lat: 35.0394, lng: 135.7292 }, node_type: 'station' },
      { id: 'A4', coordinates: { lat: 35.0279, lng: 135.7789 }, node_type: 'station' }
    ],
    edges: [
      { seq: 1, from: 'A2', to: 'A1', speed_limit: 60, type: 'drone', mode: 3, length: 4000, cost: 120000 },
      { seq: 2, from: 'A1', to: 'A3', speed_limit: 60, type: 'drone', mode: 3, length: 5000, cost: 150000 },
      { seq: 3, from: 'A3', to: 'A4', speed_limit: 60, type: 'drone', mode: 3, length: 4500, cost: 90000 }
    ],
    name: 'テストルート2 (Drone)',
    color: '#00ffff',
    isCycle: true
  },
  {
    id: 'initial-route-3',
    timestamp: Date.now(),
    nodes: [
      { id: 'C1', coordinates: { lat: 34.9759, lng: 135.7736 }, node_type: 'station' },
      { id: 'C2', coordinates: { lat: 34.9880, lng: 135.7717 }, node_type: 'station' },
      { id: 'C3', coordinates: { lat: 35.0036, lng: 135.7789 }, node_type: 'station' }
    ],
    edges: [
      { seq: 1, from: 'C1', to: 'C2', speed_limit: 50, type: 'road', mode: 1, length: 1500, cost: 60000 },
      { seq: 2, from: 'C2', to: 'C3', speed_limit: 50, type: 'road', mode: 1, length: 2000, cost: 80000 }
    ],
    name: 'テストルート3 (Road)',
    color: '#ff00ff',
    isCycle: true
  }
]

/**
 * 获取初始路线的ID列表
 */
export const getInitialRouteIds = (): string[] => {
  return INITIAL_VEHICLE_ROUTES.map(route => route.id)
}
