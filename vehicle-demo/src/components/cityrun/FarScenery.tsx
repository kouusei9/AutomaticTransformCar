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

  // 配置纹理 - 按图片原始比例显示
  useMemo(() => {
    farTexture.wrapS = THREE.ClampToEdgeWrapping;
    farTexture.wrapT = THREE.ClampToEdgeWrapping;
    farTexture.repeat.set(1, 1);
  }, [farTexture]);

  const offsetRef = useRef(0);

  useFrame((_state, delta) => {
    if (!isMoving) return;

    // 远景移动速度最慢（视差效果）
    offsetRef.current += delta * (speed / 400);
    farTexture.offset.x = -offsetRef.current;
  });

  // 远景几何体和材质 - 作为背景天空
  // 根据纹理的宽高比计算几何体尺寸
  const geometry = useMemo(() => {
    const imageAspect = farTexture.image ? farTexture.image.width / farTexture.image.height : 2;
    const height = 400;
    const width = height * imageAspect;
    return new THREE.PlaneGeometry(width, height);
  }, [farTexture]);
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
      position={[0, 5, -90]} 
      rotation={[0, 0, 0]}
    />
  );
}
