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
  day: '/assets/view_middle02.png',
  night: '/assets/view_middle01.png',
  sky: '/assets/view_middle03.png',
  city: '/assets/view_middle04.png',
  cloud: '/assets/cloud/02.png'
} as const;

const TEXTURE_REPEAT = { x: 3, y: 1 };
const PARALLAX_DIVISOR = 200;
const CITY_PARALLAX_DIVISOR = 400;

const CYCLE_DURATION = 30;
const TRANSITION_DURATION = 2;
const BASE_OPACITY = 0.95;

const GEOMETRY_SIZE = { width: 240, height: 60 };
const CITY_GEOMETRY_SIZE = { width: 400, height: 200 };
const Z_POSITION = -90;
const CITY_Z_POSITION = -70;  // 更近一些，避免被雾遮挡
const SKY_Z_POSITION = -95;   // 天空在城市后面

const SCALE = {
  normal: 1.5,
  flight: 3.5,
  drone: 0.8 // 放大城市背景
};

const Y_POSITIONS: Record<VehicleMode, number> = {
  [VehicleMode.NORMAL]: 5,
  [VehicleMode.HIGHWAY]: 5,
  [VehicleMode.DRONE]: -5,
  [VehicleMode.FLIGHT]: -10
};

// ===== 主组件 =====
export default function MiddleScenery({
  isMoving,
  speed = 50,
  currentMode = VehicleMode.NORMAL
}: MiddleSceneryProps) {
  const timeRef = useRef(0);
  const transitionRef = useRef(1);
  const offsetRef = useRef(0);

  const isFlyMode = currentMode === VehicleMode.FLIGHT;
  const isDroneMode = currentMode === VehicleMode.DRONE;

  // 1. 加载普通背景纹理
  const [dayTexture, nightTexture, skyTexture, cloudTexture] = useLoader(THREE.TextureLoader, [
    TEXTURE_PATHS.day,
    TEXTURE_PATHS.night,
    TEXTURE_PATHS.sky,
    TEXTURE_PATHS.cloud
  ]);

  // 2. 加载城市背景纹理
  const cityTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS.city) as THREE.Texture;

  // 配置纹理
  useEffect(() => {
    [dayTexture, nightTexture, skyTexture].forEach(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(TEXTURE_REPEAT.x, TEXTURE_REPEAT.y);
      texture.colorSpace = THREE.SRGBColorSpace;
    });

    cityTexture.wrapS = THREE.RepeatWrapping;
    cityTexture.repeat.set(1, 1);
    cityTexture.center.set(0.5, 0.5);
    cityTexture.colorSpace = THREE.SRGBColorSpace;

  }, [dayTexture, nightTexture, skyTexture, cityTexture]);

  // 几何体
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(GEOMETRY_SIZE.width, GEOMETRY_SIZE.height),
    []
  );

  const cityGeometry = useMemo(
    () => new THREE.PlaneGeometry(CITY_GEOMETRY_SIZE.width, CITY_GEOMETRY_SIZE.height),
    []
  );

  // 材质
  const materials = useMemo(() => {
    const common = { transparent: true, opacity: BASE_OPACITY, side: THREE.DoubleSide, fog: false };
    return {
      day: new THREE.MeshBasicMaterial({ ...common, map: dayTexture }),
      night: new THREE.MeshBasicMaterial({ ...common, map: nightTexture }),
      sky: new THREE.MeshBasicMaterial({ ...common, map: skyTexture }),
      cloud: new THREE.MeshBasicMaterial({ ...common, map: cloudTexture, opacity: 0.8 }),
      city: new THREE.MeshBasicMaterial({
        ...common,
        map: cityTexture,
        opacity: 1.0,
        transparent: true,
        toneMapped: false,
        fog: false  // 禁用雾效，确保城市清晰可见
      })
    };
  }, [dayTexture, nightTexture, skyTexture, cityTexture]);

  // 动画帧更新
  useFrame((_state, delta) => {
    // 日夜交替逻辑 (非飞行模式)
    if (!isFlyMode && !isDroneMode) {
      timeRef.current += delta;
      const halfCycle = CYCLE_DURATION / 2;
      const currentPhase = timeRef.current % CYCLE_DURATION;

      if (currentPhase < halfCycle) {
        transitionRef.current = currentPhase < TRANSITION_DURATION
          ? currentPhase / TRANSITION_DURATION : 1;
      } else {
        const nightPhase = currentPhase - halfCycle;
        transitionRef.current = nightPhase < TRANSITION_DURATION
          ? 1 - (nightPhase / TRANSITION_DURATION) : 0;
      }

      materials.day.opacity = BASE_OPACITY * transitionRef.current;
      materials.night.opacity = BASE_OPACITY * (1 - transitionRef.current);
    }

    // 移动更新
    if (!isMoving) return;

    const divisor = (isFlyMode || isDroneMode) ? CITY_PARALLAX_DIVISOR : PARALLAX_DIVISOR;
    offsetRef.current += delta * (speed / divisor);

    if (isDroneMode || isFlyMode) {
      cityTexture.offset.x = offsetRef.current * 0.15;  // 稍微加快移动
    } else {
      dayTexture.offset.x = -offsetRef.current;
      nightTexture.offset.x = -offsetRef.current;
      skyTexture.offset.x = -offsetRef.current;
    }
  });

  const yPosition = Y_POSITIONS[currentMode] ?? 5;

  // Drone模式和Flight模式渲染
  if (isDroneMode || isFlyMode) {
    const cityScale = isDroneMode ? SCALE.drone : SCALE.flight;
    const cloudScale = 0.8;
    const cityY = isDroneMode ? yPosition + 35 : yPosition;  // Drone模式城市稍微低一点
    if (isDroneMode) {
      return (<group>
        {/* 云背景 */}
        <mesh
          geometry={geometry}
          material={materials.cloud}
          position={[10, cityY - 55, -69]}
          scale={[cloudScale, cloudScale, cloudScale]}
        />
        {/* 城市背景 */}
        <mesh
          geometry={cityGeometry}
          material={materials.city}
          position={[0, cityY, CITY_Z_POSITION]}
          scale={[cityScale, cityScale, cityScale]}
        />
      </group>
      );
    } else {
      return (<group>
        {/* 天空背景 */}
        <mesh
          geometry={geometry}
          material={materials.sky}
          position={[0, yPosition + 15, SKY_Z_POSITION]}
          scale={[4, 3, 1]}
        />
      </group>
      );
    }
  }

  // 普通模式渲染
  return (
    <>
      <mesh
        geometry={geometry}
        material={materials.night}
        position={[0, yPosition, Z_POSITION]}
        scale={[SCALE.normal, SCALE.normal, SCALE.normal]}
      />
      <mesh
        geometry={geometry}
        material={materials.day}
        position={[0, yPosition, Z_POSITION + 0.01]}
        scale={[SCALE.normal, SCALE.normal, SCALE.normal]}
      />
    </>
  );
}