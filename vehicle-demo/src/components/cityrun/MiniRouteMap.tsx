import { useMemo } from 'react';
import type { RouteResponse } from '../../types/routeAPI';

interface MiniRouteMapProps {
  routeData: RouteResponse | null;
  progressPercent: number;
  currentSegmentIndex: number;
}

export default function MiniRouteMap({ 
  routeData, 
  progressPercent,
  currentSegmentIndex 
}: MiniRouteMapProps) {
  // 计算地图边界和缩放
  const mapData = useMemo(() => {
    if (!routeData || !routeData.nodes || routeData.nodes.length === 0) {
      return null;
    }

    // 找到所有节点的经纬度范围
    const lats = routeData.nodes.map(node => node.coordinates.lat);
    const lngs = routeData.nodes.map(node => node.coordinates.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    // 添加边距
    const latPadding = (maxLat - minLat) * 0.1 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.1 || 0.01;
    
    const bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    };
    
    // 将经纬度转换为SVG坐标 (0-100)
    const latToY = (lat: number) => {
      return 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
    };
    
    const lngToX = (lng: number) => {
      return ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    };
    
    // 转换所有节点坐标
    const svgNodes = routeData.nodes.map(node => ({
      id: node.id,
      x: lngToX(node.coordinates.lng),
      y: latToY(node.coordinates.lat),
      type: node.node_type,
    }));
    
    // 生成路径线段
    const pathSegments = routeData.edges.map((edge, index) => {
      const fromNode = routeData.nodes.find(n => n.id === edge.from);
      const toNode = routeData.nodes.find(n => n.id === edge.to);
      
      if (!fromNode || !toNode) return null;
      
      return {
        from: {
          x: lngToX(fromNode.coordinates.lng),
          y: latToY(fromNode.coordinates.lat),
        },
        to: {
          x: lngToX(toNode.coordinates.lng),
          y: latToY(toNode.coordinates.lat),
        },
        mode: edge.mode,
        seq: edge.seq,
        isPassed: index < currentSegmentIndex,
        isCurrent: index === currentSegmentIndex,
      };
    }).filter(Boolean);
    
    return {
      bounds,
      svgNodes,
      pathSegments,
      latToY,
      lngToX,
    };
  }, [routeData, currentSegmentIndex]);

  // 计算当前车辆在路线上的位置
  const currentPosition = useMemo(() => {
    if (!mapData || !routeData || !routeData.edges || routeData.edges.length === 0) {
      return null;
    }
    
    // 如果还没开始，返回null
    if (progressPercent <= 0) {
      return null;
    }
    
    // 验证 currentSegmentIndex 有效性
    if (currentSegmentIndex >= routeData.edges.length) {
      return null;
    }
    
    const currentEdge = routeData.edges[currentSegmentIndex];
    const fromNode = routeData.nodes.find(n => n.id === currentEdge.from);
    const toNode = routeData.nodes.find(n => n.id === currentEdge.to);
    
    if (!fromNode || !toNode) return null;
    
    // 计算总时间和每段的时间比例
    const totalTime = routeData.edges.reduce((sum, edge) => sum + (edge.cost / 1000 / 60), 0);
    
    // 计算当前段之前所有段的累计时间
    const timeBeforeCurrentSegment = routeData.edges
      .slice(0, currentSegmentIndex)
      .reduce((sum, edge) => sum + (edge.cost / 1000 / 60), 0);
    
    // 当前段的时间长度
    const currentSegmentTime = currentEdge.cost / 1000 / 60;
    
    // 计算当前段开始和结束时的总进度百分比
    const segmentStartPercent = (timeBeforeCurrentSegment / totalTime) * 100;
    const segmentEndPercent = ((timeBeforeCurrentSegment + currentSegmentTime) / totalTime) * 100;
    
    // 计算当前在本段内的进度 (0-1)
    let segmentProgress = 0;
    if (segmentEndPercent > segmentStartPercent) {
      segmentProgress = (progressPercent - segmentStartPercent) / (segmentEndPercent - segmentStartPercent);
      segmentProgress = Math.max(0, Math.min(1, segmentProgress));
    }
    
    // 在起点和终点之间插值
    const fromX = mapData.lngToX(fromNode.coordinates.lng);
    const fromY = mapData.latToY(fromNode.coordinates.lat);
    const toX = mapData.lngToX(toNode.coordinates.lng);
    const toY = mapData.latToY(toNode.coordinates.lat);
    
    return {
      x: fromX + (toX - fromX) * segmentProgress,
      y: fromY + (toY - fromY) * segmentProgress,
    };
  }, [mapData, routeData, progressPercent, currentSegmentIndex]);

  if (!mapData || !routeData) {
    return null;
  }

  // 根据模式选择颜色
  const getModeColor = (mode: number) => {
    switch (mode) {
      case 1: return '#06b6d4'; // 青色 - 通常
      case 2: return '#f59e0b'; // 橙色 - 高速
      case 3: return '#8b5cf6'; // 紫色 - 无人机
      case 4: return '#ec4899'; // 粉色 - 飞行
      default: return '#06b6d4';
    }
  };

  return (
    <div className="relative w-full h-32 bg-black/60 rounded-lg border border-cyan-500/30 overflow-hidden">
      {/* 小地图标题 */}
      <div className="absolute top-1 left-2 text-[10px] text-cyan-400 font-bold z-10">
        ルートマップ
      </div>
      
      {/* SVG 地图 */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ transform: 'scale(0.9)' }}
      >
        {/* 绘制路径线段 */}
        {mapData.pathSegments.map((segment: any, index: number) => (
          <line
            key={index}
            x1={segment.from.x}
            y1={segment.from.y}
            x2={segment.to.x}
            y2={segment.to.y}
            stroke={segment.isPassed ? getModeColor(segment.mode) : '#4b5563'}
            strokeWidth={segment.isCurrent ? '1.5' : '1'}
            strokeOpacity={segment.isPassed ? 0.8 : 0.3}
            strokeDasharray={segment.isCurrent ? '2,1' : 'none'}
            className={segment.isCurrent ? 'animate-pulse' : ''}
          />
        ))}
        
        {/* 绘制节点 */}
        {mapData.svgNodes.map((node: any, index: number) => {
          const isStart = index === 0;
          const isEnd = index === mapData.svgNodes.length - 1;
          
          return (
            <g key={node.id}>
              {/* 节点圆圈 */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isStart || isEnd ? 2.5 : 1.5}
                fill={isStart ? '#10b981' : isEnd ? '#ef4444' : '#06b6d4'}
                stroke="#ffffff"
                strokeWidth="0.5"
                opacity={0.9}
              />
              
              {/* 起点和终点标记 */}
              {isStart && (
                <text
                  x={node.x}
                  y={node.y - 4}
                  fontSize="4"
                  fill="#10b981"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  S
                </text>
              )}
              {isEnd && (
                <text
                  x={node.x}
                  y={node.y - 4}
                  fontSize="4"
                  fill="#ef4444"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  E
                </text>
              )}
            </g>
          );
        })}
        
        {/* 当前车辆位置 */}
        {currentPosition && (
          <g>
            {/* 外圈脉冲效果 */}
            <circle
              cx={currentPosition.x}
              cy={currentPosition.y}
              r="4"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="0.5"
              opacity="0.6"
              className="animate-ping"
            />
            {/* 车辆图标 */}
            <circle
              cx={currentPosition.x}
              cy={currentPosition.y}
              r="2"
              fill="#fbbf24"
              stroke="#ffffff"
              strokeWidth="0.8"
            />
            {/* 方向箭头 */}
            <polygon
              points={`${currentPosition.x},${currentPosition.y - 3} ${currentPosition.x - 1.5},${currentPosition.y} ${currentPosition.x + 1.5},${currentPosition.y}`}
              fill="#fbbf24"
              opacity="0.8"
            />
          </g>
        )}
      </svg>
      
      {/* 图例 */}
      <div className="absolute bottom-1 right-2 flex gap-2 text-[8px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-gray-400">出発</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-gray-400">目的地</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
          <span className="text-gray-400">現在地</span>
        </div>
      </div>
    </div>
  );
}
