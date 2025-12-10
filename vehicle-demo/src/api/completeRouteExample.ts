/**
 * 完整路线示例 - 包含3种模式切换
 * 金将(通常) → 香車(高速) → 飛車(飞行)
 * 
 * 这是一个从京都駅到東京駅的完整示例路线
 */

import type { RouteResponse } from '../types/routeAPI';

/**
 * 辅助函数：根据距离和速度自动计算耗时
 * @param lengthMeters - 路段长度（米）
 * @param speedKmh - 速度限制（公里/小时）
 * @returns 耗时（毫秒）
 * 
 * 计算公式：cost (ms) = (length (m) / speed (km/h)) × 3,600,000
 * 
 * 示例：
 * - 15km @ 40km/h → 22.5分钟 → 1,350,000ms
 * - 25km @ 100km/h → 15分钟 → 900,000ms
 * - 60km @ 300km/h → 12分钟 → 720,000ms
 */
function calculateCost(lengthMeters: number, speedKmh: number): number {
  const MILLISECONDS_PER_HOUR = 3_600_000;
  const lengthKm = lengthMeters / 1000;
  const timeHours = lengthKm / speedKmh;
  return Math.round(timeHours * MILLISECONDS_PER_HOUR);
}

/**
 * 生成包含3种模式的完整测试路线
 * 
 * 路线概要：
 * - 出发地：京都駅 (35.0015, 135.7583)
 * - 目的地：東京駅 (35.6812, 139.7671)
 * - 总距离：约480km
 * - 总时间：约168分钟 (2小时48分)
 * - 实际行驶时间：504秒 (8分24秒) - 基于1分钟=3秒的映射
 * 
 * 模式切换：
 * 1. 第1段 (0-60km): 金将 - 通常運転モード (一般道路)
 * 2. 第2段 (60-180km): 香車 - 高速モード (高速道路)
 * 3. 第3段 (180-420km): 飛車 - 長距離飛行モード (空路)
 * 4. 第4段 (420-480km): 金将 - 通常運転モード (一般道路)
 */
export function getCompleteThreeModeRoute(): RouteResponse {
  return {
    id: "20251114-THREE-MODE-DEMO",
    timestamp: Math.floor(Date.now() / 1000),
    nodes: [
      {
        id: "node_001",
        coordinates: { lat: 35.0015, lng: 135.7583 },
        node_type: "station"
      },
      {
        id: "node_002",
        coordinates: { lat: 35.0500, lng: 135.9000 },
        node_type: "intersection"
      },
      {
        id: "node_003",
        coordinates: { lat: 35.1500, lng: 136.2000 },
        node_type: "intersection"
      },
      {
        id: "node_004",
        coordinates: { lat: 35.3000, lng: 137.0000 },
        node_type: "airport"
      },
      {
        id: "node_005",
        coordinates: { lat: 35.5000, lng: 138.5000 },
        node_type: "airport"
      },
      {
        id: "node_006",
        coordinates: { lat: 35.6500, lng: 139.5000 },
        node_type: "intersection"
      },
      {
        id: "node_007",
        coordinates: { lat: 35.6812, lng: 139.7671 },
        node_type: "station"
      }
    ],
    edges: [
      // 第1段：金将（通常運転モード）- 京都市内の一般道路
      // 30km @ 40km/h = 45分钟 = 2,700,000ms
      {
        seq: 1,
        from: "node_001",
        to: "node_002",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 30000,
        cost: calculateCost(30000, 40)  // 2,700,000ms
      },
      // 第2段：金将（通常運転モード）- 高速入口前
      // 30km @ 40km/h = 45分钟 = 2,700,000ms
      {
        seq: 2,
        from: "node_002",
        to: "node_003",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 30000,
        cost: calculateCost(30000, 40)  // 2,700,000ms
      },
      // 第3段：香車（高速モード）- 名古屋方向の高速道路
      // 120km @ 100km/h = 72分钟 = 4,320,000ms
      {
        seq: 3,
        from: "node_003",
        to: "node_004",
        speed_limit: 100,
        type: "highway",
        mode: 2,
        length: 120000,
        cost: calculateCost(120000, 100)  // 4,320,000ms
      },
      // 第4段：飛車（長距離飛行モード）- 空路飞行
      // 240km @ 300km/h = 48分钟 = 2,880,000ms
      {
        seq: 4,
        from: "node_004",
        to: "node_005",
        speed_limit: 300,
        type: "sky",
        mode: 4,
        length: 240000,
        cost: calculateCost(240000, 300)  // 2,880,000ms
      },
      // 第5段：金将（通常運転モード）- 东京市内降落后
      // 40km @ 40km/h = 60分钟 = 3,600,000ms
      {
        seq: 5,
        from: "node_005",
        to: "node_006",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 40000,
        cost: calculateCost(40000, 40)  // 3,600,000ms
      },
      // 第6段：金将（通常運転モード）- 东京駅附近
      // 20km @ 40km/h = 30分钟 = 1,800,000ms
      {
        seq: 6,
        from: "node_006",
        to: "node_007",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 20000,
        cost: calculateCost(20000, 40)  // 1,800,000ms
      }
    ]
  };
}

/**
 * 简化版：只包含3种模式的短路线
 * 
 * 路线概要：
 * - 距离：约90km
 * - 时间：约30分钟
 * - 实际行驶时间：90秒 (1分30秒)
 * 
 * 模式切换：
 * 1. 金将 → 2. 香車 → 3. 飛車
 */
export function getSimpleThreeModeRoute(): RouteResponse {
  return {
    id: "20251114-SIMPLE-THREE-MODE",
    timestamp: Math.floor(Date.now() / 1000),
    nodes: [
      {
        id: "node_001",
        coordinates: { lat: 35.0015, lng: 135.7583 },
        node_type: "station"
      },
      {
        id: "node_002",
        coordinates: { lat: 35.1000, lng: 136.0000 },
        node_type: "intersection"
      },
      {
        id: "node_003",
        coordinates: { lat: 35.2000, lng: 136.5000 },
        node_type: "airport"
      },
      {
        id: "node_004",
        coordinates: { lat: 35.3000, lng: 137.0000 },
        node_type: "station"
      }
    ],
    edges: [
      // 第1段：金将（通常モード）
      // 10km @ 40km/h = 15分钟 = 900,000ms
      {
        seq: 1,
        from: "node_001",
        to: "node_002",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 10000,
        cost: calculateCost(10000, 40)  // 900,000ms
      },
      // 第2段：香車（高速モード）
      // 30km @ 100km/h = 18分钟 = 1,080,000ms
      {
        seq: 2,
        from: "node_002",
        to: "node_003",
        speed_limit: 100,
        type: "highway",
        mode: 2,
        length: 30000,
        cost: calculateCost(30000, 100)  // 1,080,000ms
      },
      // 第3段：飛車（飛行モード）
      // 50km @ 300km/h = 10分钟 = 600,000ms
      {
        seq: 3,
        from: "node_003",
        to: "node_004",
        speed_limit: 300,
        type: "sky",
        mode: 4,
        length: 50000,
        cost: calculateCost(50000, 300)  // 600,000ms
      }
    ]
  };
}

/**
 * 测试版：包含所有模式切换的路线（包括桂馬）
 * 
 * 模式切换：
 * 1. 金将 → 2. 香車 → 3. 桂馬 → 4. 飛車
 */
export function getAllModesRoute(): RouteResponse {
  return {
    id: "20251114-ALL-MODES",
    timestamp: Math.floor(Date.now() / 1000),
    nodes: [
      {
        id: "node_001",
        coordinates: { lat: 35.0015, lng: 135.7583 },
        node_type: "station"
      },
      {
        id: "node_002",
        coordinates: { lat: 35.0500, lng: 135.9000 },
        node_type: "intersection"
      },
      {
        id: "node_003",
        coordinates: { lat: 35.1000, lng: 136.1000 },
        node_type: "intersection"
      },
      {
        id: "node_004",
        coordinates: { lat: 35.1500, lng: 136.3000 },
        node_type: "three_way"
      },
      {
        id: "node_005",
        coordinates: { lat: 35.2500, lng: 136.8000 },
        node_type: "airport"
      },
      {
        id: "node_006",
        coordinates: { lat: 35.3500, lng: 137.3000 },
        node_type: "station"
      }
    ],
    edges: [
      // 第1段：金将（通常モード）
      // 15km @ 40km/h = 22.5分钟 = 1,350,000ms
      {
        seq: 1,
        from: "node_001",
        to: "node_002",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 1000,
        cost: calculateCost(5000, 40)  // 1,350,000ms
      },
      // 第2段：香車（高速モード）
      // 25km @ 100km/h = 15分钟 = 900,000ms
      {
        seq: 2,
        from: "node_002",
        to: "node_003",
        speed_limit: 100,
        type: "highway",
        mode: 2,
        length: 15000,
        cost: calculateCost(15000, 100)  // 900,000ms
      },
      // 第3段：桂馬（短距離飛行モード）
      // 20km @ 80km/h = 15分钟 = 900,000ms
      {
        seq: 3,
        from: "node_003",
        to: "node_004",
        speed_limit: 80,
        type: "sky",
        mode: 3,
        length: 10000,
        cost: calculateCost(10000, 80)  // 900,000ms
      },
      // 第4段：飛車（長距離飛行モード）
      // 60km @ 300km/h = 12分钟 = 720,000ms
      {
        seq: 4,
        from: "node_004",
        to: "node_005",
        speed_limit: 300,
        type: "sky",
        mode: 4,
        length: 20000,
        cost: calculateCost(20000, 300)  // 720,000ms
      },
      // 第5段：金将（通常モード）- 降落后
      // 10km @ 40km/h = 15分钟 = 900,000ms
      {
        seq: 5,
        from: "node_005",
        to: "node_006",
        speed_limit: 40,
        type: "road",
        mode: 1,
        length: 1000,
        cost: calculateCost(1000, 40)  // 900,000ms
      }
    ]
  };
}

/**
 * 在浏览器控制台中使用这些路线
 */
if (typeof window !== 'undefined') {
  (window as any).testRoutes = {
    complete: getCompleteThreeModeRoute,
    simple: getSimpleThreeModeRoute,
    all: getAllModesRoute
  };
  
  console.log('🎯 テストルート利用可能:');
  console.log('   window.testRoutes.complete() - 完整路线 (6段, 480km, 168分钟)');
  console.log('   window.testRoutes.simple()   - 简化路线 (3段, 90km, 30分钟)');
  console.log('   window.testRoutes.all()      - 全模式路线 (5段, 包含桂馬)');
}
