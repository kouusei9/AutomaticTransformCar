import { useRef, useEffect } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface FirstPersonViewProps {
  isTransitioning?: boolean;
  isEntering?: boolean;
}

export default function FirstPersonView({ isTransitioning = false, isEntering = true }: FirstPersonViewProps) {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const animationProgress = useRef(0);
  const initialOpacity = useRef(isEntering ? 0 : 1); // 初始透明度：进入时从0开始，退出时从1开始

  // 加载车内仪表盘纹理
  const dashboardTexture = useLoader(THREE.TextureLoader, '/assets/car_inside_new.png');

  // 仪表盘位置（固定在相机前方）
  // car03.png 原始尺寸为 1920x1080，比例为 16:9
  const aspectRatio = 16 / 9;
  const dashboardHeight = 3.5;
  const dashboardWidth = dashboardHeight * aspectRatio; // 保持原始宽高比
  const dashboardDistance = 2;

  // 动画参数
  const ANIMATION_DURATION = 1.0; // 1秒动画时长
  const EXIT_OFFSET = -5; // 退出时向下移动的距离
  const ENTER_OFFSET = -5; // 进入时从下方开始的距离

  // 重置动画进度
  useEffect(() => {
    if (isTransitioning) {
      animationProgress.current = 0;
      initialOpacity.current = isEntering ? 0 : 1;

      // 立即设置初始透明度
      if (meshRef.current) {
        const material = meshRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = initialOpacity.current;
      }
    }
  }, [isTransitioning, isEntering]);

  // 动画更新
  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    if (isTransitioning) {
      // 更新动画进度
      animationProgress.current = Math.min(1, animationProgress.current + delta / ANIMATION_DURATION);

      const progress = animationProgress.current;
      // 使用缓动函数（ease-in-out）
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (isEntering) {
        // 进入动画：从下方上升到正常位置
        const offsetY = ENTER_OFFSET * (1 - easeProgress);
        meshRef.current.position.y = camera.position.y + 0.5 + offsetY;
      } else {
        // 退出动画：从正常位置下降
        const offsetY = EXIT_OFFSET * easeProgress;
        meshRef.current.position.y = camera.position.y + 0.5 + offsetY;
      }

      // 根据动画进度调整透明度，避免闪现
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      if (isEntering) {
        // 进入时逐渐显示
        material.opacity = easeProgress;
      } else {
        // 退出时逐渐隐藏
        material.opacity = 1 - easeProgress;
      }
    } else {
      // 静态位置
      meshRef.current.position.y = camera.position.y + 0.5;
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 1.0;
    }

    // 保持仪表盘跟随相机 X 和 Z 位置
    meshRef.current.position.x = camera.position.x;
    meshRef.current.position.z = camera.position.z - dashboardDistance;
  });

  return (
    <group>
      {/* 仪表盘平面（附着在相机上） */}
      <mesh
        ref={meshRef}
        position={[
          camera.position.x,
          camera.position.y + 0.5,
          camera.position.z - dashboardDistance,
        ]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[dashboardWidth, dashboardHeight]} />
        <meshBasicMaterial
          map={dashboardTexture}
          transparent
          opacity={isTransitioning && !isEntering ? 0 : (isTransitioning && isEntering ? 0 : 1.0)}
        />
      </mesh>

      {/* 仪表盘底部霓虹光效 */}
      <pointLight
        position={[camera.position.x, camera.position.y - 0.6, camera.position.z - 1]}
        color={0x00d4ff}
        intensity={0.5}
        distance={3}
      />
    </group>
  );
}
