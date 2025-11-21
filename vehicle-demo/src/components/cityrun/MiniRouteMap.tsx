import { useMemo } from 'react';
import type { RouteResponse } from '../../types/routeAPI';
import { VehicleMode } from '../../pages/CityRunDemo';

interface MiniRouteMapProps {
  routeData: RouteResponse | null;
  progressPercent: number;
  currentSegmentIndex: number;
}

interface SvgPoint {
  x: number;
  y: number;
  angle?: number; // 旋转角度（可选）
}

interface SvgSegment {
  from: SvgPoint;
  to: SvgPoint;
  mode: VehicleMode;
  seq: number;
  isPassed: boolean;
  isCurrent: boolean;
  angle: number; // 新增：路段角度
}

// 定义车辆状态类型
interface VehicleState {
  x: number;
  y: number;
  angle: number;
}

export default function MiniRouteMap({
  routeData,
  progressPercent,
  currentSegmentIndex
}: MiniRouteMapProps) {

  // 1. 计算地图数据结构 (只在路线数据改变时计算)
  const mapData = useMemo(() => {
    if (!routeData?.nodes?.length) return null;

    // 坐标归一化逻辑
    const lats = routeData.nodes.map(n => n.coordinates.lat);
    const lngs = routeData.nodes.map(n => n.coordinates.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // 增加 15% 的内边距，防止边缘被切断
    const latPadding = (maxLat - minLat) * 0.15 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.15 || 0.01;

    const bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    };

    // 坐标转换函数
    const latToY = (lat: number) => 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
    const lngToX = (lng: number) => ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;

    // 生成节点
    const svgNodes = routeData.nodes.map(node => ({
      id: node.id,
      x: lngToX(node.coordinates.lng),
      y: latToY(node.coordinates.lat),
    }));

    // 生成路段
    const pathSegments: SvgSegment[] = routeData.edges.map((edge, index) => {
      const fromNode = svgNodes.find(n => n.id === edge.from);
      const toNode = svgNodes.find(n => n.id === edge.to);

      if (!fromNode || !toNode) return null;

      // 计算角度 (Math.atan2 返回弧度，转换为角度)
      // 注意：SVG Y轴向下，所以计算 dy 时要注意方向
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return {
        from: { x: fromNode.x, y: fromNode.y },
        to: { x: toNode.x, y: toNode.y },
        mode: edge.mode as VehicleMode,
        seq: edge.seq,
        isPassed: index < currentSegmentIndex,
        isCurrent: index === currentSegmentIndex,
        angle: angle
      };
    }).filter((s): s is SvgSegment => s !== null);

    // 预计算总时间，用于进度条逻辑
    const totalCost = routeData.edges.reduce((sum, e) => sum + e.cost, 0);

    // 预计算每个路段的累积进度区间 [startPercent, endPercent]
    let accumulatedCost = 0;
    const segmentProgressRanges = routeData.edges.map(edge => {
      const start = (accumulatedCost / totalCost) * 100;
      accumulatedCost += edge.cost;
      const end = (accumulatedCost / totalCost) * 100;
      return { start, end };
    });

    return {
      svgNodes,
      pathSegments,
      segmentProgressRanges,
      latToY,
      lngToX
    };
  }, [routeData, currentSegmentIndex]); // 依赖项包含 currentSegmentIndex 是为了更新 isPassed 状态

  // ✅ 2. 计算车辆实时位置
  const currentVehicleState = useMemo<VehicleState | null>(() => {
    if (!mapData || !mapData.pathSegments[currentSegmentIndex]) return null;

    // ✅ 起点时也返回完整的 VehicleState
    if (progressPercent <= 0) {
      const segment = mapData.pathSegments[0];
      return {
        x: segment.from.x,
        y: segment.from.y,
        angle: segment.angle
      };
    }

    const segment = mapData.pathSegments[currentSegmentIndex];
    const range = mapData.segmentProgressRanges[currentSegmentIndex];

    let localProgress = 0;
    if (range.end > range.start) {
      localProgress = (progressPercent - range.start) / (range.end - range.start);
      localProgress = Math.max(0, Math.min(1, localProgress));
    }

    const currentX = segment.from.x + (segment.to.x - segment.from.x) * localProgress;
    const currentY = segment.from.y + (segment.to.y - segment.from.y) * localProgress;

    return {
      x: currentX,
      y: currentY,
      angle: segment.angle
    };
  }, [mapData, progressPercent, currentSegmentIndex]);

  if (!mapData) return null;

  // 颜色映射
  const getModeColor = (mode: VehicleMode) => {
    switch (mode) {
      case VehicleMode.NORMAL: return '#06b6d4';
      case VehicleMode.HIGHWAY: return '#f59e0b';
      case VehicleMode.DRONE: return '#8b5cf6';
      case VehicleMode.FLIGHT: return '#ec4899';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="relative w-full h-32 bg-black/80 rounded-lg border border-cyan-500/30 overflow-hidden backdrop-blur-sm">
      <div className="absolute top-1 left-2 text-[10px] text-cyan-400 font-mono font-bold z-10 tracking-wider opacity-80">
        NAV SYSTEM ///
      </div>

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ padding: '10%' }}
      >
        {/* 1. 绘制所有路径线段 */}
        {mapData.pathSegments.map((segment, index) => (
          <line
            key={`seg-${index}`}
            x1={segment.from.x}
            y1={segment.from.y}
            x2={segment.to.x}
            y2={segment.to.y}
            stroke={segment.isPassed || segment.isCurrent ? getModeColor(segment.mode) : '#374151'}
            strokeWidth={segment.isCurrent ? 2 : 1.2}
            strokeOpacity={segment.isPassed ? 0.8 : 0.4}
            strokeLinecap="round"
            strokeDasharray={segment.mode === VehicleMode.FLIGHT ? '2,1' : 'none'}
          />
        ))}

        {/* 2. 绘制节点 */}
        {mapData.svgNodes.map((node, index) => {
          const isStart = index === 0;
          const isEnd = index === mapData.svgNodes.length - 1;
          const r = isStart || isEnd ? 3 : 1.5;
          const fill = isStart ? '#10b981' : isEnd ? '#ef4444' : '#0e7490';

          return (
            <g key={`node-${index}`}>
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={fill}
                stroke={isStart || isEnd ? '#fff' : 'none'}
                strokeWidth="0.5"
              />
            </g>
          );
        })}

        {/* 3. 车辆光标 */}
        {currentVehicleState && (
          <g
            transform={`translate(${currentVehicleState.x}, ${currentVehicleState.y}) rotate(${currentVehicleState.angle})`}
          >
            {/* 脉冲波纹 */}
            <circle
              r="5"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="0.5"
              opacity="0.5"
              className="animate-ping"
            />

            {/* 实体箭头 */}
            <path
              d="M 3 0 L -2 -2 L -2 2 Z"
              fill="#fbbf24"
              stroke="white"
              strokeWidth="0.5"
            />
          </g>
        )}
      </svg>

      {/* 底部状态栏 */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-1 px-2 flex justify-between items-end">
        <div className="text-[8px] text-gray-400 font-mono">
          スケール: 自動
        </div>
        <div className="flex gap-2 text-[8px]">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <span className="text-gray-400 scale-75 origin-left">S</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            <span className="text-gray-400 scale-75 origin-left">E</span>
          </div>
        </div>
      </div>
    </div>
  );
}