import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

interface PathLineProps {
  path: THREE.CurvePath<THREE.Vector3>
  color?: string
  animated?: boolean
  lineWidth?: number
  dimmed?: boolean  // 是否变暗
}

/**
 * PathLine - CurvePathを直接レンダリングするコンポーネント
 * 車両が実際に走行するパスと同じ形状を表示
 */
export const PathLine: React.FC<PathLineProps> = ({
  path,
  color = '#00ffff',
  animated = true,
  lineWidth = 2,
  dimmed = false
}) => {
  const lineRef = useRef<any>(null)
  
  // パスからポイントを生成
  const points = useMemo(() => {
    // パス全体から均等なポイントを取得
    return path.getPoints(100)
  }, [path])
  
  // アニメーション効果
  useFrame((state) => {
    if (lineRef.current && animated) {
      const material = lineRef.current.material as THREE.LineBasicMaterial
      if (material) {
        // パルス効果
        const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7
        // 如果dimmed，降低透明度
        material.opacity = dimmed ? pulse * 0.15 : pulse
      }
    }
  })
  
  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={lineWidth}
      dashed={false}
    >
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.8}
      />
    </Line>
  )
}

export default PathLine
