import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

interface RouteLineProps {
  startPos: [number, number, number]
  endPos: [number, number, number]
  color?: string
  animated?: boolean
}

/**
 * RouteLine - 路线连接组件
 * 显示两点之间的发光连线
 */
export const RouteLine: React.FC<RouteLineProps> = ({
  startPos,
  endPos,
  color = '#00ffff',
  animated = true
}) => {
  const lineRef = useRef<any>(null)
  
  // 生成路线点（包含中间点以形成弧线）
  const points = useMemo(() => {
    const start = new THREE.Vector3(...startPos)
    const end = new THREE.Vector3(...endPos)
    
    // 计算中点并抬高形成弧线
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
    // const distance = start.distanceTo(end)
    // mid.y += distance * 0.02 // 降低高度从 0.1 到 0.02（降低80%）- 已禁用，使用完全平直的线
    
    // 使用三次贝塞尔曲线
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return curve.getPoints(20)
  }, [startPos, endPos])
  
  // 动画效果
  useFrame((state) => {
    if (lineRef.current && animated) {
      const material = lineRef.current.material as THREE.LineBasicMaterial
      if (material) {
        // 脉冲效果
        const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7
        material.opacity = pulse
      }
    }
  })
  
  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={2}
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

export default RouteLine