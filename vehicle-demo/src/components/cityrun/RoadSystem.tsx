import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface RoadSystemProps {
  isMoving: boolean;
}

export default function RoadSystem({ isMoving }: RoadSystemProps) {
  const roadGroupRef = useRef<THREE.Group>(null);
  const offsetRef = useRef(0);

  // 加载道路纹理
  const roadTexture = useLoader(THREE.TextureLoader, '/assets/road.jpeg');

  // 配置纹理
  useMemo(() => {
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, 20); // 横向2次，纵向20次
  }, [roadTexture]);

  useFrame((_state, delta) => {
    if (!isMoving) return;

    // 更新道路偏移
    offsetRef.current += delta * 0.5;
    roadTexture.offset.y = offsetRef.current;
  });

  const roadWidth = 12;
  const roadLength = 300;

  return (
    <group ref={roadGroupRef} position={[0, -4, 0]}>
      {/* 主道路 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -roadLength / 2]}>
        <planeGeometry args={[roadWidth, roadLength]} />
        <meshBasicMaterial map={roadTexture} />
      </mesh>

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
