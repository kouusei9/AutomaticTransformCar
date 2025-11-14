import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface FarSceneryProps {
  isMoving: boolean;
  speed?: number;
}

export default function FarScenery({ isMoving, speed = 50 }: FarSceneryProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 加载远景纹理（天空/太阳）
  const farTexture = useLoader(THREE.TextureLoader, '/assets/sunshine.png');

  // 配置纹理
  useMemo(() => {
    farTexture.wrapS = THREE.RepeatWrapping;
    farTexture.wrapT = THREE.ClampToEdgeWrapping;
    farTexture.repeat.set(1, 1); // 横向重复2次
  }, [farTexture]);

  const offsetRef = useRef(0);

  useFrame((_state, delta) => {
    if (!isMoving) return;

    // 远景移动速度最慢（视差效果）
    offsetRef.current += delta * (speed / 400);
    farTexture.offset.x = -offsetRef.current;
  });

  // 远景几何体和材质 - 作为背景天空
  const geometry = useMemo(() => new THREE.PlaneGeometry(400, 200), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: farTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      }),
    [farTexture]
  );

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      material={material} 
      position={[0, 30, -90]} 
      rotation={[0, 0, 0]}
    />
  );
}
