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
        uScanlineSpeed: { value: 0.25 },

        // 蓝紫色系主色调
        uPrimaryColor: { value: new THREE.Color('#65e6ff') },   // 青蓝
        uSecondaryColor: { value: new THREE.Color('#d600ff') }, // 紫粉
        uScanlineColor: { value: new THREE.Color('#00ffaa') },

        uEmissionStrength: { value: 0.55 } // 柔和发光，不覆盖底图
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

          // ===== 4. 扫描线 =====
          float scanCenter = uTime * uScanlineSpeed * 20.0;
          float scan = smoothstep(4.0, 0.0, abs(vWorldPos.z - scanCenter));

          // ===== 5. hologram 颜色组合 =====
          vec3 holo = vec3(0.0);
          holo += uPrimaryColor * grid * 0.45;  // 柔和网格
          holo += mix(uPrimaryColor, uSecondaryColor, flow) * flow * 1.3;
          holo += uScanlineColor * scan * 1.8;

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
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.05, 0]}
      receiveShadow={false}
    >
      <planeGeometry args={[size, size]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  )
}