import { useState, useEffect, useRef } from 'react';
import ThreeScene from '../components/cityrun/ThreeScene.tsx';
import FirstPersonView from '../components/cityrun/FirstPersonView.tsx';
import ThirdPersonView from '../components/cityrun/ThirdPersonView.tsx';
import RoadSystem from '../components/cityrun/RoadSystem.tsx';
import SideScenery from '../components/cityrun/SideScenery.tsx';
import MiddleScenery from '../components/cityrun/MiddleScenery.tsx';
import FarScenery from '../components/cityrun/FarScenery.tsx';
import HUDPanel from '../components/cityrun/HUDPanel.tsx';
// import WeatherTimeSystem from '../components/cityrun/WeatherTimeSystem.tsx';
import OncomingVehicles from '../components/cityrun/OncomingVehicles.tsx';
import type { RouteResponse } from '../types/routeAPI';
import { websocketService } from '../services/websocketService';

export default function CityRunDemo() {
  const [isMoving, setIsMoving] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(true);
  const [showTransformVideo, setShowTransformVideo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isEnteringFirstPerson, setIsEnteringFirstPerson] = useState(true); // 是否正在进入第一视角
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [currentTransformVideo, setCurrentTransformVideo] = useState<string>('');
  const [hasPlayedInitialTransform, setHasPlayedInitialTransform] = useState(false);
  const [currentMode, setCurrentMode] = useState<number>(1); // 当前车辆模式
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0); // 当前路线段索引
  const [progressPercent, setProgressPercent] = useState<number>(0); // 总进度百分比
  const [remainingTime, setRemainingTime] = useState<number>(0); // 剩余时间（秒）
  const [elapsedTime, setElapsedTime] = useState<number>(0); // 已行驶时间（秒）- 在 useEffect 中使用
  const [isPausedForVideo, setIsPausedForVideo] = useState(false); // 是否因播放视频而暂停
  const exitAnimationModeRef = useRef<number>(1); // 保存退出动画开始时的 mode，防止动画期间被重置

  // 根据路线总时间自动停止（1分钟路程 = 3秒实际行驶）
  useEffect(() => {
    if (!isMoving || !routeData || !routeData.edges) {
      setElapsedTime(0);
      setProgressPercent(0);
      setRemainingTime(0);
      setCurrentSegmentIndex(0);
      return;
    }

    // 计算总时间（分钟）
    const totalTimeMinutes = routeData.edges.reduce((sum, edge) => {
      return sum + (edge.cost / 1000 / 60); // cost是毫秒，转换为分钟
    }, 0);

    // 1分钟路程 = 3秒实际行驶
    const actualDurationSeconds = totalTimeMinutes * 3;

    console.log(`📊 ルート総時間: ${totalTimeMinutes.toFixed(1)}分 → 実際走行時間: ${actualDurationSeconds.toFixed(1)}秒`);

    // 更新进度和剩余时间的定时器
    const progressInterval = setInterval(() => {
      // 如果正在播放视频，暂停计时
      if (isPausedForVideo) {
        return;
      }

      setElapsedTime(prev => {
        const newElapsed = prev + 0.1; // 每100ms更新一次
        const progress = (newElapsed / actualDurationSeconds) * 100;
        const remaining = actualDurationSeconds - newElapsed;

        setProgressPercent(Math.min(100, progress));
        setRemainingTime(Math.max(0, remaining));

        // 如果时间到达或超过总时长，立即停止
        if (newElapsed >= actualDurationSeconds) {
          console.log('🏁 目的地到達！自動停止（タイマー）');
          handleAutoStop();
          return actualDurationSeconds; // 确保不超过总时长
        }

        // 根据已行驶时间计算当前所在的路段
        const segmentDurations = routeData.edges.map(edge => {
          const timeMinutes = edge.cost / 1000 / 60;
          return timeMinutes * 3; // 1分钟 = 3秒
        });

        let cumulativeTime = 0;
        let newSegmentIndex = 0;

        for (let i = 0; i < segmentDurations.length; i++) {
          if (newElapsed >= cumulativeTime && newElapsed < cumulativeTime + segmentDurations[i]) {
            newSegmentIndex = i;
            break;
          }
          cumulativeTime += segmentDurations[i];

          // 如果超过所有段，停在最后一段
          if (i === segmentDurations.length - 1) {
            newSegmentIndex = i;
          }
        }

        // 只在段索引变化时更新
        setCurrentSegmentIndex(prevIndex => {
          if (prevIndex !== newSegmentIndex) {
            console.log(`📍 セグメント更新: ${prevIndex} → ${newSegmentIndex}`);

            // 检查是否需要播放变换视频
            const newEdge = routeData.edges[newSegmentIndex];
            const prevEdge = prevIndex >= 0 ? routeData.edges[prevIndex] : null;

            if (newSegmentIndex > 0 && prevEdge && newEdge.mode !== prevEdge.mode) {
              const video = getTransformVideo(currentMode, newEdge.mode);
              if (video) {
                console.log(`🎬 モード変更: ${prevEdge.mode} → ${newEdge.mode}, 動画: ${video}`);
                setCurrentTransformVideo(video);
                setShowTransformVideo(true);
                setIsPausedForVideo(true);
              }
            }

            setCurrentMode(newEdge.mode);
          }
          return newSegmentIndex;
        });

        return newElapsed;
      });
    }, 100);

    // 自动停止定时器
    const timer = window.setTimeout(() => {
      console.log('🏁 目的地到達！自動停止');
      handleAutoStop();
    }, actualDurationSeconds * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [isMoving, routeData, isPausedForVideo]);

  // 根据模式获取变换视频
  const getTransformVideo = (fromMode: Number, toMode: number): string | null => {
    if (toMode === 1) {
      switch (fromMode) {
        case 2: // 高速モード (香車)
        // return '/assets/car_to_normal.mp4';
        case 3: // 短距離飛行モード (桂馬)
        // return '/assets/drone_to_normal.mp4';
        case 4: // 長距離飛行モード (飛車)
          return '/assets/fly_car.mp4';
        default:
          return null; // 通常モード (金将) は変換なし
      }
    }
    switch (toMode) {
      case 2: // 高速モード (香車)
        return '/assets/car_highway.mp4';
      case 3: // 短距離飛行モード (桂馬)
        return '/assets/car_drone.mp4';
      case 4: // 長距離飛行モード (飛車)
        return '/assets/car_fly.mp4';
      default:
        return null; // 通常モード (金将) は変換なし
    }
  };

  // 开始行驶时，设置初始模式（移除独立的定时器逻辑）
  useEffect(() => {
    if (isMoving && routeData && routeData.edges && routeData.edges.length > 0 && !hasPlayedInitialTransform) {
      const firstMode = routeData.edges[0].mode;
      setCurrentMode(firstMode);
      setCurrentSegmentIndex(0);

      if (firstMode !== 1) {
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
      setCurrentMode(1);
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

  const currentSpeed = getSpeedMultiplier(currentMode);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      {/* HUD 控制面板 */}
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

      {/* 变形视频 */}
      {showTransformVideo && currentTransformVideo && (
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
            key={currentTransformVideo} // 强制重新加载视频
            src={currentTransformVideo}
            autoPlay
            onEnded={handleVideoEnded}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      )}

      {/* 视角切换过渡动画 - 进出车效果 */}
      {isTransitioning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
        </div>
      )}

      <style>{`
        @keyframes zoomOutToCar {
          0% { 
            transform: scale(1);
            opacity: 1;
          }
          100% { 
            transform: scale(0.1) translateY(80vh);
            opacity: 0;
          }
        }
        
        @keyframes zoomInFromCar {
          0% { 
            transform: scale(0.1) translateY(80vh);
            opacity: 0;
          }
          100% { 
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes fadeOutOverlay {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        @keyframes fadeInOverlay {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Three.js 场景 */}
      <ThreeScene>
        {/* 天气和时间系统 */}
        {/* <WeatherTimeSystem isMoving={isMoving} /> */}

        {/* 远景（天空/太阳） - 最远，移动最慢 */}
        <FarScenery isMoving={isMoving} speed={0} />

        {/* 中景 - 中等距离，中等速度 - fly模式下隐藏 */}
        <MiddleScenery isMoving={isMoving} speed={0} currentMode={currentMode} />

        {/* 近景（路边建筑） - 最近，移动最快 - fly模式下隐藏 */}
        {currentMode !== 4 && (
          <SideScenery isMoving={isMoving && !isPausedForVideo} speed={50 * currentSpeed} currentMode={currentMode} />
        )}

        {/* 道路系统 */}
        <RoadSystem isMoving={isMoving && !isPausedForVideo} speed={currentSpeed} currentMode={currentMode} />

        {/* 对向车辆系统 */}
        <OncomingVehicles isMoving={isMoving && !isPausedForVideo} speed={50 * currentSpeed} currentMode={currentMode} />

        {/* 根据视角切换渲染不同的视图 */}
        {isFirstPerson ? (
          <>
            <FirstPersonView isTransitioning={isTransitioning} isEntering={isEnteringFirstPerson} />
            {/* 在切换到第一人称时，保留第三人称视图播放退出动画 */}
            {isTransitioning && isEnteringFirstPerson && (
              <ThirdPersonView
                isMoving={isMoving}
                currentMode={exitAnimationModeRef.current}
                isTransitioning={true}
                isEntering={false}
              />
            )}
          </>
        ) : (
          <>
            <ThirdPersonView
              isMoving={isMoving}
              currentMode={currentMode}
              isTransitioning={isTransitioning}
              isEntering={!isEnteringFirstPerson} // 第三视角的进入方向与第一视角相反
            />
            {/* 在切换到第三人称时，保留第一人称视图播放退出动画 */}
            {isTransitioning && !isEnteringFirstPerson && (
              <FirstPersonView isTransitioning={true} isEntering={false} />
            )}
          </>
        )}
      </ThreeScene>


    </div>
  );
}
