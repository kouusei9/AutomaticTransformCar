import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import ThreeScene from '../components/cityrun/ThreeScene.tsx';
import FirstPersonView from '../components/cityrun/FirstPersonView.tsx';
import ThirdPersonView from '../components/cityrun/ThirdPersonView.tsx';
import RoadSystem from '../components/cityrun/RoadSystem.tsx';
import SideScenery from '../components/cityrun/SideScenery.tsx';
import MiddleScenery from '../components/cityrun/MiddleScenery.tsx';
import FarScenery from '../components/cityrun/FarScenery.tsx';
import HUDPanel from '../components/cityrun/HUDPanel.tsx';
import OncomingVehicles from '../components/cityrun/OncomingVehicles.tsx';
import type { RouteResponse } from '../types/routeAPI';
import { websocketService } from '../services/websocketService';
import './CityRunDemo.css';

// ===== 1. 使用 Enum 替代魔法数字 =====
export enum VehicleMode {
  NORMAL = 1,   // 金将 - 通常モード
  HIGHWAY = 2,  // 香車 - 高速モード
  DRONE = 3,    // 桂馬 - ドローンモード
  FLIGHT = 4    // 飛車 - 飛行モード
}

// ===== 常量定義 =====
const TIME_SCALE_FACTOR = 3;
const MS_TO_MINUTES = 1000 * 60;
const TRANSITION_DURATION = 1000;
const TRANSITION_DELAY = 100;

// 速度配置表
const SPEED_MULTIPLIERS: Record<VehicleMode, number> = {
  [VehicleMode.NORMAL]: 1.0,
  [VehicleMode.HIGHWAY]: 2.5,
  [VehicleMode.DRONE]: 2.0,
  [VehicleMode.FLIGHT]: 7.5
};

// 视频路径配置
const TRANSFORM_VIDEOS: Record<string, string> = {
  TO_HIGHWAY: '/assets/car_highway.mp4',
  TO_DRONE: '/assets/car_drone.mp4',
  TO_FLIGHT: '/assets/car_fly.mp4',
  FROM_FLIGHT: '/assets/fly_car.mp4',
};

// ===== Context =====
interface SimulationContextType {
  isMoving: boolean;
  currentSpeed: number;
  currentMode: VehicleMode;
  isActivelyMoving: boolean;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

export default function CityRunDemo() {
  // ===== State定義 =====
  const [isMoving, setIsMoving] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(true);
  const [showTransformVideo, setShowTransformVideo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEnteringFirstPerson, setIsEnteringFirstPerson] = useState(true);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [currentTransformVideo, setCurrentTransformVideo] = useState<string>('');
  const [hasPlayedInitialTransform, setHasPlayedInitialTransform] = useState(false);
  const [currentMode, setCurrentMode] = useState<VehicleMode>(VehicleMode.NORMAL);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isPausedForVideo, setIsPausedForVideo] = useState(false);

  const exitAnimationModeRef = useRef<VehicleMode>(VehicleMode.NORMAL);
  const timersRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number>();

  // ===== Timer清理 =====
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ===== ヘルパー関数 =====
  const addTimer = useCallback((timerId: number) => {
    timersRef.current.push(timerId);
  }, []);

  const getTransformVideo = useCallback((fromMode: VehicleMode, toMode: VehicleMode): string | null => {
    if (toMode === VehicleMode.NORMAL) {
      if (fromMode === VehicleMode.FLIGHT) {
        return TRANSFORM_VIDEOS.FROM_FLIGHT;
      }
      return null;
    }

    switch (toMode) {
      case VehicleMode.HIGHWAY:
        return TRANSFORM_VIDEOS.TO_HIGHWAY;
      case VehicleMode.DRONE:
        return TRANSFORM_VIDEOS.TO_DRONE;
      case VehicleMode.FLIGHT:
        return TRANSFORM_VIDEOS.TO_FLIGHT;
      default:
        return null;
    }
  }, []);

  const getSpeedMultiplier = useCallback((mode: VehicleMode): number => {
    return SPEED_MULTIPLIERS[mode] ?? 1.0;
  }, []);

  // ===== イベントハンドラー =====
  const handleStartStop = useCallback((moving: boolean) => {
    setIsMoving(moving);
    if (moving) {
      lastTimeRef.current = Date.now();
    }
  }, []);

  const handleAutoStop = useCallback(() => {
    setIsMoving(false);
    setIsEnteringFirstPerson(true);
    setIsTransitioning(true);

    const timer1 = window.setTimeout(() => {
      setIsFirstPerson(true);
      const timer2 = window.setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION);
      addTimer(timer2);
    }, TRANSITION_DELAY);
    addTimer(timer1);
  }, [addTimer]);

  const handleViewToggle = useCallback(() => {
    if (isFirstPerson) {
      setIsTransitioning(true);
      setIsEnteringFirstPerson(false);
      setIsFirstPerson(false);

      const timer = window.setTimeout(() => {
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
      addTimer(timer);
    } else {
      exitAnimationModeRef.current = currentMode;
      setIsTransitioning(true);
      setIsEnteringFirstPerson(true);

      const timer1 = window.setTimeout(() => {
        setIsFirstPerson(true);
      }, TRANSITION_DELAY);
      addTimer(timer1);

      const timer2 = window.setTimeout(() => {
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
      addTimer(timer2);
    }
  }, [isFirstPerson, currentMode, addTimer]);

  const handleTransform = useCallback(() => {
    setShowTransformVideo(true);
  }, []);

  const handleVideoEnded = useCallback(() => {
    console.log('✅ 変換動画終了、走行再開');
    setShowTransformVideo(false);
    setIsPausedForVideo(false);
    lastTimeRef.current = Date.now();
  }, []);

  const handleRouteDataChange = useCallback((newRouteData: RouteResponse | null) => {
    setRouteData(newRouteData);
    setHasPlayedInitialTransform(false);
    setElapsedTime(0);
    setProgressPercent(0);
    setCurrentSegmentIndex(0);
    console.log('📍 ルートデータ更新:', newRouteData);
  }, []);

  // ===== requestAnimationFrame 进度更新 =====
  useEffect(() => {
    if (!isMoving || !routeData?.edges?.length) {
      setElapsedTime(0);
      setProgressPercent(0);
      setRemainingTime(0);
      setCurrentSegmentIndex(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const totalTimeMinutes = routeData.edges.reduce((sum, edge) => {
      return sum + edge.cost / MS_TO_MINUTES;
    }, 0);

    const actualDurationSeconds = totalTimeMinutes * TIME_SCALE_FACTOR;

    console.log(`📊 ルート総時間: ${totalTimeMinutes.toFixed(1)}分 → 実際走行時間: ${actualDurationSeconds.toFixed(1)}秒`);

    lastTimeRef.current = Date.now();

    const updateProgress = () => {
      if (isPausedForVideo) {
        lastTimeRef.current = Date.now();
        animationFrameRef.current = requestAnimationFrame(updateProgress);
        return;
      }

      const now = Date.now();
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setElapsedTime(prev => {
        const newElapsed = prev + delta;
        const progress = (newElapsed / actualDurationSeconds) * 100;
        const remaining = actualDurationSeconds - newElapsed;

        setProgressPercent(Math.min(100, progress));
        setRemainingTime(Math.max(0, remaining));

        if (newElapsed >= actualDurationSeconds) {
          console.log('🏁 目的地到達！自動停止');
          handleAutoStop();
          return actualDurationSeconds;
        }

        const segmentDurations = routeData.edges.map(edge => {
          const timeMinutes = edge.cost / MS_TO_MINUTES;
          return timeMinutes * TIME_SCALE_FACTOR;
        });

        let cumulativeTime = 0;
        let newSegmentIndex = 0;

        for (let i = 0; i < segmentDurations.length; i++) {
          if (newElapsed >= cumulativeTime && newElapsed < cumulativeTime + segmentDurations[i]) {
            newSegmentIndex = i;
            break;
          }
          cumulativeTime += segmentDurations[i];

          if (i === segmentDurations.length - 1) {
            newSegmentIndex = i;
          }
        }

        setCurrentSegmentIndex(prevIndex => {
          if (prevIndex !== newSegmentIndex) {
            console.log(`📍 セグメント更新: ${prevIndex} → ${newSegmentIndex}`);

            const newEdge = routeData.edges[newSegmentIndex];
            const prevEdge = prevIndex >= 0 ? routeData.edges[prevIndex] : null;

            if (newSegmentIndex > 0 && prevEdge && newEdge.mode !== prevEdge.mode) {
              const video = getTransformVideo(currentMode, newEdge.mode as VehicleMode);
              if (video) {
                console.log(`🎬 モード変更: ${prevEdge.mode} → ${newEdge.mode}, 動画: ${video}`);
                setCurrentTransformVideo(video);
                setShowTransformVideo(true);
                setIsPausedForVideo(true);
              }
            }

            setCurrentMode(newEdge.mode as VehicleMode);
          }
          return newSegmentIndex;
        });

        return newElapsed;
      });

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMoving, routeData, isPausedForVideo, currentMode, getTransformVideo, handleAutoStop]);

  // ===== 初期モード設定 =====
  useEffect(() => {
    if (isMoving && routeData?.edges?.length && !hasPlayedInitialTransform) {
      const firstMode = routeData.edges[0].mode as VehicleMode;
      setCurrentMode(firstMode);
      setCurrentSegmentIndex(0);

      if (firstMode !== VehicleMode.NORMAL) {
        const video = getTransformVideo(currentMode, firstMode);
        if (video) {
          console.log(`🎬 初期モード: ${firstMode}, 動画: ${video}`);
          setCurrentTransformVideo(video);
          setShowTransformVideo(true);
          setIsPausedForVideo(true);
          setHasPlayedInitialTransform(true);
        }
      } else {
        setHasPlayedInitialTransform(true);
      }
    }

    if (!isMoving) {
      setHasPlayedInitialTransform(false);
      setCurrentMode(VehicleMode.NORMAL);
      setIsPausedForVideo(false);
      setCurrentSegmentIndex(0);
    }
  }, [isMoving, routeData, hasPlayedInitialTransform]);

  // WebSocket 连接初始化
  useEffect(() => {
    websocketService.connect().catch(err => {
      console.warn('⚠️ WebSocket 连接失败，将在后台重试:', err.message);
    });

    return () => {
      websocketService.disconnect();
    };
  }, []);

  const handleRouteDataChange = (newRouteData: RouteResponse | null) => {
    setRouteData(newRouteData);
    setHasPlayedInitialTransform(false);
    setElapsedTime(0);
    setProgressPercent(0);
    setCurrentSegmentIndex(0);
    console.log('📍 ルートデータ更新:', newRouteData);
  };

  const handleStartStop = (moving: boolean) => {
    setIsMoving(moving);
    
    // 点击 START 时通过 WebSocket 发送路线数据
    if (moving && routeData) {
      const startNode = routeData.nodes[0];
      const destNode = routeData.nodes[routeData.nodes.length - 1];
      
      // 从 kyoto_routes.json 加载节点名称
      fetch('/website-assets/kyoto_routes.json')
        .then(res => res.json())
        .then(data => {
          const startKyotoNode = data.nodes.find((n: any) => n.id === startNode.id);
          const destKyotoNode = data.nodes.find((n: any) => n.id === destNode.id);
          
          const startName = startKyotoNode?.name || startNode.id;
          const destName = destKyotoNode?.name || destNode.id;
          
          websocketService.sendNewRoute(
            startName,
            destName,
            routeData
          );
          
          console.log('📡 发送路线到 CyberpunkCityDemo:', { start: startName, destination: destName });
        })
        .catch(err => {
          console.error('❌ 加载节点名称失败:', err);
          // 使用 ID 作为后备
          websocketService.sendNewRoute(
            startNode.id,
            destNode.id,
            routeData
          );
        });
    }
  };

  const handleViewToggle = () => {
    if (isFirstPerson) {
      // 第一视角 → 第三视角
      setIsTransitioning(true);
      setIsEnteringFirstPerson(false);
      setIsFirstPerson(false); // 立即切换到第三视角

      setTimeout(() => {
        setIsTransitioning(false);
      }, 1000);
    } else {
      // 第三视角 → 第一视角
      exitAnimationModeRef.current = currentMode; // 保存当前 mode，用于退出动画
      setIsTransitioning(true);
      setIsEnteringFirstPerson(true);

      // 延迟切换视角，让退出动画先播放
      setTimeout(() => {
        setIsFirstPerson(true);
      }, 100);

      setTimeout(() => {
        setIsTransitioning(false);
      }, 1000);
    }
  };

  const handleAutoStop = () => {
    // 自动停止时，调用handleStartStop来触发HUDPanel的状态更新
    handleStartStop(false);

    // 设置为进入第一视角
    setIsEnteringFirstPerson(true);

    // 添加过渡动画 - 第三人称到第一人称
    setIsTransitioning(true);
    setTimeout(() => {
      setIsFirstPerson(true);
      setTimeout(() => setIsTransitioning(false), 1000);
    }, 100);
  };

  const handleTransform = () => {
    // 显示变形视频
    setShowTransformVideo(true);
  };

  const handleVideoEnded = () => {
    // 视频播放完成后隐藏视频并恢复行驶
    console.log('✅ 変換動画終了、走行再開');
    setShowTransformVideo(false);
    setIsPausedForVideo(false); // 恢复行驶计时
  };

  // 根据当前模式计算速度倍率
  const getSpeedMultiplier = (mode: number): number => {
    switch (mode) {
      case 1: // 金将 - 通常モード (40 km/h)
        return 1.0;
      case 2: // 香車 - 高速モード (100 km/h)
        return 2.5;
      case 3: // 桂馬 - ドローンモード (80 km/h)
        return 2.0;
      case 4: // 飛車 - 飛行モード (300 km/h)
        return 7.5;
      default:
        return 1.0;
    }
  };

  // ===== 計算値 =====
  const currentSpeed = getSpeedMultiplier(currentMode);
  const isActivelyMoving = isMoving && !isPausedForVideo;

  const simulationContextValue: SimulationContextType = {
    isMoving,
    currentSpeed,
    currentMode,
    isActivelyMoving
  };

  return (
    <SimulationContext.Provider value={simulationContextValue}>
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: '#000', overflow: 'hidden', margin: 0, padding: 0
      }}>

        {/* 1. HUD 面板 (HTML) - 在 Canvas 之上 */}
        <HUDPanel
          onStartStop={handleStartStop}
          onViewToggle={handleViewToggle}
          onTransform={handleTransform}
          onRouteDataChange={handleRouteDataChange}
          isMoving={isMoving}
          currentMode={currentMode}
          currentSegmentIndex={currentSegmentIndex}
          progressPercent={progressPercent}
          remainingTime={remainingTime}
        />

        {/* 2. 视频层 (HTML) - 在 Canvas 之上 */}
        {showTransformVideo && currentTransformVideo && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            zIndex: 100, background: '#000', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <video
              key={currentTransformVideo}
              src={currentTransformVideo}
              autoPlay
              onEnded={handleVideoEnded}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* 3. 过渡遮罩层 (HTML) - 在 Canvas 之上 */}
        {/* 只要 isTransitioning 为 true，就显示这个黑色淡入淡出层 */}
        {isTransitioning && (
          <div className="transition-overlay" />
        )}

        {/* 4. 3D 场景 (Canvas) */}
        <ThreeScene>
          <FarScenery isMoving={isMoving} speed={0} />
          <MiddleScenery isMoving={isMoving} speed={0} currentMode={currentMode} />

          {currentMode !== VehicleMode.FLIGHT && (
            <SideScenery
              isMoving={isActivelyMoving}
              speed={50 * currentSpeed}
              currentMode={currentMode}
            />
          )}

          <RoadSystem
            isMoving={isActivelyMoving}
            speed={currentSpeed}
            currentMode={currentMode}
          />

          <OncomingVehicles
            isMoving={isActivelyMoving}
            speed={50 * currentSpeed}
            currentMode={currentMode}
          />

          {/* 直接根据状态渲染 3D 组件 */}

          {isFirstPerson ? (
            <FirstPersonView
              isTransitioning={isTransitioning}
              isEntering={isEnteringFirstPerson}
            />
          ) : (
            <ThirdPersonView
              isMoving={isMoving}
              currentMode={currentMode}
              isTransitioning={isTransitioning}
              isEntering={!isEnteringFirstPerson}
            />
          )}

        </ThreeScene>
      </div>
    </SimulationContext.Provider>
  );
}