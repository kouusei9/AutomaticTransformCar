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
// const VERTICAL_DISTANCE_MULTIPLIER = 1.0  // 推奨値：1.0-5.0

// ==================== パス生成関数 ====================

/**
 * 指定されたノードIDリストに基づいてパスを作成し、エッジを使用して接続
 * 2つのノード間に直接エッジがない場合、自動的に最短パスを検索
 */
export function createRoutePathFromNodeIds(
  nodes: RouteNode[],
  edges: RouteEdge[],
  nodeIds: string[],
  routeEdges?: Array<{ from: string; to: string; cost: number }> // 路线的edge数组，包含cost信息
): THREE.CurvePath<THREE.Vector3> | null {
  if (!nodes || nodes.length === 0 || !edges || edges.length === 0 || !nodeIds || nodeIds.length < 2) {
    console.warn('無効なルートデータまたはノードID')
    return null
  }

  // 后面改成160000
  // const MOVIE_LENGTH = 160000 // 映画の総時間（ms）

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

  // 2つのノード間のコストを検索（routeEdgesから、ない場合はデフォルト値）
  const getEdgeCost = (a: string, b: string): number => {
    if (!routeEdges) return 0 // デフォルト 1分
    const edge = routeEdges.find(e => (e.from === a && e.to === b) || (e.from === b && e.to === a))
    return edge?.cost || 0
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
  const pointEdgeCosts: number[] = [] // 各セグメントのcostを記録

  const EPSILON = 1e-6

  const addSegmentPoint = (point: THREE.Vector3, edgeType: string, cost: number) => {
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
    pointEdgeCosts.push(cost)
  }

  const addVerticalTransition = (
    fromAltitude: number,
    toAltitude: number,
    position: THREE.Vector3,
    edgeType: string,
    totalCost: number
  ) => {
    const heightDiff = Math.abs(toAltitude - fromAltitude)
    if (heightDiff < EPSILON) {
      return
    }
    if (edgeType === 'drone' || edgeType === 'airplane' || edgeType === 'highway') {
      const verticalPoint = new THREE.Vector3(position.x, toAltitude, position.z)
      addSegmentPoint(verticalPoint, edgeType, totalCost)
    }
  }

  // 记录当前实际高度（只有drone需要严格管理高度）
  let currentAltitude = GROUND_Y

  const firstNode = pathNodes[0]
  const firstPos = latLngToPosition3D(firstNode.coordinates)
  if (pathNodes.length >= 2) {
    const firstEdgeType = getEdgeType(pathNodes[0].id, pathNodes[1].id)
    if (firstEdgeType === 'airplane') {
      // 检查第一个节点是否是 outside 类型
      currentAltitude = firstNode.type === 'outside' ? AIRPLANE_ALTITUDE : HIGHWAY_ALTITUDE
    } else if (firstEdgeType === 'drone') {
      currentAltitude = DRONE_ALTITUDE
    } else if (firstEdgeType === 'highway') {
      currentAltitude = HIGHWAY_ALTITUDE
    }
  }
  points.push(new THREE.Vector3(firstPos.x, currentAltitude, firstPos.z))

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const curr = pathNodes[i]
    const next = pathNodes[i + 1]

    const currPos = latLngToPosition3D(curr.coordinates)
    const nextPos = latLngToPosition3D(next.coordinates)
    const edgeType = getEdgeType(curr.id, next.id)
    let edgeCost = getEdgeCost(curr.id, next.id) // 获取该边的cost

    // 检查是否需要增加变形动画时间
    const prevEdgeType = i > 0 ? getEdgeType(pathNodes[i - 1].id, pathNodes[i].id) : null
    const nextEdgeType = i < pathNodes.length - 2 ? getEdgeType(pathNodes[i + 1].id, pathNodes[i + 2].id) : null

    // 如果当前边的类型与前一段不同，增加前端 8 秒变形时间
    if (prevEdgeType && prevEdgeType !== edgeType) {
      edgeCost += 80_000
      console.log(`🔄 前端变形动画: ${prevEdgeType} → ${edgeType}, +4s`)
    }

    // 如果当前边的类型与后一段不同，增加后端 8 秒变形时间
    if (nextEdgeType && nextEdgeType !== edgeType) {
      edgeCost += 80_000
      console.log(`🔄 后端变形动画: ${edgeType} → ${nextEdgeType}, +4s`)
    }

    // 特殊情况：第一段如果不是 road，增加起飞时间
    if (i === 0 && edgeType !== 'road') {
      edgeCost += 160_000
      console.log(`🚀 起飞动画: ${edgeType}, +16s`)
    }

    let targetAltitude = getAltitudeForType(edgeType)

    const lastPoint = points[points.length - 1]
    if (lastPoint) {
      currentAltitude = lastPoint.y
    }

    const currAnchor = new THREE.Vector3(currPos.x, currentAltitude, currPos.z)

    // Drone模式：需要垂直爬升/下降
    if (edgeType === 'drone') {
      // 计算各阶段的时间分配
      const horizontalDist = Math.sqrt((nextPos.x - currPos.x) ** 2 + (nextPos.z - currPos.z) ** 2)
      const verticalDist = Math.abs(targetAltitude - currentAltitude)
      const totalDist = horizontalDist + verticalDist * 2 // 上升+水平+下降

      // 按距离比例分配时间
      const ascentCost = totalDist > 0 ? (verticalDist / totalDist) * edgeCost : 0
      const horizontalCost = totalDist > 0 ? (horizontalDist / totalDist) * edgeCost : edgeCost
      const descentCost = totalDist > 0 ? (verticalDist / totalDist) * edgeCost : 0

      // 起点垂直爬升到目标高度
      addVerticalTransition(currentAltitude, targetAltitude, currAnchor, edgeType, ascentCost)

      // 水平飞行到终点
      const horizontalPoint = new THREE.Vector3(nextPos.x, targetAltitude, nextPos.z)
      addSegmentPoint(horizontalPoint, edgeType, horizontalCost)
      currentAltitude = targetAltitude

      // 检查是否是最后一条边，或者下一条边不是 drone
      const isLastEdge = i === pathNodes.length - 2
      const nextEdgeType = !isLastEdge ? getEdgeType(next.id, pathNodes[i + 2].id) : ''

      // 如果是最后一条边，或下一条不是 drone，则在终点下降到地面
      if (isLastEdge || nextEdgeType !== 'drone') {
        console.log(`current edge type is ${edgeType}, next edge type is ${nextEdgeType}, descending to ground.`)
        const nextAnchor = new THREE.Vector3(nextPos.x, currentAltitude, nextPos.z)
        addVerticalTransition(currentAltitude, GROUND_Y, nextAnchor, edgeType, descentCost)
        currentAltitude = GROUND_Y
      }
    }
    // ✈️ Airplane模式：去 outside 升到 20m；返程（next 不是 outside）降到 3m
    else if (edgeType === 'airplane') {
      const isReturn = next.type !== 'outside'
      const airplaneTarget = isReturn ? HIGHWAY_ALTITUDE : AIRPLANE_ALTITUDE

      // 只添加终点；起点已存在于上一段结束
      const toPoint = new THREE.Vector3(nextPos.x, airplaneTarget, nextPos.z)
      addSegmentPoint(toPoint, edgeType, edgeCost)
      currentAltitude = airplaneTarget
    }
    // 🛣️ Highway模式：保持在 3m 高度（曲线会弯起到 9m）
    else if (edgeType === 'highway') {
      const highwayTarget = HIGHWAY_ALTITUDE

      // 计算各阶段的时间分配
      const horizontalDist = Math.sqrt((nextPos.x - currPos.x) ** 2 + (nextPos.z - currPos.z) ** 2)
      const verticalDist = Math.abs(highwayTarget - currentAltitude)
      const totalDist = horizontalDist + verticalDist

      // 按距离比例分配时间
      const transitionCost = totalDist > 0 ? (verticalDist / totalDist) * edgeCost : 0
      const mainCost = totalDist > 0 ? (horizontalDist / totalDist) * edgeCost : edgeCost


      // 如果当前不在 3m 高度，先过渡到 3m（使用较小的cost）
      if (Math.abs(currentAltitude - highwayTarget) > EPSILON) {
        // const transitionCost = edgeCost * 0.1
        addVerticalTransition(currentAltitude, highwayTarget, currAnchor, edgeType, transitionCost)
        currentAltitude = highwayTarget
      }

      // 添加终点（也在 3m 高度）
      const toPoint = new THREE.Vector3(nextPos.x, highwayTarget, nextPos.z)
      // const mainCost = edgeCost * 0.9
      if (Math.abs(toPoint.y - currentAltitude) > EPSILON) {
        addSegmentPoint(toPoint, edgeType, mainCost)
      } else {
        addSegmentPoint(toPoint, edgeType, edgeCost)
      }
      currentAltitude = highwayTarget
    }
    // 🚗 Road模式：地面（0m）移动
    else {
      const groundTarget = GROUND_Y
      // addVerticalTransition(currentAltitude, groundTarget, currAnchor, edgeType, MOVIE_LENGTH)
      const toPoint = new THREE.Vector3(nextPos.x, groundTarget, nextPos.z)
      addSegmentPoint(toPoint, edgeType, edgeCost)
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
    // 0 - 60000ms
    const edgeCost = pointEdgeCosts[i] || 0

    // 
    // if (edgeCost === 0) {
    //   // 不单独生成曲线
    //   continue
    // }

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

    // userDataを設定（anyを使用して型エラーを回避）- edgeTypeとcostを保存
    ; (curve as any).userData = { edgeType, cost: edgeCost }
    path.add(curve)
  }

  return path
}