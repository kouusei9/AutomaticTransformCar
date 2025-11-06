import React, { useMemo } from 'react'
import * as THREE from 'three'

/**
 * SurroundingMountains - 环形山脉/建筑群
 * 在地图四周创建山脉或建筑群轮廓
 */
export const SurroundingMountains: React.FC = () => {
  const mountainLines = useMemo(() => {
    const points: THREE.Vector3[] = []
    const segments = 60
    const radius = 180
    
    // 创建环形山脉轮廓
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const height = 30 + Math.sin(angle * 3) * 15 + Math.random() * 10
      const distance = radius + Math.sin(angle * 5) * 20
      
      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      
      // 每两个点形成一条从地面到山顶的线段
      points.push(new THREE.Vector3(x, 0, z))
      points.push(new THREE.Vector3(x, height, z))
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: '#1a1a3a',
      transparent: true,
      opacity: 0.6
    })
    
    return new THREE.LineSegments(geometry, material)
  }, [])
  
  return <primitive object={mountainLines} />
}

export default SurroundingMountains