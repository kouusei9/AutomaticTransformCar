import { useRef, useMemo, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface MiddleSceneryProps {
  isMoving: boolean;
  speed?: number;
  currentMode?: number;
}

export default function MiddleScenery({ isMoving, speed = 50, currentMode = 1 }: MiddleSceneryProps) {
  // fly 模式下不显示中景
  const isFlyMode = currentMode === 4;

  if (isFlyMode) {
    return null;
  }
  const timeRef = useRef(0);
  const [isDay, setIsDay] = useState(true);
  const transitionRef = useRef(0); // 0=完全夜晚, 1=完全白天

  // 加载两种中景纹理
  const dayTexture = useLoader(THREE.TextureLoader, '/assets/view_middle02.png');
  const nightTexture = useLoader(THREE.TextureLoader, '/assets/view_middle01.png');

  // 配置纹理
  useMemo(() => {
    dayTexture.wrapS = THREE.RepeatWrapping;
    dayTexture.wrapT = THREE.RepeatWrapping;
    dayTexture.repeat.set(3, 1); // 横向重复3次

    nightTexture.wrapS = THREE.RepeatWrapping;
    nightTexture.wrapT = THREE.RepeatWrapping;
    nightTexture.repeat.set(3, 1);
  }, [dayTexture, nightTexture]);

  const offsetRef = useRef(0);

  useFrame((_state, delta) => {
    // 时间循环：每30秒切换一次早晚（与远景同步）
    timeRef.current += delta;
    const cycleTime = 30;
    const halfCycle = cycleTime / 2;
    const currentPhase = timeRef.current % cycleTime;
    const shouldBeDay = currentPhase < halfCycle;

    // 计算过渡进度（0-1之间）
    const transitionDuration = 2; // 2秒过渡时间
    if (shouldBeDay) {
      // 白天阶段
      if (currentPhase < transitionDuration) {
        transitionRef.current = currentPhase / transitionDuration;
      } else {
        transitionRef.current = 1;
      }
    } else {
      // 夜晚阶段
      const nightPhase = currentPhase - halfCycle;
      if (nightPhase < transitionDuration) {
        transitionRef.current = 1 - (nightPhase / transitionDuration);
      } else {
        transitionRef.current = 0;
      }
    }

    if (shouldBeDay !== isDay) {
      setIsDay(shouldBeDay);
    }

    if (!isMoving) return;

    // 中景移动速度是近景的一半（视差效果）
    offsetRef.current += delta * (speed / 200);
    // 更新两个纹理的偏移，保持同步
    dayTexture.offset.x = -offsetRef.current;
    nightTexture.offset.x = -offsetRef.current;
  });

  // 中景几何体和材质
  const geometry = useMemo(() => new THREE.PlaneGeometry(200, 40), []);

  // 白天材质
  const dayMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: dayTexture,
        transparent: true,
        opacity: 0.8,
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
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
    [nightTexture]
  );

  // 在useFrame中更新材质透明度实现交叉淡化
  useFrame(() => {
    dayMaterial.opacity = 0.8 * transitionRef.current;
    nightMaterial.opacity = 0.8 * (1 - transitionRef.current);
  });

  // drone 模式下位置下移
  const yPosition = currentMode === 3 ? -5 : 5;

  return (
    <>
      {/* 夜晚层 */}
      <mesh
        geometry={geometry}
        material={nightMaterial}
        position={[0, yPosition, -85]}
        rotation={[0, 0, 0]}
        scale={1.5}
      />
      {/* 白天层（在上面） */}
      <mesh
        geometry={geometry}
        material={dayMaterial}
        position={[0, yPosition, -84.99]}
        rotation={[0, 0, 0]}
        scale={1.5}
      />
    </>
  );
}
