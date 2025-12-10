import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface PathLineProps {
  path: THREE.CurvePath<THREE.Vector3>
  color?: string
  animated?: boolean
  lineWidth?: number
  dimmed?: boolean  // 是否变暗
}

/**
 * PathLine - 平行于地面的路面带
 * 車両が実際に走行するパスと同じ形状を表示
 */
export const PathLine: React.FC<PathLineProps> = ({
  path,
  color = '#00ffff',
  animated = true,
  lineWidth = 4,
  dimmed = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null)

  // 生成路面带状几何体
  const { geometry, material } = useMemo(() => {
    const points = path.getPoints(100)
    const roadWidth = lineWidth * 0.5 // 路面宽度

    const vertices: number[] = []
    const indices: number[] = []
    const uvs: number[] = []

    for (let i = 0; i < points.length; i++) {
      const point = points[i]

      // 计算前进方向
      let direction: THREE.Vector3
      if (i < points.length - 1) {
        direction = new THREE.Vector3().subVectors(points[i + 1], point).normalize()
      } else {
        direction = new THREE.Vector3().subVectors(point, points[i - 1]).normalize()
      }

      // 计算垂直于前进方向的向量（在3D空间，跟随路径高度）
      const up = new THREE.Vector3(0, 1, 0)
      const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize()

      // 路面两侧顶点（跟随路径实际高度）
      const leftPoint = new THREE.Vector3(
        point.x + perpendicular.x * roadWidth / 2,
        point.y == 0 ? 0.05 : point.y,  // 保持路径原有高度
        point.z + perpendicular.z * roadWidth / 2
      )
      const rightPoint = new THREE.Vector3(
        point.x - perpendicular.x * roadWidth / 2,
        point.y == 0 ? 0.05 : point.y,  // 保持路径原有高度
        point.z - perpendicular.z * roadWidth / 2
      )

      vertices.push(leftPoint.x, leftPoint.y, leftPoint.z)
      vertices.push(rightPoint.x, rightPoint.y, rightPoint.z)

      // UV坐标
      const u = i / (points.length - 1)
      uvs.push(u, 0)
      uvs.push(u, 1)

      // 三角形索引
      if (i < points.length - 1) {
        const baseIndex = i * 2
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2)
        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()

    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
      // blending: THREE.AdditiveBlending
    })

    return { geometry: geo, material: mat }
  }, [path, lineWidth, color])

  // 动画效果
  // useFrame((state) => {
  //   if (meshRef.current && animated && material) {
  //     // 脉冲发光效果
  //     const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7
  //     material.opacity = dimmed ? pulse * 0.15 : pulse * 0.6

  //     // 颜色强度
  //     const baseColor = new THREE.Color(color)
  //     material.color.copy(baseColor)
  //     material.color.multiplyScalar(dimmed ? 1.0 : 2.0)
  //   }
  // })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      renderOrder={1}
    />
  )
}

export default PathLine
