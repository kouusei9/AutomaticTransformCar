/**
 * AI Route API Type Definitions
 * Based on API説明書 v1.0
 */

// ========== モード定義 ==========
export interface VehicleMode {
  id: number;
  piece: string;          // 将棋の駒名
  name: string;           // モード名
  type: ModeType;
  function: string;       // 機能説明
}

export type ModeType = 
  | 'NORMAL'        // 通常運転モード (金将)
  | 'HIGHWAY'       // 高速モード (香車)
  | 'DRONE'         // ドローンモード - 短距離飛行 (桂馬)
  | 'LONG_FLIGHT'   // 長距離飛行モード (飛車)
  | 'FOLLOW'        // 追従モード (歩兵)
  | 'PARK';         // 駐車モード (王将)

export const VEHICLE_MODES: VehicleMode[] = [
  {
    id: 1,
    piece: '金将',
    name: '通常運転モード',
    type: 'NORMAL',
    function: '前進'
  },
  {
    id: 2,
    piece: '香車',
    name: '高速モード',
    type: 'HIGHWAY',
    function: '直線移動・速度優先'
  },
  {
    id: 3,
    piece: '桂馬',
    name: 'ドローンモード',
    type: 'DRONE',
    function: '短距離飛行・段差や障害物越え'
  },
  {
    id: 4,
    piece: '飛車',
    name: '長距離飛行モード',
    type: 'LONG_FLIGHT',
    function: '都市間移動'
  },
  {
    id: 5,
    piece: '歩兵',
    name: '追従モード',
    type: 'FOLLOW',
    function: '他車を自動追尾'
  },
  {
    id: 6,
    piece: '王将',
    name: '駐車モード',
    type: 'PARK',
    function: '駐車'
  }
];

// ========== 場所定義 ==========
export interface Location {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface Coordinates {
  lat: number;  // 緯度
  lng: number;  // 経度
}

export const LOCATIONS: Location[] = [
  {
    id: 'A',
    name: '東京駅',
    coordinates: { lat: 35.6812, lng: 139.7671 }
  },
  {
    id: 'B',
    name: '京都駅',
    coordinates: { lat: 35.0015, lng: 135.7583 }
  },
  {
    id: 'C',
    name: '清水寺',
    coordinates: { lat: 34.9948, lng: 135.7850 }
  },
  {
    id: 'D',
    name: '伏見稲荷大社',
    coordinates: { lat: 34.9671, lng: 135.7726 }
  },
  {
    id: 'E',
    name: '金閣寺',
    coordinates: { lat: 35.0394, lng: 135.7292 }
  }
];

// ========== API Request ==========
export interface RouteRequest {
  id: string;           // 区別するためのID (例: "20251030-1")
  start_id: string;     // 出発地ID
  end_id: string;       // 目的地ID
}

// ========== API Response ==========
export interface RouteResponse {
  id: string;           // リクエストと同じID
  timestamp: number;    // やり取り時間 (UNIX timestamp)
  nodes: RouteNode[];   // ノード一覧
  edges: RouteEdge[];   // エッジ（経路）一覧
}

export interface RouteNode {
  id: string;                    // ノードのコード (例: "node_001")
  coordinates: Coordinates;      // 経緯度
  node_type: NodeType;           // ノードのタイプ
}

export type NodeType = 
  | 'intersection'  // 交差点
  | 'station'       // 駅
  | 'three_way'     // 三叉路
  | 'airport';      // 空港

export interface RouteEdge {
  seq: number;          // 経路の順番
  from: string;         // 開始ノードID
  to: string;           // 終了ノードID
  speed_limit: number;  // 制限スピード (km/h)
  type: RoadType;       // 道路のタイプ
  mode: number;         // 車のモードID (VEHICLE_MODES の id に対応)
  length: number;       // 道路の長さ (メートル)
  cost: number;         // かかる時間 (ミリ秒)
}

export type RoadType = 
  | 'highway'  // 高速道路
  | 'sky'      // 空路
  | 'road'
  | 'drone';    // 一般道路

// ========== Helper Functions ==========

/**
 * モードIDからモード情報を取得
 */
export function getModeById(modeId: number): VehicleMode | undefined {
  return VEHICLE_MODES.find(mode => mode.id === modeId);
}

/**
 * 場所IDから場所情報を取得
 */
export function getLocationById(locationId: string): Location | undefined {
  return LOCATIONS.find(loc => loc.id === locationId);
}

/**
 * ルート全体の距離を計算 (メートル)
 */
export function calculateTotalDistance(edges: RouteEdge[]): number {
  return edges.reduce((total, edge) => total + edge.length, 0);
}

/**
 * ルート全体の時間を計算 (分)
 */
export function calculateTotalTime(edges: RouteEdge[]): number {
  const totalMs = edges.reduce((total, edge) => total + edge.cost, 0);
  return Math.round(totalMs / 1000 / 60); // ミリ秒 → 分
}

/**
 * 距離をフォーマット (km表示)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 時間をフォーマット (分表示)
 */
export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
}
