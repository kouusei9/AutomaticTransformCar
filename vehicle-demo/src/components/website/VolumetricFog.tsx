import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 体积雾效果组件
 * 使用 shader 创建带深度的大气散射效果
 */
export const VolumetricFog: React.FC<{
  color?: string
  density?: number
  height?: number
}> = ({ 
  color = '#0a1a2e', 
  density = 0.02,
  height = 30
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(color) },
        uDensity: { value: density },
        uHeight: { value: height }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;
        
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          
          vec4 mvPosition = viewMatrix * worldPos;
          vViewPosition = mvPosition.xyz;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uFogColor;
        uniform float uDensity;
        uniform float uHeight;
        
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;
        
        // 简化的噪声函数
        float noise(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        }
        
        // 分形噪声
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          
          for(int i = 0; i < 3; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          
          return value;
        }
        
        void main() {
          // 基于高度的雾密度
          float heightFactor = smoothstep(0.0, uHeight, vWorldPosition.y);
          heightFactor = 1.0 - heightFactor;
          
          // 基于距离的雾密度
          float distance = length(vViewPosition);
          float fogFactor = 1.0 - exp(-uDensity * distance);
          
          // 添加噪声让雾有流动感
          vec3 noisePos = vWorldPosition * 0.05 + vec3(uTime * 0.05, 0.0, 0.0);
          float noiseFactor = fbm(noisePos) * 0.3;
          
          // 组合雾效
          float finalFog = fogFactor * heightFactor * (0.7 + noiseFactor);
          
          // 雾的颜色 - 越远越浓
          vec3 fogColorFinal = uFogColor * (0.8 + distance * 0.002);
          
          gl_FragColor = vec4(fogColorFinal, finalFog * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    })
  }, [color, density, height])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <mesh ref={meshRef} position={[0, height / 2, 0]}>
      <boxGeometry args={[400, height, 400]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  )
}

/**
 * 神光（God Rays）效果组件
 * 从顶部向下的光束效果
 */
export const GodRays: React.FC<{
  count?: number
  color?: string
  intensity?: number
}> = ({ 
  count = 8, 
  color = '#88ddff',
  intensity = 0.3
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const materialsRef = useRef<THREE.ShaderMaterial[]>([])

  const rays = useMemo(() => {
    const rayArray = []
    const radius = 120
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const rotation = Math.atan2(x, z)
      
      rayArray.push({
        position: [x, 50, z] as [number, number, number],
        rotation: [0, rotation, 0] as [number, number, number],
        delay: i * 0.5
      })
    }
    
    return rayArray
  }, [count])

  const rayMaterial = useMemo(() => {
    return rays.map(() => new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uIntensity: { value: intensity }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uIntensity;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // 从上到下渐变
          float verticalGradient = smoothstep(1.0, 0.0, vUv.y);
          
          // 横向渐变（中间亮，两边暗）
          float horizontalGradient = 1.0 - abs(vUv.x - 0.5) * 2.0;
          horizontalGradient = pow(horizontalGradient, 3.0);
          
          // 脉动效果
          float pulse = sin(uTime * 0.5 + vPosition.y * 0.1) * 0.3 + 0.7;
          
          // 组合
          float alpha = verticalGradient * horizontalGradient * uIntensity * pulse;
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }))
  }, [rays.length, color, intensity])

  materialsRef.current = rayMaterial

  useFrame((state) => {
    materialsRef.current.forEach((material, i) => {
      material.uniforms.uTime.value = state.clock.elapsedTime + rays[i].delay
    })
  })

  return (
    <group ref={groupRef}>
      {rays.map((ray, i) => (
        <mesh
          key={i}
          position={ray.position}
          rotation={ray.rotation}
        >
          <planeGeometry args={[15, 100]} />
          <primitive object={rayMaterial[i]} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 环境氛围粒子
 * 空气中漂浮的微小粒子
 */
export const AtmosphericParticles: React.FC<{
  count?: number
  size?: number
}> = ({ 
  count = 500,
  size = 0.3
}) => {
  const pointsRef = useRef<THREE.Points>(null)
  
  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // 在整个场景范围内随机分布
      pos[i3] = (Math.random() - 0.5) * 200
      pos[i3 + 1] = Math.random() * 40
      pos[i3 + 2] = (Math.random() - 0.5) * 200
      
      // 缓慢漂浮
      vel[i3] = (Math.random() - 0.5) * 0.05
      vel[i3 + 1] = Math.random() * 0.02 + 0.01
      vel[i3 + 2] = (Math.random() - 0.5) * 0.05
    }
    
    return { positions: pos, velocities: vel }
  }, [count])

  useFrame(() => {
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
      
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        
        pos[i3] += velocities[i3]
        pos[i3 + 1] += velocities[i3 + 1]
        pos[i3 + 2] += velocities[i3 + 2]
        
        // 边界检查 - 循环
        if (pos[i3] > 100) pos[i3] = -100
        if (pos[i3] < -100) pos[i3] = 100
        if (pos[i3 + 1] > 40) pos[i3 + 1] = 0
        if (pos[i3 + 2] > 100) pos[i3 + 2] = -100
        if (pos[i3 + 2] < -100) pos[i3 + 2] = 100
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [positions])

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={size}
        color="#88ddff"
        transparent
        opacity={0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
