import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 流光管道路径组件
 * 使用 TubeGeometry + 动态 Shader 实现流动光线效果
 */
interface FlowingTubePathProps {
  path: THREE.CurvePath<THREE.Vector3>
  color?: string
  secondaryColor?: string
  tubeRadius?: number
  flowSpeed?: number
  segments?: number
  opacity?: number
}

export const FlowingTubePath: React.FC<FlowingTubePathProps> = ({
  path,
  color = '#00ffff',
  secondaryColor = '#ff00ff',
  tubeRadius = 0.3,
  flowSpeed = 1.0,
  segments = 200,
  opacity = 0.8
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // 创建管道几何体
  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(path, segments, tubeRadius, 8, false)
  }, [path, segments, tubeRadius])

  // 流光 Shader 材质
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(color) },
        uColor2: { value: new THREE.Color(secondaryColor) },
        uFlowSpeed: { value: flowSpeed },
        uOpacity: { value: opacity }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uFlowSpeed;
        uniform float uOpacity;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          // 沿路径方向的流动效果
          float flow = fract(vUv.x * 3.0 - uTime * uFlowSpeed);
          
          // 创建流光段
          float flowPulse = smoothstep(0.0, 0.2, flow) * smoothstep(1.0, 0.8, flow);
          
          // 颜色混合
          vec3 baseColor = mix(uColor1, uColor2, sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5);
          
          // 流光增强
          vec3 finalColor = baseColor * (0.3 + flowPulse * 2.0);
          
          // 边缘发光
          float edgeFactor = 1.0 - abs(vUv.y - 0.5) * 2.0;
          finalColor += baseColor * edgeFactor * 0.5;
          
          // 脉冲闪烁
          float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
          
          gl_FragColor = vec4(finalColor * pulse, uOpacity * (0.5 + flowPulse * 0.5));
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [color, secondaryColor, flowSpeed, opacity])

  // 更新时间 uniform
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeometry}>
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  )
}

/**
 * 根据路径类型选择不同颜色的流光管道
 */
interface TypedFlowingTubeProps {
  path: THREE.CurvePath<THREE.Vector3>
  edgeType: 'road' | 'highway' | 'drone' | 'sky'
  tubeRadius?: number
}

export const TypedFlowingTube: React.FC<TypedFlowingTubeProps> = ({
  path,
  edgeType,
  tubeRadius = 0.3
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
    <FlowingTubePath
      path={path}
      color={colors.primary}
      secondaryColor={colors.secondary}
      tubeRadius={tubeRadius}
      flowSpeed={1.5}
      opacity={0.7}
    />
  )
}
