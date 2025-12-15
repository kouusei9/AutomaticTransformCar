/**
 * 火焰粒子系统组件
 * 用于飞行模式（无人机/飞机）的推进效果
 */

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface FlameParticlesProps {
  visible: boolean
  position: THREE.Vector3
  tangent: THREE.Vector3
  vehicleScale: number
  particleCount?: number
  speed?: number
}

export const FlameParticles: React.FC<FlameParticlesProps> = ({
  visible,
  position,
  tangent,
  vehicleScale,
  particleCount = 30,
  speed = 4.0
}) => {
  const pointsRef = useRef<THREE.Points>(null)

  // 创建粒子系统
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const lifetimes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      lifetimes[i] = Math.random()
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1))

    const mat = new THREE.PointsMaterial({
      color: 0xff3300,
      size: 0.5,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [particleCount])

  // 清理资源
  React.useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // 更新粒子
  useFrame((_state, delta) => {
    if (!pointsRef.current || !visible) return

    const positions = geometry.attributes.position.array as Float32Array
    const lifetimes = geometry.attributes.lifetime.array as Float32Array

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3

      // 更新生命周期
      lifetimes[i] -= delta * 3

      // 重置粒子
      if (lifetimes[i] <= 0) {
        const spawnOffset = tangent.clone().multiplyScalar(-vehicleScale * 0.3)

        positions[i3] = position.x + spawnOffset.x + (Math.random() - 0.5) * 1.5
        positions[i3 + 1] = position.y + (Math.random() - 0.5) * 1.5
        positions[i3 + 2] = position.z + spawnOffset.z + (Math.random() - 0.5) * 1.5

        lifetimes[i] = 0.3 + Math.random() * 0.3
      } else {
        // 向后喷射
        const flameDirection = tangent.clone().multiplyScalar(-speed * delta * 8)
        positions[i3] += flameDirection.x
        positions[i3 + 1] += flameDirection.y
        positions[i3 + 2] += flameDirection.z

        // 随机扩散
        positions[i3] += (Math.random() - 0.5) * delta * 3
        positions[i3 + 1] += (Math.random() - 0.5) * delta * 3
        positions[i3 + 2] += (Math.random() - 0.5) * delta * 3
      }
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.lifetime.needsUpdate = true
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      visible={visible}
    />
  )
}
