import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import useVehicleStore from '../../store/useVehicleStore';

const PathCurve = () => {
  const { route } = useVehicleStore();

  const points = useMemo(() => {
    if (route.path.length === 0) return [];
    return route.path.map(p => new THREE.Vector3(...p));
  }, [route.path]);

  if (points.length === 0) return null;

  return (
    <>
      {/* 主路径线 */}
      <Line
        points={points}
        color="#10b981"
        lineWidth={3}
        dashed={false}
      />
      
      {/* 起点标记 */}
      {route.start && (
        <mesh position={[...route.start]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
        </mesh>
      )}
      
      {/* 终点标记 */}
      {route.destination && (
        <mesh position={[...route.destination]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
      )}
    </>
  );
};

export default PathCurve;
