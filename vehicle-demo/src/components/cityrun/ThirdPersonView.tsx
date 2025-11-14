import { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface ThirdPersonViewProps {
  isMoving: boolean;
  isTransformed: boolean;
}

export default function ThirdPersonView({ isMoving, isTransformed }: ThirdPersonViewProps) {
  const carRef = useRef<THREE.Sprite>(null);

  // 加载车辆背面纹理
  const carTexture = useLoader(THREE.TextureLoader, '/assets/car_back.png');
  const highCarTexture = useLoader(THREE.TextureLoader, '/assets/high_car_back.png');

  // 根据变形状态选择纹理
  const currentTexture = isTransformed ? highCarTexture : carTexture;
  
  // 根据纹理图片的实际尺寸计算宽高比
  const textureAspectRatio = currentTexture.image 
    ? currentTexture.image.width / currentTexture.image.height 
    : 1.5; // 默认比例
  
  // 设置车辆高度，宽度根据比例自动计算
  const carHeight = 2;
  const carWidth = carHeight * textureAspectRatio;

  // 车辆摇晃动画
  useFrame((state) => {
    if (carRef.current && isMoving) {
      // 轻微的上下晃动
      carRef.current.position.y = -2.5 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      // 轻微的左右晃动
      carRef.current.position.x = Math.sin(state.clock.elapsedTime * 2) * 0.03;
    }
    
    // 不修改相机位置，保持和第一人称相同的相机设置
  });

  return (
    <group>
      {/* 车辆精灵 */}
      <sprite ref={carRef} position={[0, -3, 0]} scale={[carWidth, carHeight, 1]}>
        <spriteMaterial map={currentTexture} transparent />
      </sprite>

      {/* 车辆周围的霓虹光晕 */}
      <pointLight position={[0, -3, 0]} color={0x00d4ff} intensity={1} distance={5} />
      <pointLight position={[-1, -3.5, 0]} color={0xff00ff} intensity={0.5} distance={3} />
      <pointLight position={[1, -3.5, 0]} color={0xff00ff} intensity={0.5} distance={3} />

      {/* 车底霓虹灯效果 */}
      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.5, 32]} />
        <meshBasicMaterial color={0x00d4ff} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
