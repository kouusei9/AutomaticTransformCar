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

let cachedData: KyotoRoutesData | null = null;

/**
 * 加载 kyoto_routes.json 数据
 */
export async function loadKyotoRoutes(): Promise<KyotoRoutesData> {
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await fetch('/website-assets/kyoto_routes.json');
    const data = await response.json();
    cachedData = data;
    return data;
  } catch (error) {
    console.error('❌ 加载 kyoto_routes.json 失败:', error);
    throw error;
  }
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
 * 使用 BFS 查找两点之间的路径
 */
function findPath(
  startId: string,
  endId: string,
  edges: KyotoEdge[]
): string[] | null {
  // 构建邻接表
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

  // BFS 查找最短路径
  const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startId, path: [startId] }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (nodeId === endId) {
      return path;
    }

    const neighbors = graph.get(nodeId) || [];
    for (const { to } of neighbors) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push({ nodeId: to, path: [...path, to] });
      }
    }
  }

  return null; // 没有找到路径
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
    const length = edge.distance_km * 1000; // 转换为米
    const cost = (length / speedLimit) * 3600; // 计算时间（毫秒）

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
