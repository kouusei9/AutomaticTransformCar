import { useLoader } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function FirstPersonView() {
  const { camera } = useThree();

  // 加载车内仪表盘纹理
  const dashboardTexture = useLoader(THREE.TextureLoader, '/assets/car_inside.png');

  // 仪表盘位置（固定在相机前方）
  // car03.png 原始尺寸为 1920x1080，比例为 16:9
  const aspectRatio = 16 / 9;
  const dashboardHeight = 3.5;
  const dashboardWidth = dashboardHeight * aspectRatio; // 保持原始宽高比
  const dashboardDistance = 2;

  return (
    <group>
      {/* 仪表盘平面（附着在相机上） */}
      <mesh
        position={[
          camera.position.x,
          camera.position.y+0.5,
          camera.position.z - dashboardDistance,
        ]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[dashboardWidth, dashboardHeight]} />
        <meshBasicMaterial map={dashboardTexture} transparent opacity={1.0} />
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
