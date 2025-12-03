/**
 * 路线起点和终点标志组件
 * 未来科技感的全息标记
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

interface RouteMarkersProps {
  startPosition: THREE.Vector3
  endPosition: THREE.Vector3
  startName?: string
  endName?: string
}

export function RouteMarkers({
  startPosition,
  endPosition,
  startName = 'START',
  endName = 'DESTINATION'
}: RouteMarkersProps) {
  return (
    <>
      <Marker 
        position={startPosition} 
        label={startName} 
        color="#00ff00"
        type="start"
      />
      <Marker 
        position={endPosition} 
        label={endName} 
        color="#ff00ff"
        type="end"
      />
    </>
  )
}

interface MarkerProps {
  position: THREE.Vector3
  label: string
  color: string
  type: 'start' | 'end'
}

function Marker({ position, label, color, type }: MarkerProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const pulseRef = useRef(0)
  const rotationRef = useRef(0)

  // 创建粒子环
  const particles = useMemo(() => {
    const particleCount = 20
    const points = []
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2
      const radius = 2
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        )
      )
    }
    return points
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // 旋转动画
    rotationRef.current += delta * 0.5
    groupRef.current.rotation.y = rotationRef.current

    // 脉冲动画
    pulseRef.current += delta * 2
    const scale = 1 + Math.sin(pulseRef.current) * 0.1
    groupRef.current.scale.setScalar(scale)
  })

  return (
    <group ref={groupRef} position={position}>
      {/* 底部光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 内部光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 中心标志 */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.5, 0.8, 0.3, 6]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.6}
          wireframe
        />
      </mesh>

      {/* 垂直光柱 */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.1, 0.3, 6, 8]} />
        <meshBasicMaterial 
          color={color} 
          transparent 
          opacity={0.3}
        />
      </mesh>

      {/* 顶部图标 */}
      <mesh position={[0, 6, 0]} rotation={[0, 0, type === 'start' ? 0 : Math.PI]}>
        <coneGeometry args={[0.5, 1, 3]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* 文字标签 */}
      <Text
        position={[0, 7, 0]}
        fontSize={0.6}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
        font="/fonts/NotoSansJP-Regular.otf"
      >
        {label}
      </Text>

      {/* 粒子环 */}
      {particles.map((point, index) => (
        <mesh key={index} position={[point.x, 0.5 + Math.sin(pulseRef.current + index) * 0.3, point.z]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.8}
          />
        </mesh>
      ))}

      {/* 扫描线 */}
      <group rotation={[0, rotationRef.current * 2, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh 
            key={i} 
            position={[2, 0.3 + i * 2, 0]} 
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
            <meshBasicMaterial 
              color={color} 
              transparent 
              opacity={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* 点光源 */}
      <pointLight 
        color={color} 
        intensity={2} 
        distance={10} 
        position={[0, 3, 0]}
      />
    </group>
  )
}
