import { useState, useEffect } from 'react';
import { getRoute } from '../../api/mockRouteAPI';
import { getAllModesRoute, getSimpleThreeModeRoute } from '../../api/completeRouteExample';
import type { RouteResponse } from '../../types/routeAPI';
import MiniRouteMap from './MiniRouteMap';
import { 
  calculateTotalDistance, 
  calculateTotalTime, 
  formatDistance, 
  formatTime,
  getModeById,
  LOCATIONS
} from '../../types/routeAPI';
import { getAll } from 'three/examples/jsm/libs/tween.module.js';

interface HUDPanelProps {
  onStartStop: (isMoving: boolean) => void;
  onViewToggle: (isFirstPerson: boolean) => void;
  onTransform: () => void;
  isMoving?: boolean;
  onStartLocationSet?: (location: string) => void;
  onDestinationSet?: (destination: string) => void;
  onRouteDataChange?: (routeData: RouteResponse | null) => void;
  currentMode?: number;
  currentSegmentIndex?: number;
  progressPercent?: number;
  remainingTime?: number;
}

export default function HUDPanel({ 
  onStartStop, 
  onViewToggle, 
  onTransform, 
  isMoving: externalIsMoving,
  onStartLocationSet,
  onDestinationSet,
  onRouteDataChange,
  currentMode = 1,
  currentSegmentIndex = 0,
  progressPercent = 0,
  remainingTime = 0
}: HUDPanelProps) {
  const [isMoving, setIsMoving] = useState(false);
  const [startLocation, setStartLocation] = useState('京都駅');
  const [destination, setDestination] = useState('清水寺');
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [startLocationId, setStartLocationId] = useState('B'); // 京都駅のID
  const [destinationId, setDestinationId] = useState('C'); // 清水寺のID

  // 同步外部isMoving状态
  useEffect(() => {
    if (externalIsMoving !== undefined) {
      setIsMoving(externalIsMoving);
    }
  }, [externalIsMoving]);

  // ルートデータを取得
  const fetchRouteData = async () => {
    setIsLoadingRoute(true);
    try {
      const route = await getRoute(startLocationId, destinationId);
      setRouteData(route);
      onRouteDataChange?.(route); // 将路线数据传递给父组件
      console.log('🚗 ルートデータ取得成功:', route);
    } catch (error) {
      console.error('❌ ルートデータ取得エラー:', error);
      onRouteDataChange?.(null);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // 出発地・目的地が変更されたらルートを再取得
  useEffect(() => {
    if (startLocationId && destinationId && !isMoving) {
      fetchRouteData();
    }
  }, [startLocationId, destinationId]);

  // ロケーション名からIDを検索
  const findLocationId = (locationName: string): string => {
    const location = LOCATIONS.find(loc => loc.name === locationName);
    return location?.id || 'B'; // デフォルトは京都駅
  };

  // 加载测试路线（3种模式）
  const loadTestRoute = () => {
    const testRoute = getAllModesRoute();
    setRouteData(testRoute);
    onRouteDataChange?.(testRoute);
    setStartLocation('テストルート（3モード）');
    setDestination('完整示例');
    console.log('🎯 テストルート読み込み完了:', testRoute);
  };

  const handleStart = () => {
    if (!isMoving) {
      setIsMoving(true);
      onStartStop(true);
      // 点击START时切换到第三人称视角
      onViewToggle(false);
    } else {
      // 点击STOP时结束行驶并切换回第一人称
      setIsMoving(false);
      onStartStop(false);
      onViewToggle(true);
    }
  };

  const handleTransform = () => {
    onTransform();
  };

  return (
    <div 
      className={`fixed pointer-events-none z-50 transition-all duration-1000 ease-in-out ${
        isMoving 
          ? 'top-6 left-6' 
          : 'flex items-center justify-center'
      }`}
      style={{
        perspective: '1000px',
        top: isMoving ? undefined : '50%',
        left: isMoving ? undefined : '50%',
        transform: isMoving ? undefined : 'translate(-50%, -50%)',
      }}
    >
      {/* PAD 容器 */}
      <div 
        className={`bg-gradient-to-br from-gray-900/95 to-black/95 shadow-2xl border-2 border-cyan-500/50 pointer-events-auto backdrop-blur-md transition-all duration-1000 ${
          isMoving ? 'p-3' : 'p-6'
        }`}
        style={{
          width: isMoving ? '300px' : '600px',
          boxShadow: '0 0 40px rgba(5, 6, 6, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)',
          transform: isMoving ?'perspective(800px) rotateX(0deg)' : 'perspective(800px) rotateX(10deg)',
          borderRadius: '30px 30px 40px 40px',
          borderBottomWidth: '3px',
          borderTopWidth: '1px',
        }}
      >
        {/* 顶部标题 */}
        <div className="text-center mb-3">
          <h2 
            className={`font-bold text-cyan-400 mb-1 transition-all duration-1000 ${
              isMoving ? 'text-base' : 'text-xl'
            }`}
            style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }}
          >
            車両コントロールパネル
          </h2>
          <div className="h-1 w-20 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto"></div>
        </div>

        {/* 状态显示区域 */}
        <div className="bg-black/40 rounded-xl p-2.5 mb-3 border border-cyan-500/30">
          {isMoving ? (
            /* 行驶中显示路线信息（使用API数据） */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">出発地</span>
                <span className="text-cyan-400 text-sm font-bold">{startLocation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">目的地</span>
                <span className="text-green-400 text-sm font-bold">{destination}</span>
              </div>
              {routeData && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">現在モード</span>
                    <span className="text-yellow-400 text-sm font-bold">
                      {getModeById(currentMode)?.piece || '---'}
                      <span className="text-xs text-gray-500 ml-1">({getModeById(currentMode)?.name})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">経路進捗</span>
                    <span className="text-blue-400 text-sm font-bold">
                      {currentSegmentIndex + 1} / {routeData.edges.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">残り時間</span>
                    <span className="text-purple-400 text-sm font-bold">
                      {Math.max(0, Math.floor(remainingTime))} 秒
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">総距離</span>
                    <span className="text-cyan-300 text-xs">
                      {formatDistance(calculateTotalDistance(routeData.edges))}
                    </span>
                  </div>
                </>
              )}
              {/* 进度条 */}
              <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-500 relative"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                </div>
              </div>
              <div className="text-center text-xs text-gray-500">
                {progressPercent.toFixed(1)}% 完了
              </div>
              
              {/* 小地图 */}
              <div className="mt-3">
                <MiniRouteMap 
                  routeData={routeData}
                  progressPercent={progressPercent}
                  currentSegmentIndex={currentSegmentIndex}
                />
              </div>
            </div>
          ) : (
            /* 停止时显示起始地和目的地选择 */
            <div className="space-y-2.5">
              {isLoadingRoute && (
                <div className="text-center text-cyan-400 text-xs py-2">
                  📡 ルート計算中...
                </div>
              )}
              <div>
                <div className="text-gray-400 text-xs mb-1.5">出発地</div>
                <select
                  value={startLocation}
                  onChange={(e) => {
                    const newLocation = e.target.value;
                    setStartLocation(newLocation);
                    setStartLocationId(findLocationId(newLocation));
                    onStartLocationSet?.(newLocation);
                  }}
                  className="w-full px-3 py-1.5 bg-gray-800/60 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm focus:outline-none focus:border-cyan-500/60 transition-colors cursor-pointer"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.name} className="bg-gray-900">
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-gray-400 text-xs mb-1.5">目的地</div>
                <select
                  value={destination}
                  onChange={(e) => {
                    const newDestination = e.target.value;
                    setDestination(newDestination);
                    setDestinationId(findLocationId(newDestination));
                    onDestinationSet?.(newDestination);
                  }}
                  className="w-full px-3 py-1.5 bg-gray-800/60 border border-cyan-500/30 rounded-lg text-green-400 text-sm focus:outline-none focus:border-green-500/60 transition-colors cursor-pointer"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.id} value={loc.name} className="bg-gray-900">
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* 显示路线预览信息 */}
              {routeData && !isLoadingRoute && (
                <div className="mt-2 pt-2 border-t border-cyan-500/20 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">距離:</span>
                    <span className="text-cyan-300">{formatDistance(calculateTotalDistance(routeData.edges))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">予想時間:</span>
                    <span className="text-purple-300">{formatTime(calculateTotalTime(routeData.edges))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">経路数:</span>
                    <span className="text-blue-300">{routeData.edges.length} セグメント</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 按钮组 */}
        <div className={`transition-all duration-1000 ${isMoving ? 'space-y-2' : 'space-y-2.5'}`}>
          {/* START/STOP 按钮 */}
          <button
            onClick={handleStart}
            className={`w-full rounded-xl font-bold transition-all duration-300 shadow-lg ${
              isMoving
                ? 'py-2 text-sm bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white'
                : 'py-3 text-base bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white'
            }`}
            style={{
              boxShadow: isMoving
                ? '0 0 20px rgba(239, 68, 68, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)'
                : '0 0 20px rgba(6, 182, 212, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
            }}
          >
            {isMoving ? '⏸ ストップ' : '▶ スタート'}
          </button>

          {/* 变形按钮 - 只在停止时显示 */}
          {/* {!isMoving && (
            <button
              onClick={handleTransform}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-700 hover:to-orange-600 text-white font-bold text-base transition-all duration-300 shadow-lg"
              style={{
                boxShadow: '0 0 20px rgba(234, 179, 8, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
            >
              ⚡ トランスフォーム
            </button>
          )} */}

          {/* 测试路线按钮 - 只在停止时显示 */}
          {!isMoving && (
            <button
              onClick={loadTestRoute}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold text-sm transition-all duration-300 shadow-lg"
              style={{
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
            >
              🎯 テストルート (3モード)
            </button>
          )}
        </div>

        {/* 底部装饰线 - 只在停止时显示 */}
        {!isMoving && (
          <div className="mt-4 flex justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
