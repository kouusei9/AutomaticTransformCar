import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import useVehicleStore from '../store/useVehicleStore';

const CarModel = () => {
  const meshRef = useRef();
  const { vehicle, route, updateVehicleProgress } = useVehicleStore();
  const [targetIndex, setTargetIndex] = React.useState(0);
  const progressTimerRef = useRef(null);

  // 定期更新进度
  useEffect(() => {
    if (vehicle.isMoving && route.path.length > 0) {
      progressTimerRef.current = setInterval(() => {
        updateVehicleProgress();
      }, 1000); // 每秒更新一次距离和ETA
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [vehicle.isMoving, route.path.length, updateVehicleProgress]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (vehicle.isMoving && route.path.length > 0) {
      const target = route.path[targetIndex];
      if (target) {
        const [tx, ty, tz] = target;
        const [cx, cy, cz] = vehicle.position;

        // 移动到目标点
        const speed = 0.05;
        const dx = tx - cx;
        const dz = tz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.1) {
          if (targetIndex < route.path.length - 1) {
            setTargetIndex(targetIndex + 1);
          } else {
            useVehicleStore.getState().setVehicleMoving(false);
            setTargetIndex(0);
          }
        } else {
          const newX = cx + (dx / dist) * speed;
          const newZ = cz + (dz / dist) * speed;
          useVehicleStore.getState().setVehiclePosition([newX, cy, newZ]);

          // 旋转朝向目标
          const angle = Math.atan2(dx, dz);
          meshRef.current.rotation.y = angle;
        }
      }
    }

    meshRef.current.position.set(...vehicle.position);
  });

  return (
    <group ref={meshRef}>
      {/* 车身 */}
      <Box args={[1, 0.5, 2]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#3b82f6" />
      </Box>
      {/* 车顶 */}
      <Box args={[0.8, 0.4, 1]} position={[0, 0.45, -0.2]}>
        <meshStandardMaterial color="#1e40af" />
      </Box>
      {/* 车轮 */}
      <mesh position={[-0.4, -0.25, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.4, -0.25, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[-0.4, -0.25, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.4, -0.25, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
};

export default CarModel;
