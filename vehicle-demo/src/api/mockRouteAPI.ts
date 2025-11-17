/**
 * Mock Route API
 * Based on API説明書 v1.0 - /api/ai_route
 * 
 * 伪数据生成器：根据出发地和目的地生成路线信息
 */

import type {
  RouteRequest,
  RouteResponse,
  RouteNode,
  RouteEdge,
  NodeType,
  RoadType,
  Location,
  Coordinates
} from '../types/routeAPI';
import { getLocationById } from '../types/routeAPI';

/**
 * ルート取得 API (Mock実装)
 * 
 * @param request - リクエストパラメータ
 * @returns Promise<RouteResponse> - ルート情報
 */
export async function fetchRoute(request: RouteRequest): Promise<RouteResponse> {
  // 実際のAPIコールをシミュレート（500ms遅延）
  await new Promise(resolve => setTimeout(resolve, 500));

  const startLocation = getLocationById(request.start_id);
  const endLocation = getLocationById(request.end_id);

  if (!startLocation || !endLocation) {
    throw new Error(`Invalid location ID: ${request.start_id} or ${request.end_id}`);
  }

  // ルートデータを生成
  const routeData = generateRouteData(request.id, startLocation, endLocation);

  return routeData;
}

/**
 * ルートデータを生成
 */
function generateRouteData(
  requestId: string,
  startLocation: Location,
  endLocation: Location
): RouteResponse {
  const nodes: RouteNode[] = [];
  const edges: RouteEdge[] = [];

  // 距離を計算（簡易的にハバサイン公式を使用）
  const totalDistance = calculateDistance(
    startLocation.coordinates,
    endLocation.coordinates
  );

  // セグメント数を距離に応じて決定（50kmごとに1セグメント）
  const segmentCount = Math.max(2, Math.ceil(totalDistance / 50000));

  // ノードを生成
  for (let i = 0; i <= segmentCount; i++) {
    const progress = i / segmentCount;
    const coordinates = interpolateCoordinates(
      startLocation.coordinates,
      endLocation.coordinates,
      progress
    );

    const nodeType = determineNodeType(i, segmentCount, totalDistance);

    nodes.push({
      id: `node_${String(i + 1).padStart(3, '0')}`,
      coordinates,
      node_type: nodeType
    });
  }

  // エッジを生成
  for (let i = 0; i < segmentCount; i++) {
    const segmentDistance = totalDistance / segmentCount;
    const roadType = determineRoadType(segmentDistance, i, segmentCount);
    const mode = determineModeByRoadType(roadType);
    const speedLimit = getSpeedLimit(roadType);
    const cost = calculateCost(segmentDistance, speedLimit);

    edges.push({
      seq: i + 1,
      from: `node_${String(i + 1).padStart(3, '0')}`,
      to: `node_${String(i + 2).padStart(3, '0')}`,
      speed_limit: speedLimit,
      type: roadType,
      mode: mode,
      length: Math.round(segmentDistance),
      cost: Math.round(cost)
    });
  }

  return {
    id: requestId,
    timestamp: Math.floor(Date.now() / 1000), // UNIX timestamp
    nodes,
    edges
  };
}

/**
 * 2点間の距離を計算（ハバサイン公式）
 * @returns 距離（メートル）
 */
function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // 地球の半径（メートル）
  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);
  const deltaLat = toRadians(coord2.lat - coord1.lat);
  const deltaLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 度数法からラジアンに変換
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * 2点間の座標を補間
 */
function interpolateCoordinates(
  start: Coordinates,
  end: Coordinates,
  progress: number
): Coordinates {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress
  };
}

/**
 * ノードタイプを決定
 */
function determineNodeType(
  index: number,
  total: number,
  totalDistance: number
): NodeType {
  if (index === 0 || index === total) {
    return 'station'; // 始点・終点は駅
  }

  if (totalDistance > 100000 && index === Math.floor(total / 2)) {
    return 'airport'; // 長距離の中間点は空港
  }

  if (index % 3 === 0) {
    return 'three_way'; // 3つおきに三叉路
  }

  return 'intersection'; // それ以外は交差点
}

/**
 * 道路タイプを決定
 */
function determineRoadType(
  segmentDistance: number,
  index: number,
  total: number
): RoadType {
  // 長距離（100km以上）の場合、中間セグメントは空路
  if (segmentDistance > 50000 && index > 0 && index < total - 1) {
    return 'sky';
  }

  // 中距離（30km以上）の場合、高速道路
  if (segmentDistance > 30000) {
    return 'highway';
  }

  // 短距離（30km未満）は一般道路
  if (segmentDistance > 10000) {
    return 'drone';
  }

  // それ以外は一般道路
  return 'road';
}

/**
 * 道路タイプに応じたモードIDを決定
 */
function determineModeByRoadType(roadType: RoadType): number {
  switch (roadType) {
    case 'road':
      return 1; // 通常運転モード (金将)
    case 'highway':
      return 2; // 高速モード (香車)
    case 'sky':
      return 4; // 長距離飛行モード (飛車)
    case 'drone':
      return 3; // 短距離飛行モード (桂馬)
    default:
      return 1;
  }
}

/**
 * 道路タイプに応じた制限速度を取得
 */
function getSpeedLimit(roadType: RoadType): number {
  switch (roadType) {
    case 'road':
      return 40; // 一般道路: 40km/h
    case 'highway':
      return 100; // 高速道路: 100km/h
    case 'sky':
      return 300; // 空路: 300km/h
    case 'drone':
      return 80;  // ドローンモード: 80km/h
    default:
      return 40;
  }
}

/**
 * 移動コスト（時間）を計算
 * @param distance - 距離（メートル）
 * @param speedLimit - 制限速度（km/h）
 * @returns コスト（ミリ秒）
 */
function calculateCost(distance: number, speedLimit: number): number {
  // 時間 = 距離 / 速度
  const hours = distance / 1000 / speedLimit;
  const milliseconds = hours * 60 * 60 * 1000;
  return milliseconds;
}

/**
 * ランダムなリクエストIDを生成
 */
export function generateRequestId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 1000);
  return `${dateStr}-${randomNum}`;
}

/**
 * 簡易ルート取得（start_idとend_idのみで呼び出し可能）
 */
export async function getRoute(startId: string, endId: string): Promise<RouteResponse> {
  const requestId = generateRequestId();
  return fetchRoute({
    id: requestId,
    start_id: startId,
    end_id: endId
  });
}

/**
 * 京都エリア内のサンプルルートを生成
 */
export async function getKyotoSampleRoute(): Promise<RouteResponse> {
  // 京都駅 → 清水寺
  return getRoute('B', 'C');
}

/**
 * 長距離ルート（東京 → 京都）を生成
 */
export async function getLongDistanceRoute(): Promise<RouteResponse> {
  // 東京駅 → 京都駅
  return getRoute('A', 'B');
}
