import React, { useMemo, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { LocationMarker } from './LocationMarker'
import { RouteLine } from './RouteLine'
import { latLngToPosition3D } from '../utils/coordinateConverter'
import { type RouteData, type RouteEdge } from '../utils/routePathGenerator'
import { DRONE_ALTITUDE } from '../utils/constants'

/**
 * Cyberpunk City Ground Component
 * Renders aerial and ground routes with vertical connectors
 */

// ==================== Constants ====================
const GROUND_COLOR = new THREE.Color(0x0a0a0f)
const LIGHT_INTENSITY = 0.6
const DIRECTIONAL_LIGHT_INTENSITY = 0.8
const ROUTE_DATA_URL = '/kyoto_routes.json'
const GROUND_SIZE = 200

// ==================== Types ====================
interface Route {
  startPos: [number, number, number]
  endPos: [number, number, number]
  distance: number
}

interface VerticalRoute {
  startPos: [number, number, number]
  endPos: [number, number, number]
  nodeId: string
}

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

// ==================== Components ====================

/**
 * Ground plane with map texture
 */
const GroundPlane: React.FC<{ size: number }> = ({ size }) => {
  const textureResult = useTexture('/routes_map.png')
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
      
      console.log('Map texture loaded:', mapTexture, 'Size:', size)
    } else {
      console.error('Failed to load map texture:', mapTexture)
    }
  }, [mapTexture, size])
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[size, size, 1, 1]} />
      {mapTexture ? (
        <meshStandardMaterial
          map={mapTexture}
          color={0xffffff}
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
 * Billboard Building Component
 * 建筑物图片，始终朝向相机
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

// ==================== Helper Functions ====================

/**
 * 统计每个节点连接的边类型
 */
function analyzeNodeEdgeTypes(edges: RouteEdge[]): Map<string, NodeEdgeTypes> {
  const nodeEdgeTypes = new Map<string, NodeEdgeTypes>()
  
  edges.forEach(edge => {
    const isDrone = edge.type === 'drone'
    
    // 记录 from 节点
    const fromTypes = nodeEdgeTypes.get(edge.from) || { hasDrone: false, hasGround: false }
    if (isDrone) fromTypes.hasDrone = true
    else fromTypes.hasGround = true
    nodeEdgeTypes.set(edge.from, fromTypes)
    
    // 记录 to 节点
    const toTypes = nodeEdgeTypes.get(edge.to) || { hasDrone: false, hasGround: false }
    if (isDrone) toTypes.hasDrone = true
    else toTypes.hasGround = true
    nodeEdgeTypes.set(edge.to, toTypes)
  })
  
  return nodeEdgeTypes
}

/**
 * 生成路线数据
 */
function generateRoutes(
  edges: RouteEdge[],
  convertedNodes: ConvertedNode[],
  nodeEdgeTypes: Map<string, NodeEdgeTypes>
) {
  const ground: Route[] = []
  const aerial: Route[] = []
  const vertical: VerticalRoute[] = []
  
  // 处理边
  edges.forEach(edge => {
    const fromNode = convertedNodes.find(n => n.id === edge.from)
    const toNode = convertedNodes.find(n => n.id === edge.to)
    
    if (!fromNode || !toNode) return
    
    if (edge.type === 'drone') {
      // 空中路线 - 提升到空中高度
      aerial.push({
        startPos: [fromNode.position[0], DRONE_ALTITUDE, fromNode.position[2]],
        endPos: [toNode.position[0], DRONE_ALTITUDE, toNode.position[2]],
        distance: edge.distance_km
      })
    } else {
      // 地面路线
      ground.push({
        startPos: fromNode.position,
        endPos: toNode.position,
        distance: edge.distance_km
      })
    }
  })
  
  // 为需要升降的节点创建垂直路线（既有drone又有ground连接的节点）
  nodeEdgeTypes.forEach((types, nodeId) => {
    if (types.hasDrone && types.hasGround) {
      const node = convertedNodes.find(n => n.id === nodeId)
      if (node) {
        vertical.push({
          startPos: node.position, // 地面位置
          endPos: [node.position[0], DRONE_ALTITUDE, node.position[2]], // 空中位置
          nodeId
        })
      }
    }
  })
  
  return { ground, aerial, vertical }
}

// ==================== Main Component ====================

interface CityGroundProps {
  size?: number
  onRouteDataLoaded?: (data: RouteData) => void
}

/**
 * CityGround Component
 */
export const CityGround: React.FC<CityGroundProps> = ({ 
  size = GROUND_SIZE,
  onRouteDataLoaded 
}) => {
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  
  // 加载路线数据
  useEffect(() => {
    fetch(ROUTE_DATA_URL)
      .then(res => res.json())
      .then(data => {
        console.log('Route data loaded:', data)
        setRouteData(data)
        onRouteDataLoaded?.(data)
      })
      .catch(err => console.error('Failed to load route data:', err))
  }, [onRouteDataLoaded])
  
  // 转换节点坐标
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
  
  // 生成路线 - 分离地面和空中路线，并计算升降节点
  const routes = useMemo(() => {
    if (!routeData || convertedNodes.length === 0) {
      return { ground: [], aerial: [], vertical: [] }
    }
    
    const nodeEdgeTypes = analyzeNodeEdgeTypes(routeData.edges)
    return generateRoutes(routeData.edges, convertedNodes, nodeEdgeTypes)
  }, [routeData, convertedNodes])
  
  // 查找特定建筑物位置
  const buildingPosition = useMemo(() => {
    return convertedNodes.find(n => n.id === 'D2')?.position || [-60, 0, -60]
  }, [convertedNodes])
  
  return (
    <group>
      {/* 光照 */}
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
      
      {/* 地面路线 */}
      {routes.ground.map((route, index) => (
        <RouteLine
          key={`ground-${index}`}
          startPos={route.startPos}
          endPos={route.endPos}
          color="#00ffff"
          animated
        />
      ))}
      
      {/* 空中飞行路线（drone） */}
      {routes.aerial.map((route, index) => (
        <RouteLine
          key={`aerial-${index}`}
          startPos={route.startPos}
          endPos={route.endPos}
          color="#ff00ff"
          animated
        />
      ))}
      
      {/* 垂直升降路线 */}
      {routes.vertical.map((route) => (
        <RouteLine
          key={`vertical-${route.nodeId}`}
          startPos={route.startPos}
          endPos={route.endPos}
          color="#ff00ff"
          animated
        />
      ))}
      
      {/* 位置标记 */}
      {convertedNodes.map((node, index) => (
        <LocationMarker
          key={node.id}
          position={node.position}
          name={node.name}
          color={index === 0 ? '#ff00ff' : '#00ffff'}
          scale={1.2}
        />
      ))}
      
      {/* 建筑物 */}
      <BillboardBuilding 
        position={buildingPosition as [number, number, number]}
        texturePath="/build_kiomizu.png"
        scale={30}
      />
    </group>
  )
}

export default CityGround
