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
import DebugPanel from '../components/cityrun/DebugPanel.tsx';
import type { RouteResponse } from '../types/routeAPI';
import { websocketService } from '../services/websocketService';
import './CityRunDemo.css';

// 创建将棋形状的赛博朋克风格指示牌纹理(带调色板)
function createShogiSignTextureWithPalette(modeText: string, palette: { from: string; to: string; primary: string }): string {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d')!;

  // 透明背景
  ctx.clearRect(0, 0, 256, 256);

  // 绘制将棋形状(扁平五角形,左右更宽)
  const centerX = 128;
  const centerY = 128;
  const width = 80; // 水平方向更长
  const height = 100; // 垂直方向较短

  const drawPentagon = (w: number, h: number) => {
    ctx.beginPath();
    // 顶点
    ctx.moveTo(centerX, centerY - h);
    // 右上
    ctx.lineTo(centerX + w * 0.7, centerY - h * 0.8);
    // 右下
    ctx.lineTo(centerX + w, centerY + h);
    // 左下
    ctx.lineTo(centerX - w, centerY + h);
    // 左上
    ctx.lineTo(centerX - w * 0.7, centerY - h * 0.8);
    ctx.closePath();
  };

  // 外层边框(较粗,发光)
  drawPentagon(width, height);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 4;
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 20;
  ctx.stroke();

  // 内层边框(较细)
  const innerWidth = width - 12;
  const innerHeight = height - 10;
  drawPentagon(innerWidth, innerHeight);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2;
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // 绘制中心文字(使用primary颜色)
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.fillStyle = palette.primary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = palette.primary;
  ctx.shadowBlur = 15;
  ctx.fillText(modeText, centerX, centerY + 10);

  return canvas.toDataURL();
}

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
  TO_HIGHWAY: '/assets/car_to_highway.mp4',
  TO_DRONE: '/assets/car_to_drone.mp4',
  TO_FLIGHT: '/assets/car_to_fly.mp4',
  FROM_FLIGHT: '/assets/fly_to_car.mp4',
  FROM_DRONE: '/assets/drone_to_car.mp4',
  FROM_HIGHWAY: '/assets/highway_to_car.mp4'
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
  // ===== 浏览器检测 =====
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // ===== State定義 =====
  const [isMoving, setIsMoving] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(true);
  const [showTransformVideo, setShowTransformVideo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEnteringFirstPerson, setIsEnteringFirstPerson] = useState(true);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [currentTransformVideo, setCurrentTransformVideo] = useState<string>('');
  const [transformFromMode, setTransformFromMode] = useState<VehicleMode | null>(null);
  const [transformToMode, setTransformToMode] = useState<VehicleMode | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(2.4);
  const [isAnimationEnding, setIsAnimationEnding] = useState(false);
  const [showToMode, setShowToMode] = useState(false); // 控制显示from还是to模式
  const [hasPlayedInitialTransform, setHasPlayedInitialTransform] = useState(false);
  const [currentMode, setCurrentMode] = useState<VehicleMode>(VehicleMode.NORMAL);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isPausedForVideo, setIsPausedForVideo] = useState(false);
  const [isTestRoute, setIsTestRoute] = useState(false); // 是否显示DebugPanel(仅测试路线行驶时)
  const isTestRouteRef = useRef(false); // 标记当前路线是否为测试路线
  const [isPaused, setIsPaused] = useState(false); // 用户手动暂停状态

  const exitAnimationModeRef = useRef<VehicleMode>(VehicleMode.NORMAL);
  const timersRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | undefined>(undefined);

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
      switch (fromMode) {
        case VehicleMode.HIGHWAY:
          return TRANSFORM_VIDEOS.FROM_HIGHWAY;
        case VehicleMode.DRONE:
          return TRANSFORM_VIDEOS.FROM_DRONE;
        case VehicleMode.FLIGHT:
          return TRANSFORM_VIDEOS.FROM_FLIGHT;
        default:
          return null;
      }
    } else {
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
    }
  }, []);

  const getSpeedMultiplier = useCallback((mode: VehicleMode): number => {
    return SPEED_MULTIPLIERS[mode] ?? 1.0;
  }, []);

  // 辅助：模式字符 / 名称 / 调色板
  const modeChar = (mode: VehicleMode | null) => {
    if (!mode) return '';
    switch (mode) {
      case VehicleMode.NORMAL: return '金';
      case VehicleMode.HIGHWAY: return '香';
      case VehicleMode.DRONE: return '桂';
      case VehicleMode.FLIGHT: return '飛';
      default: return '';
    }
  };

  const modeName = (mode: VehicleMode | null) => {
    if (!mode) return '';
    switch (mode) {
      case VehicleMode.NORMAL: return '金将';
      case VehicleMode.HIGHWAY: return '香車';
      case VehicleMode.DRONE: return '桂馬';
      case VehicleMode.FLIGHT: return '飛車';
      default: return '';
    }
  };

  const modePalette = (mode: VehicleMode | null) => {
    if (!mode) return { from: '#000', to: '#111', primary: '#00ffff' };
    switch (mode) {
      case VehicleMode.NORMAL: return { from: '#F2D56A', to: '#FFF4CC', primary: '#F2D56A' };
      case VehicleMode.HIGHWAY: return { from: '#E8BAA0', to: '#F0F0F0', primary: '#E8BAA0' };
      case VehicleMode.DRONE: return { from: '#C1CB93', to: '#E8BAA0', primary: '#C1CB93' };
      case VehicleMode.FLIGHT: return { from: '#ADC6D7', to: '#F2D56A', primary: '#ADC6D7' };
      default: return { from: '#000', to: '#111', primary: '#00ffff' };
    }
  };

  // ===== イベントハンドラー =====
  const handleStartStop = useCallback((moving: boolean) => {
    setIsMoving(moving);
    if (moving) {
      lastTimeRef.current = Date.now();

      // 通过 WebSocket 发送路线数据到 CyberpunkCityDemo
      if (routeData) {
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
            websocketService.sendNewRoute(
              startNode.id,
              destNode.id,
              routeData
            );
          });
      }
    }
  }, [routeData]);

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

  const handleVideoLoaded = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const duration = video.duration;
    setVideoDuration(duration);
    setIsAnimationEnding(false);
    setShowToMode(false);
    console.log(`🎬 視頻時長: ${duration.toFixed(2)}秒`);

    const rotationDuration = duration / 2; // 单次旋转时长(速度x2)
    const halfDuration = duration / 2; // 视频播放到一半的时间

    // 在视频播放到一半时切换到to模式
    const timer1 = window.setTimeout(() => {
      setShowToMode(true);
      console.log('🔄 视频播放到一半,切换到to模式');
    }, halfDuration * 1000);
    addTimer(timer1);

    // 在视频结束前的最后一个旋转周期停止动画
    const stopTime = Math.floor(duration / rotationDuration) * rotationDuration;
    const timer2 = window.setTimeout(() => {
      setIsAnimationEnding(true);
      console.log('🎯 停止旋转,固定在to模式');
    }, stopTime * 1000);
    addTimer(timer2);
  }, [addTimer]);

  const handleVideoEnded = useCallback(() => {
    console.log('✅ 変換動画終了、走行再開');

    // 使用setTimeout确保状态更新顺序正确,防止卡住
    setTimeout(() => {
      setShowTransformVideo(false);
      setIsPausedForVideo(false);
      setIsAnimationEnding(false);
      setShowToMode(false);
      // 清除 transform 提示状态
      setTransformFromMode(null);
      setTransformToMode(null);
      lastTimeRef.current = Date.now();
    }, 50); // 延迟50ms确保视频完全结束
  }, []);

  const handleRouteDataChange = useCallback((newRouteData: RouteResponse | null) => {
    setRouteData(newRouteData);
    setHasPlayedInitialTransform(false);
    setElapsedTime(0);
    setProgressPercent(0);
    setCurrentSegmentIndex(0);
    setIsPaused(false); // 重置暂停状态

    // 检查是否为测试路线(通过ID判断,测试路线ID包含THREE-MODE或ALL-MODES)
    const isTest = newRouteData?.id?.includes('THREE-MODE') ||
      newRouteData?.id?.includes('ALL-MODES') ||
      false;
    isTestRouteRef.current = isTest;
    setIsTestRoute(false); // 加载路线时不显示DebugPanel

    console.log('📍 ルートデータ更新:', newRouteData, isTest ? '(テストルート)' : '');
  }, []);

  // ===== 暂停/恢复处理 =====
  const handlePauseToggle = useCallback(() => {
    setIsPaused(prev => {
      const newPaused = !prev;
      console.log(newPaused ? '⏸️ 一時停止' : '▶️ 再開');
      if (!newPaused) {
        // 恢复时重置lastTime，防止时间跳跃
        lastTimeRef.current = Date.now();
      }
      return newPaused;
    });
  }, []);

  // ===== isMoving变化时控制DebugPanel显示和重置暂停状态 =====
  useEffect(() => {
    console.log('🔍 DebugPanel状态检查:', {
      isMoving,
      isTestRouteRef: isTestRouteRef.current,
      isDev: (import.meta as any)?.env?.DEV
    });

    if (isMoving && isTestRouteRef.current) {
      // 开始行驶测试路线时显示DebugPanel
      console.log('✅ 显示DebugPanel');
      setIsTestRoute(true);
    } else {
      // 停止行驶时隐藏DebugPanel
      console.log('❌ 隐藏DebugPanel');
      setIsTestRoute(false);
    }

    // 停止行驶时重置暂停状态
    if (!isMoving) {
      setIsPaused(false);
    }
  }, [isMoving]);

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
              const toMode = newEdge.mode as VehicleMode;
              const fromMode = prevEdge.mode as VehicleMode;
              const video = getTransformVideo(fromMode, toMode); // 使用fromMode而不是currentMode
              if (video) {
                console.log(`🎬 モード変更: ${fromMode} → ${toMode}, 動画: ${video}`);
                // 设置转换来源/目标，用于右下角提示
                setTransformFromMode(fromMode);
                setTransformToMode(toMode);
                setCurrentTransformVideo(video);
                setShowTransformVideo(true);
                setIsPausedForVideo(true);

                // 延迟更新模式,确保视频正常播放
                setTimeout(() => {
                  setCurrentMode(toMode);
                }, 100);
              } else {
                // 没有视频时立即更新模式
                setCurrentMode(toMode);
              }
            } else {
              // 首次进入或无模式变化时更新模式
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
  }, [isMoving, routeData, isPausedForVideo, isPaused, currentMode, getTransformVideo, handleAutoStop]);

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

  // ===== 計算値 =====
  const currentSpeed = getSpeedMultiplier(currentMode);
  const isActivelyMoving = isMoving && !isPausedForVideo && !isPaused;

  const simulationContextValue: SimulationContextType = {
    isMoving,
    currentSpeed,
    currentMode,
    isActivelyMoving
  };

  return (
    <SimulationContext.Provider value={simulationContextValue}>
      <div style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        maxWidth: '100vw', maxHeight: '100vh',
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
              playsInline
              muted={isSafari} // Safari需要静音才能自动播放,Chrome/Firefox/Edge可有声
              webkit-playsinline="true"
              onLoadedMetadata={(e) => {
                console.log('🎬 視頻元數據加載:', currentTransformVideo);
                handleVideoLoaded(e);
                // 强制播放,处理Safari自动播放限制
                const video = e.currentTarget;
                video.play().catch(err => {
                  console.error('❌ 視頻播放失敗:', err);
                  // 播放失败时跳过视频
                  setTimeout(() => handleVideoEnded(), 100);
                });
              }}
              onEnded={handleVideoEnded}
              onError={(e) => {
                console.error('❌ 視頻加載失敗:', currentTransformVideo, e);
                // 视频加载失败时自动继续
                handleVideoEnded();
              }}
              onLoadStart={() => console.log('🎬 視頻開始加載:', currentTransformVideo)}
              onCanPlay={() => console.log('✅ 視頻可以播放:', currentTransformVideo)}
              onPlay={() => console.log('▶️ 視頻開始播放')}
              onPause={() => console.log('⏸️ 視頻暫停')}
              onWaiting={() => console.log('⏳ 視頻緩衝中...')}
              onStalled={() => console.log('⚠️ 視頻加載停滯')}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* 3. 过渡遮罩层 (HTML) - 在 Canvas 之上 */}
        {/* 只要 isTransitioning 为 true，就显示这个黑色淡入淡出层 */}
        {isTransitioning && (
          <div className="transition-overlay" />
        )}

        {/* 转换提示（右下角：旋转指示牌 - 使用Canvas绘制） */}
        {showTransformVideo && transformFromMode != null && transformToMode != null && (() => {
          const fromSignUrl = createShogiSignTextureWithPalette(modeChar(transformFromMode), modePalette(transformFromMode));
          const toSignUrl = createShogiSignTextureWithPalette(modeChar(transformToMode), modePalette(transformToMode));

          return (
            <div
              className="transform-sign-wrapper"
              aria-hidden
              style={{
                '--animation-duration': `${videoDuration}s`
              } as React.CSSProperties}
            >
              <div className="transform-sign">
                <div className={`sign-card${isAnimationEnding ? ' animation-end' : ''}`}>
                  <div className="sign-content">
                    <img
                      src={showToMode ? toSignUrl : fromSignUrl}
                      alt={showToMode ? modeName(transformToMode) : modeName(transformFromMode)}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 4. 3D 场景 (Canvas) */}
        <ThreeScene cameraPosition={
          currentMode === 3 ? [0, 3, 8] :  // 桂模式：高俯视
            currentMode === 2 ? [0, 1.5, 6] : // 香模式：低俯视
              [0, -1, 5]                         // 其他模式：正常视角
        }>
          <FarScenery isMoving={isMoving} speed={0} />
          <MiddleScenery isMoving={isMoving} speed={0} currentMode={currentMode} />

          <SideScenery
            isMoving={isActivelyMoving}
            speed={50 * currentSpeed}
            currentMode={currentMode}
          />

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

        {/* 暂停按钮 (仅在第三人称视角行驶时显示) */}
        {isMoving && !isFirstPerson && (
          <button
            onClick={handlePauseToggle}
            style={{
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
              boxShadow: isPaused
                ? '0 0 20px rgba(0, 255, 0, 0.6)'
                : '0 0 10px rgba(255, 0, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = isPaused
                ? '0 0 30px rgba(0, 255, 0, 0.8)'
                : '0 0 30px rgba(255, 0, 255, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = isPaused
                ? '0 0 20px rgba(0, 255, 0, 0.6)'
                : '0 0 10px rgba(255, 0, 255, 0.3)';
            }}
          >
            {isPaused ? '▶️ 再開' : '⏸️ 一時停止'}
          </button>
        )}

        {/* Debug面板 (测试路线行驶时显示) */}
        {isTestRoute && <DebugPanel />}
      </div>
    </SimulationContext.Provider>
  );
}