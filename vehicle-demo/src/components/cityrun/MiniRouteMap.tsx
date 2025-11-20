import { useMemo } from 'react';
import type { RouteResponse } from '../../types/routeAPI';
import { VehicleMode } from '../../pages/CityRunDemo'; // 引入 Enum

interface MiniRouteMapProps {
  routeData: RouteResponse | null;
  progressPercent: number;
  currentSegmentIndex: number;
}

interface SvgPoint {
  x: number;
  y: number;
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

export default function MiniRouteMap({
  routeData,
  progressPercent,
  currentSegmentIndex
}: MiniRouteMapProps) {

  // 1. 计算地图数据结构 (只在路线数据改变时计算)
  const mapData = useMemo(() => {
    if (!routeData?.nodes?.length) return null;

    // --- 坐标归一化逻辑 ---
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

    // --- 生成节点 ---
    const svgNodes = routeData.nodes.map(node => ({
      id: node.id,
      x: lngToX(node.coordinates.lng),
      y: latToY(node.coordinates.lat),
    }));

    // --- 生成路段 ---
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

  // 2. 计算车辆实时位置 (高频更新)
  const currentVehicleState = useMemo(() => {
    if (!mapData || !mapData.pathSegments[currentSegmentIndex]) return null;
    if (progressPercent <= 0) return mapData.pathSegments[0].from; // 起点

    const segment = mapData.pathSegments[currentSegmentIndex];
    const range = mapData.segmentProgressRanges[currentSegmentIndex];

    // 计算该路段内的局部进度 (0.0 - 1.0)
    let localProgress = 0;
    if (range.end > range.start) {
      localProgress = (progressPercent - range.start) / (range.end - range.start);
      // 限制在 0-1 之间，防止浮点数误差导致的越界
      localProgress = Math.max(0, Math.min(1, localProgress));
    }

    // 线性插值计算坐标
    const currentX = segment.from.x + (segment.to.x - segment.from.x) * localProgress;
    const currentY = segment.from.y + (segment.to.y - segment.from.y) * localProgress;

    return {
      x: currentX,
      y: currentY,
      angle: segment.angle // 直接使用预计算的角度
    };
  }, [mapData, progressPercent, currentSegmentIndex]);

  if (!mapData) return null;

  // 颜色映射
  const getModeColor = (mode: VehicleMode) => {
    switch (mode) {
      case VehicleMode.NORMAL: return '#06b6d4';  // Cyan
      case VehicleMode.HIGHWAY: return '#f59e0b'; // Amber
      case VehicleMode.DRONE: return '#8b5cf6';   // Violet
      case VehicleMode.FLIGHT: return '#ec4899';  // Pink
      default: return '#9ca3af';
    }
  };

  return (
    <div className="relative w-full h-32 bg-black/80 rounded-lg border border-cyan-500/30 overflow-hidden backdrop-blur-sm">
      {/* Title */}
      <div className="absolute top-1 left-2 text-[10px] text-cyan-400 font-mono font-bold z-10 tracking-wider opacity-80">
        NAV SYSTEM ///
      </div>

      {/* SVG Map */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ padding: '10%' }} // 内边距，防止圆点切边
      >
        {/* 1. 绘制所有路径线段 */}
        {mapData.pathSegments.map((segment, index) => (
          <line
            key={`seg-${index}`}
            x1={segment.from.x}
            y1={segment.from.y}
            x2={segment.to.x}
            y2={segment.to.y}
            stroke={segment.isPassed || segment.isCurrent ? getModeColor(segment.mode) : '#374151'} // 未经过显示深灰色
            strokeWidth={segment.isCurrent ? 2 : 1.2}
            strokeOpacity={segment.isPassed ? 0.8 : 0.4}
            strokeLinecap="round"
            // 当前路段如果是飞行模式，用虚线表示
            strokeDasharray={segment.mode === VehicleMode.FLIGHT ? '2,1' : 'none'}
          />
        ))}

        {/* 2. 绘制节点 (只绘制起点、终点和转折点) */}
        {mapData.svgNodes.map((node, index) => {
          const isStart = index === 0;
          const isEnd = index === mapData.svgNodes.length - 1;
          // 中间节点稍微小一点
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

        {/* 3. 车辆光标 (带旋转和脉冲) */}
        {currentVehicleState && (
          <g
            transform={`translate(${currentVehicleState.x}, ${currentVehicleState.y}) rotate(${currentVehicleState.angle})`}
          >
            {/* 脉冲波纹 (不随箭头旋转，保持正圆) */}
            {/* 注意：因为外层 g 旋转了，为了保持波纹不旋转（如果是圆形没关系），如果波纹有方向则需要反向旋转 */}
            <circle
              r="5"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="0.5"
              opacity="0.5"
              className="animate-ping"
            />

            {/* 实体箭头 (三角形) */}
            {/* points: 顶端向右(0,0)，这样 rotate 0度时是指向右侧的(X轴正向)。
                SVG计算的角度也是基于X轴正向。
                但是画三角形的时候，为了配合 atan2 的默认方向(X+)，三角形尖端应该朝右 */}
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
          SCALE: AUTO
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