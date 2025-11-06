import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

interface LocationMarkerProps {
  position: [number, number, number]
  name: string
  color?: string
  scale?: number
}

export const LocationMarker: React.FC<LocationMarkerProps> = ({
  position,
  name,
  color = '#00ffff',
  scale = 1.0
}) => {
  const markerRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  
  const markerMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9
    })
  }, [color])
  
  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
  }, [color])
  
  useFrame((state) => {
    if (markerRef.current && glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.2 + 1.0
      markerRef.current.scale.setScalar(scale * pulse)
      glowRef.current.scale.setScalar(scale * pulse * 1.5)
      glowRef.current.rotation.z += 0.01
    }
  })
  
  return (
    <group position={position}>
      <mesh ref={markerRef} position={[0, 2, 0]}>
        <sphereGeometry args={[0.8 * scale, 16, 16]} />
        <primitive object={markerMaterial} attach="material" />
      </mesh>
      
      <mesh ref={glowRef} position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0 * scale, 1.5 * scale, 32]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>
      
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.1 * scale, 0.1 * scale, 2, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      
      <Text
        position={[0, 3.5, 0]}
        fontSize={0.8 * scale}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.1}
        outlineColor="#000000"
      >
        {name}
      </Text>
    </group>
  )
}

export default LocationMarker