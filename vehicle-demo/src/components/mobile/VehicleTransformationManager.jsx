import React, { useEffect, useState, useRef } from 'react';
import useVehicleStore from '../store/useVehicleStore';

/**
 * 🚗 车辆变形管理器
 * 根据道路类型自动切换车辆形态并播放动画
 */

// 🎭 车辆模式配置
const VEHICLE_MODES = {
  NORMAL: {
    id: 1,
    piece: '金将',
    name: '通常運転モード',
    type: 'NORMAL',
    function: '前進',
    color: '#FFD700',
    icon: '🚗',
  },
  HIGHWAY: {
    id: 2,
    piece: '香車',
    name: '高速モード',
    type: 'HIGHWAY',
    function: '直線移動・速度優先',
    color: '#FF4500',
    icon: '🏎️',
    speed: 120, // km/h
  },
  DRONE: {
    id: 3,
    piece: '桂馬',
    name: 'ドローンモード',
    type: 'DRONE',
    function: '短距離飛行・段差や障害物越え',
    color: '#00CED1',
    icon: '🚁',
  },
  LONG_FLIGHT: {
    id: 4,
    piece: '飛車',
    name: '長距離飛行モード',
    type: 'LONG_FLIGHT',
    function: '都市間移動',
    color: '#1E90FF',
    icon: '✈️',
    speed: 200, // km/h
  },
  FOLLOW: {
    id: 5,
    piece: '歩兵',
    name: '追従モード',
    type: 'FOLLOW',
    function: '他車を自動追尾',
    color: '#32CD32',
    icon: '🚙',
  },
  PARK: {
    id: 6,
    piece: '王将',
    name: '駐車モード',
    type: 'PARK',
    function: '駐車',
    color: '#9370DB',
    icon: '🅿️',
  },
};

const VehicleTransformationManager = () => {
  const { vehicle, route, setVehicleMoving } = useVehicleStore();
  const [currentMode, setCurrentMode] = useState(VEHICLE_MODES.NORMAL);
  const [isTransforming, setIsTransforming] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [progress, setProgress] = useState(0);
  const checkpointsRef = useRef([]);
  const currentCheckpointRef = useRef(0);

  // 🔥 解析路线,生成检查点
  useEffect(() => {
    if (route.edges && route.edges.length > 0) {
      // 从 edges 提取检查点
      const checkpoints = route.edges.map((edge, index) => ({
        seq: edge.seq || index + 1,
        from: edge.from,
        to: edge.to,
        type: edge.type || 'road',
        mode: edge.mode || 1,
        length: edge.length || 0,
        speedLimit: edge.speed_limit || 60,
        // 计算累计距离
        accumulatedDistance: route.edges
          .slice(0, index + 1)
          .reduce((sum, e) => sum + (e.length || 0), 0),
      }));
      
      checkpointsRef.current = checkpoints;
      currentCheckpointRef.current = 0;
      
      console.log('📍 路线检查点:', checkpoints);
    }
  }, [route.edges]);

  // 🔥 监听行驶进度,判断是否需要变形
  useEffect(() => {
    if (!vehicle.isMoving || checkpointsRef.current.length === 0) return;

    const checkInterval = setInterval(() => {
      // 从 route 获取当前行驶距离
      const traveledDistance = parseFloat(route.traveledDistance) || 0;
      const totalDistance = parseFloat(route.distance) || 1;
      const currentProgress = traveledDistance / totalDistance;
      
      setProgress(currentProgress);

      // 检查是否到达下一个检查点
      const nextCheckpoint = checkpointsRef.current[currentCheckpointRef.current];
      
      if (nextCheckpoint && traveledDistance >= nextCheckpoint.accumulatedDistance * 0.95) {
        // 🎯 到达检查点,判断是否需要变形
        const requiredMode = getModeByType(nextCheckpoint.type, nextCheckpoint.mode);
        
        if (requiredMode.type !== currentMode.type) {
          console.log('🔄 需要变形:', {
            from: currentMode.name,
            to: requiredMode.name,
            checkpoint: nextCheckpoint,
          });
          
          // 触发变形
          triggerTransformation(requiredMode);
        }
        
        // 移动到下一个检查点
        currentCheckpointRef.current += 1;
      }
      
      // 🏁 检查是否到达终点
      if (currentProgress >= 0.99) {
        console.log('🏁 到达终点!');
        handleArrival();
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [vehicle.isMoving, currentMode, route.traveledDistance]);

  // 🎭 根据道路类型和mode ID获取车辆模式
  const getModeByType = (edgeType, modeId) => {
    // 优先使用 modeId
    if (modeId) {
      const modeEntry = Object.values(VEHICLE_MODES).find(m => m.id === modeId);
      if (modeEntry) return modeEntry;
    }
    
    // 根据 edgeType 推断
    switch (edgeType?.toLowerCase()) {
      case 'highway':
        return VEHICLE_MODES.HIGHWAY;
      case 'sky':
      case 'air':
        return VEHICLE_MODES.LONG_FLIGHT;
      case 'drone':
      case 'short_flight':
        return VEHICLE_MODES.DRONE;
      default:
        return VEHICLE_MODES.NORMAL;
    }
  };

  // 🎬 触发变形动画
  const triggerTransformation = (newMode) => {
    setIsTransforming(true);
    setShowAnimation(true);
    
    // 暂停车辆移动
    setVehicleMoving(false);
    
    // 播放变形动画 (3秒)
    setTimeout(() => {
      setCurrentMode(newMode);
      setShowAnimation(false);
      setIsTransforming(false);
      
      // 恢复车辆移动
      setVehicleMoving(true);
      
      console.log('✅ 变形完成:', newMode.name);
    }, 3000);
  };

  // 🏁 处理到达终点
  const handleArrival = () => {
    setVehicleMoving(false);
    // 可以触发到达动画或提示
  };

  // 不显示任何UI,这是一个纯逻辑组件
  // 变形动画由独立的 TransformationAnimation 组件显示
  return null;
};

export default VehicleTransformationManager;


/**
 * 🎬 变形动画组件 (全屏覆盖)
 */
export const TransformationAnimation = () => {
  const { vehicle } = useVehicleStore();
  const [isTransforming, setIsTransforming] = useState(false);
  const [fromMode, setFromMode] = useState(VEHICLE_MODES.NORMAL);
  const [toMode, setToMode] = useState(VEHICLE_MODES.HIGHWAY);

  // 🔥 监听变形事件 (通过自定义事件)
  useEffect(() => {
    const handleTransform = (event) => {
      const { from, to } = event.detail;
      setFromMode(from);
      setToMode(to);
      setIsTransforming(true);
      
      setTimeout(() => {
        setIsTransforming(false);
      }, 3000);
    };

    window.addEventListener('vehicleTransform', handleTransform);
    return () => window.removeEventListener('vehicleTransform', handleTransform);
  }, []);

  if (!isTransforming) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="text-center">
        {/* 变形动画 */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          {/* 原形态 */}
          <div 
            className="absolute inset-0 flex items-center justify-center text-8xl animate-pulse"
            style={{
              animation: 'fadeOut 1.5s ease-out forwards',
            }}
          >
            {fromMode.icon}
          </div>
          
          {/* 能量特效 */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${toMode.color}40 0%, transparent 70%)`,
              animation: 'pulse 0.5s ease-in-out infinite',
            }}
          ></div>
          
          {/* 新形态 */}
          <div 
            className="absolute inset-0 flex items-center justify-center text-8xl"
            style={{
              animation: 'fadeIn 1.5s ease-in 1.5s forwards',
              opacity: 0,
            }}
          >
            {toMode.icon}
          </div>
        </div>

        {/* 文字提示 */}
        <div className="space-y-4">
          <div 
            className="text-2xl font-bold"
            style={{ color: fromMode.color }}
          >
            {fromMode.name}
          </div>
          
          <div className="text-4xl text-cyan-400">
            ↓
          </div>
          
          <div 
            className="text-3xl font-bold animate-pulse"
            style={{ color: toMode.color }}
          >
            {toMode.name}
          </div>
          
          <div className="text-cyan-300 text-lg mt-4">
            {toMode.function}
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-8 w-64 mx-auto">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: '100%',
                background: `linear-gradient(90deg, ${fromMode.color}, ${toMode.color})`,
                animation: 'progress 3s linear',
              }}
            ></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeOut {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.5); }
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
};

// 🔥 辅助函数: 触发变形事件
export const triggerVehicleTransform = (fromMode, toMode) => {
  const event = new CustomEvent('vehicleTransform', {
    detail: { from: fromMode, to: toMode }
  });
  window.dispatchEvent(event);
};
