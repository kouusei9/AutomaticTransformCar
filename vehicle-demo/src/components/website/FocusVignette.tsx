/**
 * 聚焦蒙板组件
 * 在跟踪模式下创建黑色迷雾效果，突出显示车辆和路线
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FocusVignetteProps {
  vehiclePosition: THREE.Vector3
  intensity?: number // 蒙板强度 0-1
  radius?: number // 聚光半径
  falloff?: number // 边缘衰减
}

export function FocusVignette({
  vehiclePosition,
  intensity = 0.7,
  radius = 30,
  falloff = 20
}: FocusVignetteProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  // 自定义着色器材质
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        fogCenter: { value: new THREE.Vector3(0, 0, 0) },
        fogRadius: { value: radius },
        fogFalloff: { value: falloff },
        fogIntensity: { value: intensity },
        fogColor: { value: new THREE.Color(0x000000) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 fogCenter;
        uniform float fogRadius;
        uniform float fogFalloff;
        uniform float fogIntensity;
        uniform vec3 fogColor;
        
        varying vec3 vWorldPosition;
        
        void main() {
          // 计算水平距离（忽略Y轴）
          vec2 centerXZ = fogCenter.xz;
          vec2 posXZ = vWorldPosition.xz;
          float dist = distance(centerXZ, posXZ);
          
          // 计算雾的透明度（聚光区域透明，外围不透明）
          float fogAmount = smoothstep(fogRadius, fogRadius + fogFalloff, dist);
          fogAmount *= fogIntensity;
          
          gl_FragColor = vec4(fogColor, fogAmount);
        }
      `
    })
  }, [radius, falloff, intensity])

  // 更新雾的中心位置
  useFrame(() => {
    if (materialRef.current && vehiclePosition) {
      materialRef.current.uniforms.fogCenter.value.copy(vehiclePosition)
    }
  })

  return (
    <>
      {/* 顶部蒙板平面 */}
      <mesh 
        ref={meshRef}
        position={[0, 50, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1000}
      >
        <planeGeometry args={[400, 400]} />
        <primitive object={shaderMaterial} ref={materialRef} />
      </mesh>

      {/* 额外的环境暗化 */}
      <mesh 
        position={[0, 25, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial 
          color="#000000" 
          transparent 
          opacity={intensity * 0.3}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
