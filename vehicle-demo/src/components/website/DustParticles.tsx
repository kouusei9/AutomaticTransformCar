import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 漂浮粒子组件 (Dust Particles)
 * 三维粒子，蓝色/白色小点，缓慢上升、发光
 */
interface DustParticlesProps {
  count?: number
  color1?: string
  color2?: string
  size?: number
  speed?: number
  range?: number
}

export const DustParticles: React.FC<DustParticlesProps> = ({
  count = 500,
  color1 = '#00ffff',
  color2 = '#ffffff',
  size = 0.3,
  speed = 0.5,
  range = 100
}) => {
  const pointsRef = useRef<THREE.Points>(null)
  
  // 粒子初始位置和速度
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    
    const color1Obj = new THREE.Color(color1)
    const color2Obj = new THREE.Color(color2)
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // 随机位置（在地面上方的立方体空间内）
      positions[i3] = (Math.random() - 0.5) * range * 2
      positions[i3 + 1] = Math.random() * 30 + 5 // 5m到35m高度
      positions[i3 + 2] = (Math.random() - 0.5) * range * 2
      
      // 随机上升速度
      velocities[i3] = (Math.random() - 0.5) * 0.1 // 微弱水平漂移
      velocities[i3 + 1] = Math.random() * 0.3 + 0.1 // 向上速度
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1
      
      // 随机颜色（蓝色或白色）
      const color = Math.random() > 0.5 ? color1Obj : color2Obj
      colors[i3] = color.r
      colors[i3 + 1] = color.g
      colors[i3 + 2] = color.b
      
      // 随机大小
      sizes[i] = Math.random() * size + size * 0.5
    }
    
    return { positions, velocities, colors, sizes }
  }, [count, range, color1, color2, size])
  
  // 动画更新
  useFrame((_state, delta) => {
    if (!pointsRef.current) return
    
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
    const velocities = particles.velocities
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // 更新位置
      positions[i3] += velocities[i3] * speed * delta * 10
      positions[i3 + 1] += velocities[i3 + 1] * speed * delta * 10
      positions[i3 + 2] += velocities[i3 + 2] * speed * delta * 10
      
      // 如果粒子飞太高，重置到底部
      if (positions[i3 + 1] > 40) {
        positions[i3 + 1] = 5
      }
      
      // 边界检测，循环回到对面
      if (Math.abs(positions[i3]) > range) {
        positions[i3] = -positions[i3]
      }
      if (Math.abs(positions[i3 + 2]) > range) {
        positions[i3 + 2] = -positions[i3 + 2]
      }
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true
    
    // 轻微旋转整个粒子系统
    pointsRef.current.rotation.y += delta * 0.02
  })
  
  // 创建几何体
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(particles.colors, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(particles.sizes, 1))
    return geo
  }, [particles])

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={size}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/**
 * 多层粒子系统
 * 不同高度、不同速度的粒子层
 */
export const MultiLayerDustParticles: React.FC = () => {
  return (
    <>
      {/* 底层 - 慢速大粒子 (优化: 200→100) */}
      <DustParticles
        count={100}
        color1="#00ffff"
        color2="#0088ff"
        size={0.4}
        speed={0.3}
        range={100}
      />
      
      {/* 中层 - 中速中粒子 (优化: 300→150) */}
      <DustParticles
        count={150}
        color1="#00ffff"
        color2="#ffffff"
        size={0.25}
        speed={0.5}
        range={120}
      />
      
      {/* 高层 - 快速小粒子 */}
      <DustParticles
        count={100}
        color1="#88ffff"
        color2="#ffffff"
        size={0.15}
        speed={0.8}
        range={80}
      />
    </>
  )
}
