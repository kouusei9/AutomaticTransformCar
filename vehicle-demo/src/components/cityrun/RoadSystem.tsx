import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface RoadSystemProps {
  isMoving: boolean;
  speed?: number;
  currentMode?: number;
}

export default function RoadSystem({ isMoving, speed = 1, currentMode = 1 }: RoadSystemProps) {
  const roadGroupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(0);

  // 加载道路纹理
  const roadTexture = useLoader(THREE.TextureLoader, '/assets/road_normal.jpeg');
  const roadHighwayTexture = useLoader(THREE.TextureLoader, '/assets/road_highway03.png');
  const roadDroneTexture = useLoader(THREE.TextureLoader, '/assets/road_fly.png'); // 桂馬和飛車共用飞行纹理
  const roadFlyTexture = useLoader(THREE.TextureLoader, '/assets/road_fly.png');
  const greenbeltTexture = useLoader(THREE.TextureLoader, '/assets/haystack_short.png');

  // 配置纹理
  useMemo(() => {
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 20); // 横向2次，纵向20次

    roadHighwayTexture.wrapS = THREE.RepeatWrapping;
    roadHighwayTexture.wrapT = THREE.RepeatWrapping;
    roadHighwayTexture.repeat.set(1, 20);

    roadDroneTexture.wrapS = THREE.RepeatWrapping;
    roadDroneTexture.wrapT = THREE.RepeatWrapping;
    roadDroneTexture.repeat.set(1, 20);

    roadFlyTexture.wrapS = THREE.RepeatWrapping;
    roadFlyTexture.wrapT = THREE.RepeatWrapping;
    roadFlyTexture.repeat.set(1, 20);

    greenbeltTexture.wrapS = THREE.RepeatWrapping;
    greenbeltTexture.wrapT = THREE.RepeatWrapping;
    greenbeltTexture.repeat.set(60, 1); // 沿道路方向重复60次，高度方向1次
    greenbeltTexture.needsUpdate = true;
  }, [roadTexture, roadHighwayTexture, roadDroneTexture, roadFlyTexture, greenbeltTexture]);

  // 创建翻转的绿化带纹理用于右侧
  const greenbeltTextureFlipped = useMemo(() => {
    const flipped = greenbeltTexture.clone();
    flipped.wrapS = THREE.RepeatWrapping;
    flipped.wrapT = THREE.RepeatWrapping;
    flipped.repeat.set(-60, 1); // 负数表示翻转
    flipped.needsUpdate = true;
    return flipped;
  }, [greenbeltTexture]);

  useFrame((_state, delta) => {
    if (!isMoving) return;

    // 更新道路偏移 - 根据速度倍率调整
    offsetRef.current += delta * 0.5 * speed;
    roadTexture.offset.y = offsetRef.current;
    roadHighwayTexture.offset.y = offsetRef.current;
    roadDroneTexture.offset.y = offsetRef.current;
    roadFlyTexture.offset.y = offsetRef.current;

    // 更新绿化带偏移（同步移动）
    greenbeltTexture.offset.x = offsetRef.current;
    greenbeltTextureFlipped.offset.x = offsetRef.current;
  });

  // fly 模式下道路宽度覆盖整个屏幕
  const isFlyMode = currentMode === 4;
  const roadWidth = isFlyMode ? 100 : 12;
  const roadLength = 300;
  const greenbeltHeight = 1; // 绿化带高度

  // 根据当前模式选择道路纹理和材质属性
  const currentRoadTexture = currentMode === 2
    ? roadHighwayTexture   // 香車 - 高速公路
    : currentMode === 3
      ? roadHighwayTexture   // 桂馬 - 使用高速公路纹理
      : currentMode === 4
        ? roadFlyTexture       // 飛車 - 高空飞行
        : roadTexture;         // 金将 - 普通道路

  // drone 模式下使用赛博风格（半透明蓝色）
  const isDroneMode = false; // 桁模式不再使用透明效果
  const roadOpacity = isDroneMode ? 0.6 : 1.0;
  const roadColor = isDroneMode ? new THREE.Color(0x00d4ff) : new THREE.Color(0xffffff);

  return (
    <group ref={roadGroupRef} position={[0, -4, 0]}>
      {/* 主道路 */}
      {!isDroneMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -roadLength / 2]}>
          <planeGeometry args={[roadWidth, roadLength]} />
          <meshBasicMaterial
            map={currentRoadTexture}
            transparent={isDroneMode}
            opacity={roadOpacity}
            color={roadColor}
          />
        </mesh>
      )}


      {/* 左侧绿化带（垂直站立）- drone模式下隐藏 */}
      {!isDroneMode && !isFlyMode && (
        <mesh rotation={[0, Math.PI / 2, 0]} position={[-(roadWidth / 2 + 0.1), greenbeltHeight / 2, -roadLength / 2]}>
          <planeGeometry args={[roadLength, greenbeltHeight]} />
          <meshBasicMaterial
            map={greenbeltTexture}
            transparent={true}
            side={THREE.DoubleSide}
            alphaTest={0.5}
          />
        </mesh>
      )}

      {/* 右侧绿化带（垂直站立）- drone模式下隐藏 */}
      {!isDroneMode && !isFlyMode && (
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[roadWidth / 2 + 0.1, greenbeltHeight / 2, -roadLength / 2]}>
          <planeGeometry args={[roadLength, greenbeltHeight]} />
          <meshBasicMaterial
            map={greenbeltTextureFlipped}
            transparent={true}
            side={THREE.DoubleSide}
            alphaTest={0.5}
          />
        </mesh>
      )}

      {/* 左侧霓虹边缘线 */}
      <mesh position={[-roadWidth / 2, 0.02, -roadLength / 2]}>
        <boxGeometry args={[0.2, 0.1, roadLength]} />
        <meshBasicMaterial color={0x00d4ff} />
      </mesh>

      {/* 右侧霓虹边缘线 */}
      <mesh position={[roadWidth / 2, 0.02, -roadLength / 2]}>
        <boxGeometry args={[0.2, 0.1, roadLength]} />
        <meshBasicMaterial color={0x00d4ff} />
      </mesh>
    </group>
  );
}
