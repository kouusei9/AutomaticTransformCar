import React, { useState, useRef, useEffect } from 'react';
import { Minimize2, Maximize2, Move } from 'lucide-react';
import useVehicleStore from '../../store/useVehicleStore';

const MiniMap = () => {
  const { vehicle, route } = useVehicleStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const mapRef = useRef(null);
  
  // 🔥 删除独立的 vehicleProgress,改用 route 数据计算
  // const [vehicleProgress, setVehicleProgress] = useState(0);
  
  // 🔥实时数据
  const [liveStats, setLiveStats] = useState({
    speed: 0,
    distance: 0,
    eta: 0,
  });

  const scale = 10;
  const mapSize = isMinimized ? 150 : 300;

  // 🔥 根据 route 数据计算车辆在路径上的位置
  const getVehiclePositionOnPath = () => {
    if (!route.start || !route.destination) {
      return [0, 0, 0];
    }

    // 🔥 使用真实的行驶数据计算进度
    // 如果有 route.distance 和 route.remainingDistance,使用它们
    let progress = 0;
    
    if (route.distance && parseFloat(route.distance) > 0) {
      const totalDist = parseFloat(route.distance);
      const remaining = parseFloat(route.remainingDistance) || 0;
      progress = Math.max(0, Math.min(1, 1 - remaining / totalDist));
    }

    // 线性插值: 起点 + 进度 × (终点 - 起点)
    const x = route.start[0] + progress * (route.destination[0] - route.start[0]);
    const z = route.start[2] + progress * (route.destination[2] - route.start[2]);
    
    return [x, 0, z];
  };

  const vehiclePos = getVehiclePositionOnPath();
  const centerX = mapSize / 2;
  const centerY = mapSize / 2;

  // 🔥 修复：以车辆为中心的坐标转换
  const toScreenCoords = (x, z) => {
    return {
      x: centerX + (x - vehiclePos[0]) * scale,
      y: centerY + (z - vehiclePos[2]) * scale,
    };
  };

  // 🔥 删除独立的进度更新 - 改用 route 数据
  // useEffect(() => {
  //   if (!vehicle.isMoving) return;
  //   const progressTimer = setInterval(() => {
  //     setVehicleProgress(prev => ...);
  //   }, 100);
  //   return () => clearInterval(progressTimer);
  // }, [vehicle.isMoving]);

  // 🔥 删除重置进度的逻辑 - 不再需要
  // useEffect(() => {
  //   if (route.path.length > 0) {
  //     setVehicleProgress(0);
  //   }
  // }, [route.path.length]);

  // 🔥 新增：实时更新统计数据
  useEffect(() => {
    const statsTimer = setInterval(() => {
      if (vehicle.isMoving) {
        setLiveStats(prev => ({
          speed: 55 + Math.floor(Math.random() * 10),
          distance: prev.distance + 0.05,
          eta: Math.max(0, prev.eta - 1),
        }));
      } else {
        setLiveStats(prev => ({
          ...prev,
          speed: 0,
        }));
      }
    }, 1000);

    return () => clearInterval(statsTimer);
  }, [vehicle.isMoving]);

  // 🔥 监听 route 变化,初始化数据
  useEffect(() => {
    if (route.path.length > 0) {
      setLiveStats(prev => ({
        ...prev,
        distance: parseFloat(route.distance) || 0,
        eta: parseInt(route.eta) || 0,
      }));
    }
  }, [route.path.length]);

  // 拖动处理
  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={mapRef}
      className="absolute cursor-move select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${mapSize + 40}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="rounded-xl overflow-hidden transition-all duration-300"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 40, 80, 0.9) 0%, rgba(0, 20, 40, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(0, 212, 255, 0.4)',
          boxShadow: '0 8px 32px rgba(0, 212, 255, 0.3)',
        }}
      >
        {/* 头部 */}
        <div 
          className="drag-handle flex items-center justify-between p-3 border-b cursor-move"
          style={{
            borderColor: 'rgba(0, 212, 255, 0.3)',
            background: 'rgba(0, 212, 255, 0.1)',
          }}
        >
          <div className="flex items-center gap-2">
            <Move size={16} className="text-cyan-400" />
            <span className="text-cyan-300 text-sm font-semibold">NAVIGATION</span>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="p-1 hover:bg-cyan-500 hover:bg-opacity-20 rounded transition-colors"
          >
            {isMinimized ? (
              <Maximize2 size={16} className="text-cyan-400" />
            ) : (
              <Minimize2 size={16} className="text-cyan-400" />
            )}
          </button>
        </div>

        {/* 地图内容 */}
        <div className="p-3">
          <div 
            className="relative rounded-lg overflow-hidden"
            style={{
              width: `${mapSize}px`,
              height: `${mapSize}px`,
              background: 'linear-gradient(180deg, rgba(10, 30, 60, 0.8) 0%, rgba(5, 15, 30, 0.9) 100%)',
            }}
          >
            {/* SVG 地图 */}
            <svg width={mapSize} height={mapSize} className="absolute inset-0">
              {/* 网格 */}
              <defs>
                <pattern id="minimap-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0, 212, 255, 0.1)" strokeWidth="0.5" />
                </pattern>
                
                {/* 发光效果 */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              <rect width={mapSize} height={mapSize} fill="url(#minimap-grid)" />

              {/* 中心十字线 */}
              <line 
                x1={centerX} 
                y1="0" 
                x2={centerX} 
                y2={mapSize} 
                stroke="rgba(0, 212, 255, 0.3)" 
                strokeWidth="1" 
              />
              <line 
                x1="0" 
                y1={centerY} 
                x2={mapSize} 
                y2={centerY} 
                stroke="rgba(0, 212, 255, 0.3)" 
                strokeWidth="1" 
              />

              {/* 路径 */}
              {route.start && route.destination && (
                <>
                  {/* 路径线 */}
                  <line
                    x1={toScreenCoords(route.start[0], route.start[2]).x}
                    y1={toScreenCoords(route.start[0], route.start[2]).y}
                    x2={toScreenCoords(route.destination[0], route.destination[2]).x}
                    y2={toScreenCoords(route.destination[0], route.destination[2]).y}
                    stroke="#00ff88"
                    strokeWidth="3"
                    strokeLinecap="round"
                    filter="url(#glow)"
                  />

                  {/* 🔥 路径动画点 - 实时移动 */}
                  {!isMinimized && Array.from({ length: 5 }).map((_, index) => {
                    // 🔥 计算实时进度
                    let currentProgress = 0;
                    if (route.distance && parseFloat(route.distance) > 0) {
                      const totalDist = parseFloat(route.distance);
                      const remaining = parseFloat(route.remainingDistance) || 0;
                      currentProgress = Math.max(0, Math.min(1, 1 - remaining / totalDist));
                    }
                    
                    const progress = (index / 5 + currentProgress * 0.3) % 1;
                    const x = route.start[0] + progress * (route.destination[0] - route.start[0]);
                    const z = route.start[2] + progress * (route.destination[2] - route.start[2]);
                    const coords = toScreenCoords(x, z);
                    
                    return (
                      <circle
                        key={index}
                        cx={coords.x}
                        cy={coords.y}
                        r="2"
                        fill="#00ff88"
                        opacity="0.6"
                      >
                        <animate
                          attributeName="r"
                          values="2;4;2"
                          dur="2s"
                          repeatCount="indefinite"
                          begin={`${index * 0.4}s`}
                        />
                        <animate
                          attributeName="opacity"
                          values="0.6;1;0.6"
                          dur="2s"
                          repeatCount="indefinite"
                          begin={`${index * 0.4}s`}
                        />
                      </circle>
                    );
                  })}
                </>
              )}

              {/* 起点 */}
              {route.start && (
                <g>
                  <circle
                    cx={toScreenCoords(route.start[0], route.start[2]).x}
                    cy={toScreenCoords(route.start[0], route.start[2]).y}
                    r={isMinimized ? 6 : 10}
                    fill="#22c55e"
                    filter="url(#glow)"
                  />
                  <circle
                    cx={toScreenCoords(route.start[0], route.start[2]).x}
                    cy={toScreenCoords(route.start[0], route.start[2]).y}
                    r={isMinimized ? 4 : 6}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* 终点 */}
              {route.destination && (
                <g>
                  <circle
                    cx={toScreenCoords(route.destination[0], route.destination[2]).x}
                    cy={toScreenCoords(route.destination[0], route.destination[2]).y}
                    r={isMinimized ? 6 : 10}
                    fill="#ef4444"
                    filter="url(#glow)"
                  />
                  <circle
                    cx={toScreenCoords(route.destination[0], route.destination[2]).x}
                    cy={toScreenCoords(route.destination[0], route.destination[2]).y}
                    r={isMinimized ? 4 : 6}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* 🔥 车辆位置 - 始终在中心 */}
              <g transform={`translate(${centerX}, ${centerY})`}>
                {/* 车辆外圈动画 */}
                {vehicle.isMoving && (
                  <>
                    <circle r={isMinimized ? 8 : 12} fill="#3b82f6" opacity="0.3">
                      <animate attributeName="r" from={isMinimized ? 8 : 12} to={isMinimized ? 16 : 24} dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle r={isMinimized ? 10 : 15} fill="#3b82f6" opacity="0.2">
                      <animate attributeName="r" from={isMinimized ? 10 : 15} to={isMinimized ? 20 : 30} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.2" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                
                {/* 车辆主体 */}
                <circle r={isMinimized ? 5 : 8} fill="#3b82f6" filter="url(#glow)" />
                <circle r={isMinimized ? 3 : 5} fill="#60a5fa" />
                
                {/* 方向指示 */}
                {!isMinimized && route.destination && (
                  <path
                    d="M 0,-10 L -4,-6 L 4,-6 Z"
                    fill="#ffffff"
                    opacity="0.9"
                    transform={`rotate(${Math.atan2(
                      route.destination[2] - vehiclePos[2],
                      route.destination[0] - vehiclePos[0]
                    ) * 180 / Math.PI + 90})`}
                  />
                )}
              </g>

              {/* 距离圈 */}
              {!isMinimized && (
                <>
                  <circle
                    cx={centerX}
                    cy={centerY}
                    r="50"
                    fill="none"
                    stroke="rgba(0, 212, 255, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="10"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    cx={centerX}
                    cy={centerY}
                    r="100"
                    fill="none"
                    stroke="rgba(0, 212, 255, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="10"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}
            </svg>

            {/* 图例 */}
            {!isMinimized && (
              <div className="absolute bottom-2 left-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-cyan-300">Start</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-cyan-300">Goal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-cyan-300">Vehicle</span>
                </div>
              </div>
            )}

            {/* 比例尺 */}
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 rounded px-2 py-1 text-xs text-cyan-300">
              1:{scale}
            </div>

            {/* 状态指示器 */}
            {vehicle.isMoving && (
              <div className="absolute top-2 right-2 flex items-center gap-2 bg-green-500 bg-opacity-20 border border-green-500 rounded-full px-3 py-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-xs font-semibold">MOVING</span>
              </div>
            )}

            {/* 进度指示 */}
            {!isMinimized && vehicle.isMoving && (
              <div className="absolute top-2 left-2 bg-black bg-opacity-50 rounded px-2 py-1 text-xs text-cyan-300">
                {(() => {
                  // 🔥 计算实时进度
                  let currentProgress = 0;
                  if (route.distance && parseFloat(route.distance) > 0) {
                    const totalDist = parseFloat(route.distance);
                    const remaining = parseFloat(route.remainingDistance) || 0;
                    currentProgress = Math.max(0, Math.min(1, 1 - remaining / totalDist));
                  }
                  return Math.round(currentProgress * 100);
                })()}%
              </div>
            )}
          </div>

          {/* 信息显示 - 移除电池 */}
          {!isMinimized && route.path.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-cyan-400">距離</div>
                <div className="text-white font-mono">{(liveStats.distance || 0).toFixed(1)}m</div>
              </div>
              <div className="text-center">
                <div className="text-cyan-400">時間</div>
                <div className="text-white font-mono">{Math.ceil(liveStats.eta || 0)}s</div>
              </div>
              <div className="text-center">
                <div className="text-cyan-400">速度</div>
                <div className="text-white font-mono">{liveStats.speed || 0}km/h</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部发光条 */}
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
      </div>
    </div>
  );
};

export default MiniMap;
