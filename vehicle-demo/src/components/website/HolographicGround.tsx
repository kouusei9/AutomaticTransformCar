import React, { useRef, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * 和现有蓝紫色未来地图贴图完全融合的地面 Shader
 * - 保留真实地图颜色
 * - 增加柔和 hologram 效果
 * - 不漂白、不遮盖原贴图
 * - 高性能（适合手机）
 */
export const HolographicGroundFusion: React.FC<{
  size?: number;
  textureUrl: string;
}> = ({ size = 200, textureUrl }) => {

  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // 加载地面贴图（你的蓝紫色未来地图）
  const baseMap = useLoader(THREE.TextureLoader, textureUrl)
  baseMap.wrapS = baseMap.wrapT = THREE.ClampToEdgeWrapping

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },

        // 地面贴图
        uBaseMap: { value: baseMap },

        // hologram 参数
        uGridSize: { value: 16.0 }, // 网格大小更贴合蓝紫地图
        uGridThickness: { value: 0.045 },
        uFlowSpeed: { value: 0.4 },
        uScanlineSpeed: { value: 0.0 }, // 关闭扫描线

        // 蓝紫色系主色调 - 降低饱和度
        uPrimaryColor: { value: new THREE.Color('#4db3cc') },   // 降低饱和度的青蓝
        uSecondaryColor: { value: new THREE.Color('#9966cc') }, // 降低饱和度的紫色
        uScanlineColor: { value: new THREE.Color('#00ffaa') },

        uEmissionStrength: { value: 0.35 } // 降低发光强度
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uBaseMap;

        uniform float uGridSize;
        uniform float uGridThickness;

        uniform float uFlowSpeed;
        uniform float uScanlineSpeed;

        uniform vec3 uPrimaryColor;
        uniform vec3 uSecondaryColor;
        uniform vec3 uScanlineColor;

        uniform float uEmissionStrength;

        varying vec2 vUv;
        varying vec3 vWorldPos;

        // 简化版网格线算法（高性能）
        float gridLine(vec2 coord, float thick) {
          vec2 g = abs(fract(coord + 0.5) - 0.5);
          float d = min(g.x, g.y);
          return smoothstep(thick, 0.0, d);
        }

        void main() {
          // ===== 1. 地图贴图 =====
          vec3 baseTex = texture2D(uBaseMap, vUv).rgb;

          // 轻微提升贴图对比度，让蓝紫色更清晰
          baseTex = pow(baseTex, vec3(1.15));

          // ===== 2. hologram 网格 =====
          vec2 gridCoord = vWorldPos.xz / uGridSize;
          float grid = gridLine(gridCoord, uGridThickness);

          // ===== 3. 光流效果 =====
          float fp = fract(gridCoord.x + uTime * uFlowSpeed);
          float flow = smoothstep(0.0, 0.25, fp) * (1.0 - smoothstep(0.6, 1.0, fp));
          flow *= grid;

          // ===== 4. 扫描线 (已禁用) =====
          // float scanCenter = uTime * uScanlineSpeed * 20.0;
          // float scan = smoothstep(4.0, 0.0, abs(vWorldPos.z - scanCenter));

          // ===== 5. hologram 颜色组合 =====
          vec3 holo = vec3(0.0);
          holo += uPrimaryColor * grid * 0.35;  // 降低网格强度
          holo += mix(uPrimaryColor, uSecondaryColor, flow) * flow * 0.9; // 降低光流强度
          // holo += uScanlineColor * scan * 1.8; // 扫描线已禁用

          // 提升整体亮度
          holo *= uEmissionStrength;

          // ===== 6. 与贴图融合（最重要）=====
          // hologram 不覆盖地面，只是叠加光效
          vec3 finalColor = baseTex + holo * 0.55;

          // 限制亮度，避免过亮
          finalColor = clamp(finalColor, vec3(0.0), vec3(1.0));

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  }, [baseMap])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <group>
      {/* 主地面 - 带圆角和厚度 */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow={false}
      >
        {/* 使用圆角矩形几何体 */}
        <RoundedBoxGeometry args={[size, size, 1.5, 8, 8]} />
        <primitive object={shaderMaterial} ref={materialRef} attach="material" />
      </mesh>

      {/* 底部边缘发光 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.8, 0]}
      >
        {/* <RoundedBoxGeometry args={[size + 0.5, size + 0.5, 0.2, 8, 8]} /> */}
        <meshStandardMaterial
          // color="#00ffff"
          // emissive="#00ffff"
          // emissiveIntensity={0.5}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  )
}

/**
 * 圆角矩形几何体
 */
function RoundedBoxGeometry({ args }: { args: [number, number, number, number, number] }) {
  const [width, height, depth, radius, smoothness] = args
  
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    const x = -width / 2
    const y = -height / 2
    const w = width
    const h = height
    const r = Math.min(radius, Math.min(w, h) / 2)

    // 绘制圆角矩形路径
    shape.moveTo(x + r, y)
    shape.lineTo(x + w - r, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + r)
    shape.lineTo(x + w, y + h - r)
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    shape.lineTo(x + r, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - r)
    shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.1,
      bevelSegments: smoothness
    }

    return new THREE.ExtrudeGeometry(shape, extrudeSettings)
  }, [width, height, depth, radius, smoothness])

  return <primitive object={geometry} />
}