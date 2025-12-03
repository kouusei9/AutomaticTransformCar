import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 车辆光尾粒子系统
 * 车辆经过时留下渐隐的光尾效果
 */
interface VehicleTrailProps {
  vehiclePosition: THREE.Vector3
  vehicleForward: THREE.Vector3
  color?: string
  maxParticles?: number
  particleSize?: number
  trailLength?: number
  emissionRate?: number
}

export const VehicleTrail: React.FC<VehicleTrailProps> = ({
  vehiclePosition,
  vehicleForward,
  color = '#00ffff',
  maxParticles = 50,
  particleSize = 0.5,
  trailLength = 10,
  emissionRate = 3
}) => {
  const pointsRef = useRef<THREE.Points>(null)
  const particlesRef = useRef<{
    positions: Float32Array
    velocities: Float32Array
    lifetimes: Float32Array
    sizes: Float32Array
    activeCount: number
    lastEmitTime: number
  }>({
    positions: new Float32Array(maxParticles * 3),
    velocities: new Float32Array(maxParticles * 3),
    lifetimes: new Float32Array(maxParticles),
    sizes: new Float32Array(maxParticles),
    activeCount: 0,
    lastEmitTime: 0
  })

  // 创建几何体
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(particlesRef.current.positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(particlesRef.current.sizes, 1))
    return geo
  }, [])

  // 发射新粒子
  const emitParticle = (position: THREE.Vector3, forward: THREE.Vector3) => {
    const particles = particlesRef.current
    if (particles.activeCount >= maxParticles) return

    const idx = particles.activeCount
    const i3 = idx * 3

    // 位置 - 在车辆后方
    particles.positions[i3] = position.x - forward.x * 2
    particles.positions[i3 + 1] = position.y + 0.5
    particles.positions[i3 + 2] = position.z - forward.z * 2

    // 速度 - 轻微向后扩散
    particles.velocities[i3] = -forward.x * 0.5 + (Math.random() - 0.5) * 0.2
    particles.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1
    particles.velocities[i3 + 2] = -forward.z * 0.5 + (Math.random() - 0.5) * 0.2

    // 生命周期
    particles.lifetimes[idx] = trailLength

    // 大小
    particles.sizes[idx] = particleSize * (0.5 + Math.random() * 0.5)

    particles.activeCount++
  }

  // 更新粒子
  useFrame((state, delta) => {
    const particles = particlesRef.current
    const currentTime = state.clock.elapsedTime

    // 发射新粒子
    if (currentTime - particles.lastEmitTime > 1 / emissionRate) {
      emitParticle(vehiclePosition, vehicleForward)
      particles.lastEmitTime = currentTime
    }

    // 更新现有粒子
    for (let i = particles.activeCount - 1; i >= 0; i--) {
      const i3 = i * 3

      // 更新位置
      particles.positions[i3] += particles.velocities[i3] * delta * 10
      particles.positions[i3 + 1] += particles.velocities[i3 + 1] * delta * 10
      particles.positions[i3 + 2] += particles.velocities[i3 + 2] * delta * 10

      // 减少生命周期
      particles.lifetimes[i] -= delta

      // 根据生命周期调整大小（渐隐效果）
      const lifeRatio = particles.lifetimes[i] / trailLength
      particles.sizes[i] = particleSize * lifeRatio

      // 移除死亡粒子
      if (particles.lifetimes[i] <= 0) {
        // 将最后一个粒子移到当前位置
        if (i < particles.activeCount - 1) {
          const lastIdx = particles.activeCount - 1
          const last3 = lastIdx * 3

          particles.positions[i3] = particles.positions[last3]
          particles.positions[i3 + 1] = particles.positions[last3 + 1]
          particles.positions[i3 + 2] = particles.positions[last3 + 2]

          particles.velocities[i3] = particles.velocities[last3]
          particles.velocities[i3 + 1] = particles.velocities[last3 + 1]
          particles.velocities[i3 + 2] = particles.velocities[last3 + 2]

          particles.lifetimes[i] = particles.lifetimes[lastIdx]
          particles.sizes[i] = particles.sizes[lastIdx]
        }
        particles.activeCount--
      }
    }

    // 更新几何体
    if (pointsRef.current) {
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.size.needsUpdate = true
      geometry.setDrawRange(0, particles.activeCount)
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={particleSize}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/**
 * 增强版车辆光尾
 * 包含多层粒子效果
 */
interface EnhancedVehicleTrailProps {
  vehiclePosition: THREE.Vector3
  vehicleForward: THREE.Vector3
  edgeType?: 'road' | 'highway' | 'drone' | 'sky'
}

export const EnhancedVehicleTrail: React.FC<EnhancedVehicleTrailProps> = ({
  vehiclePosition,
  vehicleForward,
  edgeType = 'road'
}) => {
  // 根据边类型选择颜色
  const colors = useMemo(() => {
    switch (edgeType) {
      case 'road':
        return { primary: '#00ffff', secondary: '#0088ff' }
      case 'highway':
        return { primary: '#ffaa00', secondary: '#ff6600' }
      case 'drone':
        return { primary: '#00ff00', secondary: '#00ff88' }
      case 'sky':
        return { primary: '#ff00ff', secondary: '#ff88ff' }
      default:
        return { primary: '#00ffff', secondary: '#0088ff' }
    }
  }, [edgeType])

  return (
    <>
      {/* 主光尾 */}
      <VehicleTrail
        vehiclePosition={vehiclePosition}
        vehicleForward={vehicleForward}
        color={colors.primary}
        maxParticles={50}
        particleSize={0.8}
        trailLength={8}
        emissionRate={5}
      />

      {/* 次级光尾（更小、更快消失） */}
      <VehicleTrail
        vehiclePosition={vehiclePosition}
        vehicleForward={vehicleForward}
        color={colors.secondary}
        maxParticles={30}
        particleSize={0.4}
        trailLength={5}
        emissionRate={8}
      />
    </>
  )
}
