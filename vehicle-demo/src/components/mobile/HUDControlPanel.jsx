import React, { useState, useEffect } from 'react';
import { Play, Square, Navigation2, Cloud, Sun, CloudRain, Moon, Sunset, Sunrise } from 'lucide-react';
import useVehicleStore from '../../store/useVehicleStore';

const HUDControlPanel = () => {
  const {
    vehicle,
    route,
    requestRoute,
    setVehicleMoving,
    serverStatus,
    weather,
    timeOfDay,
    setWeather,
    setTimeOfDay,
    updateRouteProgress  // 用于同步进度到store
  } = useVehicleStore();

  const [startPoint, setStartPoint] = useState({ x: 0, z: 0 });
  const [endPoint, setEndPoint] = useState({ x: 10, z: 10 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // 保存路径规划时的坐标快照
  const [routeSnapshot, setRouteSnapshot] = useState({ start: null, end: null });

  // 行程状态
  const [tripStatus, setTripStatus] = useState('idle'); // 'idle' | 'loading' | 'active' | 'completed' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  // 基于真实物理的数据状态
  const [liveData, setLiveData] = useState({
    // 距离数据
    totalRouteDistance: 0,      // 总路程 (m) - 路径规划时确定,不变
    traveledDistance: 0,        // 已行驶距离 (m) - 持续增加
    remainingDistance: 0,       // 剩余距离 (m) - 持续减少

    // 速度数据
    currentSpeed: 0,            // 当前速度 (km/h)
    averageSpeed: 60,           // 平均速度 (km/h)

    // 其他数据
    temperature: 20,
    estimatedTime: 0,           // 预计到达时间 (秒)
  });

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 路径规划时初始化数据
  useEffect(() => {
    if (route.path.length > 0 && routeSnapshot.start && routeSnapshot.end) {
      // 使用快照坐标计算距离
      const start = [routeSnapshot.start.x, 0, routeSnapshot.start.z];
      const dest = [routeSnapshot.end.x, 0, routeSnapshot.end.z];

      const dx = dest[0] - start[0];
      const dz = dest[2] - start[2];
      const totalDistance = Math.sqrt(dx * dx + dz * dz); // 勾股定理

      console.log('📍 路径规划完成:', {
        起点: start,
        终点: dest,
        总距离: totalDistance.toFixed(2) + 'm'
      });

      setLiveData(prev => ({
        ...prev,
        totalRouteDistance: totalDistance,
        remainingDistance: totalDistance,
        traveledDistance: 0,
        estimatedTime: Math.ceil(totalDistance / (prev.averageSpeed * 1000 / 3600)), // 距离/速度
      }));
    }
  }, [route.path.length, routeSnapshot]); // 依赖 routeSnapshot

  // 行驶时实时更新数据
  useEffect(() => {
    if (!vehicle.isMoving) return;

    const UPDATE_INTERVAL = 100; // 100ms 更新一次

    const dataTimer = setInterval(() => {
      setLiveData(prev => {
        // 如果已经到达,停止更新
        if (prev.remainingDistance <= 0) {
          setVehicleMoving(false);
          return prev;
        }

        // 计算本次移动的距离
        const speedInMPS = (prev.averageSpeed * 1000) / 3600; // km/h → m/s
        const distancePerUpdate = speedInMPS * (UPDATE_INTERVAL / 1000); // m

        // 更新距离数据
        const newTraveled = Math.min(
          prev.traveledDistance + distancePerUpdate,
          prev.totalRouteDistance
        );
        const newRemaining = Math.max(0, prev.totalRouteDistance - newTraveled);

        // 更新速度
        const speedVariation = (Math.random() - 0.5) * 10;
        const newSpeed = Math.max(50, Math.min(70, prev.averageSpeed + speedVariation));

        // 计算预计到达时间
        const newETA = newRemaining > 0
          ? Math.ceil(newRemaining / speedInMPS)
          : 0;

        // 同步到全局 store (如果方法存在)
        if (updateRouteProgress) {
          updateRouteProgress(newRemaining, newTraveled);
        }

        // 检查是否到达终点
        if (newRemaining <= 0) {
          setTripStatus('completed');
        }

        return {
          ...prev,
          traveledDistance: newTraveled,
          remainingDistance: newRemaining,
          currentSpeed: Math.round(newSpeed),
          estimatedTime: newETA,
          temperature: 18 + Math.floor(Math.random() * 5),
        };
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(dataTimer);
  }, [vehicle.isMoving, setVehicleMoving, updateRouteProgress]);

  const handleRequestRoute = async () => {
    const start = [startPoint.x, 0.5, startPoint.z];
    const destination = [endPoint.x, 0.5, endPoint.z];

    // 保存当前坐标快照
    setRouteSnapshot({
      start: { x: startPoint.x, z: startPoint.z },
      end: { x: endPoint.x, z: endPoint.z }
    });

    // 设置加载状态 - ルート計算中画面
    setTripStatus('loading');
    setErrorMessage('');

    try {
      const response = await requestRoute(start, destination);

      // ルート確定 - 路线确定
      if (response && response.edges) {
        if (typeof setRouteData === 'function') {
          setRouteData(response.nodes || [], response.edges);
        }
      }

      // 成功后重置为 idle,等待用户点击 START
      setTripStatus('idle');

    } catch (error) {
      // エラー発生 - 错误画面
      console.error('Route request failed:', error);
      setTripStatus('error');
      setErrorMessage(error.message || 'ルート計算に失敗しました');
    }
  };

  const handleStartMoving = () => {
    if (route.path.length > 0) {
      setVehicleMoving(true);
      setTripStatus('active');  // 设置为进行中
    }
  };

  const handleStopMoving = () => {
    setVehicleMoving(false);
    setTripStatus('idle');  // 重置状态
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return 'bg-yellow-400';
      case 'completed': return 'bg-green-400';
      case 'waiting': return 'bg-blue-400';
      default: return 'bg-gray-500';
    }
  };

  const weatherIcons = {
    clear: Sun,
    rain: CloudRain,
    fog: Cloud,
  };

  const timeIcons = {
    morning: Sunrise,
    day: Sun,
    evening: Sunset,
    night: Moon,
  };

  const WeatherIcon = weatherIcons[weather];
  const TimeIcon = timeIcons[timeOfDay];

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-[800px]">
      {/* 加载状态 - ルート計算中画面 */}
      {tripStatus === 'loading' && (
        <div
          className="mb-4 rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 150, 255, 0.2) 0%, rgba(0, 100, 200, 0.3) 100%)',
            border: '2px solid rgba(0, 150, 255, 0.5)',
            boxShadow: '0 8px 32px rgba(0, 150, 255, 0.3)',
          }}
        >
          <div className="p-6 text-center">
            <div className="text-5xl mb-4 animate-spin">🔄</div>
            <div className="text-2xl font-bold text-blue-400 mb-2">
              ルート計算中...
            </div>
            <div className="text-cyan-300 text-sm">
              シーン準備
            </div>
          </div>
        </div>
      )}

      {/* 错误状态 - エラー画面 */}
      {tripStatus === 'error' && (
        <div
          className="mb-4 rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 68, 68, 0.2) 0%, rgba(200, 50, 50, 0.3) 100%)',
            border: '2px solid rgba(255, 68, 68, 0.5)',
            boxShadow: '0 8px 32px rgba(255, 68, 68, 0.3)',
          }}
        >
          <div className="p-6 text-center">
            <div className="text-5xl mb-4">❌</div>
            <div className="text-2xl font-bold text-red-400 mb-2">
              エラーが発生しました
            </div>
            <div className="text-cyan-300 text-sm mb-4">
              {errorMessage}
            </div>
            <button
              onClick={() => setTripStatus('idle')}
              className="px-6 py-2 rounded-full font-semibold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                color: '#ffffff',
              }}
            >
              戻る
            </button>
          </div>
        </div>
      )}

      {/* 行程完成提示 - 到着画面 */}
      {tripStatus === 'completed' && (
        <div
          className="mb-4 rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2) 0%, rgba(0, 200, 100, 0.3) 100%)',
            border: '2px solid rgba(0, 255, 136, 0.5)',
            boxShadow: '0 8px 32px rgba(0, 255, 136, 0.3)',
          }}
        >
          <div className="p-6 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <div className="text-3xl font-bold text-green-400 mb-2">
              到着しました!
            </div>
            <div className="text-cyan-300 text-lg mb-2">
              目的地に到達
            </div>
            <div className="mt-4 text-white text-sm space-y-1">
              <div>総距離: {(liveData.totalRouteDistance / 1000).toFixed(2)} km</div>
              <div>統計表示</div>
            </div>
            <button
              onClick={() => {
                setTripStatus('idle');
                setLiveData({
                  totalRouteDistance: 0,
                  traveledDistance: 0,
                  remainingDistance: 0,
                  currentSpeed: 0,
                  averageSpeed: 60,
                  temperature: 20,
                  estimatedTime: 0,
                });
              }}
              className="mt-4 px-6 py-2 rounded-full font-semibold text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
                color: '#0a0f1e',
              }}
            >
              リセット
            </button>
          </div>
        </div>
      )}

      {/* 主HUD面板 */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 40, 80, 0.85) 0%, rgba(0, 20, 40, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(0, 212, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(0, 212, 255, 0.1)',
        }}
      >
        {/* 发光边框效果 */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 30px rgba(0, 212, 255, 0.2)',
          }}
        ></div>

        <div className="p-6">
          {/* 顶部信息栏 */}
          <div className="flex items-center justify-between mb-4 text-cyan-300 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TimeIcon size={18} className="text-cyan-400" />
                <span className="font-mono">{currentTime.toLocaleTimeString('ja-JP')}</span>
              </div>
              <div className="flex items-center gap-2">
                <WeatherIcon size={18} className="text-cyan-400" />
                <span className="capitalize">{weather}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(serverStatus.aiServer)} animate-pulse`}></div>
              <span className="text-xs">AI {serverStatus.aiServer}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* 左侧：距离信息 */}
            <div className="space-y-4">
              <div>
                <div className="text-cyan-400 text-xs mb-1">行程距離</div>
                <div className="text-white text-3xl font-mono font-bold">
                  {(liveData.totalRouteDistance / 1000).toFixed(2)}
                  <span className="text-lg ml-1">km</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-cyan-400 text-xs">残距離</div>
                <div className="text-white text-xl font-mono">
                  {liveData.remainingDistance.toFixed(1)}m
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-cyan-400 text-xs">予想時間</div>
                <div className="text-white text-xl font-mono">
                  {liveData.estimatedTime}s
                </div>
              </div>
            </div>

            {/* 中间：3D地图和控制 */}
            <div className="flex flex-col items-center justify-center">
              {/* 简化的3D地图视图 */}
              <div
                className="w-48 h-32 rounded-lg mb-3 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(0, 100, 150, 0.3) 0%, rgba(0, 50, 100, 0.5) 100%)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                }}
              >
                {/* 网格效果 */}
                <div className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                  }}
                ></div>

                {/* 使用真实route数据绘制路径 */}
                {route.path.length > 0 && routeSnapshot.start && routeSnapshot.end && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 192 128">
                    {/* 计算起点和终点的屏幕坐标 */}
                    {(() => {
                      const mapWidth = 192;
                      const mapHeight = 128;
                      const padding = 20;

                      // 计算坐标范围
                      const minX = Math.min(routeSnapshot.start.x, routeSnapshot.end.x);
                      const maxX = Math.max(routeSnapshot.start.x, routeSnapshot.end.x);
                      const minZ = Math.min(routeSnapshot.start.z, routeSnapshot.end.z);
                      const maxZ = Math.max(routeSnapshot.start.z, routeSnapshot.end.z);

                      const rangeX = maxX - minX || 1;
                      const rangeZ = maxZ - minZ || 1;

                      // 转换为屏幕坐标
                      const startX = padding + (routeSnapshot.start.x - minX) / rangeX * (mapWidth - 2 * padding);
                      const startY = mapHeight - padding - (routeSnapshot.start.z - minZ) / rangeZ * (mapHeight - 2 * padding);
                      const endX = padding + (routeSnapshot.end.x - minX) / rangeX * (mapWidth - 2 * padding);
                      const endY = mapHeight - padding - (routeSnapshot.end.z - minZ) / rangeZ * (mapHeight - 2 * padding);

                      // 计算车辆当前位置
                      const progress = liveData.traveledDistance / liveData.totalRouteDistance;
                      const vehicleX = startX + progress * (endX - startX);
                      const vehicleY = startY + progress * (endY - startY);

                      return (
                        <>
                          {/* 路径线 */}
                          <line
                            x1={startX}
                            y1={startY}
                            x2={endX}
                            y2={endY}
                            stroke="#00ff88"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />

                          {/* 起点 */}
                          <circle cx={startX} cy={startY} r="6" fill="#22c55e" />
                          <circle cx={startX} cy={startY} r="3" fill="#ffffff" />

                          {/* 终点 */}
                          <circle cx={endX} cy={endY} r="6" fill="#ef4444" />
                          <circle cx={endX} cy={endY} r="3" fill="#ffffff" />

                          {/* 车辆位置 (沿路径移动) */}
                          {vehicle.isMoving && (
                            <g>
                              <circle cx={vehicleX} cy={vehicleY} r="8" fill="#3b82f6" opacity="0.3">
                                <animate attributeName="r" from="8" to="16" dur="1.5s" repeatCount="indefinite" />
                                <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
                              </circle>
                              <circle cx={vehicleX} cy={vehicleY} r="5" fill="#3b82f6" />
                              <circle cx={vehicleX} cy={vehicleY} r="3" fill="#60a5fa" />
                            </g>
                          )}
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>

              {/* SET DESTINATION 按钮 */}
              <button
                onClick={handleRequestRoute}
                className="w-full px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-300"
                style={{
                  background: 'rgba(0, 212, 255, 0.2)',
                  border: '1px solid rgba(0, 212, 255, 0.5)',
                  color: '#00d4ff',
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(0, 212, 255, 0.3)';
                  e.target.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(0, 212, 255, 0.2)';
                  e.target.style.boxShadow = '0 0 20px rgba(0, 212, 255, 0.3)';
                }}
              >
                SET DESTINATION
              </button>
            </div>

            {/* 右侧：车辆状态 */}
            <div className="flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <div className="text-cyan-400 text-xs mb-1">已行驶距離</div>
                  <div className="text-white text-2xl font-mono font-bold">
                    {liveData.traveledDistance.toFixed(1)}<span className="text-lg">m</span>
                  </div>
                </div>

                <div>
                  <div className="text-cyan-400 text-xs mb-1">速度</div>
                  <div className="text-white text-4xl font-mono font-bold">
                    {liveData.currentSpeed}
                  </div>
                </div>

                <div>
                  <div className="text-cyan-400 text-xs mb-1">温度</div>
                  <div className="text-white text-xl font-mono">{liveData.temperature}°C</div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部控制按钮 */}
          <div className="mt-6 flex items-center justify-center gap-4">
            {/* 圆形控制按钮 */}
            <button
              onClick={() => setWeather(weather === 'clear' ? 'rain' : 'clear')}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
              style={{
                background: 'rgba(0, 212, 255, 0.2)',
                border: '2px solid rgba(0, 212, 255, 0.5)',
              }}
            >
              <WeatherIcon size={20} className="text-cyan-400" />
            </button>

            <button
              onClick={() => {
                const times = ['morning', 'day', 'evening', 'night'];
                const currentIndex = times.indexOf(timeOfDay);
                const nextIndex = (currentIndex + 1) % times.length;
                setTimeOfDay(times[nextIndex]);
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
              style={{
                background: 'rgba(0, 212, 255, 0.2)',
                border: '2px solid rgba(0, 212, 255, 0.5)',
              }}
            >
              <TimeIcon size={20} className="text-cyan-400" />
            </button>

            {/* 启动/停止按钮 */}
            {!vehicle.isMoving ? (
              <button
                onClick={handleStartMoving}
                disabled={route.path.length === 0}
                className="px-8 py-3 rounded-full font-bold text-sm transition-all disabled:opacity-30"
                style={{
                  background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
                  color: '#0a0f1e',
                  boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
                }}
              >
                <Play size={20} className="inline mr-2" />
                START
              </button>
            ) : (
              <button
                onClick={handleStopMoving}
                className="px-8 py-3 rounded-full font-bold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                  color: '#ffffff',
                  boxShadow: '0 0 30px rgba(255, 68, 68, 0.5)',
                }}
              >
                <Square size={20} className="inline mr-2" />
                STOP
              </button>
            )}

            {/* 路径输入区域 */}
            <div className="ml-4 flex items-center gap-2 text-xs">
              <input
                type="number"
                value={startPoint.x}
                onChange={(e) => setStartPoint({ ...startPoint, x: Number(e.target.value) })}
                className="w-16 px-2 py-1 rounded bg-gray-900 bg-opacity-50 border border-cyan-500 text-cyan-300 text-center"
                placeholder="X"
              />
              <input
                type="number"
                value={startPoint.z}
                onChange={(e) => setStartPoint({ ...startPoint, z: Number(e.target.value) })}
                className="w-16 px-2 py-1 rounded bg-gray-900 bg-opacity-50 border border-cyan-500 text-cyan-300 text-center"
                placeholder="Z"
              />
              <span className="text-cyan-400">→</span>
              <input
                type="number"
                value={endPoint.x}
                onChange={(e) => setEndPoint({ ...endPoint, x: Number(e.target.value) })}
                className="w-16 px-2 py-1 rounded bg-gray-900 bg-opacity-50 border border-cyan-500 text-cyan-300 text-center"
                placeholder="X"
              />
              <input
                type="number"
                value={endPoint.z}
                onChange={(e) => setEndPoint({ ...endPoint, z: Number(e.target.value) })}
                className="w-16 px-2 py-1 rounded bg-gray-900 bg-opacity-50 border border-cyan-500 text-cyan-300 text-center"
                placeholder="Z"
              />
            </div>
          </div>
        </div>

        {/* 底部发光条 */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
      </div>
    </div>
  );
};

export default HUDControlPanel;
