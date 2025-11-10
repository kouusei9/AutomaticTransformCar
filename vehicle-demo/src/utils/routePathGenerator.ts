import * as THREE from 'three'
import { latLngToPosition3D, type LatLng } from './coordinateConverter'
import { DRONE_ALTITUDE, GROUND_Y, HIGHWAY_ALTITUDE, AIRPLANE_ALTITUDE } from './constants'

// ==================== エクスポート型定義 ====================
export interface RouteNode {
  id: string
  name: string
  coordinates: LatLng
  type?: string
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

  // 直接使用传入的节点序列（不使用 Dijkstra 算法）
  const pathNodes: RouteNode[] = []
  for (const id of nodeIds) {
    const node = nodes.find(n => n.id === id)
    if (!node) {
      console.error(`ノードが見つかりません: ${id}`)
      return null
    }
    pathNodes.push(node)
  }
  
  if (pathNodes.length < 2) {
    console.warn('パスを作成するためのノードが不足しています')
    return null
  }

  // 2つのノード間のエッジタイプを検索（双方向）
  const getEdgeType = (a: string, b: string): string => {
    const edge = edges.find(e => (e.from === a && e.to === b) || (e.from === b && e.to === a))
    return edge?.type || 'road'
  }

  // エッジタイプに応じた高度を取得
  const getAltitudeForType = (type: string): number => {
    if (type === 'drone') return DRONE_ALTITUDE
    if (type === 'highway') return HIGHWAY_ALTITUDE
    if (type === 'airplane') return AIRPLANE_ALTITUDE
    return GROUND_Y
  }

  // ポイントとそれに対応するエッジタイプを記録
  const points: THREE.Vector3[] = []
  const pointEdgeTypes: string[] = [] // 各セグメントのedgeTypeを記録

  const EPSILON = 1e-6

  const addSegmentPoint = (point: THREE.Vector3, edgeType: string) => {
    if (points.length === 0) {
      points.push(point.clone())
      return
    }

    const lastPoint = points[points.length - 1]
    if (lastPoint.distanceToSquared(point) < EPSILON) {
      return
    }

    points.push(point)
    pointEdgeTypes.push(edgeType)
  }

  const addVerticalTransition = (
    fromAltitude: number,
    toAltitude: number,
    position: THREE.Vector3,
    edgeType: string
  ) => {
    const heightDiff = Math.abs(toAltitude - fromAltitude)
    if (heightDiff < EPSILON) {
      return
    }

    const segments = Math.max(1, Math.ceil(heightDiff * VERTICAL_DISTANCE_MULTIPLIER))

    for (let j = 1; j <= segments; j++) {
      const t = j / segments
      const y = fromAltitude + (toAltitude - fromAltitude) * t
      const verticalPoint = new THREE.Vector3(position.x, y, position.z)
      addSegmentPoint(verticalPoint, edgeType)
    }
  }

  // 记录当前实际高度（只有drone需要严格管理高度）
  let currentAltitude = GROUND_Y

  const firstNode = pathNodes[0]
  const firstPos = latLngToPosition3D(firstNode.coordinates)
  points.push(new THREE.Vector3(firstPos.x, currentAltitude, firstPos.z))

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const curr = pathNodes[i]
    const next = pathNodes[i + 1]

    const currPos = latLngToPosition3D(curr.coordinates)
    const nextPos = latLngToPosition3D(next.coordinates)
    const edgeType = getEdgeType(curr.id, next.id)
    let targetAltitude = getAltitudeForType(edgeType)

    const lastPoint = points[points.length - 1]
    if (lastPoint) {
      currentAltitude = lastPoint.y
    }

    const currAnchor = new THREE.Vector3(currPos.x, currentAltitude, currPos.z)

    // Drone模式：需要垂直爬升/下降
    if (edgeType === 'drone') {
      // 起点垂直爬升到目标高度
      addVerticalTransition(currentAltitude, targetAltitude, currAnchor, edgeType)

      // 水平飞行到终点
      const horizontalPoint = new THREE.Vector3(nextPos.x, targetAltitude, nextPos.z)
      addSegmentPoint(horizontalPoint, edgeType)
      currentAltitude = targetAltitude
      
      // 检查是否是最后一条边，或者下一条边不是 drone
      const isLastEdge = i === pathNodes.length - 2
      const nextEdgeType = !isLastEdge ? getEdgeType(next.id, pathNodes[i + 2].id) : ''
      
      // 如果是最后一条边，或下一条不是 drone，则在终点下降到地面
      if (isLastEdge || nextEdgeType !== 'drone') {
        const nextAnchor = new THREE.Vector3(nextPos.x, currentAltitude, nextPos.z)
        addVerticalTransition(currentAltitude, GROUND_Y, nextAnchor, edgeType)
        currentAltitude = GROUND_Y
      }
    }
    // ✈️ Airplane模式：去 outside 升到 20m；返程（next 不是 outside）降到 3m
    else if (edgeType === 'airplane') {
      const isReturn = next.type !== 'outside'
      const airplaneTarget = isReturn ? HIGHWAY_ALTITUDE : AIRPLANE_ALTITUDE

      // 只添加终点；起点已存在于上一段结束
      const toPoint = new THREE.Vector3(nextPos.x, airplaneTarget, nextPos.z)
      addSegmentPoint(toPoint, edgeType)
      currentAltitude = airplaneTarget
    }
    // 🛣️ Highway模式：保持在 3m 高度（曲线会弯起到 9m）
    else if (edgeType === 'highway') {
      const highwayTarget = HIGHWAY_ALTITUDE
      
      // 如果当前不在 3m 高度，先过渡到 3m
      if (Math.abs(currentAltitude - highwayTarget) > EPSILON) {
        addVerticalTransition(currentAltitude, highwayTarget, currAnchor, edgeType)
        currentAltitude = highwayTarget
      }
      
      // 添加终点（也在 3m 高度）
      const toPoint = new THREE.Vector3(nextPos.x, highwayTarget, nextPos.z)
      addSegmentPoint(toPoint, edgeType)
      currentAltitude = highwayTarget
    }
    // 🚗 Road模式：地面（0m）移动
    else {
      const groundTarget = GROUND_Y
      addVerticalTransition(currentAltitude, groundTarget, currAnchor, edgeType)
      const toPoint = new THREE.Vector3(nextPos.x, groundTarget, nextPos.z)
      addSegmentPoint(toPoint, edgeType)
      currentAltitude = groundTarget
    }
  }

  // 順次接続されたポイントから折れ線パスを作成（垂直セグメントと水平セグメントを含む）、そして閉じる
  // 各曲線のuserDataにedgeTypeを保存
  // ハイウェイセグメントには曲線を適用
  // 飛行機（outside行き）には三次ベジェ曲線を適用
  const path = new THREE.CurvePath<THREE.Vector3>()
  
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const edgeType = pointEdgeTypes[i] || 'road'
    
    // セグメントが水平か判定（高度差が小さい）
    const isHorizontal = Math.abs(a.y - b.y) < 0.01
    const isHighway = edgeType === 'highway'
    const isAirplane = edgeType === 'airplane'
    const distance = a.distanceTo(b)
    const heightDiff = Math.abs(b.y - a.y)
    const horizontalDist = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2)
    
    let curve: THREE.Curve<THREE.Vector3>
    
    // 飛行機モード（outside行き）：滑らかな三次ベジェ曲線
    if (isAirplane && heightDiff > 0.5 && horizontalDist > 1) {
      // 制御点の距離を計算
      const controlDist = Math.max(horizontalDist * 0.4, heightDiff * 0.4)
      
      // 方向ベクトルを計算
      const direction = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
      
      // 第1制御点：開始点から水平方向に延ばす + わずかに上昇
      const cp1 = new THREE.Vector3(
        a.x + direction.x * controlDist,
        a.y + heightDiff * 0.15,
        a.z + direction.z * controlDist
      )
      
      // 第2制御点：終了点に近く、目標高度に近い
      const cp2 = new THREE.Vector3(
        b.x - direction.x * controlDist,
        b.y - heightDiff * 0.15,
        b.z - direction.z * controlDist
      )
      
      // 三次ベジェ曲線を使用
      curve = new THREE.CubicBezierCurve3(a, cp1, cp2, b)
    }
    // ハイウェイの水平セグメントには弧形を適用（3m → 9m → 3m）
    else if (isHighway && isHorizontal && distance > 1) {
      // 中点を計算
      const mid = new THREE.Vector3(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        (a.z + b.z) / 2
      )
      
      // 中点を9m高度に設定（3m基礎高度 + 6m弧形）
      mid.y = 9.0  // 3m → 9m → 3m の自然な弧を形成
      
      // 二次ベジェ曲線を使用
      curve = new THREE.QuadraticBezierCurve3(a, mid, b)
    } else {
      // その他のセグメント：直線を使用
      curve = new THREE.LineCurve3(a, b)
    }
    
    // userDataを設定（anyを使用して型エラーを回避）
    ;(curve as any).userData = { edgeType }
    path.add(curve)
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