import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface MiddleSceneryProps {
  isMoving: boolean;
  speed?: number;
}

export default function MiddleScenery({ isMoving, speed = 50 }: MiddleSceneryProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // 加载中景纹理
  const middleTexture = useLoader(THREE.TextureLoader, '/assets/view_middle.png');

  // 配置纹理
  useMemo(() => {
    middleTexture.wrapS = THREE.RepeatWrapping;
    middleTexture.wrapT = THREE.RepeatWrapping;
    middleTexture.repeat.set(3, 1); // 横向重复3次
  }, [middleTexture]);

  const offsetRef = useRef(0);

  useFrame((_state, delta) => {
    if (!isMoving) return;

    // 中景移动速度是近景的一半（视差效果）
    offsetRef.current += delta * (speed / 200);
    middleTexture.offset.x = -offsetRef.current;
  });

  // 中景几何体和材质
  const geometry = useMemo(() => new THREE.PlaneGeometry(200, 40), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: middleTexture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
    [middleTexture]
  );

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      material={material} 
      position={[0, 5, -50]} 
      rotation={[0, 0, 0]}
    />
  );
}
