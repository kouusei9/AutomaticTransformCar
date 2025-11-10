import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

interface RouteLineProps {
  startPos: [number, number, number]
  endPos: [number, number, number]
  color?: string
  animated?: boolean
  lineWidth?: number
}

/**
 * RouteLine - ルート接続コンポーネント
 * 2点間の発光接続線を表示
 */
export const RouteLine: React.FC<RouteLineProps> = ({
  startPos,
  endPos,
  color = '#00ffff',
  animated = true,
  lineWidth = 2
}) => {
  const lineRef = useRef<any>(null)
  
  // ルートポイントを生成（中間点を含めて弧を形成）
  const points = useMemo(() => {
    const start = new THREE.Vector3(...startPos)
    const end = new THREE.Vector3(...endPos)
    
    // 中点を計算し、上方に持ち上げて弧を形成
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
    const distance = start.distanceTo(end)
    
    // ハイウェイの場合、弧の高さを追加
    if (lineWidth > 2) {
      mid.y += distance * 0.08 // ハイウェイには曲率を追加
    }
    
    // 二次ベジェ曲線を使用
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return curve.getPoints(20)
  }, [startPos, endPos, lineWidth])
  
  // アニメーション効果
  useFrame((state) => {
    if (lineRef.current && animated) {
      const material = lineRef.current.material as THREE.LineBasicMaterial
      if (material) {
        // パルス効果
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

export default RouteLine