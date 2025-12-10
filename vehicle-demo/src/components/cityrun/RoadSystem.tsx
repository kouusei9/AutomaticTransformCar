import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleMode } from '../../types/vehicleMode';

// ===== 类型定义 =====
interface RoadSystemProps {
  isMoving: boolean;
  speed?: number;
  currentMode?: VehicleMode;
}

// ===== 常量定义 =====
// 道路纹理路径
const ROAD_TEXTURE_PATHS = {
  normal: '/assets/road_normal.jpeg',
  highway: '/assets/road_highway03.png',
  fly: '/assets/road_fly.png'
} as const;

// 绿化带纹理路径
const GREENBELT_TEXTURE_PATH = '../assets/haystack_short.png';
type RoadTextureKey = keyof typeof ROAD_TEXTURE_PATHS;

const ROAD_TEXTURE_REPEAT = { x: 1, y: 20 };
const GREENBELT_REPEAT = 60;

const ROAD_DIMENSIONS = {
  normal: { width: 12, length: 300 },
  flight: { width: 100, length: 300 }
} as const;

const GREENBELT_HEIGHT = 1;
const EDGE_LINE_WIDTH = 0.2;
const EDGE_LINE_HEIGHT = 0.1;
const NEON_COLOR = 0x00d4ff;

const GROUP_Y_POSITION = -4;

// 模式对应的道路纹理
const MODE_TEXTURES: Record<VehicleMode, RoadTextureKey> = {
  [VehicleMode.NORMAL]: 'normal',
  [VehicleMode.HIGHWAY]: 'highway',
  [VehicleMode.DRONE]: 'highway',
  [VehicleMode.FLIGHT]: 'fly'
};

// ===== 子组件 =====
interface GreenbeltProps {
  roadWidth: number;
  roadLength: number;
  texture: THREE.Texture;
  flippedTexture: THREE.Texture;
}

function Greenbelt({ roadWidth, roadLength, texture, flippedTexture }: GreenbeltProps) {
  const xOffset = roadWidth / 2 + 0.1;
  const yPosition = GREENBELT_HEIGHT / 2;
  const zPosition = -roadLength / 2;

  return (
    <>
      {/* 左侧 */}
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[-xOffset, yPosition, zPosition]}
      >
        <planeGeometry args={[roadLength, GREENBELT_HEIGHT]} />
        <meshBasicMaterial
          map={texture}
          transparent
          side={THREE.DoubleSide}
          alphaTest={0.5}
        />
      </mesh>

      {/* 右侧 */}
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[xOffset, yPosition, zPosition]}
      >
        <planeGeometry args={[roadLength, GREENBELT_HEIGHT]} />
        <meshBasicMaterial
          map={flippedTexture}
          transparent
          side={THREE.DoubleSide}
          alphaTest={0.5}
        />
      </mesh>
    </>
  );
}

interface NeonEdgeLinesProps {
  roadWidth: number;
  roadLength: number;
}

function NeonEdgeLines({ roadWidth, roadLength }: NeonEdgeLinesProps) {
  const xOffset = roadWidth / 2;
  const zPosition = -roadLength / 2;

  return (
    <>
      <mesh position={[-xOffset, 0.02, zPosition]}>
        <boxGeometry args={[EDGE_LINE_WIDTH, EDGE_LINE_HEIGHT, roadLength]} />
        <meshBasicMaterial color={NEON_COLOR} />
      </mesh>
      <mesh position={[xOffset, 0.02, zPosition]}>
        <boxGeometry args={[EDGE_LINE_WIDTH, EDGE_LINE_HEIGHT, roadLength]} />
        <meshBasicMaterial color={NEON_COLOR} />
      </mesh>
    </>
  );
}

// ===== 主组件 =====
export default function RoadSystem({
  isMoving,
  speed = 1,
  currentMode = VehicleMode.NORMAL
}: RoadSystemProps) {
  const roadGroupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(0);

  const isFlyMode = currentMode === VehicleMode.FLIGHT;

  // 加载纹理（必须在条件渲染之前）
  const roadTexture = useLoader(THREE.TextureLoader, ROAD_TEXTURE_PATHS.normal);
  const roadHighwayTexture = useLoader(THREE.TextureLoader, ROAD_TEXTURE_PATHS.highway);
  const roadFlyTexture = useLoader(THREE.TextureLoader, ROAD_TEXTURE_PATHS.fly);
  const greenbeltTexture = useLoader(THREE.TextureLoader, GREENBELT_TEXTURE_PATH);

  // 配置道路纹理
  useEffect(() => {
    const roadTextures = [roadTexture, roadHighwayTexture, roadFlyTexture];
    roadTextures.forEach(texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(ROAD_TEXTURE_REPEAT.x, ROAD_TEXTURE_REPEAT.y);
    });

    greenbeltTexture.wrapS = THREE.RepeatWrapping;
    greenbeltTexture.wrapT = THREE.RepeatWrapping;
    greenbeltTexture.repeat.set(GREENBELT_REPEAT, 1);
    greenbeltTexture.needsUpdate = true;
  }, [roadTexture, roadHighwayTexture, roadFlyTexture, greenbeltTexture]);

  // 创建翻转的绿化带纹理
  const greenbeltTextureFlipped = useMemo(() => {
    const flipped = greenbeltTexture.clone();
    flipped.wrapS = THREE.RepeatWrapping;
    flipped.wrapT = THREE.RepeatWrapping;
    flipped.repeat.set(-GREENBELT_REPEAT, 1);
    flipped.needsUpdate = true;
    return flipped;
  }, [greenbeltTexture]);

  // 纹理映射
  const textureMap = useMemo(() => ({
    normal: roadTexture,
    highway: roadHighwayTexture,
    fly: roadFlyTexture
  }), [roadTexture, roadHighwayTexture, roadFlyTexture]);

  // 当前道路纹理
  const currentRoadTexture = textureMap[MODE_TEXTURES[currentMode]];

  // 道路尺寸
  const roadWidth = isFlyMode ? ROAD_DIMENSIONS.flight.width : ROAD_DIMENSIONS.normal.width;
  const roadLength = ROAD_DIMENSIONS.normal.length;

  // 动画更新
  useFrame((_state, delta) => {
    if (!isMoving) return;

    offsetRef.current += delta * 0.5 * speed;

    // 更新所有道路纹理偏移
    roadTexture.offset.y = offsetRef.current;
    roadHighwayTexture.offset.y = offsetRef.current;
    roadFlyTexture.offset.y = offsetRef.current;

    // 更新绿化带偏移
    greenbeltTexture.offset.x = offsetRef.current;
    greenbeltTextureFlipped.offset.x = offsetRef.current;
  });

  // 飞行模式不显示道路系统
  if (isFlyMode) {
    return null;
  }

  return (
    <group ref={roadGroupRef} position={[0, GROUP_Y_POSITION, 0]}>
      {/* 主道路 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, -roadLength / 2]}
      >
        <planeGeometry args={[roadWidth, roadLength]} />
        <meshBasicMaterial map={currentRoadTexture} />
      </mesh>

      {/* 绿化带 */}
      <Greenbelt
        roadWidth={roadWidth}
        roadLength={roadLength}
        texture={greenbeltTexture}
        flippedTexture={greenbeltTextureFlipped}
      />

      {/* 霓虹边缘线 */}
      <NeonEdgeLines roadWidth={roadWidth} roadLength={roadLength} />
    </group>
  );
}