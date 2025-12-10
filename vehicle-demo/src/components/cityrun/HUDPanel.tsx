import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RouteResponse } from '../../types/routeAPI';
import { getAllModesRoute } from '../../api/completeRouteExample';
import MiniRouteMap from './MiniRouteMap';
import { generateRoute, getAvailableLocations, type KyotoNode } from '../../utils/kyotoRouteUtils';
import {
  calculateTotalDistance,
  calculateTotalTime,
  formatDistance,
  formatTime,
  getModeById
} from '../../types/routeAPI';

// ===== 类型定义 =====
interface HUDPanelProps {
  isMoving: boolean;
  onStartStop: (isMoving: boolean) => void;
  onViewToggle: (isFirstPerson: boolean) => void;
  onTransform: () => void;
  onStartLocationSet?: (location: string) => void;
  onDestinationSet?: (destination: string) => void;
  onRouteDataChange?: (routeData: RouteResponse | null) => void;
  currentMode?: number;
  currentSegmentIndex?: number;
  progressPercent?: number;
  remainingTime?: number;
  useSimulationMode?: boolean; // 是否为模拟模式（true时不显示走行シミュレーション按钮）
}

interface WindowSize {
  width: number;
  height: number;
}

interface StyleConfig {
  width: string;
  transform: string;
  padding: string;
  shadow: string;
  titleSize: string;
  position: { top: number; left: number };
}

// ===== 常量定义 =====
const DEFAULT_START_ID = 'A1'; // 京都駅
const DEFAULT_DEST_ID = 'D2';  // 清水寺

const STYLE_CONFIG = {
  moving: {
    width: '320px',
    transform: 'rotateX(0deg) scale(1)',
    padding: 'p-3',
    shadow: '0 0 20px rgba(6, 182, 212, 0.2)',
    titleSize: 'text-sm tracking-widest',
    position: { top: 24, left: 24 }
  },
  stopped: {
    width: '600px',
    transform: 'rotateX(10deg) scale(1)',
    padding: 'p-6',
    shadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(6, 182, 212, 0.1)',
    titleSize: 'text-xl tracking-widest',
    position: { top: 0, left: 0 }
  }
} as const;

const IPAD_BREAKPOINT = { min: 768, max: 1024 };
const TOUCH_MIN_HEIGHT = 48;
const TOUCH_MIN_HEIGHT_SMALL = 44;

// ===== 工具函数 =====
/**
 * 检测是否为iPad设备
 */
function isIPadDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

/**
 * 检测是否为平板尺寸
 */
function isTabletSize(width: number): boolean {
  return width >= IPAD_BREAKPOINT.min && width <= IPAD_BREAKPOINT.max;
}

/**
 * 计算响应式样式配置
 */
function calculateResponsiveStyles(
  windowSize: WindowSize,
  isMoving: boolean
): StyleConfig {
  const baseConfig = isMoving ? STYLE_CONFIG.moving : STYLE_CONFIG.stopped;
  const { width, height } = windowSize;
  const isPortrait = height > width;
  const isTablet = isIPadDevice() || isTabletSize(width);

  if (!isTablet) return baseConfig;

  const safeMaxWidth = Math.min(width * 0.95, isMoving ? 340 : 600);

  if (isMoving) {
    return {
      ...baseConfig,
      width: isPortrait ? `${Math.min(280, safeMaxWidth)}px` : `${Math.min(340, safeMaxWidth)}px`,
      position: { top: isPortrait ? 16 : 20, left: isPortrait ? 16 : 20 },
      padding: 'p-2.5',
      titleSize: 'text-xs tracking-wider'
    };
  }

  return {
    ...baseConfig,
    width: isPortrait ? '90vw' : `${Math.min(520, safeMaxWidth)}px`,
    padding: isPortrait ? 'p-4' : 'p-5',
    titleSize: isPortrait ? 'text-lg tracking-wide' : 'text-xl tracking-widest'
  };
}

// ===== 自定义Hooks =====
/**
 * 窗口尺寸监听Hook
 */
function useWindowSize(): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return size;
}

/**
 * 可用地点加载Hook
 */
function useAvailableLocations() {
  const [locations, setLocations] = useState<KyotoNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getAvailableLocations()
      .then(data => {
        if (!cancelled) {
          setLocations(data);
          console.log('📍 加载了', data.length, '个地点');
        }
      })
      .catch(error => {
        console.error('❌ 加载地点列表失败:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { locations, isLoading };
}

// ===== 子组件 =====
interface LocationSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: KyotoNode[];
  colorClass: string;
}

function LocationSelect({ label, value, onChange, options, colorClass }: LocationSelectProps) {
  const borderColor = colorClass === 'cyan' ? 'border-cyan-500/30 focus:border-cyan-500' : 'border-green-500/30 focus:border-green-500';
  const textColor = colorClass === 'cyan' ? 'text-cyan-300' : 'text-green-300';
  const labelColor = colorClass === 'cyan' ? 'text-cyan-500' : 'text-green-500';

  return (
    <div className="group">
      <label className={`block ${labelColor} text-[14px] font-mono mb-1 tracking-wider`}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 bg-gray-900/80 border ${borderColor} rounded ${textColor} text-sm focus:outline-none transition-colors cursor-pointer hover:bg-gray-800`}
        style={{ fontSize: '16px' }}
      >
        {options.map(loc => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </select>
    </div>
  );
}

interface RoutePreviewProps {
  routeData: RouteResponse;
}

function RoutePreview({ routeData }: RoutePreviewProps) {
  const totalDistance = useMemo(() => calculateTotalDistance(routeData.edges), [routeData.edges]);
  const totalTime = useMemo(() => calculateTotalTime(routeData.edges), [routeData.edges]);

  return (
    <div className="mt-4 p-3 bg-gray-800/40 rounded border border-cyan-500/10">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[14px] text-gray-400 font-mono">推定距離</span>
        <span className="text-sm text-cyan-300 font-mono font-bold">
          {formatDistance(totalDistance)}
        </span>
      </div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[14px] text-gray-400 font-mono">推定時間</span>
        <span className="text-sm text-purple-300 font-mono font-bold">
          {formatTime(totalTime)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[14px] text-gray-400 font-mono">経路区間</span>
        <span className="text-sm text-blue-300 font-mono font-bold">
          {routeData.edges.length} <span className="text-[12px] font-normal text-gray-500">区間</span>
        </span>
      </div>
    </div>
  );
}

//  进度条组件
interface ProgressBarProps {
  percent: number;
}

function ProgressBar({ percent }: ProgressBarProps) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const lastUpdateRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const clampedPercent = Math.min(100, Math.max(0, percent));
    const precisePercent = Number(clampedPercent.toFixed(1));

    // 取消之前的更新
    if (rafRef.current !== undefined) { // ✅ 类型安全检查
      cancelAnimationFrame(rafRef.current);
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    const shouldUpdateImmediately =
      precisePercent === 0 ||
      precisePercent === 100 ||
      timeSinceLastUpdate >= 100;

    if (shouldUpdateImmediately) {
      setDisplayPercent(precisePercent);
      lastUpdateRef.current = now;
    } else {
      const delay = 100 - timeSinceLastUpdate;
      rafRef.current = requestAnimationFrame(() => { // ✅ 赋值
        setTimeout(() => {
          setDisplayPercent(precisePercent);
          lastUpdateRef.current = Date.now();
        }, delay);
      });
    }

    return () => {
      if (rafRef.current !== undefined) { // ✅ 清理时检查
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [percent]);

  // 页面展示时四舍五入取整
  const displayInteger = Math.round(displayPercent);

  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
        <span>進捗</span>
        <span className="font-mono font-bold">{displayInteger}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full relative"
          style={{
            width: `${displayPercent}%`,
            transition: 'width 0.15s ease-out',
            transform: 'translateZ(0)',
            willChange: 'width'
          }}
        >
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 shadow-[0_0_5px_#fff]" />
        </div>
      </div>
    </div>
  );
}

interface DrivingStatusProps {
  startLocation: string;
  destination: string;
  routeData: RouteResponse | null;
  currentMode: number;
  currentSegmentIndex: number;
  remainingTime: number;
  progressPercent: number;
}

function DrivingStatus({
  startLocation,
  destination,
  routeData,
  currentMode,
  currentSegmentIndex,
  remainingTime,
  progressPercent
}: DrivingStatusProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b border-gray-800 pb-1">
        <span className="text-gray-500 text-[10px] font-mono uppercase">出発地</span>
        <span className="text-cyan-400 text-xs font-bold truncate max-w-[150px]">{startLocation}</span>
      </div>
      <div className="flex items-center justify-between border-b border-gray-800 pb-1">
        <span className="text-gray-500 text-[10px] font-mono uppercase">目的地</span>
        <span className="text-green-400 text-xs font-bold truncate max-w-[150px]">{destination}</span>
      </div>

      {routeData && (
        <>
          <div className="flex items-center justify-between mt-2">
            <span className="text-gray-500 text-[10px] font-mono uppercase">モード</span>
            <span className="text-yellow-400 text-xs font-bold flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              {getModeById(currentMode)?.name || 'UNKNOWN'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="bg-gray-800/50 p-1.5 rounded text-center">
              <div className="text-[8px] text-gray-500 uppercase">経路区間</div>
              <div className="text-blue-400 text-sm font-mono font-bold leading-none">
                {currentSegmentIndex + 1}
                <span className="text-[10px] text-gray-600">/{routeData.edges.length}</span>
              </div>
            </div>
            <div className="bg-gray-800/50 p-1.5 rounded text-center">
              <div className="text-[8px] text-gray-500 uppercase">到着予想時刻</div>
              <div className="text-purple-400 text-sm font-mono font-bold leading-none">
                {Math.max(0, Math.floor(remainingTime))}<span className="text-[10px]">s</span>
              </div>
            </div>
          </div>
        </>
      )}

      <ProgressBar percent={progressPercent} />

      <div className="mt-3 pt-2 border-t border-gray-800">
        <MiniRouteMap
          routeData={routeData}
          progressPercent={progressPercent}
          currentSegmentIndex={currentSegmentIndex}
        />
      </div>
    </div>
  );
}

// ===== 主组件 =====
export default function HUDPanel({
  isMoving,
  onStartStop,
  onViewToggle,
  onStartLocationSet,
  onDestinationSet,
  onRouteDataChange,
  currentMode = 1,
  currentSegmentIndex = 0,
  progressPercent = 0,
  remainingTime = 0,
  useSimulationMode = false
}: HUDPanelProps) {
  // 状态：只存储ID，名称通过派生获取
  const [startLocationId, setStartLocationId] = useState(DEFAULT_START_ID);
  const [destinationId, setDestinationId] = useState(DEFAULT_DEST_ID);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Hooks
  const windowSize = useWindowSize();
  const { locations: availableLocations } = useAvailableLocations();

  // 派生状态：通过ID获取名称
  const getLocationName = useCallback((id: string): string => {
    return availableLocations.find(loc => loc.id === id)?.name || id;
  }, [availableLocations]);

  const startLocation = useMemo(() => getLocationName(startLocationId), [getLocationName, startLocationId]);
  const destination = useMemo(() => getLocationName(destinationId), [getLocationName, destinationId]);

  // 响应式样式
  const styleConfig = useMemo(
    () => calculateResponsiveStyles(windowSize, isMoving),
    [windowSize, isMoving]
  );

  // 路线获取
  const fetchRouteData = useCallback(async () => {
    if (!startLocationId || !destinationId) return;

    setIsLoadingRoute(true);
    try {
      const route = await generateRoute(startLocationId, destinationId);
      if (route) {
        setRouteData(route);
        onRouteDataChange?.(route);
        console.log('🚗 ルートデータ取得成功:', route);
      } else {
        console.error('❌ 无法生成路线');
        onRouteDataChange?.(null);
      }
    } catch (error) {
      console.error('❌ ルートデータ取得エラー:', error);
      onRouteDataChange?.(null);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [startLocationId, destinationId, onRouteDataChange]);

  // 事件处理
  const loadTestRoute = useCallback(() => {
    const testRoute = getAllModesRoute();
    setRouteData(testRoute);
    onRouteDataChange?.(testRoute);
    console.log('🎮 テストルート読み込み完了');
  }, [onRouteDataChange]);

  const handleStartToggle = useCallback(() => {
    const newIsMoving = !isMoving;
    onStartStop(newIsMoving);
    onViewToggle(!newIsMoving); // 开始→第三人称，停止→第一人称
  }, [isMoving, onStartStop, onViewToggle]);

  const handleStartLocationChange = useCallback((id: string) => {
    setStartLocationId(id);
    const name = availableLocations.find(loc => loc.id === id)?.name || id;
    onStartLocationSet?.(name);
  }, [availableLocations, onStartLocationSet]);

  const handleDestinationChange = useCallback((id: string) => {
    setDestinationId(id);
    const name = availableLocations.find(loc => loc.id === id)?.name || id;
    onDestinationSet?.(name);
  }, [availableLocations, onDestinationSet]);

  // 位置变化时获取路线（仅在停止状态）
  useEffect(() => {
    if (!isMoving && startLocationId && destinationId && !useSimulationMode) {
      fetchRouteData();
    }
  }, [startLocationId, destinationId, isMoving, fetchRouteData, useSimulationMode]);

  // 模拟模式下自动加载测试路线
  useEffect(() => {
    if (useSimulationMode && !routeData) {
      console.log('🎮 シミュレーションモード: テストルート自動読み込み');
      loadTestRoute();
    }
  }, [useSimulationMode, routeData, loadTestRoute]);

  return (
    <div
      className={`fixed z-50 transition-all duration-1000 ease-in-out pointer-events-none ${isMoving ? '' : 'flex items-center justify-center'
        }`}
      style={{
        top: isMoving ? styleConfig.position.top : 0,
        left: isMoving ? styleConfig.position.left : 0,
        right: isMoving ? 'auto' : 0,
        bottom: isMoving ? 'auto' : 0,
        perspective: '1000px'
      }}
    >
      <div
        className={`bg-gradient-to-br from-gray-900/95 to-black/95 border-2 border-cyan-500/50 pointer-events-auto backdrop-blur-md transition-all duration-1000 ${styleConfig.padding}`}
        style={{
          width: styleConfig.width,
          transform: styleConfig.transform,
          boxShadow: styleConfig.shadow,
          borderRadius: '20px',
          borderBottomWidth: '3px',
          borderTopWidth: '1px',
          maxWidth: isMoving ? 'none' : '95vw',
          maxHeight: isMoving ? 'calc(100vh - 48px)' : '95vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* 标题 */}
        <div className="text-center mb-3">
          <h2
            className={`font-mono font-bold text-cyan-400 mb-1 transition-all duration-1000 ${styleConfig.titleSize}`}
            style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }}
          >
            {isMoving ? 'SYSTEM MONITOR' : 'MISSION CONTROL'}
          </h2>
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mx-auto" />
        </div>

        {/* 内容区域 */}
        <div className="bg-black/40 rounded-xl p-2.5 mb-3 border border-cyan-500/20">
          {isMoving ? (
            <DrivingStatus
              startLocation={startLocation}
              destination={destination}
              routeData={routeData}
              currentMode={currentMode}
              currentSegmentIndex={currentSegmentIndex}
              remainingTime={remainingTime}
              progressPercent={progressPercent}
            />
          ) : (
            <div className="space-y-4 py-1">              
              {isLoadingRoute && (
                <div className="text-center text-cyan-400 text-xs animate-pulse">
                  📡 UPLOADING NAVIGATION DATA...
                </div>
              )}

              {/* 非模拟模式时显示位置选择器 */}

              <div className="grid grid-cols-1 gap-4">
                <LocationSelect
                  label="出発地"
                  value={startLocationId}
                  onChange={handleStartLocationChange}
                  options={availableLocations}
                  colorClass="cyan"
                />
                <LocationSelect
                  label="目的地"
                  value={destinationId}
                  onChange={handleDestinationChange}
                  options={availableLocations}
                  colorClass="green"
                />
              </div>


              {routeData && !isLoadingRoute && (
                <RoutePreview routeData={routeData} />
              )}
            </div>
          )}
        </div>

        {/* 按钮组 */}
        <div className={`transition-all duration-1000 ${isMoving ? 'space-y-2' : 'space-y-3'}`}>
          <button
            onClick={handleStartToggle}
            className={`w-full rounded font-bold font-mono tracking-wider transition-all duration-300 shadow-lg flex items-center justify-center gap-2 ${isMoving
              ? 'py-2 text-xs bg-red-900/80 hover:bg-red-800 active:bg-red-700 text-red-100 border border-red-500/50'
              : 'py-3 text-sm bg-cyan-900/80 hover:bg-cyan-800 active:bg-cyan-700 text-cyan-100 border border-cyan-500/50'
              }`}
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.9)',
              textShadow: isMoving ? '0 0 5px rgba(220,38,38,0.5)' : '0 0 5px rgba(6,182,212,0.5)',
              boxShadow: isMoving
                ? '0 0 15px rgba(220, 38, 38, 0.2)'
                : '0 0 15px rgba(6, 182, 212, 0.2)',
              minHeight: `${TOUCH_MIN_HEIGHT}px`,
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {isMoving ? (
              <>
                <span className="w-2 h-2 bg-red-500 rounded-sm animate-ping" />
                中止
              </>
            ) : (
              <>
                開始
                <span className="text-xs">///</span>
              </>
            )}
          </button>

          {/* 走行シミュレーション按钮：仅在非移动且非模拟模式时显示 */}
          {/* {!isMoving && !useSimulationMode && (
            <button
              onClick={loadTestRoute}
              className="w-full py-2 rounded font-mono text-xs bg-purple-900/40 hover:bg-purple-900/60 active:bg-purple-900/80 text-purple-200 border border-purple-500/30 transition-all duration-300"
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.7)',
                minHeight: `${TOUCH_MIN_HEIGHT_SMALL}px`,
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              [ 走行シミュレーション ]
            </button>
          )} */}
        </div>

        {/* 装饰元素 */}
        {!isMoving && (
          <div className="mt-4 flex justify-center gap-1 opacity-50">
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse delay-75" />
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse delay-150" />
          </div>
        )}
      </div>
    </div>
  );
}