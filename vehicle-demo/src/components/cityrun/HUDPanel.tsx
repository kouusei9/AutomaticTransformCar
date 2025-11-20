import { useState, useEffect, useMemo } from 'react';
import type { RouteResponse } from '../../types/routeAPI';
import { getRoute } from '../../api/mockRouteAPI';
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

// ===== 1. 常量配置 (优化样式管理) =====
const PANEL_STYLES = {
  MOVING: {
    width: '320px',
    transform: 'rotateX(0deg) scale(1)',
    padding: 'p-3',
    shadow: '0 0 20px rgba(6, 182, 212, 0.2)',
    titleSize: 'text-sm tracking-widest',
    // 动态定位：行驶时在左上角
    position: { top: 24, left: 24, right: 'auto', bottom: 'auto' }
  },
  STOPPED: {
    width: '600px',
    transform: 'rotateX(10deg) scale(1)',
    padding: 'p-6',
    shadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(6, 182, 212, 0.1)',
    titleSize: 'text-xl tracking-widest',
    // 动态定位：停止时配合 flex 居中，设为 0
    position: { top: 0, left: 0, right: 0, bottom: 0 }
  }
} as const;

// ===== 2. 辅助函数 (移出组件，提升性能) =====
const findLocationId = (locationName: string): string => {
  const location = LOCATIONS.find(loc => loc.name === locationName);
  return location?.id || 'B';
};

interface HUDPanelProps {
  // 核心状态 (受控)
  isMoving: boolean;
  onStartStop: (isMoving: boolean) => void;
  onViewToggle: (isFirstPerson: boolean) => void;
  onTransform: () => void;

  // 回调
  onStartLocationSet?: (location: string) => void;
  onDestinationSet?: (destination: string) => void;
  onRouteDataChange?: (routeData: RouteResponse | null) => void;

  // 数据展示 (使用 number 避免循环依赖)
  currentMode?: number;
  currentSegmentIndex?: number;
  progressPercent?: number;
  remainingTime?: number;
}

export default function HUDPanel({
  isMoving, // ✅ 直接使用 props，单一数据源
  onStartStop,
  onViewToggle,
  onTransform,
  onStartLocationSet,
  onDestinationSet,
  onRouteDataChange,
  currentMode = 1, // 默认为 1 (Normal)
  currentSegmentIndex = 0,
  progressPercent = 0,
  remainingTime = 0
}: HUDPanelProps) {
  // 本地 UI 状态 (仅用于表单选择)
  const [startLocation, setStartLocation] = useState('京都駅');
  const [destination, setDestination] = useState('清水寺');
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [startLocationId, setStartLocationId] = useState('A1'); // 京都駅のID
  const [destinationId, setDestinationId] = useState('D2'); // 清水寺のID
  const [availableLocations, setAvailableLocations] = useState<KyotoNode[]>([]);

  // ===== 3. 路由获取逻辑 (带防抖) =====
  useEffect(() => {
    // 如果正在移动，或者ID不全，则不请求
    if (isMoving || !startLocationId || !destinationId) return;

  // 加载可用地点列表
  useEffect(() => {
    getAvailableLocations().then(locations => {
      setAvailableLocations(locations);
      console.log('📍 加载了', locations.length, '个地点');
    }).catch(error => {
      console.error('❌ 加载地点列表失败:', error);
    });
  }, []);

  // ルートデータを取得
  const fetchRouteData = async () => {
    setIsLoadingRoute(true);
    try {
      const route = await generateRoute(startLocationId, destinationId);
      if (route) {
        setRouteData(route);
        onRouteDataChange?.(route); // 将路线数据传递给父组件
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
  };

    // 防抖：500ms 后再执行 API 请求，避免快速切换时频繁请求
    const timerId = setTimeout(fetchData, 500);

  // ロケーション名からIDを検索 (使用 Kyoto 数据)
  const findLocationId = (locationName: string): string => {
    const location = availableLocations.find(loc => loc.name === locationName);
    return location?.id || 'A1'; // デフォルトは京都駅
  };

  // 加载演示路线
  const loadTestRoute = () => {
    const testRoute = getAllModesRoute();
    setRouteData(testRoute);
    onRouteDataChange?.(testRoute);
    setStartLocation('テストルート（3モード）');
    setDestination('全機能デモ');
  };

  // ===== 4. 简化的控制逻辑 =====
  const handleStartToggle = () => {
    const newIsMoving = !isMoving;

    // 通知父组件状态变更 (父组件负责更新 isMoving prop)
    onStartStop(newIsMoving);

    // 视角切换逻辑 (Cinematic Effect)
    if (newIsMoving) {
      // 开始行驶：切换到第三人称
      onViewToggle(false);
    } else {
      // 停止行驶：切回第一人称
      onViewToggle(true);
    }
  };

  // ===== 5. 性能优化：缓存 Option 列表 =====
  const locationOptions = useMemo(() => (
    LOCATIONS.map(loc => (
      <option key={loc.id} value={loc.name}>{loc.name}</option>
    ))
  ), []);

  // 获取当前样式配置
  const styleConfig = isMoving ? PANEL_STYLES.MOVING : PANEL_STYLES.STOPPED;

  return (
    <div
      className={`fixed z-50 transition-all duration-1000 ease-in-out pointer-events-none ${isMoving ? '' : 'flex items-center justify-center'
        }`}
      style={{
        // 动态定位
        top: isMoving ? styleConfig.position.top : 0,
        left: isMoving ? styleConfig.position.left : 0,
        right: isMoving ? 'auto' : 0,
        bottom: isMoving ? 'auto' : 0,
        perspective: '1000px',
      }}
    >
      {/* 主面板容器 */}
      <div
        className={`bg-gradient-to-br from-gray-900/95 to-black/95 border-2 border-cyan-500/50 pointer-events-auto backdrop-blur-md transition-all duration-1000 ${styleConfig.padding}`}
        style={{
          width: styleConfig.width,
          transform: styleConfig.transform,
          boxShadow: styleConfig.shadow,
          borderRadius: '20px',
          borderBottomWidth: '3px',
          borderTopWidth: '1px',
        }}
      >
        {/* 顶部标题 */}
        <div className="text-center mb-3">
          <h2
            className={`font-mono font-bold text-cyan-400 mb-1 transition-all duration-1000 ${styleConfig.titleSize}`}
            style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }}
          >
            {isMoving ? 'SYSTEM MONITOR' : 'MISSION CONTROL'}
          </h2>
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mx-auto"></div>
        </div>

        {/* 内容区域 */}
        <div className="bg-black/40 rounded-xl p-2.5 mb-3 border border-cyan-500/20">
          {isMoving ? (
            /* ===== 驾驶模式显示内容 ===== */
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-gray-800 pb-1">
                <span className="text-gray-500 text-[10px] font-mono uppercase">Origin</span>
                <span className="text-cyan-400 text-xs font-bold truncate max-w-[150px]">{startLocation}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-800 pb-1">
                <span className="text-gray-500 text-[10px] font-mono uppercase">Dest</span>
                <span className="text-green-400 text-xs font-bold truncate max-w-[150px]">{destination}</span>
              </div>

              {routeData && (
                <>
                  {/* 当前模式 */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-500 text-[10px] font-mono uppercase">Mode</span>
                    <span className="text-yellow-400 text-xs font-bold flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                      {/* 使用 getModeById 处理显示逻辑，无需导入 Enum */}
                      {getModeById(currentMode)?.name || 'UNKNOWN'}
                    </span>
                  </div>

                  {/* 数据统计 */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-gray-800/50 p-1.5 rounded text-center">
                      <div className="text-[8px] text-gray-500 uppercase">Segment</div>
                      <div className="text-blue-400 text-sm font-mono font-bold leading-none">
                        {currentSegmentIndex + 1}<span className="text-[10px] text-gray-600">/{routeData.edges.length}</span>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 p-1.5 rounded text-center">
                      <div className="text-[8px] text-gray-500 uppercase">ETA</div>
                      <div className="text-purple-400 text-sm font-mono font-bold leading-none">
                        {Math.max(0, Math.floor(remainingTime))}<span className="text-[10px]">s</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 进度条 */}
              <div className="mt-2">
                <div className="flex justify-between text-[8px] text-gray-500 mb-0.5">
                  <span>PROGRESS</span>
                  <span>{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300 relative"
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50 shadow-[0_0_5px_#fff]"></div>
                  </div>
                </div>
              </div>

              {/* 小地图组件 */}
              <div className="mt-3 pt-2 border-t border-gray-800">
                <MiniRouteMap
                  routeData={routeData}
                  progressPercent={progressPercent}
                  currentSegmentIndex={currentSegmentIndex}
                />
              </div>
            </div>
          ) : (
            /* ===== 设置模式显示内容 ===== */
            <div className="space-y-4 py-1">
              {isLoadingRoute && (
                <div className="text-center text-cyan-400 text-xs animate-pulse">
                  📡 UPLOADING NAVIGATION DATA...
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* 出发地 */}
                <div className="group">
                  <label className="block text-cyan-500 text-[14px] font-mono mb-1 tracking-wider">START POINT</label>
                  <select
                    value={startLocation}
                    onChange={(e) => {
                      const newLocation = e.target.value;
                      setStartLocation(newLocation);
                      setStartLocationId(findLocationId(newLocation));
                      onStartLocationSet?.(newLocation);
                    }}
                    className="w-full px-3 py-2 bg-gray-900/80 border border-cyan-500/30 rounded text-cyan-300 text-sm focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer hover:bg-gray-800"
                  >
                    {locationOptions}
                  </select>
                </div>

                {/* 目的地 */}
                <div className="group">
                  <label className="block text-green-500 text-[14px] font-mono mb-1 tracking-wider text">DESTINATION</label>
                  <select
                    value={destination}
                    onChange={(e) => {
                      const newDestination = e.target.value;
                      setDestination(newDestination);
                      setDestinationId(findLocationId(newDestination));
                      onDestinationSet?.(newDestination);
                    }}
                    className="w-full px-3 py-2 bg-gray-900/80 border border-green-500/30 rounded text-green-300 text-sm focus:outline-none focus:border-green-500 transition-colors cursor-pointer hover:bg-gray-800"
                  >
                    {locationOptions}
                  </select>
                </div>
              </div>

              {/* 路线预览数据 */}
              {routeData && !isLoadingRoute && (
                <div className="mt-4 p-3 bg-gray-800/40 rounded border border-cyan-500/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[14px] text-gray-400 font-mono">ESTIMATED DISTANCE</span>
                    <span className="text-sm text-cyan-300 font-mono font-bold">
                      {formatDistance(calculateTotalDistance(routeData.edges))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[14px] text-gray-400 font-mono">ESTIMATED TIME</span>
                    <span className="text-sm text-purple-300 font-mono font-bold">
                      {formatTime(calculateTotalTime(routeData.edges))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-gray-400 font-mono">ROUTE SEGMENTS</span>
                    <span className="text-sm text-blue-300 font-mono font-bold">
                      {routeData.edges.length} <span className="text-[12px] font-normal text-gray-500">SEGS</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮组 */}
        <div className={`transition-all duration-1000 ${isMoving ? 'space-y-2' : 'space-y-3'}`}>
          <button
            onClick={handleStartToggle}
            className={`w-full rounded font-bold font-mono tracking-wider transition-all duration-300 shadow-lg flex items-center justify-center gap-2 ${isMoving
              ? 'py-2 text-xs bg-red-900/80 hover:bg-red-800 text-red-100 border border-red-500/50'
              : 'py-3 text-sm bg-cyan-900/80 hover:bg-cyan-800 text-cyan-100 border border-cyan-500/50'
              }`}
            style={{
              textShadow: isMoving ? '0 0 5px rgba(220,38,38,0.5)' : '0 0 5px rgba(6,182,212,0.5)',
              boxShadow: isMoving
                ? '0 0 15px rgba(220, 38, 38, 0.2)'
                : '0 0 15px rgba(6, 182, 212, 0.2)'
            }}
          >
            {isMoving ? (
              <>
                <span className="w-2 h-2 bg-red-500 rounded-sm animate-ping"></span>
                ABORT MISSION
              </>
            ) : (
              <>
                INITIATE LAUNCH
                <span className="text-xs">///</span>
              </>
            )}
          </button>

          {/* 演示按钮 - 仅在停止时显示 */}
          {!isMoving && (
            <button
              onClick={loadTestRoute}
              className="w-full py-2 rounded font-mono text-xs bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 transition-all duration-300"
            >
              [ LOAD DEMO SIMULATION ]
            </button>
          )}
        </div>

        {/* 装饰元素 - 仅停止时 */}
        {!isMoving && (
          <div className="mt-4 flex justify-center gap-1 opacity-50">
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse"></div>
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse delay-75"></div>
            <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse delay-150"></div>
          </div>
        )}
      </div>
    </div>
  );
}