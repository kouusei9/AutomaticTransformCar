import * as THREE from 'three'
import { latLngToPosition3D, type LatLng } from './coordinateConverter'
import { DRONE_ALTITUDE, GROUND_Y } from './constants'

// ==================== エクスポート型定義 ====================
export interface RouteNode {
  id: string
  name: string
  coordinates: LatLng
}

export interface RouteEdge {
  from: string
  to: string
  distance_km: number
  type?: string
}

export interface RouteData {
  nodes: RouteNode[]
  edges: RouteEdge[]
}

// ==================== 垂直速度制御パラメータ ====================
// 垂直セグメントの距離係数 - 値が大きいほど垂直セグメントが長く、上昇が遅くなる
// 例：2.0は垂直セグメントの長さが実際の高度差の2倍であることを意味する
const VERTICAL_DISTANCE_MULTIPLIER = 1.0  // 推奨値：1.0-5.0

// ==================== パス生成関数 ====================

/**
 * Dijkstraアルゴリズムを使用してエッジに基づいて2つのノード間の最短パスを検索
 */
function findPathBetweenNodes(
  startId: string,
  endId: string,
  nodes: RouteNode[],
  edges: RouteEdge[]
): string[] | null {
  // 始点と終点が同じ場合、直接返す
  if (startId === endId) {
    return [startId]
  }
  
  // 隣接リストを構築（双方向グラフ）
  const adjacency = new Map<string, Map<string, number>>()
  
  edges.forEach(edge => {
    // 正方向
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, new Map())
    }
    adjacency.get(edge.from)!.set(edge.to, edge.distance_km)
    
    // 逆方向（エッジは双方向に通行可能）
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, new Map())
    }
    adjacency.get(edge.to)!.set(edge.from, edge.distance_km)
  })
  
  // Dijkstraアルゴリズム
  const distances = new Map<string, number>()
  const previous = new Map<string, string>()
  const unvisited = new Set(nodes.map(n => n.id))
  
  // 距離を初期化
  nodes.forEach(node => {
    distances.set(node.id, node.id === startId ? 0 : Infinity)
  })
  
  while (unvisited.size > 0) {
    // 未訪問ノードの中から距離が最小のものを見つける
    let currentId: string | null = null
    let minDist = Infinity
    
    unvisited.forEach(id => {
      const dist = distances.get(id)
      if (dist !== undefined && dist < minDist) {
        minDist = dist
        currentId = id
      }
    })
    
    if (currentId === null || minDist === Infinity) {
      break
    }
    
    unvisited.delete(currentId)
    
    // 終点に到達した場合、早期終了可能
    if (currentId === endId) {
      break
    }
    
    // 隣接ノードの距離を更新
    const neighbors = adjacency.get(currentId)
    
    if (neighbors) {
      neighbors.forEach((weight, neighborId) => {
        if (unvisited.has(neighborId)) {
          const newDist = minDist + weight
          const oldDist = distances.get(neighborId)
          
          if (oldDist === undefined || newDist < oldDist) {
            distances.set(neighborId, newDist)
            previous.set(neighborId, currentId!)
          }
        }
      })
    }
  }
  
  // パスを再構築
  const finalDistance = distances.get(endId) || Infinity
  
  if (finalDistance === Infinity) {
    return null
  }
  
  const path: string[] = []
  let current = endId
  
  while (current && current !== startId) {
    path.unshift(current)
    const prev = previous.get(current)
    if (!prev) {
      return null
    }
    current = prev
  }
  
  // 始点を追加
  path.unshift(startId)
  
  return path.length >= 2 ? path : null
}

/**
 * 指定されたノードIDリストに基づいてパスを作成し、エッジを使用して接続
 * 2つのノード間に直接エッジがない場合、自動的に最短パスを検索
 */
export function createRoutePathFromNodeIds(
  nodes: RouteNode[],
  edges: RouteEdge[],
  nodeIds: string[]
): THREE.CurvePath<THREE.Vector3> | null {
  if (!nodes || nodes.length === 0 || !edges || edges.length === 0 || !nodeIds || nodeIds.length < 2) {
    console.warn('無効なルートデータまたはノードID')
    return null
  }

  // 各ペアの隣接ノードのパスを検索
  const fullPath: string[] = []
  
  for (let i = 0; i < nodeIds.length; i++) {
    const startId = nodeIds[i]
    const endId = nodeIds[(i + 1) % nodeIds.length] // 最初のノードに循環
    
    const segmentPath = findPathBetweenNodes(startId, endId, nodes, edges)
    
    if (!segmentPath) {
      return null
    }
    
    // 完全なパスに追加（重複ノードを避ける）
    if (fullPath.length === 0) {
      fullPath.push(...segmentPath)
    } else {
      // 最初のノードをスキップ（前のセグメントの最後に既存）
      fullPath.push(...segmentPath.slice(1))
    }
  }
  
  // Three.jsポイントに変換し、エッジタイプ（drone/road）に基づいて上昇/下降ロジックを構築
  const pathNodes = fullPath
    .map(id => nodes.find(n => n.id === id))
    .filter(Boolean) as RouteNode[]
  
  if (pathNodes.length < 2) {
    console.warn('パスを作成するためのノードが不足しています')
    return null
  }

  // 2つのノード間のエッジタイプを検索（双方向）
  const getEdgeType = (a: string, b: string): string => {
    const edge = edges.find(e => (e.from === a && e.to === b) || (e.from === b && e.to === a))
    return edge?.type || 'road'
  }

  const points: THREE.Vector3[] = []

  for (let i = 0; i < pathNodes.length; i++) {
    const curr = pathNodes[i]
    const prev = pathNodes[(i - 1 + pathNodes.length) % pathNodes.length]
    const next = pathNodes[(i + 1) % pathNodes.length]

    const currPos = latLngToPosition3D(curr.coordinates)
    const prevType = getEdgeType(prev.id, curr.id)
    const nextType = getEdgeType(curr.id, next.id)

    // 離陸：地上から空中へ（中間点を追加して上昇を遅くする）
    if (prevType !== 'drone' && nextType === 'drone') {
      const groundPoint = new THREE.Vector3(currPos.x, GROUND_Y, currPos.z)
      
      points.push(groundPoint)
      
      // 中間点を追加（VERTICAL_DISTANCE_MULTIPLIERに基づいて数を制御）
      const heightDiff = DRONE_ALTITUDE - GROUND_Y
      const segments = Math.ceil(heightDiff * VERTICAL_DISTANCE_MULTIPLIER)
      
      for (let j = 1; j <= segments; j++) {
        const t = j / segments
        points.push(new THREE.Vector3(
          currPos.x,
          GROUND_Y + heightDiff * t,
          currPos.z
        ))
      }
    }
        // 着陸：空中から地上へ（中間点を追加して降下を遅くする）
    else if (prevType === 'drone' && nextType !== 'drone') {
      const airPoint = new THREE.Vector3(currPos.x, DRONE_ALTITUDE, currPos.z)
      
      points.push(airPoint)
      
      // 中間点を追加
      const heightDiff = DRONE_ALTITUDE - GROUND_Y
      const segments = Math.ceil(heightDiff * VERTICAL_DISTANCE_MULTIPLIER)
      
      for (let j = 1; j <= segments; j++) {
        const t = j / segments
        points.push(new THREE.Vector3(
          currPos.x,
          DRONE_ALTITUDE - heightDiff * t,
          currPos.z
        ))
      }
    }
    // 継続飛行または継続地上移動
    else {
      const y = (prevType === 'drone' || nextType === 'drone') ? DRONE_ALTITUDE : GROUND_Y
      points.push(new THREE.Vector3(currPos.x, y, currPos.z))
    }
  }

  // 順次接続されたポイントから折れ線パスを作成（垂直セグメントと水平セグメントを含む）、そして閉じる
  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    path.add(new THREE.LineCurve3(a, b))
  }

  return path
}

/**
 * 完全に直線のパスを作成（折れ線）- デフォルトでこれを使用
 */
export function createRoutePathFromData(
  nodes: RouteNode[],
  edges: RouteEdge[]
): THREE.CurvePath<THREE.Vector3> | null {
  if (!nodes || nodes.length === 0 || !edges || edges.length === 0) {
    console.warn('無効なルートデータ')
    return null
  }

  const pathNodes: RouteNode[] = []
  const visited = new Set<string>()
  
  const firstEdge = edges[0]
  let currentNodeId = firstEdge.from
  
  while (currentNodeId && !visited.has(currentNodeId)) {
    const node = nodes.find(n => n.id === currentNodeId)
    if (!node) break
    
    pathNodes.push(node)
    visited.add(currentNodeId)
    
    const nextEdge = edges.find(e => e.from === currentNodeId)
    currentNodeId = nextEdge ? nextEdge.to : ''
  }
  
  if (currentNodeId && !visited.has(currentNodeId)) {
    const lastNode = nodes.find(n => n.id === currentNodeId)
    if (lastNode) {
      pathNodes.push(lastNode)
    }
  }
  
  if (pathNodes.length < 2) {
    console.warn('パスを作成するためのノードが不足しています')
    return null
  }
  
  const points: THREE.Vector3[] = pathNodes.map(node => {
    const pos = latLngToPosition3D(node.coordinates)
    return new THREE.Vector3(pos.x, GROUND_Y, pos.z)
  })
  
  // 折れ線パスを作成（完全に直線）
  const path = new THREE.CurvePath<THREE.Vector3>()
  
  for (let i = 0; i < points.length - 1; i++) {
    path.add(new THREE.LineCurve3(points[i], points[i + 1]))
  }
  
  // パスを閉じる：最後のポイントから最初のポイントに接続
  path.add(new THREE.LineCurve3(points[points.length - 1], points[0]))
  
  console.log('直線ルートパスを生成しました。ポイント数:', points.length, pathNodes.map(n => n.name))
  
  return path
}

export async function loadRoutePathFromJSON(
  jsonUrl: string
): Promise<THREE.CurvePath<THREE.Vector3> | null> {
  try {
    const response = await fetch(jsonUrl)
    const data = await response.json()
    
    if (!data.nodes || !data.edges) {
      console.error('無効なルートデータ形式')
      return null
    }
    
    return createRoutePathFromData(data.nodes, data.edges)
  } catch (error) {
    console.error('ルートデータの読み込みに失敗:', error)
    return null
  }
}