import { useState, useEffect } from 'react';
import ThreeScene from '../components/cityrun/ThreeScene.tsx';
import FirstPersonView from '../components/cityrun/FirstPersonView.tsx';
import ThirdPersonView from '../components/cityrun/ThirdPersonView.tsx';
import RoadSystem from '../components/cityrun/RoadSystem.tsx';
import SideScenery from '../components/cityrun/SideScenery.tsx';
import MiddleScenery from '../components/cityrun/MiddleScenery.tsx';
import FarScenery from '../components/cityrun/FarScenery.tsx';
import HUDPanel from '../components/cityrun/HUDPanel.tsx';

export default function CityRunDemo() {
  const [isMoving, setIsMoving] = useState(false);
  const [isFirstPerson, setIsFirstPerson] = useState(true);
  const [isTransformed, setIsTransformed] = useState(false);
  const [showTransformVideo, setShowTransformVideo] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'toThird' | 'toFirst'>('toThird');

  // 自动停止计时器（行驶10秒后自动停止）
  useEffect(() => {
    let timer: number;
    if (isMoving) {
      timer = window.setTimeout(() => {
        handleAutoStop();
      }, 5000); // 5秒后自动停止
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isMoving]);

  const handleStartStop = (moving: boolean) => {
    setIsMoving(moving);
  };

  const handleViewToggle = (firstPerson: boolean) => {
    // 添加过渡动画
    setTransitionDirection(firstPerson ? 'toFirst' : 'toThird');
    setIsTransitioning(true);
    setTimeout(() => {
      setIsFirstPerson(firstPerson);
      setTimeout(() => setIsTransitioning(false), 1000);
    }, 100);
  };

  const handleAutoStop = () => {
    // 自动停止时，调用handleStartStop来触发HUDPanel的状态更新
    handleStartStop(false);
    // 添加过渡动画 - 第三人称到第一人称
    setTransitionDirection('toFirst');
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
    // 视频播放完成后隐藏视频并标记为已变形
    setShowTransformVideo(false);
    setIsTransformed(true);
  };

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
        isMoving={isMoving}
      />

      {/* 变形视频 */}
      {showTransformVideo && (
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
            src="/assets/car_highway.mp4"
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
          {/* 车内图片缩放动画 */}
          <img 
            src="/assets/car_inside.png"
            alt="car"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: transitionDirection === 'toThird' 
                ? 'zoomOutToCar 1s ease-in-out' 
                : 'zoomInFromCar 1s ease-in-out',
            }}
          />
          
          {/* 径向模糊叠加效果 */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at center, transparent 0%, transparent 40%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.9) 100%)',
              animation: transitionDirection === 'toThird' ? 'fadeOutOverlay 1s ease-in-out' : 'fadeInOverlay 1s ease-in-out',
            }}
          />
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
        {/* 远景（天空/太阳） - 最远，移动最慢 */}
        <FarScenery isMoving={isMoving} speed={0} />

        {/* 中景 - 中等距离，中等速度 */}
        <MiddleScenery isMoving={isMoving} speed={0} />

        {/* 近景（路边建筑） - 最近，移动最快 */}
        <SideScenery isMoving={isMoving} speed={50} />

        {/* 道路系统 */}
        <RoadSystem isMoving={isMoving} />

        {/* 根据视角切换渲染不同的视图 */}
        {isFirstPerson ? (
          <FirstPersonView />
        ) : (
          <ThirdPersonView isMoving={isMoving} isTransformed={isTransformed} />
        )}
      </ThreeScene>

      
    </div>
  );
}
