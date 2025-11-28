/**
 * 风粒子系统组件
 * 用于地面车辆行驶时的风效果
 */

import React, { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface WindParticlesProps {
  visible: boolean
  position: THREE.Vector3
  tangent: THREE.Vector3
  particleCount?: number
  speed?: number
}

export const WindParticles: React.FC<WindParticlesProps> = ({
  visible,
  position,
  tangent,
  particleCount = 50,
  speed = 2.0
}) => {
  const pointsRef = useRef<THREE.Points>(null)

  // 创建粒子系统
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const lifetimes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10
      positions[i * 3 + 1] = Math.random() * 5
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
      lifetimes[i] = Math.random()
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1))

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
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
      lifetimes[i] -= delta * 2

      // 重置粒子
      if (lifetimes[i] <= 0) {
        const spawnDistance = 5
        const spawnOffset = tangent.clone().multiplyScalar(-spawnDistance)

        positions[i3] = position.x + spawnOffset.x + (Math.random() - 0.5) * 3
        positions[i3 + 1] = position.y + (Math.random() - 0.5) * 2
        positions[i3 + 2] = position.z + spawnOffset.z + (Math.random() - 0.5) * 3

        lifetimes[i] = 0.5 + Math.random() * 0.5
      } else {
        // 向后移动
        const windDirection = tangent.clone().multiplyScalar(-speed * delta * 10)
        positions[i3] += windDirection.x
        positions[i3 + 1] += windDirection.y - delta * 2
        positions[i3 + 2] += windDirection.z
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
