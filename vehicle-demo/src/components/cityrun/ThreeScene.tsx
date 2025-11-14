import { Canvas } from '@react-three/fiber';
import { ReactNode } from 'react';

interface ThreeSceneProps {
  children: ReactNode;
}

export default function ThreeScene({ children }: ThreeSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, -1, 5], fov: 75 }}
      gl={{ 
        antialias: true,
        toneMapping: 0, // NoToneMapping - 不进行色调映射
        toneMappingExposure: 1,
      }}
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%', 
        height: '100%' 
      }}
    >
      {/* 场景背景和雾效 */}
      <color attach="background" args={['#050510']} />
      <fog attach="fog" args={['#050510', 80, 200]} />

      {/* 子组件 */}
      {children}
    </Canvas>
  );
}

