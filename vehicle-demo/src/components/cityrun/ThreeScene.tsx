import { Canvas } from '@react-three/fiber';
import { ReactNode } from 'react';

interface ThreeSceneProps {
  children: ReactNode;
  cameraPosition?: [number, number, number]; // 相机位置
}

export default function ThreeScene({ children, cameraPosition = [0, -1, 5] }: ThreeSceneProps) {
  // 检测是否为iPad，降低渲染质量以提升性能
  const isIPad = typeof navigator !== 'undefined' && (
    /iPad/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
  );

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 75 }}
      gl={{
        antialias: !isIPad, // iPad关闭抗锯齿以提升性能
        toneMapping: 0, // NoToneMapping - 不进行色调映射
        toneMappingExposure: 1,
        powerPreference: 'high-performance', // 优先使用高性能GPU
        alpha: false, // 禁用透明度以提升性能
      }}
      dpr={isIPad ? [1, 1.5] : [1, 2]} // iPad限制像素比
      performance={{ min: 0.5 }} // 性能优化：帧率过低时自动降级
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

