import React, { useMemo } from 'react'

/**
 * DistantCityscape - 遠方都市シルエット
 * マップの端に霞んだ建物の輪郭を作成
 */
export const DistantCityscape: React.FC = () => {
  // ランダムな建物データを生成
  const buildings = useMemo(() => {
    const buildingData = []
    const radius = 150 // 中心からの半径
    const count = 40 // 建物の数
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const distance = radius + Math.random() * 50
      const x = Math.cos(angle) * distance
      const z = Math.sin(angle) * distance
      
      buildingData.push({
        position: [x, 0, z] as [number, number, number],
        height: 20 + Math.random() * 60,
        width: 8 + Math.random() * 12,
        depth: 8 + Math.random() * 12,
        opacity: 0.15 + Math.random() * 0.15
      })
    }
    
    return buildingData
  }, [])
  
  return (
    <group>
      {buildings.map((building, i) => (
        <mesh
          key={i}
          position={[
            building.position[0],
            building.height / 2,
            building.position[2]
          ]}
        >
          <boxGeometry args={[building.width, building.height, building.depth]} />
          <meshBasicMaterial
            color="#0a0a20"
            transparent
            opacity={building.opacity}
            fog={true}
          />
        </mesh>
      ))}
    </group>
  )
}

export default DistantCityscape