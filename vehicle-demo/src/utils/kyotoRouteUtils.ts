/**
 * Kyoto 路线工具函数
 * 从 kyoto_routes.json 加载数据并生成路线
 */

import type { RouteResponse, RouteNode, RouteEdge } from '../types/routeAPI';

export interface KyotoNode {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  type: string;
}

export interface KyotoEdge {
  from: string;
  to: string;
  distance_km: number;
  type: 'road' | 'highway' | 'drone' | 'airplane';
}

export interface KyotoRoutesData {
  nodes: KyotoNode[];
  edges: KyotoEdge[];
}

let cachePromise: Promise<KyotoRoutesData> | null = null;

/**
 * 加载 kyoto_routes.json 数据
 */
export function loadKyotoRoutes(): Promise<KyotoRoutesData> {
  if (!cachePromise) {
    cachePromise = fetch('/website-assets/kyoto_routes.json')
      .then(res => res.json())
      .catch(err => {
        cachePromise = null;  // 失败时重置，允许重试
        throw err;
      });
  }
  return cachePromise;
}

/**
 * 将 Kyoto edge type 转换为 mode ID
 */
function getEdgeMode(edgeType: string): number {
  switch (edgeType) {
    case 'road':
      return 1; // 通常モード
    case 'highway':
      return 2; // 高速モード
    case 'drone':
      return 3; // ドローンモード
    case 'airplane':
      return 4; // 飛行モード
    default:
      return 1;
  }
}

/**
 * 将 Kyoto edge type 转换为 road type
 */
function getRoadType(edgeType: string): 'road' | 'highway' | 'sky' | 'drone' {
  switch (edgeType) {
    case 'airplane':
      return 'sky';
    default:
      return edgeType as 'road' | 'highway' | 'drone';
  }
}

/**
 * 计算速度限制
 */
function getSpeedLimit(mode: number): number {
  switch (mode) {
    case 1: return 40;   // 通常モード
    case 2: return 100;  // 高速モード
    case 3: return 80;   // ドローンモード
    case 4: return 300;  // 飛行モード
    default: return 40;
  }
}

/**
 * 使用 Dijkstra 算法查找两点之间速度最快的路径
 */
function findPath(
  startId: string,
  endId: string,
  edges: KyotoEdge[]
): string[] | null {
  // 构建邻接表（包含边信息）
  const graph = new Map<string, { to: string; edge: KyotoEdge }[]>();

  edges.forEach(edge => {
    // 添加正向边
    if (!graph.has(edge.from)) {
      graph.set(edge.from, []);
    }
    graph.get(edge.from)!.push({ to: edge.to, edge });

    // 添加反向边（假设所有边都是双向的）
    if (!graph.has(edge.to)) {
      graph.set(edge.to, []);
    }
    graph.get(edge.to)!.push({ to: edge.from, edge });
  });

  // Dijkstra 算法数据结构
  const distances = new Map<string, number>(); // 到达每个节点的最短时间
  const previous = new Map<string, string>(); // 最短路径的前驱节点
  const unvisited = new Set<string>(); // 未访问的节点集合

  // 初始化所有节点距离为无穷大
  graph.forEach((_, nodeId) => {
    distances.set(nodeId, Infinity);
    unvisited.add(nodeId);
  });

  // 起点距离为0
  distances.set(startId, 0);

  while (unvisited.size > 0) {
    // 找到未访问节点中距离最小的节点
    let currentNode: string | null = null;
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId)!;
      if (distance < minDistance) {
        minDistance = distance;
        currentNode = nodeId;
      }
    }

    // 如果没有可达的节点，退出
    if (currentNode === null || minDistance === Infinity) {
      break;
    }

    // 如果找到终点，提前退出
    if (currentNode === endId) {
      break;
    }

    // 标记当前节点为已访问
    unvisited.delete(currentNode);

    // 更新邻居节点的距离
    const neighbors = graph.get(currentNode) || [];
    for (const { to, edge } of neighbors) {
      if (!unvisited.has(to)) continue;

      // 计算通过当前节点到达邻居的时间
      const mode = getEdgeMode(edge.type);
      const speedLimit = getSpeedLimit(mode);
      const cost = (edge.distance_km / speedLimit) * 3_600_000; // km / (km/h) * ms/h

      const newDistance = distances.get(currentNode)! + cost;

      // 如果找到更短的路径，更新距离和前驱
      if (newDistance < distances.get(to)!) {
        distances.set(to, newDistance);
        previous.set(to, currentNode);
      }
    }
  }

  // 如果终点不可达
  if (!previous.has(endId) && startId !== endId) {
    return null;
  }

  // 重建路径
  const path: string[] = [];
  let current: string | undefined = endId;

  while (current !== undefined) {
    path.unshift(current);
    if (current === startId) break;
    current = previous.get(current);
  }

  // 验证路径是否有效
  if (path.length === 0 || path[0] !== startId) {
    return null;
  }

  const totalTime = distances.get(endId)!;
  console.log(`🚀 Dijkstra找到最快路径: ${path.join(' → ')} (总时间: ${(totalTime / 60000).toFixed(2)} 分钟)`);

  return path;
}

/**
 * 根据起点和终点生成完整的路线数据
 */
export async function generateRoute(
  startId: string,
  endId: string
): Promise<RouteResponse | null> {
  const data = await loadKyotoRoutes();

  // 查找节点
  const startNode = data.nodes.find(n => n.id === startId);
  const endNode = data.nodes.find(n => n.id === endId);

  if (!startNode || !endNode) {
    console.error('❌ 找不到节点:', { startId, endId });
    return null;
  }

  // 查找路径
  const path = findPath(startId, endId, data.edges);

  if (!path || path.length < 2) {
    console.error('❌ 无法找到路径:', { startId, endId });
    return null;
  }

  console.log('✅ 找到路径:', path);

  // 构建路线节点
  const routeNodes: RouteNode[] = path.map(nodeId => {
    const node = data.nodes.find(n => n.id === nodeId)!;
    return {
      id: node.id,
      coordinates: node.coordinates,
      node_type: node.type as any
    };
  });

  // 构建路线边
  const routeEdges: RouteEdge[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];

    // 查找对应的边（正向或反向）
    let edge = data.edges.find(e => e.from === fromId && e.to === toId);
    if (!edge) {
      edge = data.edges.find(e => e.from === toId && e.to === fromId);
    }

    if (!edge) {
      console.warn('⚠️ 找不到边:', { fromId, toId });
      continue;
    }

    const mode = getEdgeMode(edge.type);
    const speedLimit = getSpeedLimit(mode);
    const length = edge.distance_km * 1000;
    const cost = (edge.distance_km / speedLimit) * 3_600_000; // km / (km/h) * ms/h

    routeEdges.push({
      seq: i + 1,
      from: fromId,
      to: toId,
      speed_limit: speedLimit,
      type: getRoadType(edge.type),
      mode,
      length,
      cost
    });
  }

  const routeResponse: RouteResponse = {
    id: `route-${Date.now()}`,
    timestamp: Date.now(),
    nodes: routeNodes,
    edges: routeEdges
  };

  console.log('✅ 生成的路线:', routeResponse);
  return routeResponse;
}

/**
 * 获取所有可选的地点列表
 */
export async function getAvailableLocations(): Promise<KyotoNode[]> {
  const data = await loadKyotoRoutes();
  // 过滤掉 "outside" 类型的节点
  return data.nodes;//.filter(node => node.type !== 'outside');
}
