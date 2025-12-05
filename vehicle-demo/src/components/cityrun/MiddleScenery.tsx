import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleMode } from '../../types/vehicleMode';

// ===== 类型定义 =====
interface MiddleSceneryProps {
  isMoving: boolean;
  speed?: number;
  currentMode?: VehicleMode;
}

// ===== 常量定义 =====
const TEXTURE_PATHS = {
  day: '../assets/view_middle02.png',
  night: '../assets/view_middle01.png',
  sky: '../assets/view_middle03.png'
} as const;

const TEXTURE_REPEAT = { x: 3, y: 1 };
const PARALLAX_DIVISOR = 200;
const CYCLE_DURATION = 30; // 秒
const TRANSITION_DURATION = 2; // 秒
const BASE_OPACITY = 0.8;
const GEOMETRY_SIZE = { width: 200, height: 40 };
const Z_POSITION = -85;
const SCALE = {
  normal: 1.5,
  flight: 4
};

// Y位置配置
const Y_POSITIONS: Record<VehicleMode, number> = {
  [VehicleMode.NORMAL]: 5,
  [VehicleMode.HIGHWAY]: 5,
  [VehicleMode.DRONE]: -5,
  [VehicleMode.FLIGHT]: -5
};

// ===== 主组件 =====
export default function MiddleScenery({
  isMoving,
  speed = 50,
  currentMode = VehicleMode.NORMAL
}: MiddleSceneryProps) {
  // Refs
  const timeRef = useRef(0);
  const transitionRef = useRef(1); // 0=夜晚, 1=白天
  const offsetRef = useRef(0);

  const isFlyMode = currentMode === VehicleMode.FLIGHT;

  // 加载纹理
  const dayTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS.day);
  const nightTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS.night);
  const skyTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS.sky);

  // 配置纹理（副作用应该用useEffect）
  useEffect(() => {
    const textures = [dayTexture, nightTexture, skyTexture];
    textures.forEach(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(TEXTURE_REPEAT.x, TEXTURE_REPEAT.y);
    });
  }, [dayTexture, nightTexture, skyTexture]);

  // 几何体（只创建一次）
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(GEOMETRY_SIZE.width, GEOMETRY_SIZE.height),
    []
  );

  // 材质
  const dayMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: dayTexture,
      transparent: true,
      opacity: BASE_OPACITY,
      side: THREE.DoubleSide
    }),
    [dayTexture]
  );

  const nightMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: nightTexture,
      transparent: true,
      opacity: BASE_OPACITY,
      side: THREE.DoubleSide
    }),
    [nightTexture]
  );

  const skyMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      map: skyTexture,
      transparent: true,
      opacity: BASE_OPACITY,
      side: THREE.DoubleSide
    }),
    [skyTexture]
  );

  // 动画帧更新（合并所有useFrame逻辑）
  useFrame((_state, delta) => {
    // 1. 时间循环和过渡计算
    timeRef.current += delta;
    const halfCycle = CYCLE_DURATION / 2;
    const currentPhase = timeRef.current % CYCLE_DURATION;
    const isInDayPhase = currentPhase < halfCycle;

    // 计算过渡进度
    if (isInDayPhase) {
      transitionRef.current = currentPhase < TRANSITION_DURATION
        ? currentPhase / TRANSITION_DURATION
        : 1;
    } else {
      const nightPhase = currentPhase - halfCycle;
      transitionRef.current = nightPhase < TRANSITION_DURATION
        ? 1 - (nightPhase / TRANSITION_DURATION)
        : 0;
    }

    // 2. 更新材质透明度（非飞行模式）
    if (!isFlyMode) {
      dayMaterial.opacity = BASE_OPACITY * transitionRef.current;
      nightMaterial.opacity = BASE_OPACITY * (1 - transitionRef.current);
    }

    // 3. 移动更新
    if (!isMoving) return;

    offsetRef.current += delta * (speed / PARALLAX_DIVISOR);
    dayTexture.offset.x = -offsetRef.current;
    nightTexture.offset.x = -offsetRef.current;
    skyTexture.offset.x = -offsetRef.current;
  });

  // 计算位置
  const yPosition = Y_POSITIONS[currentMode] ?? 5;

  // 飞行模式：只显示天空视角
  if (isFlyMode) {
    return (
      <mesh
        geometry={geometry}
        material={skyMaterial}
        position={[0, Y_POSITIONS[VehicleMode.FLIGHT], Z_POSITION]}
        scale={SCALE.flight}
      />
    );
  }

  // 普通模式：日夜交替
  return (
    <>
      <mesh
        geometry={geometry}
        material={nightMaterial}
        position={[0, yPosition, Z_POSITION]}
        scale={SCALE.normal}
      />
      <mesh
        geometry={geometry}
        material={dayMaterial}
        position={[0, yPosition, Z_POSITION + 0.01]}
        scale={SCALE.normal}
      />
    </>
  );
}