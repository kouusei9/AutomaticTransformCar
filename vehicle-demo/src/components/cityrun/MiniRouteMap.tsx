import { useMemo, useCallback } from 'react';
import type { RouteResponse } from '../../types/routeAPI';
import { VehicleMode, getModeColor } from '../../types/vehicleMode';

// ===== 类型定义 =====
interface MiniRouteMapProps {
  routeData: RouteResponse | null;
  progressPercent: number;
  currentSegmentIndex: number;
}

interface SvgPoint {
  x: number;
  y: number;
}

interface SvgNode extends SvgPoint {
  id: string;
}

interface SvgSegment {
  from: SvgPoint;
  to: SvgPoint;
  mode: VehicleMode;
  seq: number;
  angle: number;
}

interface ProgressRange {
  start: number;
  end: number;
}

interface MapData {
  svgNodes: SvgNode[];
  pathSegments: SvgSegment[];
  segmentProgressRanges: ProgressRange[];
  totalCost: number;
}

interface VehicleState {
  x: number;
  y: number;
  angle: number;
}

// ===== 常量定义 =====
const PADDING_RATIO = 0.15;
const DEFAULT_PADDING = 0.01;
const SVG_SIZE = 100;

const STROKE_WIDTH = {
  background: 1.2,
  active: 2.5,
  passed: 1.5,
  glow: {
    active: 4,
    passed: 2.5
  }
} as const;

const NODE_RADIUS = {
  terminal: 3,
  waypoint: 1.5,
  glowOffset: 2
} as const;

const NODE_COLORS = {
  start: '#10b981',
  end: '#ef4444',
  waypoint: '#0e7490'
} as const;

const VEHICLE_COLOR = '#fbbf24';

// Debug标志类型
declare global {
  interface Window {
    __DEBUG_PROGRESS?: boolean;
  }
}

// ===== 工具函数 =====
/**
 * 计算两点之间的角度（度）
 */
function calculateAngle(from: SvgPoint, to: SvgPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * 线性插值
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 限制值在指定范围内
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 创建坐标转换函数
 */
function createCoordinateTransformers(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
) {
  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;

  return {
    latToY: (lat: number) => SVG_SIZE - ((lat - bounds.minLat) / latRange) * SVG_SIZE,
    lngToX: (lng: number) => ((lng - bounds.minLng) / lngRange) * SVG_SIZE
  };
}

// ===== 子组件 =====
interface SegmentLineProps {
  segment: SvgSegment;
  progress: number;
  isBackground?: boolean;
}

function SegmentLine({ segment, progress, isBackground = false }: SegmentLineProps) {
  if (isBackground) {
    return (
      <line
        x1={segment.from.x}
        y1={segment.from.y}
        x2={segment.to.x}
        y2={segment.to.y}
        stroke="#374151"
        strokeWidth={STROKE_WIDTH.background}
        strokeOpacity={0.4}
        strokeLinecap="round"
        strokeDasharray={segment.mode === VehicleMode.FLIGHT ? '2,1' : 'none'}
      />
    );
  }

  if (progress <= 0) return null;

  const endX = lerp(segment.from.x, segment.to.x, progress);
  const endY = lerp(segment.from.y, segment.to.y, progress);
  const isActive = progress < 1;
  const color = getModeColor(segment.mode);

  return (
    <g>
      {/* 主线 */}
      <line
        x1={segment.from.x}
        y1={segment.from.y}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth={isActive ? STROKE_WIDTH.active : STROKE_WIDTH.passed}
        strokeOpacity={0.9}
        strokeLinecap="round"
        strokeDasharray={segment.mode === VehicleMode.FLIGHT ? '2,1' : 'none'}
      />
      {/* 发光效果 */}
      <line
        x1={segment.from.x}
        y1={segment.from.y}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth={isActive ? STROKE_WIDTH.glow.active : STROKE_WIDTH.glow.passed}
        strokeOpacity={0.3}
        strokeLinecap="round"
        filter="url(#blur)"
      />
    </g>
  );
}

interface MapNodeProps {
  node: SvgNode;
  isStart: boolean;
  isEnd: boolean;
}

function MapNode({ node, isStart, isEnd }: MapNodeProps) {
  const isTerminal = isStart || isEnd;
  const radius = isTerminal ? NODE_RADIUS.terminal : NODE_RADIUS.waypoint;
  const fill = isStart ? NODE_COLORS.start : isEnd ? NODE_COLORS.end : NODE_COLORS.waypoint;

  return (
    <g>
      {isTerminal && (
        <circle
          cx={node.x}
          cy={node.y}
          r={radius + NODE_RADIUS.glowOffset}
          fill={fill}
          opacity={0.3}
          filter="url(#blur)"
        />
      )}
      <circle
        cx={node.x}
        cy={node.y}
        r={radius}
        fill={fill}
        stroke={isTerminal ? '#fff' : 'none'}
        strokeWidth={0.5}
      />
    </g>
  );
}

interface VehicleCursorProps {
  state: VehicleState;
}

function VehicleCursor({ state }: VehicleCursorProps) {
  return (
    <g transform={`translate(${state.x}, ${state.y}) rotate(${state.angle})`}>
      {/* 外层脉冲环 */}
      <circle
        r={6}
        fill="none"
        stroke={VEHICLE_COLOR}
        strokeWidth={0.8}
        opacity={0.6}
        className="animate-ping"
        style={{ animationDuration: '1.5s' }}
      />
      {/* 内层脉冲环 */}
      <circle
        r={4}
        fill="none"
        stroke={VEHICLE_COLOR}
        strokeWidth={0.5}
        opacity={0.8}
        className="animate-ping"
        style={{ animationDuration: '1s' }}
      />
      {/* 发光效果 */}
      <circle
        r={3}
        fill={VEHICLE_COLOR}
        opacity={0.4}
        filter="url(#blur)"
      />
      {/* 箭头 */}
      <path
        d="M 3.5 0 L -2.5 -2.5 L -1.5 0 L -2.5 2.5 Z"
        fill={VEHICLE_COLOR}
        stroke="white"
        strokeWidth={0.5}
      />
    </g>
  );
}

// ===== 主组件 =====
export default function MiniRouteMap({
  routeData,
  progressPercent,
  currentSegmentIndex
}: MiniRouteMapProps) {

  // 计算地图数据（仅在路线数据变化时重新计算）
  const mapData = useMemo<MapData | null>(() => {
    if (!routeData?.nodes?.length || !routeData?.edges?.length) return null;

    // 提取坐标
    const lats = routeData.nodes.map(n => n.coordinates.lat);
    const lngs = routeData.nodes.map(n => n.coordinates.lng);

    // 计算边界
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latPadding = (maxLat - minLat) * PADDING_RATIO || DEFAULT_PADDING;
    const lngPadding = (maxLng - minLng) * PADDING_RATIO || DEFAULT_PADDING;

    const bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding
    };

    const { latToY, lngToX } = createCoordinateTransformers(bounds);

    // 生成SVG节点
    const svgNodes: SvgNode[] = routeData.nodes.map(node => ({
      id: node.id,
      x: lngToX(node.coordinates.lng),
      y: latToY(node.coordinates.lat)
    }));

    // 创建节点ID到SVG节点的映射（优化查找性能）
    const nodeMap = new Map(svgNodes.map(n => [n.id, n]));

    // 生成路径段
    const pathSegments: SvgSegment[] = routeData.edges
      .map(edge => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);

        if (!fromNode || !toNode) return null;

        return {
          from: { x: fromNode.x, y: fromNode.y },
          to: { x: toNode.x, y: toNode.y },
          mode: edge.mode as VehicleMode,
          seq: edge.seq,
          angle: calculateAngle(fromNode, toNode)
        };
      })
      .filter((s): s is SvgSegment => s !== null);

    // 计算总成本和进度范围
    const totalCost = routeData.edges.reduce((sum, e) => sum + e.cost, 0);

    let accumulatedCost = 0;
    const segmentProgressRanges: ProgressRange[] = routeData.edges.map(edge => {
      const start = (accumulatedCost / totalCost) * 100;
      accumulatedCost += edge.cost;
      const end = (accumulatedCost / totalCost) * 100;
      return { start, end };
    });

    // Debug输出
    if (window.__DEBUG_PROGRESS) {
      console.group('🗺️ MiniRouteMap Debug');
      console.log('Total Segments:', routeData.edges.length);
      console.log('Total Cost:', totalCost);
      console.table(segmentProgressRanges.map((range, i) => ({
        Segment: i + 1,
        Start: `${range.start.toFixed(1)}%`,
        End: `${range.end.toFixed(1)}%`,
        Range: `${(range.end - range.start).toFixed(1)}%`
      })));
      console.groupEnd();
    }

    return { svgNodes, pathSegments, segmentProgressRanges, totalCost };
  }, [routeData]); // 移除 currentSegmentIndex 依赖

  // 计算段的进度
  const getSegmentProgress = useCallback((segmentIndex: number): number => {
    if (!mapData) return 0;

    const range = mapData.segmentProgressRanges[segmentIndex];
    if (!range) return 0;

    if (progressPercent >= range.end) return 1;
    if (progressPercent <= range.start) return 0;

    return clamp((progressPercent - range.start) / (range.end - range.start), 0, 1);
  }, [mapData, progressPercent]);

  // 计算车辆位置
  const vehicleState = useMemo<VehicleState | null>(() => {
    if (!mapData?.pathSegments.length) return null;

    // 起点
    if (progressPercent <= 0) {
      const segment = mapData.pathSegments[0];
      return { x: segment.from.x, y: segment.from.y, angle: segment.angle };
    }

    // 终点
    if (progressPercent >= 100) {
      const lastSegment = mapData.pathSegments[mapData.pathSegments.length - 1];
      return { x: lastSegment.to.x, y: lastSegment.to.y, angle: lastSegment.angle };
    }

    // 当前段
    const segment = mapData.pathSegments[currentSegmentIndex];
    if (!segment) return null;

    const localProgress = getSegmentProgress(currentSegmentIndex);

    return {
      x: lerp(segment.from.x, segment.to.x, localProgress),
      y: lerp(segment.from.y, segment.to.y, localProgress),
      angle: segment.angle
    };
  }, [mapData, progressPercent, currentSegmentIndex, getSegmentProgress]);

  // 检测进度不一致（仅Debug模式）
  const progressMismatch = useMemo(() => {
    if (!window.__DEBUG_PROGRESS || !mapData || !routeData) return null;

    const segmentBasedProgress = ((currentSegmentIndex + 1) / routeData.edges.length) * 100;
    const difference = Math.abs(progressPercent - segmentBasedProgress);

    if (difference > 10) {
      return { difference };
    }
    return null;
  }, [mapData, routeData, currentSegmentIndex, progressPercent]);

  if (!mapData) return null;

  const { svgNodes, pathSegments } = mapData;

  return (
    <div className="relative w-full h-32 bg-black/80 rounded-lg border border-cyan-500/30 overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-1 left-2 text-[10px] text-cyan-400 font-mono font-bold z-10 tracking-wider opacity-80">
        NAV SYSTEM  </div>

      {/* Debug警告 */}
      {progressMismatch && (
        <div className="absolute top-1 right-2 text-[8px] text-orange-400 font-mono z-10 bg-black/60 px-1 rounded">
          ⚠️ {progressMismatch.difference.toFixed(0)}% diff
        </div>
      )}

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ padding: '10%' }}
      >
        {/* SVG滤镜定义 */}
        <defs>
          <filter id="blur">
            <feGaussianBlur stdDeviation="1" />
          </filter>
        </defs>

        {/* 背景层 */}
        {pathSegments.map((segment, index) => (
          <SegmentLine
            key={`bg-${index}`}
            segment={segment}
            progress={1}
            isBackground
          />
        ))}

        {/* 进度层 */}
        {pathSegments.map((segment, index) => (
          <SegmentLine
            key={`progress-${index}`}
            segment={segment}
            progress={getSegmentProgress(index)}
          />
        ))}

        {/* 节点层 */}
        {svgNodes.map((node, index) => (
          <MapNode
            key={`node-${node.id}`}
            node={node}
            isStart={index === 0}
            isEnd={index === svgNodes.length - 1}
          />
        ))}

        {/* 车辆 */}
        {vehicleState && <VehicleCursor state={vehicleState} />}
      </svg>

      {/* 底部状态栏 */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-1 px-2 flex justify-between items-end">
        <div className="text-[8px] text-gray-400 font-mono">
          スケール: 自動
        </div>
        <div className="flex gap-2 text-[8px]">
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: NODE_COLORS.start }}
            />
            <span className="text-gray-400 scale-75 origin-left">S</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: NODE_COLORS.end }}
            />
            <span className="text-gray-400 scale-75 origin-left">E</span>
          </div>
        </div>
      </div>
    </div>
  );
}