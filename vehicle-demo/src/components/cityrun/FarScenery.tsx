import { useRef, useMemo, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface FarSceneryProps {
  isMoving: boolean;
  speed?: number;
}

export default function FarScenery({ isMoving, speed = 50 }: FarSceneryProps) {
  const timeRef = useRef(0);
  const [isDay, setIsDay] = useState(true);
  const transitionRef = useRef(0); // 0=完全夜晚, 1=完全白天

  // 加载两种远景纹理
  const dayTexture = useLoader(THREE.TextureLoader, '/assets/bg_sunshine.png');
  const nightTexture = useLoader(THREE.TextureLoader, '/assets/bg_night.png');

  // 配置纹理 - 按图片原始比例显示
  useMemo(() => {
    dayTexture.wrapS = THREE.ClampToEdgeWrapping;
    dayTexture.wrapT = THREE.ClampToEdgeWrapping;
    dayTexture.repeat.set(1, 1);
    
    nightTexture.wrapS = THREE.ClampToEdgeWrapping;
    nightTexture.wrapT = THREE.ClampToEdgeWrapping;
    nightTexture.repeat.set(1, 1);
  }, [dayTexture, nightTexture]);

  const offsetRef = useRef(0);

  useFrame((_state, delta) => {
    // 时间循环：每30秒切换一次早晚（15秒白天，15秒黑夜）
    timeRef.current += delta;
    const cycleTime = 30; // 完整周期30秒
    const halfCycle = cycleTime / 2;
    const currentPhase = timeRef.current % cycleTime;
    const shouldBeDay = currentPhase < halfCycle;
    
    // 计算过渡进度（0-1之间）
    const transitionDuration = 2; // 2秒过渡时间
    if (shouldBeDay) {
      // 白天阶段：从0秒到15秒
      if (currentPhase < transitionDuration) {
        // 从夜晚淡入白天（0→1）
        transitionRef.current = currentPhase / transitionDuration;
      } else {
        transitionRef.current = 1; // 完全白天
      }
    } else {
      // 夜晚阶段：从15秒到30秒
      const nightPhase = currentPhase - halfCycle;
      if (nightPhase < transitionDuration) {
        // 从白天淡入夜晚（1→0）
        transitionRef.current = 1 - (nightPhase / transitionDuration);
      } else {
        transitionRef.current = 0; // 完全夜晚
      }
    }
    
    if (shouldBeDay !== isDay) {
      setIsDay(shouldBeDay);
    }

    if (!isMoving) return;

    // 远景移动速度最慢（视差效果）
    offsetRef.current += delta * (speed / 400);
    // 更新两个纹理的偏移，保持同步
    dayTexture.offset.x = -offsetRef.current;
    nightTexture.offset.x = -offsetRef.current;
  });

  // 远景几何体 - 固定尺寸，不再依赖纹理
  const geometry = useMemo(() => {
    const height = 350;
    const width = height * 2; // 默认宽高比2:1
    return new THREE.PlaneGeometry(width, height);
  }, []);
  
  // 白天材质
  const dayMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: dayTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      }),
    [dayTexture]
  );

  // 夜晚材质
  const nightMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: nightTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      }),
    [nightTexture]
  );

  // 在useFrame中更新材质透明度实现交叉淡化
  useFrame(() => {
    dayMaterial.opacity = transitionRef.current;
    nightMaterial.opacity = 1 - transitionRef.current;
  });

  return (
    <>
      {/* 夜晚层 */}
      <mesh 
        geometry={geometry} 
        material={nightMaterial} 
        position={[0, 5, -100]} 
        rotation={[0, 0, 0]}
      />
      {/* 白天层（在上面） */}
      <mesh 
        geometry={geometry} 
        material={dayMaterial} 
        position={[0, 5, -99.99]} 
        rotation={[0, 0, 0]}
      />
    </>
  );
}
