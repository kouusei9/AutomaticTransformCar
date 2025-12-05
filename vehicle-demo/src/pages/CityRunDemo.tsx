import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import ThreeScene from '../components/cityrun/ThreeScene.tsx';
import FirstPersonView from '../components/cityrun/FirstPersonView.tsx';
import ThirdPersonView from '../components/cityrun/ThirdPersonView.tsx';
import RoadSystem from '../components/cityrun/RoadSystem.tsx';
import SideScenery from '../components/cityrun/SideScenery.tsx';
import MiddleScenery from '../components/cityrun/MiddleScenery.tsx';
import FarScenery from '../components/cityrun/FarScenery.tsx';
import HUDPanel from '../components/cityrun/HUDPanel.tsx';
import OncomingVehicles from '../components/cityrun/OncomingVehicles.tsx';
import DebugPanel from '../components/cityrun/DebugPanel.tsx';
import type { RouteResponse } from '../types/routeAPI';
import { websocketService } from '../services/websocketService';
import { VehicleMode, MODE_CONFIG, type ModePalette } from '../types/vehicleMode';
import './CityRunDemo.css';

// 重新导出VehicleMode供其他组件使用
export { VehicleMode };

// ===== 类型定义 =====
interface SimulationContextType {
  isMoving: boolean;
  currentSpeed: number;
  currentMode: VehicleMode;
  isActivelyMoving: boolean;
}

const DEFAULT_PALETTE: ModePalette = { from: '#000', to: '#111', primary: '#00ffff' };

// ===== 常量定义 =====
const TIME_SCALE_FACTOR = 3;
const MS_TO_MINUTES = 1000 * 60;
const TRANSITION_DURATION = 1000;
const TRANSITION_DELAY = 100;
const SCENERY_BASE_SPEED = 50;

// 视频路径配置
const TRANSFORM_VIDEOS = {
  TO_HIGHWAY: '../assets/car_to_highway.mp4',
  TO_DRONE: '../assets/car_to_drone.mp4',
  TO_FLIGHT: '../assets/car_to_fly.mp4',
  FROM_FLIGHT: '../assets/fly_to_car.mp4',
  FROM_DRONE: '../assets/drone_to_car.mp4',
  FROM_HIGHWAY: '../assets/highway_to_car.mp4'
} as const;

// 相机位置配置
const CAMERA_POSITIONS: Record<VehicleMode, [number, number, number]> = {
  [VehicleMode.NORMAL]: [0, -1, 5],
  [VehicleMode.HIGHWAY]: [0, 1.5, 6],
  [VehicleMode.DRONE]: [0, 3, 8],
  [VehicleMode.FLIGHT]: [0, -1, 5]
};

// ===== Context (移到组件外部) =====
const SimulationContext = createContext<SimulationContextType | null>(null);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within SimulationProvider');
  }
  return context;
};

// ===== 工具函数 =====
/**
 * 创建将棋形状的赛博朋克风格指示牌纹理
 */
function createShogiSignTexture(modeText: string, palette: ModePalette): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const centerX = 128;
  const centerY = 128;
  const width = 80;
  const height = 100;

  const drawPentagon = (w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - h);
    ctx.lineTo(centerX + w * 0.7, centerY - h * 0.8);
    ctx.lineTo(centerX + w, centerY + h);
    ctx.lineTo(centerX - w, centerY + h);
    ctx.lineTo(centerX - w * 0.7, centerY - h * 0.8);
    ctx.closePath();
  };

  // 外层边框
  drawPentagon(width, height);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 4;
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 20;
  ctx.stroke();

  // 内层边框
  drawPentagon(width - 12, height - 10);
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // 中心文字
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.fillStyle = palette.primary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 15;
  ctx.fillText(modeText, centerX, centerY + 10);

  return canvas.toDataURL();
}

/**
 * 获取模式转换视频路径
 */
function getTransformVideoPath(fromMode: VehicleMode, toMode: VehicleMode): string | null {
  if (toMode === VehicleMode.NORMAL) {
    const videoMap: Partial<Record<VehicleMode, string>> = {
      [VehicleMode.HIGHWAY]: TRANSFORM_VIDEOS.FROM_HIGHWAY,
      [VehicleMode.DRONE]: TRANSFORM_VIDEOS.FROM_DRONE,
      [VehicleMode.FLIGHT]: TRANSFORM_VIDEOS.FROM_FLIGHT
    };
    return videoMap[fromMode] ?? null;
  }

  const videoMap: Partial<Record<VehicleMode, string>> = {
    [VehicleMode.HIGHWAY]: TRANSFORM_VIDEOS.TO_HIGHWAY,
    [VehicleMode.DRONE]: TRANSFORM_VIDEOS.TO_DRONE,
    [VehicleMode.FLIGHT]: TRANSFORM_VIDEOS.TO_FLIGHT
  };
  return videoMap[toMode] ?? null;
}

/**
 * 检测Safari浏览器
 */
function isSafariBrowser(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * 检测是否为测试路线
 */
function isTestRouteId(routeId?: string): boolean {
  if (!routeId) return false;
  return routeId.includes('THREE-MODE') || routeId.includes('ALL-MODES');
}

// ===== 自定义Hooks =====
/**
 * 视频预加载Hook
 */
function useVideoPreload() {
  const preloadedVideos = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const videoUrls = Object.values(TRANSFORM_VIDEOS);
    console.log('🎬 开始预加载视频...');

    videoUrls.forEach(url => {
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      video.addEventListener('loadeddata', () => {
        console.log('✅ 视频预加载完成:', url);
      });

      video.addEventListener('error', (e) => {
        console.error('❌ 视频预加载失败:', url, e);
      });

      video.load();
      preloadedVideos.current.set(url, video);
    });

    return () => {
      preloadedVideos.current.forEach(video => {
        video.src = '';
        video.load();
      });
      preloadedVideos.current.clear();
    };
  }, []);

  return preloadedVideos;
}

/**
 * Timer管理Hook
 */
function useTimerManager() {
  const timersRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const addTimer = useCallback((callback: () => void, delay: number): number => {
    const timerId = window.setTimeout(callback, delay);
    timersRef.current.push(timerId);
    return timerId;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return clearAllTimers;
  }, [clearAllTimers]);

  return { addTimer, animationFrameRef, clearAllTimers };
}

// ===== 子组件 =====
interface TransformVideoOverlayProps {
  videoUrl: string;
  fromMode: VehicleMode;
  toMode: VehicleMode;
  isSafari: boolean;
  onVideoLoaded: (duration: number) => void;
  onVideoEnded: () => void;
}

function TransformVideoOverlay({
  videoUrl,
  fromMode,
  toMode,
  isSafari,
  onVideoLoaded,
  onVideoEnded
}: TransformVideoOverlayProps) {
  const [videoDuration, setVideoDuration] = useState(2.4);
  const [isAnimationEnding, setIsAnimationEnding] = useState(false);
  const [showToMode, setShowToMode] = useState(false);
  const timersRef = useRef<number[]>([]);

  // 清理定时器
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const duration = video.duration;
    setVideoDuration(duration);
    setIsAnimationEnding(false);
    setShowToMode(false);

    console.log(`🎬 視頻時長: ${duration.toFixed(2)}秒`);
    onVideoLoaded(duration);

    const rotationDuration = duration / 2;
    const halfDuration = duration / 2;

    // 视频播放到一半时切换到to模式
    const timer1 = window.setTimeout(() => {
      setShowToMode(true);
      console.log('🔄 视频播放到一半,切换到to模式');
    }, halfDuration * 1000);
    timersRef.current.push(timer1);

    // 停止旋转动画
    const stopTime = Math.floor(duration / rotationDuration) * rotationDuration;
    const timer2 = window.setTimeout(() => {
      setIsAnimationEnding(true);
      console.log('🎯 停止旋转,固定在to模式');
    }, stopTime * 1000);
    timersRef.current.push(timer2);

    // 强制播放
    video.play().catch(err => {
      console.error('❌ 視頻播放失敗:', err);
      setTimeout(onVideoEnded, 100);
    });
  }, [onVideoLoaded, onVideoEnded]);

  const handleError = useCallback(() => {
    console.error('❌ 視頻加載失敗:', videoUrl);
    onVideoEnded();
  }, [videoUrl, onVideoEnded]);

  // 缓存纹理URL
  const fromConfig = MODE_CONFIG[fromMode];
  const toConfig = MODE_CONFIG[toMode];

  const fromSignUrl = useMemo(() =>
    createShogiSignTexture(fromConfig.char, fromConfig.palette),
    [fromConfig.char, fromConfig.palette]
  );

  const toSignUrl = useMemo(() =>
    createShogiSignTexture(toConfig.char, toConfig.palette),
    [toConfig.char, toConfig.palette]
  );

  const displayMode = showToMode ? toMode : fromMode;
  const displayConfig = MODE_CONFIG[displayMode];
  const displaySignUrl = showToMode ? toSignUrl : fromSignUrl;

  return (
    <>
      {/* 视频层 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 100,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <video
          key={videoUrl}
          src={videoUrl}
          autoPlay
          playsInline
          muted={isSafari}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onVideoEnded}
          onError={handleError}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* 转换提示 */}
      <div
        className="transform-sign-wrapper"
        aria-hidden
        style={{ '--animation-duration': `${videoDuration}s` } as React.CSSProperties}
      >
        <div className="transform-sign">
          <div className={`sign-card${isAnimationEnding ? ' animation-end' : ''}`}>
            <div className="sign-content">
              <img
                src={displaySignUrl}
                alt={displayConfig.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface PauseButtonProps {
  isPaused: boolean;
  onToggle: () => void;
}

function PauseButton({ isPaused, onToggle }: PauseButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 20,
    padding: '12px 24px',
    fontSize: '18px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: isPaused ? '#000' : '#fff',
    background: isPaused
      ? 'linear-gradient(135deg, #00ff00 0%, #00ff88 100%)'
      : 'rgba(0, 0, 0, 0.7)',
    border: `2px solid ${isPaused ? '#00ff00' : '#ff00ff'}`,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isHovered
      ? (isPaused ? '0 0 30px rgba(0, 255, 0, 0.8)' : '0 0 30px rgba(255, 0, 255, 0.6)')
      : (isPaused ? '0 0 20px rgba(0, 255, 0, 0.6)' : '0 0 10px rgba(255, 0, 255, 0.3)')
  };

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={baseStyle}
    >
      {isPaused ? '▶️ 再開' : '⏸️ 一時停止'}
    </button>
  );
}

// ===== 主组件 =====
export default function CityRunDemo() {
  const isSafari = useMemo(() => isSafariBrowser(), []);

  // 基础状态
  const [isMoving, setIsMoving] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEnteringFirstPerson, setIsEnteringFirstPerson] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // 路线状态
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [currentMode, setCurrentMode] = useState<VehicleMode>(VehicleMode.NORMAL);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 视频状态
  const [showTransformVideo, setShowTransformVideo] = useState(false);
  const [currentTransformVideo, setCurrentTransformVideo] = useState('');
  const [transformFromMode, setTransformFromMode] = useState<VehicleMode | null>(null);
  const [transformToMode, setTransformToMode] = useState<VehicleMode | null>(null);
  const [isPausedForVideo, setIsPausedForVideo] = useState(false);
  const [hasPlayedInitialTransform, setHasPlayedInitialTransform] = useState(false);

  // 测试路线状态
  const [isTestRoute, setIsTestRoute] = useState(false);
  const isTestRouteRef = useRef(false);

  // Refs
  const exitAnimationModeRef = useRef<VehicleMode>(VehicleMode.NORMAL);
  const lastTimeRef = useRef<number>(Date.now());

  // 自定义Hooks
  useVideoPreload();
  const { addTimer, animationFrameRef, clearAllTimers } = useTimerManager();

  // 计算值
  const currentSpeed = MODE_CONFIG[currentMode].speedMultiplier;
  const isActivelyMoving = isMoving && !isPausedForVideo && !isPaused;
  const cameraPosition = CAMERA_POSITIONS[currentMode];

  // ===== 事件处理 =====
  const handleAutoStop = useCallback(() => {
    setIsMoving(false);
    setIsEnteringFirstPerson(true);
    setIsTransitioning(true);

    addTimer(() => {
      setIsFirstPerson(true);
      addTimer(() => setIsTransitioning(false), TRANSITION_DURATION);
    }, TRANSITION_DELAY);
  }, [addTimer]);

  const handleStartStop = useCallback((moving: boolean) => {
    setIsMoving(moving);
    if (moving) {
      lastTimeRef.current = Date.now();

      // 通过 WebSocket 发送路线数据
      if (routeData) {
        const startNode = routeData.nodes[0];
        const destNode = routeData.nodes[routeData.nodes.length - 1];

        fetch('/website-assets/kyoto_routes.json')
          .then(res => res.json())
          .then(data => {
            const startKyotoNode = data.nodes.find((n: { id: string }) => n.id === startNode.id);
            const destKyotoNode = data.nodes.find((n: { id: string }) => n.id === destNode.id);

            websocketService.sendNewRoute(
              startKyotoNode?.name || startNode.id,
              destKyotoNode?.name || destNode.id,
              routeData
            );
          })
          .catch(err => {
            console.error('❌ 加载节点名称失败:', err);
            websocketService.sendNewRoute(startNode.id, destNode.id, routeData);
          });
      }
    }
  }, [routeData]);

  const handleViewToggle = useCallback(() => {
    if (isFirstPerson) {
      setIsTransitioning(true);
      setIsEnteringFirstPerson(false);
      setIsFirstPerson(false);
      addTimer(() => setIsTransitioning(false), TRANSITION_DURATION);
    } else {
      exitAnimationModeRef.current = currentMode;
      setIsTransitioning(true);
      setIsEnteringFirstPerson(true);
      addTimer(() => setIsFirstPerson(true), TRANSITION_DELAY);
      addTimer(() => setIsTransitioning(false), TRANSITION_DURATION);
    }
  }, [isFirstPerson, currentMode, addTimer]);

  const handleTransform = useCallback(() => {
    setShowTransformVideo(true);
  }, []);

  const handleVideoEnded = useCallback(() => {
    console.log('✅ 変換動画終了、走行再開');
    setTimeout(() => {
      setShowTransformVideo(false);
      setIsPausedForVideo(false);
      setTransformFromMode(null);
      setTransformToMode(null);
      lastTimeRef.current = Date.now();
    }, 50);
  }, []);

  const handleRouteDataChange = useCallback((newRouteData: RouteResponse | null) => {
    setRouteData(newRouteData);
    setHasPlayedInitialTransform(false);
    setElapsedTime(0);
    setProgressPercent(0);
    setCurrentSegmentIndex(0);
    setIsPaused(false);

    const isTest = isTestRouteId(newRouteData?.id);
    isTestRouteRef.current = isTest;
    setIsTestRoute(false);

    console.log('📍 ルートデータ更新:', newRouteData, isTest ? '(テストルート)' : '');
  }, []);

  const handlePauseToggle = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;
      console.log(newPaused ? '⏸️ 一時停止' : '▶️ 再開');
      if (!newPaused) {
        lastTimeRef.current = Date.now();
      }
      return newPaused;
    });
  }, []);

  // ===== Effects =====

  // WebSocket 连接
  useEffect(() => {
    websocketService.connect().catch(err => {
      console.warn('⚠️ WebSocket 连接失败，将在后台重试:', err.message);
    });
    return () => websocketService.disconnect();
  }, []);

  // DebugPanel显示控制
  useEffect(() => {
    if (isMoving && isTestRouteRef.current) {
      setIsTestRoute(true);
    } else {
      setIsTestRoute(false);
    }

    if (!isMoving) {
      setIsPaused(false);
    }
  }, [isMoving]);

  // 进度更新
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

    const totalTimeMinutes = routeData.edges.reduce(
      (sum, edge) => sum + edge.cost / MS_TO_MINUTES,
      0
    );
    const actualDurationSeconds = totalTimeMinutes * TIME_SCALE_FACTOR;

    console.log(`📊 ルート総時間: ${totalTimeMinutes.toFixed(1)}分 → 実際走行時間: ${actualDurationSeconds.toFixed(1)}秒`);

    lastTimeRef.current = Date.now();

    const segmentDurations = routeData.edges.map(edge =>
      (edge.cost / MS_TO_MINUTES) * TIME_SCALE_FACTOR
    );

    const updateProgress = () => {
      if (isPausedForVideo || isPaused) {
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

        // 计算当前段
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
              const toMode = newEdge.mode as VehicleMode;
              const fromMode = prevEdge.mode as VehicleMode;
              const video = getTransformVideoPath(fromMode, toMode);

              if (video) {
                console.log(`🎬 モード変更: ${fromMode} → ${toMode}, 動画: ${video}`);
                setTransformFromMode(fromMode);
                setTransformToMode(toMode);
                setCurrentTransformVideo(video);
                setShowTransformVideo(true);
                setIsPausedForVideo(true);
                setTimeout(() => setCurrentMode(toMode), 100);
              } else {
                setCurrentMode(toMode);
              }
            } else {
              setCurrentMode(newEdge.mode as VehicleMode);
            }
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
  }, [isMoving, routeData, isPausedForVideo, isPaused, handleAutoStop, animationFrameRef]);

  // 初期モード設定
  useEffect(() => {
    if (isMoving && routeData?.edges?.length && !hasPlayedInitialTransform) {
      const firstMode = routeData.edges[0].mode as VehicleMode;
      setCurrentMode(firstMode);
      setCurrentSegmentIndex(0);

      if (firstMode !== VehicleMode.NORMAL) {
        const video = getTransformVideoPath(currentMode, firstMode);
        if (video) {
          console.log(`🎬 初期モード: ${firstMode}, 動画: ${video}`);
          setTransformFromMode(currentMode);
          setTransformToMode(firstMode);
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
  }, [isMoving, routeData, hasPlayedInitialTransform, currentMode]);

  // Context value
  const simulationContextValue = useMemo<SimulationContextType>(() => ({
    isMoving,
    currentSpeed,
    currentMode,
    isActivelyMoving
  }), [isMoving, currentSpeed, currentMode, isActivelyMoving]);

  return (
    <SimulationContext.Provider value={simulationContextValue}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        background: '#000',
        overflow: 'hidden',
        margin: 0,
        padding: 0
      }}>
        {/* HUD 面板 */}
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

        {/* 视频转换层 */}
        {showTransformVideo && currentTransformVideo && transformFromMode !== null && transformToMode !== null && (
          <TransformVideoOverlay
            videoUrl={currentTransformVideo}
            fromMode={transformFromMode}
            toMode={transformToMode}
            isSafari={isSafari}
            onVideoLoaded={(duration) => console.log(`视频时长: ${duration}s`)}
            onVideoEnded={handleVideoEnded}
          />
        )}

        {/* 过渡遮罩层 */}
        {isTransitioning && <div className="transition-overlay" />}

        {/* 3D 场景 */}
        <ThreeScene cameraPosition={cameraPosition}>
          <FarScenery isMoving={isMoving} speed={0} />
          <MiddleScenery isMoving={isMoving} speed={0} currentMode={currentMode} />

          <SideScenery
            isMoving={isActivelyMoving}
            speed={SCENERY_BASE_SPEED * currentSpeed}
            currentMode={currentMode}
          />

          <RoadSystem
            isMoving={isActivelyMoving}
            speed={currentSpeed}
            currentMode={currentMode}
          />

          <OncomingVehicles
            isMoving={isActivelyMoving}
            speed={SCENERY_BASE_SPEED * currentSpeed}
            currentMode={currentMode}
          />

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

        {/* 暂停按钮 */}
        {isMoving && !isFirstPerson && (
          <PauseButton isPaused={isPaused} onToggle={handlePauseToggle} />
        )}

        {/* Debug面板 */}
        {isTestRoute && <DebugPanel />}
      </div>
    </SimulationContext.Provider>
  );
}