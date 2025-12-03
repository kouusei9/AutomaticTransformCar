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
  type: 'building' | 'shrine' | 'skytree' | 'cocoontower' | 'skyscraper'
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
useGLTF.preload('/website-assets/central_park_tower.glb')

/**
 * 3D建築物モデルコンポーネント (InstancedMesh版)
 */
const Building3DModelInstanced: React.FC<{ buildings: Landmark[] }> = ({ buildings }) => {
  const { scene } = useGLTF('/website-assets/futuristic_city.glb')
  const groupRef = useRef<THREE.Group>(null)
  
  // 为每个建筑物创建独立的实例
  const instances = useMemo(() => {
    return buildings.map((building) => {
      if (!building.position) return null
      
      const [x, y, z] = building.position
      const scale = 5
      const adjustedScale = (building.height / 30) * scale
      
      return {
        position: [x, y, z] as [number, number, number],
        scale: adjustedScale,
        key: building.id
      }
    }).filter(Boolean)
  }, [buildings])
  
  return (
    <group ref={groupRef}>
      {instances.map((instance) => {
        if (!instance) return null
        
        const clonedScene = scene.clone()
        clonedScene.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (child.material) {
              child.material.needsUpdate = true
            }
          }
        })
        
        return (
          <primitive
            key={instance.key}
            object={clonedScene}
            position={instance.position}
            scale={[instance.scale, instance.scale, instance.scale]}
          />
        )
      })}
    </group>
  )
}

/**
 * 神社3Dモデルコンポーネント (InstancedMesh版)
 */
const Shrine3DModelInstanced: React.FC<{ shrines: Landmark[] }> = ({ shrines }) => {
  const { scene } = useGLTF('/website-assets/shrine01.glb')
  const groupRef = useRef<THREE.Group>(null)
  
  const instances = useMemo(() => {
    return shrines.map((shrine) => {
      if (!shrine.position) return null
      
      const [x, y, z] = shrine.position
      const rankScale = shrine.rank === 'major' ? 1.2 : shrine.rank === 'medium' ? 1.0 : 0.8
      const finalScale = rankScale * 0.01
      
      return {
        position: [x, y, z] as [number, number, number],
        scale: finalScale,
        key: shrine.id
      }
    }).filter(Boolean)
  }, [shrines])
  
  return (
    <group ref={groupRef}>
      {instances.map((instance) => {
        if (!instance) return null
        
        const clonedScene = scene.clone()
        clonedScene.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (child.material) {
              child.material.needsUpdate = true
            }
          }
        })
        
        return (
          <primitive
            key={instance.key}
            object={clonedScene}
            position={instance.position}
            scale={[instance.scale, instance.scale, instance.scale]}
          />
        )
      })}
    </group>
  )
}

/**
 * 3D建築物モデルコンポーネント
 */
const Building3DModel: React.FC<{
  position: [number, number, number]
  scale?: number
  height?: number
}> = ({ position, scale = 1, height = 120 }) => {
  const { scene } = useGLTF('/website-assets/futuristic_city.glb')
  const clonedScene = useMemo(() => {
    const cloned = scene.clone()
    // 遍历所有子对象，确保阴影设置应用到所有网格
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // 确保材质支持阴影
        if (child.material) {
          child.material.needsUpdate = true
        }
      }
    })
    return cloned
  }, [scene])

  // 统一高度120m，调整缩放使建筑物大小合适
  // futuristic_city.glb -> 5
  // central_park_tower.glb -> 0.7
  scale = 5
  const adjustedScale = (height / 30) * scale // 基准scale调整

  return (
    <group position={position}>
      {/* <mesh>
        <boxGeometry args={[10, 0.1, 10]} />
        <meshStandardMaterial color={0x222244} />
      </mesh> */}
      <primitive
        object={clonedScene}
        // position={position}
        scale={[adjustedScale, adjustedScale, adjustedScale]}
        castShadow
        receiveShadow
      />
    </group>
  )
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
  const { scene } = useGLTF('/website-assets/shrine01.glb')
  const clonedScene = useMemo(() => {
    const cloned = scene.clone()
    // 遍历所有子对象，确保阴影设置应用到所有网格
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // 确保材质支持阴影
        if (child.material) {
          child.material.needsUpdate = true
        }
      }
    })
    return cloned
  }, [scene])

  // ランクに応じてスケールを調整
  const rankScale = rank === 'major' ? 1.2 : rank === 'medium' ? 1.0 : 0.8
  // shrine.glb -> 8.0; shrine01.glb -> 0.01
  const finalScale = scale * rankScale * 0.01 // 基準スケール

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
      {/* <pointLight
        position={[0, 80, 0]}
        intensity={0.5}
        color="#00ffff"
        distance={100}
      /> */}
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
 * Skyscraper 3Dモデルコンポーネント (Central Park Tower)
 */
const Skyscraper3DModel: React.FC<{
  position: [number, number, number]
  scale?: number
}> = ({ position, scale = 1 }) => {
  try {
    const { scene } = useGLTF('/website-assets/central_park_tower.glb')
    const clonedScene = useMemo(() => {
      const cloned = scene.clone()
      // モデル内のすべてのメッシュを表示設定
      cloned.traverse((child: any) => {
        if (child.isMesh) {
          child.visible = true
          child.castShadow = true
          child.receiveShadow = true
          if (child.material) {
            child.material.side = THREE.DoubleSide
            child.material.transparent = false
            child.material.opacity = 1.0
            child.material.needsUpdate = true
          }
        }
      })
      return cloned
    }, [scene])

    // Central Park Towerの基準スケール（高さ472mを考慮）
    const finalScale = scale * 0.5

    return (
      <group position={position}>
        {/* 実際のモデル */}
        <primitive
          object={clonedScene}
          scale={[finalScale, finalScale, finalScale]}
          castShadow
          receiveShadow
        />

        {/* Skyscraper周囲の光効果 */}
        <pointLight
          position={[0, 100, 0]}
          intensity={0.8}
          color="#00ddff"
          distance={150}
        />
      </group>
    )
  } catch (error) {
    console.error('❌ Skyscraper loading error:', error)
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
 * 全息广告屏组件 (Hologram Billboard)
 * 使用 shader 创建赛博朋克风格的动态广告效果
 */
const HologramBillboard: React.FC<{
  position: [number, number, number]
  size?: [number, number]
  color?: string
}> = ({ position, size = [12, 8], color = '#00ffff' }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const shaderMaterialRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (shaderMaterialRef.current) {
      shaderMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  // 全息 Shader
  const hologramShader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.7 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vPosition;
      
      // 扫描线效果
      float scanline(vec2 uv, float time) {
        return sin(uv.y * 100.0 + time * 5.0) * 0.5 + 0.5;
      }
      
      // 闪烁效果
      float flicker(float time) {
        return sin(time * 10.0) * 0.05 + 0.95;
      }
      
      // 网格效果
      float grid(vec2 uv) {
        vec2 grid = fract(uv * 20.0);
        float lineX = step(0.95, grid.x);
        float lineY = step(0.95, grid.y);
        return max(lineX, lineY);
      }
      
      // 文字区域（简化的矩形）
      float textArea(vec2 uv) {
        vec2 center = uv - 0.5;
        float rect = step(abs(center.x), 0.4) * step(abs(center.y), 0.15);
        return rect;
      }
      
      void main() {
        vec2 uv = vUv;
        
        // 组合效果
        float scan = scanline(uv, uTime) * 0.3;
        float flick = flicker(uTime);
        float gridEffect = grid(uv) * 0.2;
        float textEffect = textArea(uv);
        
        // 边缘发光
        float edgeGlow = 1.0 - length(uv - 0.5) * 0.8;
        
        // 最终颜色
        vec3 finalColor = uColor;
        float intensity = (0.5 + scan + gridEffect + textEffect * 0.5) * flick * edgeGlow;
        
        gl_FragColor = vec4(finalColor * intensity, uOpacity * intensity);
      }
    `
  }), [color])

  return (
    <group position={position}>
      {/* 主广告屏 */}
      <mesh ref={meshRef}>
        <planeGeometry args={[size[0], size[1]]} />
        <shaderMaterial
          ref={shaderMaterialRef}
          {...hologramShader}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 边框光效 */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size[0], size[1])]} />
        <lineBasicMaterial color={color} transparent opacity={0.8} />
      </lineSegments>

      {/* 背后点光源 */}
      <pointLight
        position={[0, 0, -1]}
        color={color}
        intensity={15}
        distance={20}
      />
    </group>
  )
}

/**
 * 全息广告屏集合
 */
const HologramBillboards: React.FC<{ buildings: Landmark[] }> = ({ buildings }) => {
  // 选择几个建筑物位置放置广告屏
  const billboardPositions = useMemo(() => {
    return buildings.slice(0, 4).map((building, idx) => {
      if (!building.position) return null

      const [x, , z] = building.position
      const height = (building.height / 30) * 0.5 * 11
      const colors = ['#00ffff', '#ff00ff', '#00ff00', '#ffaa00']

      return {
        // 放置在建筑物正上方
        position: [x, height + 3, z] as [number, number, number],
        color: colors[idx % colors.length],
        rotation: [0, 0, 0] as [number, number, number] // 水平放置
      }
    }).filter(Boolean)
  }, [buildings])

  return (
    <>
      {billboardPositions.map((billboard, i) => {
        if (!billboard) return null
        return (
          <group key={`billboard-${i}`} rotation={billboard.rotation}>
            <HologramBillboard
              position={billboard.position}
              color={billboard.color}
              size={[10, 6]}
            />
          </group>
        )
      })}
    </>
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
  const [skyscrapers, setSkyscrapers] = useState<Landmark[]>([])

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

  // ランドマークデータを読み込み（建築物、神社、スカイツリー、コクーンタワー、摩天楼を統合）
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
        const skyscrapersData = landmarks.filter((l: Landmark) => l.type === 'skyscraper')

        console.log('📍 Landmarks loaded:', {
          buildings: buildings.length,
          shrines: shrinesData.length,
          skytrees: skytreesData.length,
          cocoontowers: cocoontowersData.length,
          skyscrapers: skyscrapersData.length
        })
        console.log('🏢 Cocoon Towers data:', cocoontowersData)
        console.log('🏙️ Skyscrapers data:', skyscrapersData)

        setCityBuildings(buildings)
        setShrines(shrinesData)
        setSkytrees(skytreesData)
        setCocoontowers(cocoontowersData)
        setSkyscrapers(skyscrapersData)
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
    const buildingScale = 1.0 // 渲染时使用的scale
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

  // Skyscraper座標を変換
  const convertedSkyscrapers = useMemo(() => {
    const converted = skyscrapers.map(tower => {
      const pos3d = latLngToPosition3D(tower.coordinates)

      // Skyscraperは地面レベルに配置
      const yPosition = 0
      const position = [pos3d.x, yPosition, pos3d.z] as [number, number, number]

      return {
        ...tower,
        position
      }
    })

    if (converted.length > 0) {
      console.log('🏙️ Skyscraper positions:', converted.map(t => ({
        name: t.name,
        coords: t.coordinates,
        position: t.position
      })))
    }

    return converted
  }, [skyscrapers])

  // ルートを生成 - 車両と同じロジックでパスを生成
  const routes = useMemo(() => {
    if (!routeData || convertedNodes.length === 0) {
      return { ground: [], aerial: [], highway: [], airplane: [] }
    }

    const nodeEdgeTypes = analyzeNodeEdgeTypes(routeData.edges)
    return generateRoutes(routeData.edges, convertedNodes, nodeEdgeTypes, routeData)
  }, [routeData, convertedNodes])

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

      {/* 3D建築物モデル (InstancedMesh最適化) */}
      <Suspense fallback={null}>
        <Building3DModelInstanced buildings={convertedBuildings} />
      </Suspense>

      {/* 全息广告屏 */}
      <HologramBillboards buildings={convertedBuildings} />

      {/* 神社3Dモデル (InstancedMesh最適化) */}
      <Suspense fallback={null}>
        <Shrine3DModelInstanced shrines={convertedShrines} />
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

      {/* Skyscraper 3Dモデル (Central Park Tower) */}
      <Suspense fallback={null}>
        {convertedSkyscrapers.map((tower) => (
          <Skyscraper3DModel
            key={tower.id}
            position={tower.position!}
          />
        ))}
      </Suspense>
    </group>
  )
}

export default CityGround
