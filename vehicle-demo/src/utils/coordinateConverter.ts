/**
 * 座標変換ユーティリティ
 * 経緯度座標をThree.js 3Dシーン座標に変換
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface Position3D {
  x: number
  y: number
  z: number
}

/**
 * 京都マップの境界（55箇所すべてを含むように範囲を拡大）
 * kyoto_routes.json内の実際の座標範囲に基づいて調整
 *
 * 経度範囲: 135.676111 (嵐山) ~ 135.799444 (宇治)
 * 緯度範囲: 34.889444 (宇治) ~ 35.120278 (鞍馬)
 */
const MAP_BOUNDS = {
  minLat: 34.88,   // 34.98から34.88に拡大（宇治、山崎などの南部地点を含む）
  maxLat: 35.13,   // 35.02から35.13に拡大（鞍馬などの北部地点を含む）
  minLng: 135.67,  // 135.75から135.67に拡大（嵐山などの西部地点を含む）
  maxLng: 135.80,  // 135.79から135.80に拡大（宇治などの東部地点を含む）
  mapSize: 200     // マップサイズは変更なし
}

/**
 * 経緯度をThree.jsシーン座標に変換
 */
export function latLngToPosition3D(latLng: LatLng): Position3D {
  const { lat, lng } = latLng
  const { minLat, maxLat, minLng, maxLng, mapSize } = MAP_BOUNDS
  
  // 0-1の範囲に正規化
  const normalizedX = (lng - minLng) / (maxLng - minLng)
  const normalizedZ = (lat - minLat) / (maxLat - minLat)
  
  // Three.js座標系に変換（-mapSize/2 から mapSize/2）
  const x = (normalizedX - 0.5) * mapSize
  const z = (0.5 - normalizedZ) * mapSize
  const y = 0
  
  return { x, y, z }
}

export function convertMultiplePositions(positions: LatLng[]): Position3D[] {
  return positions.map(latLngToPosition3D)
}