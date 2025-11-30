import React, { useMemo, useEffect, useRef, useState, Suspense, use } from 'react'
import * as THREE from 'three'
import { useTexture, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { LocationMarker } from './LocationMarker'
import { PathLine } from './PathLine'
import { latLngToPosition3D } from '../../utils/coordinateConverter'
import { type RouteData, type RouteEdge, createRoutePathFromNodeIds } from '../../utils/routePathGenerator'

/**
 * サイバーパンク都市地面コンポーネント
 * 空中および地上ルートと垂直コネクターをレンダリング
 */

// ==================== 定数 ====================
const GROUND_COLOR = new THREE.Color(0x0a0a0f)
const LIGHT_INTENSITY = 0.6
const DIRECTIONAL_LIGHT_INTENSITY = 0.8
const ROUTE_DATA_URL = '/website-assets/kyoto_routes.json'
const GROUND_SIZE = 200

// ==================== 型定義 ====================

interface ConvertedNode {
  id: string
  name: string
  position: [number, number, number]
  type?: string
  coordinates: { lat: number; lng: number }
}

interface NodeEdgeTypes {
  hasDrone: boolean
  hasGround: boolean
}

interface Landmark {
  id: string
  name: string
  type: 'building' | 'shrine' | 'skytree' | 'cocoontower'
  coordinates: {
    lat: number
    lng: number
  }
  height: number
  description: string
  rank: string
  position?: [number, number, number]
  scale?: number
}

// ==================== コンポーネント ====================
// GLTFモデルをプリロード
useGLTF.preload('/website-assets/futuristic_city.glb')
useGLTF.preload('/website-assets/shrine.glb')
useGLTF.preload('/website-assets/tokyo_skytree_japan.glb')
useGLTF.preload('/website-assets/cocoon_tower.glb')

/**
 * 3D建築物モデルコンポーネント
 */
const Building3DModel: React.FC<{
  position: [number, number, number]
  scale?: number
  height?: number
}> = ({ position, scale = 1, height = 120 }) => {
  // try {
  const { scene } = useGLTF('/website-assets/futuristic_city.glb')
  const clonedScene = useMemo(() => {
    return scene.clone()
  }, [scene])

  // 统一高度120m，调整缩放使建筑物大小合适
  const adjustedScale = (height / 30) * scale * 0.5 // 基准scale调整

  return (
    <primitive
      object={clonedScene}
      position={position}
      scale={[adjustedScale, adjustedScale, adjustedScale]}
      castShadow
      receiveShadow
    />
  )
  // } catch (error) {
  //   console.error('Error loading building model:', error)
  //   return null
  // }
}

/**
 * 神社3Dモデルコンポーネント
 */
const Shrine3DModel: React.FC<{
  position: [number, number, number]
  scale?: number
  rank: 'major' | 'medium' | 'small'
  name: string
}> = ({ position, scale = 1, rank }) => {
  // try {
  const { scene } = useGLTF('/website-assets/shrine.glb')
  const clonedScene = useMemo(() => {
    return scene.clone()
  }, [scene])

  // ランクに応じてスケールを調整
  const rankScale = rank === 'major' ? 1.2 : rank === 'medium' ? 1.0 : 0.8
  const finalScale = scale * rankScale * 8.0 // 基準スケール

  return (
    <group position={position}>
      <primitive
        object={clonedScene}
        scale={[finalScale, finalScale, finalScale]}
        castShadow
        receiveShadow
      />
      {/* 神社名ラベル（オプション） */}
      {/* <Text
          position={[0, finalScale * 3, 0]}
          fontSize={1.5}
          color="#ff6b6b"
          anchorX="center"
          anchorY="bottom"
        >
          {name}
        </Text> */}
    </group>
  )
  // } catch (error) {
  //   console.error('Error loading shrine model:', error)
  //   return null
  // }
}

/**
 * スカイツリー3Dモデルコンポーネント
 */
const SkyTree3DModel: React.FC<{
  position: [number, number, number]
  scale?: number
}> = ({ position, scale = 1 }) => {
  const { scene } = useGLTF('/website-assets/tokyo_skytree_japan.glb')
  const clonedScene = useMemo(() => {
    return scene.clone()
  }, [scene])

  // スカイツリーの基準スケール（高さ634mを考慮）
  const finalScale = scale * 0.2 // モデルサイズに応じて調整

  return (
    <group position={position}>
      <primitive
        object={clonedScene}
        scale={[finalScale, finalScale, finalScale]}
        castShadow
        receiveShadow
      />
      {/* スカイツリー周囲の光効果 */}
      <pointLight
        position={[0, 80, 0]}
        intensity={0.5}
        color="#00ffff"
        distance={100}
      />
    </group>
  )
}

/**
 * Cocoon Tower 3Dモデルコンポーネント
 */
const CocoonTower3DModel: React.FC<{
  position: [number, number, number]
  scale?: number
}> = ({ position, scale = 1 }) => {
  try {
    const { scene } = useGLTF('/website-assets/cocoon_tower.glb')
    const clonedScene = useMemo(() => {
      const cloned = scene.clone()
      // モデル内のすべてのメッシュを表示設定
      cloned.traverse((child: any) => {
        if (child.isMesh) {
          child.visible = true
          child.castShadow = true
          child.receiveShadow = true
          if (child.material) {
            child.material.needsUpdate = true
          }
        }
      })
      return cloned
    }, [scene])

    // Cocoon Towerの基準スケール（高さ204mを考慮）
    const finalScale = scale * 20

    return (
      <group position={position}>
        {/* 実際のモデル */}
        <primitive
          object={clonedScene}
          scale={[finalScale, finalScale, finalScale]}
          castShadow
          receiveShadow
        />
        
        {/* Cocoon Tower周囲の光効果 */}
        <pointLight
          position={[0, 50, 0]}
          intensity={0.6}
          color="#ff9900"
          distance={120}
        />
      </group>
    )
  } catch (error) {
    console.error('❌ Cocoon Tower loading error:', error)
    return null
  }
}

/**
 * マップテクスチャ付き地面平面
 */
const GroundPlane: React.FC<{ size: number }> = ({ size }) => {
  const textureResult = useTexture('/website-assets/routes_map.png')
  const mapTexture = Array.isArray(textureResult) ? textureResult[0] : textureResult

  useEffect(() => {
    if (mapTexture && mapTexture instanceof THREE.Texture) {
      mapTexture.wrapS = THREE.RepeatWrapping
      mapTexture.wrapT = THREE.RepeatWrapping
      mapTexture.repeat.set(1, 1)
      mapTexture.flipY = false
      mapTexture.format = THREE.RGBAFormat
      mapTexture.needsUpdate = true
      mapTexture.minFilter = THREE.LinearFilter
      mapTexture.magFilter = THREE.LinearFilter
    } else {
      console.error('マップテクスチャの読み込みに失敗:', mapTexture)
    }
  }, [mapTexture, size])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[size, size, 1, 1]} />
      {mapTexture ? (
        <meshStandardMaterial
          map={mapTexture}
          color={0xffffff}
          opacity={0.8}
          metalness={0.0}
          roughness={1.0}
          side={THREE.DoubleSide}
        />
      ) : (
        <meshStandardMaterial
          color={GROUND_COLOR}
          metalness={0.3}
          roughness={0.7}
        />
      )}
    </mesh>
  )
}

/**
 * ビルボード建物コンポーネント
 * 建物の画像、常にカメラの方を向く
 */
const BillboardBuilding: React.FC<{
  position: [number, number, number]
  texturePath: string
  scale?: number
}> = React.memo(({ position, texturePath, scale = 15 }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  const textureResult = useTexture(texturePath)
  const buildingTexture = Array.isArray(textureResult) ? textureResult[0] : textureResult

  useEffect(() => {
    if (buildingTexture && buildingTexture instanceof THREE.Texture) {
      buildingTexture.flipY = true
      buildingTexture.format = THREE.RGBAFormat
      buildingTexture.needsUpdate = true
      buildingTexture.minFilter = THREE.LinearFilter
      buildingTexture.magFilter = THREE.LinearFilter
    }
  }, [buildingTexture])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: buildingTexture,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: 0.2,
    })
  }, [buildingTexture])

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.translate(0, 0.5, 0)
    return geo
  }, [])

  useFrame(({ camera }) => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position)
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={[scale, scale, 1]}
      castShadow
      receiveShadow
    >
      <primitive object={geometry} />
      <primitive object={material} attach="material" />
    </mesh>
  )
})

BillboardBuilding.displayName = 'BillboardBuilding'

// ==================== ヘルパー関数 ====================

/**
 * 各ノードに接続されたエッジタイプを統計
 */
function analyzeNodeEdgeTypes(edges: RouteEdge[]): Map<string, NodeEdgeTypes> {
  const nodeEdgeTypes = new Map<string, NodeEdgeTypes>()

  edges.forEach(edge => {
    const isDrone = edge.type === 'drone'

    // fromノードを記録
    const fromTypes = nodeEdgeTypes.get(edge.from) || { hasDrone: false, hasGround: false }
    if (isDrone) fromTypes.hasDrone = true
    else fromTypes.hasGround = true
    nodeEdgeTypes.set(edge.from, fromTypes)

    // toノードを記録
    const toTypes = nodeEdgeTypes.get(edge.to) || { hasDrone: false, hasGround: false }
    if (isDrone) toTypes.hasDrone = true
    else toTypes.hasGround = true
    nodeEdgeTypes.set(edge.to, toTypes)
  })

  return nodeEdgeTypes
}

/**
 * ルートデータを生成
 * 車両と同じロジックでパスを生成
 */
function generateRoutes(
  edges: RouteEdge[],
  _convertedNodes: ConvertedNode[],
  _nodeEdgeTypes: Map<string, NodeEdgeTypes>,
  routeData: RouteData
) {
  const groundPaths: { path: THREE.CurvePath<THREE.Vector3>; edge: RouteEdge }[] = []
  const aerialPaths: { path: THREE.CurvePath<THREE.Vector3>; edge: RouteEdge }[] = []
  const highwayPaths: { path: THREE.CurvePath<THREE.Vector3>; edge: RouteEdge }[] = []
  const airplanePaths: { path: THREE.CurvePath<THREE.Vector3>; edge: RouteEdge }[] = []

  // 各エッジについて、車両と同じロジックでパスを生成
  edges.forEach(edge => {
    const nodeIds = [edge.from, edge.to]
    const path = createRoutePathFromNodeIds(routeData.nodes, routeData.edges, nodeIds)

    if (path) {
      const pathWithEdge = { path, edge }
      if (edge.type === 'drone') {
        aerialPaths.push(pathWithEdge)
      } else if (edge.type === 'highway') {
        highwayPaths.push(pathWithEdge)
      } else if (edge.type === 'airplane') {
        airplanePaths.push(pathWithEdge)
      } else {
        groundPaths.push(pathWithEdge)
      }
    }
  })

  return {
    ground: groundPaths,
    aerial: aerialPaths,
    highway: highwayPaths,
    airplane: airplanePaths
  }
}

// ==================== メインコンポーネント ====================

interface CityGroundProps {
  size?: number
  onRouteDataLoaded?: (data: RouteData) => void
  highlightedRoute?: {
    nodeIds: string[]
  } | null
}

/**
 * CityGroundコンポーネント
 */
export const CityGround: React.FC<CityGroundProps> = ({
  size = GROUND_SIZE,
  onRouteDataLoaded,
  highlightedRoute
}) => {
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [cityBuildings, setCityBuildings] = useState<Landmark[]>([])
  const [shrines, setShrines] = useState<Landmark[]>([])
  const [skytrees, setSkytrees] = useState<Landmark[]>([])
  const [cocoontowers, setCocoontowers] = useState<Landmark[]>([])

  // ルートデータを読み込み
  useEffect(() => {
    fetch(ROUTE_DATA_URL)
      .then(res => res.json())
      .then(data => {
        setRouteData(data)
        onRouteDataLoaded?.(data)
      })
      .catch(err => console.error('ルートデータの読み込みに失敗:', err))
  }, [onRouteDataLoaded])

  // ランドマークデータを読み込み（建築物、神社、スカイツリー、コクーンタワーを統合）
  useEffect(() => {
    fetch('/website-assets/kyoto_landmarks.json')
      .then(res => res.json())
      .then(data => {
        const landmarks = data.landmarks || []
        // typeで分類
        const buildings = landmarks.filter((l: Landmark) => l.type === 'building')
        const shrinesData = landmarks.filter((l: Landmark) => l.type === 'shrine')
        const skytreesData = landmarks.filter((l: Landmark) => l.type === 'skytree')
        const cocoontowersData = landmarks.filter((l: Landmark) => l.type === 'cocoontower')
        
        console.log('📍 Landmarks loaded:', {
          buildings: buildings.length,
          shrines: shrinesData.length,
          skytrees: skytreesData.length,
          cocoontowers: cocoontowersData.length
        })
        console.log('🏢 Cocoon Towers data:', cocoontowersData)
        
        setCityBuildings(buildings)
        setShrines(shrinesData)
        setSkytrees(skytreesData)
        setCocoontowers(cocoontowersData)
      })
      .catch(err => console.error('ランドマークデータの読み込みに失敗:', err))
  }, [])

  // ノード座標を変換
  const convertedNodes = useMemo<ConvertedNode[]>(() => {
    if (!routeData) return []

    return routeData.nodes.map(node => {
      const pos3d = latLngToPosition3D(node.coordinates)
      return {
        ...node,
        position: [pos3d.x, pos3d.y, pos3d.z] as [number, number, number]
      }
    })
  }, [routeData])

  // 建築物座標を変換
  const convertedBuildings = useMemo(() => {
    const buildingScale = 10.0 // 渲染时使用的scale
    // const buildingHeight =  120// 統一高度120m

    const buildings = cityBuildings.map(building => {
      const pos3d = latLngToPosition3D(building.coordinates)

      // モデルの原点が底部にある場合、Y=0に配置
      const yPosition = 0

      const position = [pos3d.x, yPosition, pos3d.z] as [number, number, number]

      return {
        ...building,
        position,
        height: building.height * 2,
        scale: buildingScale
      }
    })
    return buildings
  }, [cityBuildings])

  // 神社座標を変換
  const convertedShrines = useMemo(() => {
    return shrines.map(shrine => {
      const pos3d = latLngToPosition3D(shrine.coordinates)

      // 神社は地面レベルに配置
      const yPosition = 0
      const position = [pos3d.x, yPosition, pos3d.z] as [number, number, number]

      return {
        ...shrine,
        position
      }
    })
  }, [shrines])

  // スカイツリー座標を変換
  const convertedSkytrees = useMemo(() => {
    return skytrees.map(skytree => {
      const pos3d = latLngToPosition3D(skytree.coordinates)

      // スカイツリーは地面レベルに配置
      const yPosition = 0
      const position = [pos3d.x, yPosition, pos3d.z] as [number, number, number]

      return {
        ...skytree,
        position
      }
    })
  }, [skytrees])

  // Cocoon Tower座標を変換
  const convertedCocoontowers = useMemo(() => {
    const converted = cocoontowers.map(tower => {
      const pos3d = latLngToPosition3D(tower.coordinates)

      // Cocoon Towerは地面レベルに配置
      const yPosition = 0
      const position = [pos3d.x, yPosition, pos3d.z] as [number, number, number]

      return {
        ...tower,
        position
      }
    })
    
    if (converted.length > 0) {
      console.log('🏢 Cocoon Tower positions:', converted.map(t => ({
        name: t.name,
        coords: t.coordinates,
        position: t.position
      })))
    }
    
    return converted
  }, [cocoontowers])

  // ルートを生成 - 車両と同じロジックでパスを生成
  const routes = useMemo(() => {
    if (!routeData || convertedNodes.length === 0) {
      return { ground: [], aerial: [], highway: [], airplane: [] }
    }

    const nodeEdgeTypes = analyzeNodeEdgeTypes(routeData.edges)
    return generateRoutes(routeData.edges, convertedNodes, nodeEdgeTypes, routeData)
  }, [routeData, convertedNodes])

  // 特定の建物位置を検索
  const buildingPosition = useMemo(() => {
    return convertedNodes.find(n => n.id === 'D2')?.position || [-60, 60, -60]
  }, [convertedNodes])

  return (
    <group>
      {/* 照明 */}
      <ambientLight intensity={LIGHT_INTENSITY * 1.5} color={0xffffff} />

      <directionalLight
        position={[50, 100, 50]}
        intensity={DIRECTIONAL_LIGHT_INTENSITY * 1.5}
        color={0xffffff}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <directionalLight
        position={[-50, 80, -50]}
        intensity={DIRECTIONAL_LIGHT_INTENSITY * 0.8}
        color={0xffffff}
      />

      {/* 地面平面 */}
      <GroundPlane size={size} />

      {/* 地上ルート（車両と同じパスを使用） */}
      {routes.ground.map((item, index) => {
        const isHighlighted = highlightedRoute &&
          highlightedRoute.nodeIds.some((nodeId, i) => {
            if (i === highlightedRoute.nodeIds.length - 1) return false
            const nextNodeId = highlightedRoute.nodeIds[i + 1]
            return (item.edge.from === nodeId && item.edge.to === nextNodeId) ||
              (item.edge.from === nextNodeId && item.edge.to === nodeId)
          })
        return (
          <PathLine
            key={`ground-${index}`}
            path={item.path}
            color="#00ffff"
            animated
            lineWidth={6}
            dimmed={highlightedRoute !== null && !isHighlighted}
          />
        )
      })}

      {/* ハイウェイルート（車両と同じパスを使用、幅広で曲線的） */}
      {routes.highway.map((item, index) => {
        const isHighlighted = highlightedRoute &&
          highlightedRoute.nodeIds.some((nodeId, i) => {
            if (i === highlightedRoute.nodeIds.length - 1) return false
            const nextNodeId = highlightedRoute.nodeIds[i + 1]
            return (item.edge.from === nodeId && item.edge.to === nextNodeId) ||
              (item.edge.from === nextNodeId && item.edge.to === nodeId)
          })
        return (
          <PathLine
            key={`highway-${index}`}
            path={item.path}
            color="#ffaa00"
            animated
            lineWidth={6}
            dimmed={highlightedRoute !== null && !isHighlighted}
          />
        )
      })}

      {/* 空中飛行ルート（車両と同じパスを使用） */}
      {routes.aerial.map((item, index) => {
        const isHighlighted = highlightedRoute &&
          highlightedRoute.nodeIds.some((nodeId, i) => {
            if (i === highlightedRoute.nodeIds.length - 1) return false
            const nextNodeId = highlightedRoute.nodeIds[i + 1]
            return (item.edge.from === nodeId && item.edge.to === nextNodeId) ||
              (item.edge.from === nextNodeId && item.edge.to === nodeId)
          })
        return (
          <PathLine
            key={`aerial-${index}`}
            path={item.path}
            color="#ff00ff"
            animated
            lineWidth={6}
            dimmed={highlightedRoute !== null && !isHighlighted}
          />
        )
      })}

      {/* 飛行機ルート（地図外への航空路線） */}
      {routes.airplane.map((item, index) => {
        const isHighlighted = highlightedRoute &&
          highlightedRoute.nodeIds.some((nodeId, i) => {
            if (i === highlightedRoute.nodeIds.length - 1) return false
            const nextNodeId = highlightedRoute.nodeIds[i + 1]
            return (item.edge.from === nodeId && item.edge.to === nextNodeId) ||
              (item.edge.from === nextNodeId && item.edge.to === nodeId)
          })
        return (
          <PathLine
            key={`airplane-${index}`}
            path={item.path}
            color="#00ff00"
            animated
            lineWidth={2.5}
            dimmed={highlightedRoute !== null && !isHighlighted}
          />
        )
      })}

      {/* 位置マーカー */}
      {convertedNodes.map((node, index) => {
        const isHighlighted = highlightedRoute &&
          highlightedRoute.nodeIds.includes(node.id)
        return (
          <LocationMarker
            key={node.id}
            position={node.position}
            name={node.name}
            color={index === 0 ? '#ff00ff' : '#00ffff'}
            scale={1.2}
            dimmed={highlightedRoute !== null && !isHighlighted}
          />
        )
      })}

      {/* 3D建築物モデル */}
      <Suspense fallback={null}>
        {convertedBuildings.map((building) => (
          <Building3DModel
            key={building.id}
            position={building.position}
            scale={building.scale}
            height={building.height}
          />
        ))}
      </Suspense>

      {/* 神社3Dモデル */}
      <Suspense fallback={null}>
        {convertedShrines.map((shrine) => (
          <Shrine3DModel
            key={shrine.id}
            position={shrine.position!}
            rank={shrine.rank as 'major' | 'medium' | 'small'}
            name={shrine.name}
          />
        ))}
      </Suspense>

      {/* スカイツリー3Dモデル */}
      <Suspense fallback={null}>
        {convertedSkytrees.map((skytree) => (
          <SkyTree3DModel
            key={skytree.id}
            position={skytree.position!}
          />
        ))}
      </Suspense>

      {/* Cocoon Tower 3Dモデル */}
      <Suspense fallback={null}>
        {convertedCocoontowers.map((tower) => (
          <CocoonTower3DModel
            key={tower.id}
            position={tower.position!}
          />
        ))}
      </Suspense>

      {/* 建物（旧ビルボード） */}
      <BillboardBuilding
        position={buildingPosition as [number, number, number]}
        texturePath="/website-assets/build_kiomizu.png"
        scale={30}
      />
    </group>
  )
}

export default CityGround
