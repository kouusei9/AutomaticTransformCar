import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import CityGround from '../components/website/CityGround'
import SkyEnvironment from '../components/website/SkyEnvironment'
import Vehicle from '../components/website/Vehicle'
import { createRoutePathFromNodeIds } from '../utils/routePathGenerator'
import { websocketService } from '../services/websocketService'
import type { RouteResponse } from '../types/routeAPI'

// 初始车辆路线配置
const INITIAL_VEHICLE_ROUTES: VehicleRoute[] = [
  {
    id: 'initial-route-1',
    routeId: 'initial-route-1',
    name: 'テストルート1 (Airplane)',
    nodeIds: ['D1', 'H1', 'OUT_H1'],  // Airplane テスト：伏見稲荷 → 宇治空港 → 地図外
    color: '#00ff00',
    speed: 0.010,
    isCycle: true  // 到达终点后删除车辆
  },
  {
    id: 'initial-route-2',
    routeId: 'initial-route-2',
    name: 'テストルート2 (Drone)',
    nodeIds: ['A2', 'A1', 'A3', 'A4'],  // Drone テスト：東寺 → 二条城
    color: '#00ffff',
    speed: 0.012,
    isCycle: true  // A1→A2→A3→A4→A3→A2→A1 循环
  },
  {
    id: 'initial-route-3',
    routeId: 'initial-route-3',
    name: 'テストルート3 (Road)',
    nodeIds: ['C1', 'C2', 'C3'],  // Road テスト：東福寺 → 三十三間堂 → 祇園
    color: '#ff00ff',
    speed: 0.012,
    isCycle: true  // C1→C2→C3→C2→C1 循环
  }
]

// 车辆路线类型定义
interface VehicleRoute {
  id: string  // 使用 RouteResponse.id 作为唯一标识
  routeId: string  // 保留路线 ID（与 id 相同）
  name: string
  nodeIds: string[]
  color: string
  speed: number
  isCycle: boolean
}

// カメラ追従更新コンポーネント
function CameraFollower({
  followMode,
  vehiclePosition,
  vehicleForward,
  cameraRef,
  controlsRef
}: {
  followMode: boolean
  vehiclePosition: THREE.Vector3 | null
  vehicleForward: THREE.Vector3 | null
  cameraRef: React.RefObject<THREE.PerspectiveCamera>
  controlsRef: React.RefObject<any>
}) {
  useFrame(() => {
    if (followMode && vehiclePosition && vehicleForward && cameraRef.current && controlsRef.current) {
      const offset = vehicleForward.clone().multiplyScalar(-12)
      offset.y += 6
      const targetCameraPos = vehiclePosition.clone().add(offset)

      cameraRef.current.position.lerp(targetCameraPos, 0.08)

      const lookTarget = vehiclePosition.clone().add(vehicleForward.clone().multiplyScalar(15))

      if (controlsRef.current.target) {
        controlsRef.current.target.lerp(lookTarget, 0.08)
      }
    }
  })

  return null
}

/**
 * サイバーパンク都市デモページ
 */
export default function CyberpunkCityDemo() {
  const [followMode, setFollowMode] = useState(false)
  const [vehiclePosition, setVehiclePosition] = useState<THREE.Vector3 | null>(null)
  const [vehicleForward, setVehicleForward] = useState<THREE.Vector3 | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [routePaths, setRoutePaths] = useState<Map<string, THREE.CurvePath<THREE.Vector3>>>(new Map()) // 使用 Map 存储路径，key 为 vehicle.id
  const [routeData, setRouteData] = useState<any>(null)
  const [activeVehicles, setActiveVehicles] = useState<Set<string>>(new Set(['initial-route-1', 'initial-route-2', 'initial-route-3']))  // 活跃的车辆 ID（来自 RouteResponse.id）
  const [vehicleRoutes, setVehicleRoutes] = useState<VehicleRoute[]>(INITIAL_VEHICLE_ROUTES) // 可动态添加车辆
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const controlsRef = useRef<any>(null!)
  const defaultCameraPos = new THREE.Vector3(100, 80, 100)
  const defaultTarget = new THREE.Vector3(0, 0, 0)
  
  // 使用 ref 追踪已添加的路线 ID，避免闭包问题
  const addedRouteIdsRef = useRef<Set<string>>(new Set(['initial-route-1', 'initial-route-2', 'initial-route-3']))

  // 从 RouteResponse 数据提取节点 ID 列表
  const extractNodeIdsFromRoute = (routeResponse: RouteResponse): string[] => {
    if (!routeResponse.nodes || routeResponse.nodes.length === 0) {
      return []
    }
    // nodes 数组已经包含了路线的所有节点，按顺序返回其 ID
    return routeResponse.nodes.map(node => node.id)
  }

  // 添加新车辆到场景（使用 ref 追踪已添加的 ID）
  const addNewVehicle = (start: string, destination: string, routeResponse: RouteResponse) => {
    const nodeIds = extractNodeIdsFromRoute(routeResponse)

    if (nodeIds.length === 0) {
      console.warn('⚠️ 无效的路线数据，无法添加车辆')
      return
    }

    // 使用 RouteResponse.id 作为唯一标识
    const routeId = routeResponse.id

    console.log('🔍 准备添加车辆，路线 ID:', routeId)
    
    // 使用 ref 检查是否已添加（避免闭包问题）
    if (addedRouteIdsRef.current.has(routeId)) {
      console.warn(`⚠️ 车辆已存在（ref 检查），跳过添加: ID=${routeId}, 路线: ${start} → ${destination}`)
      return // 提前返回，不执行任何 setState
    }

    // 标记为已添加
    addedRouteIdsRef.current.add(routeId)
    console.log('✅ 添加到 ref 追踪列表:', Array.from(addedRouteIdsRef.current))

    const newRoute: VehicleRoute = {
      id: routeId,
      routeId: routeId,
      name: `${start} → ${destination}`,
      nodeIds,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`, // 随机颜色
      speed: 0.012,
      isCycle: false // CityRun 的路线是单程
    }

    // 添加到状态
    setVehicleRoutes(prev => {
      console.log('🔍 当前车辆数量:', prev.length)
      console.log('🔍 提取的节点 IDs:', nodeIds)
      const updated = [...prev, newRoute]
      console.log('✅ 更新后的车辆路线:', updated)
      return updated
    })

    setActiveVehicles(prev => {
      const newSet = new Set([...prev, routeId])
      console.log('✅ 更新后的活跃车辆 IDs:', Array.from(newSet))
      return newSet
    })

    console.log(`✅ 添加新车辆: ${newRoute.name}, Route ID: ${routeId}`)
  }

  // ルートデータを読み込み
  useEffect(() => {
    fetch('/website-assets/kyoto_routes.json')
      .then(res => res.json())
      .then(data => {
        setRouteData(data)
      })
      .catch(err => console.error('ルートデータの読み込みに失敗:', err))
  }, [])

  // WebSocket 连接初始化并监听新路线消息
  useEffect(() => {
    websocketService.connect().catch(err => {
      console.warn('⚠️ WebSocket 连接失败，将在后台重试:', err.message)
    })

    // 监听来自 CityRun 的新路线消息
    const cleanup = websocketService.on('NEW_ROUTE', (message) => {
      console.log('📨 收到新路线:', message)
      console.log('📊 路线数据类型:', typeof message.routeData)
      console.log('📊 路线数据内容:', JSON.stringify(message.routeData, null, 2))

      try {
        addNewVehicle(message.start, message.destination, message.routeData)
      } catch (error) {
        console.error('❌ 添加车辆失败:', error)
      }
    })

    return () => {
      cleanup()
      websocketService.disconnect()
    }
    // empty dependency array to set up WebSocket only once
  }, []) // 依赖 vehicleRoutes 以在添加车辆时访问最新状态

  // 設定に基づいて複数の経路を生成
  useEffect(() => {
    if (!routeData) return
    if (routePaths.size === vehicleRoutes.length) return  // 没有新车辆
    
    console.log('🛣️ 开始生成路径，车辆数量:', vehicleRoutes.length)
    const newPaths = new Map(routePaths) // 复制现有路径

    vehicleRoutes.forEach((route: VehicleRoute) => {
      // 如果该车辆的路径已存在，跳过
      if (newPaths.has(route.id)) return

      const nodeIds = route.nodeIds.slice()
      console.log(`🚗 生成车辆 ID ${route.id} (${route.name}) 的路径，节点:`, nodeIds)

      const path = createRoutePathFromNodeIds(
        routeData.nodes,
        routeData.edges,
        nodeIds
      )

      if (path) {
        newPaths.set(route.id, path)
        console.log(`✅ 车辆 ID ${route.id} 路径生成成功`)
      } else {
        console.warn(`❌ 车辆 ID ${route.id} 路径生成失败`)
      }
    })

    console.log(`✅ 总共生成 ${newPaths.size} 条路径`)
    setRoutePaths(newPaths)
  }, [routeData, vehicleRoutes])

  // ノードIDからノード名を取得する関数
  const getNodeName = (nodeId: string): string => {
    if (!routeData) return nodeId
    const node = routeData.nodes.find((n: any) => n.id === nodeId)
    return node ? node.name : nodeId
  }

  // ノードIDの配列をノード名の配列に変換
  const getRouteNames = (nodeIds: string[]): string => {
    return nodeIds.map(id => getNodeName(id)).join(' → ')
  }

  const handleVehicleClick = (vehicleId: string) => (position: THREE.Vector3, forward: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return

    if (!followMode || selectedVehicleId !== vehicleId) {
      setFollowMode(true)
      setSelectedVehicleId(vehicleId)
      setVehiclePosition(position)
      setVehicleForward(forward)

      const offset = forward.clone().multiplyScalar(-12)
      offset.y += 6
      const followPos = position.clone().add(offset)
      const lookAtPoint = position.clone().add(forward.clone().multiplyScalar(15))

      gsap.to(cameraRef.current.position, {
        x: followPos.x,
        y: followPos.y,
        z: followPos.z,
        duration: 1.2,
        ease: 'power2.inOut'
      })
      gsap.to(controlsRef.current.target, {
        x: lookAtPoint.x,
        y: lookAtPoint.y,
        z: lookAtPoint.z,
        duration: 1.2,
        ease: 'power2.inOut'
      })
    } else {
      setFollowMode(false)
      setSelectedVehicleId(null)
      setVehiclePosition(null)
      setVehicleForward(null)

      gsap.to(cameraRef.current.position, {
        x: defaultCameraPos.x,
        y: defaultCameraPos.y,
        z: defaultCameraPos.z,
        duration: 1.2,
        ease: 'power2.inOut'
      })
      gsap.to(controlsRef.current.target, {
        x: defaultTarget.x,
        y: defaultTarget.y,
        z: defaultTarget.z,
        duration: 1.2,
        ease: 'power2.inOut'
      })
    }
  }

  const handlePositionUpdate = (vehicleId: string) => (position: THREE.Vector3, forward: THREE.Vector3) => {
    if (followMode && selectedVehicleId === vehicleId) {
      setVehiclePosition(position)
      setVehicleForward(forward)
    }
  }

  // 车辆到达终点的回调
  const handleVehicleComplete = (vehicleId: string) => {
    const route = vehicleRoutes.find(r => r.id === vehicleId)
    if (!route) return

    // 如果不是循环路线，删除车辆
    if (!route.isCycle) {
      setActiveVehicles(prev => {
        const newSet = new Set(prev)
        newSet.delete(vehicleId)
        return newSet
      })

      // 如果正在跟随该车辆，取消跟随
      if (selectedVehicleId === vehicleId) {
        setFollowMode(false)
        setSelectedVehicleId(null)

        if (cameraRef.current && controlsRef.current) {
          gsap.to(cameraRef.current.position, {
            x: defaultCameraPos.x,
            y: defaultCameraPos.y,
            z: defaultCameraPos.z,
            duration: 1.2,
            ease: 'power2.inOut'
          })
          gsap.to(controlsRef.current.target, {
            x: defaultTarget.x,
            y: defaultTarget.y,
            z: defaultTarget.z,
            duration: 1.2,
            ease: 'power2.inOut'
          })
        }
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#000',
      overflow: 'hidden'
    }}>
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: true, // 改善深度精度
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      >
        <PerspectiveCamera
          ref={cameraRef}
          makeDefault
          position={[100, 80, 100]}
          fov={50}
          near={0.1}
          far={1000}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={!followMode}
          enableZoom={!followMode}
          enableRotate={!followMode}
          minDistance={50}
          maxDistance={300}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          target={[0, 0, 0]}
        />

        <CameraFollower
          followMode={followMode}
          vehiclePosition={vehiclePosition}
          vehicleForward={vehicleForward}
          cameraRef={cameraRef}
          controlsRef={controlsRef}
        />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={500}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-bias={-0.0001}
        />

        <SkyEnvironment />
        {/* <DistantCityscape /> */}
        <CityGround
          onRouteDataLoaded={setRouteData}
          highlightedRoute={selectedVehicleId !== null ? vehicleRoutes.find(r => r.id === selectedVehicleId) || null : null}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.3} transparent />
        </mesh>

        {/* 各車両が異なる経路を走行 */}
        {vehicleRoutes.map((route) => {
          const path = routePaths.get(route.id);
          if (!path || !activeVehicles.has(route.id)) {
            return null;
          }

          return (
            <Vehicle
              key={route.id}
              path={path}
              speed={route.speed}
              startPosition={0}
              onClick={handleVehicleClick(route.id)}
              onPositionUpdate={handlePositionUpdate(route.id)}
              onComplete={() => handleVehicleComplete(route.id)}
              name={route.name}
              isCycle={route.isCycle}
            />
          );
        })}

        <gridHelper args={[200, 20, '#444', '#222']} position={[0, 0.1, 0]} />
        <fog attach="fog" args={['#000', 100, 400]} />
      </Canvas>

      {/* UIオーバーレイ */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: '#00ffff',
          fontFamily: 'monospace',
          fontSize: '14px',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '15px',
          borderRadius: '8px',
          border: `1px solid ${selectedVehicleId !== null ? '#ff00ff' : '#00ffff'}`,
          zIndex: 10,
          pointerEvents: 'none',
          textAlign: 'left'
        }}
      >
        {selectedVehicleId !== null && vehicleRoutes.find(r => r.id === selectedVehicleId) ? (
          // 選択された車両の詳細情報
          (() => {
            const selectedRoute = vehicleRoutes.find(r => r.id === selectedVehicleId)!;
            return (
              <>
                <h2 style={{ margin: '0 0 10px 0', color: '#ff00ff', textAlign: 'left' }}>
                  🎯 車両追跡中
                </h2>
                <div style={{ lineHeight: '1.6', textAlign: 'left' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                    {selectedRoute.name}
                  </div>
                  <div>📍 ルート: {getRouteNames(selectedRoute.nodeIds)}</div>
                  <div>⚡ 速度: {selectedRoute.speed}</div>
                  <div>🔄 モード: {selectedRoute.isCycle ? '循環' : '片道'}</div>
                  <div>🎨 カラー: <span style={{ color: selectedRoute.color }}>■</span> {selectedRoute.color}</div>
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                    再クリックで追跡解除
                  </div>
                </div>
              </>
            );
          })()
        ) : (
          // 全体情報
          <>
            <h2 style={{ margin: '0 0 10px 0', color: '#ff00ff', textAlign: 'left' }}>
              🚀 京都市街地ナビゲーション
            </h2>
            <div style={{ lineHeight: '1.6', textAlign: 'left' }}>
              {vehicleRoutes.filter(r => activeVehicles.has(r.id)).map((route, idx) => (
                <div key={route.id}>🚗 車両{idx + 1}: {route.name}</div>
              ))}
              <div>• {routePaths.size > 0 ? `✓ ${routePaths.size}ルート読み込み完了` : '⏳ ルート読み込み中...'}</div>
              <div>• アクティブ車両: {activeVehicles.size}台</div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                クリックで車両を追跡 | マウスで視点操作
              </div>
            </div>
          </>
        )}
      </div>

      {/* ルート図例（右下角） */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          color: '#00ffff',
          fontFamily: 'monospace',
          fontSize: '13px',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '12px 15px',
          borderRadius: '8px',
          border: '1px solid #00ffff',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <h3 style={{ margin: '0 0 8px 0', color: '#ff00ff', fontSize: '14px' }}>
          🗺️ ルート図例
        </h3>
        <div style={{ lineHeight: '1.8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ffff', fontSize: '16px' }}>━━</span>
            <span>地上ルート (Road)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ffaa00', fontSize: '16px' }}>━━</span>
            <span>高速道路 (Highway)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ff00ff', fontSize: '16px' }}>━━</span>
            <span>ドローン (Drone)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#00ff00', fontSize: '16px' }}>━━</span>
            <span>航空路線 (Airplane)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
