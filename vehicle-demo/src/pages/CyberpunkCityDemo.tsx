import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import CityGround from '../components/website/CityGround'
import SkyEnvironment from '../components/website/SkyEnvironment'
import Vehicle from '../components/website/Vehicle'
import DistantCityscape from '../components/website/DistantCityscape'
import { createRoutePathFromNodeIds } from '../utils/routePathGenerator'

// 車両ルート設定（後でAPIから取得可能）
// 主要な経由点のみ指定すれば、システムが自動的にエッジに基づいて最短経路を探索
const VEHICLE_ROUTES = [
  {
    id: 1,
    name: 'テストルート1 (Airplane)',
    nodeIds: ['D1', 'H1', 'OUT_H1'],  // Airplane テスト：伏見稲荷 → 宇治空港 → 地図外
    color: '#00ff00',
    speed: 0.010,
    isCycle: true  // 到达终点后删除车辆
  },
  {
    id: 2,
    name: 'テストルート2 (Drone)',
    nodeIds: ['A2', 'A1', 'A3', 'A4'],  // Drone テスト：東寺 → 二条城
    color: '#00ffff',
    speed: 0.012,
    isCycle: true  // A1→A2→A3→A4→A3→A2→A1 循环
  },
  {
    id: 3,
    name: 'テストルート3 (Road)',
    nodeIds: ['C1', 'C2', 'C3'],  // Road テスト：東福寺 → 三十三間堂 → 祇園
    color: '#ff00ff',
    speed: 0.012,
    isCycle: true  // C1→C2→C3→C2→C1 循环
  }
]

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
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const [routePaths, setRoutePaths] = useState<THREE.CurvePath<THREE.Vector3>[]>([])
  const [routeData, setRouteData] = useState<any>(null)
  const [activeVehicles, setActiveVehicles] = useState<Set<number>>(new Set([0, 1, 2]))  // 活跃的车辆索引
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const controlsRef = useRef<any>(null!)
  const defaultCameraPos = new THREE.Vector3(100, 80, 100)
  const defaultTarget = new THREE.Vector3(0, 0, 0)

  // ルートデータを読み込み
  useEffect(() => {
    fetch('/website-assets/kyoto_routes.json')
      .then(res => res.json())
      .then(data => {
        setRouteData(data)
      })
      .catch(err => console.error('ルートデータの読み込みに失敗:', err))
  }, [])

  // 設定に基づいて複数の経路を生成
  useEffect(() => {
    if (routeData) {
      const paths: THREE.CurvePath<THREE.Vector3>[] = []
      
      VEHICLE_ROUTES.forEach(route => {
        // 直接使用原始节点序列，不添加返程节点
        const nodeIds = route.nodeIds.slice()
        
        const path = createRoutePathFromNodeIds(
          routeData.nodes,
          routeData.edges,
          nodeIds
        )
        
        if (path) {
          paths.push(path)
        }
      })
      
      setRoutePaths(paths)
    }
  }, [routeData])

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

  const handleVehicleClick = (vehicleId: number) => (position: THREE.Vector3, forward: THREE.Vector3) => {
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
  
  const handlePositionUpdate = (vehicleId: number) => (position: THREE.Vector3, forward: THREE.Vector3) => {
    if (followMode && selectedVehicleId === vehicleId) {
      setVehiclePosition(position)
      setVehicleForward(forward)
    }
  }

  // 车辆到达终点的回调
  const handleVehicleComplete = (vehicleId: number) => {
    const route = VEHICLE_ROUTES[vehicleId]
    
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
          powerPreference: 'high-performance'
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
        <DistantCityscape />
        <CityGround 
          onRouteDataLoaded={setRouteData} 
          highlightedRoute={selectedVehicleId !== null ? VEHICLE_ROUTES[selectedVehicleId] : null}
        />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.3} transparent />
        </mesh>
        
        {/* 各車両が異なる経路を走行 */}
        {routePaths.length >= 3 && (
          <>
            {activeVehicles.has(0) && (
              <Vehicle 
                path={routePaths[0]}
                speed={VEHICLE_ROUTES[0].speed} 
                startPosition={0} 
                onClick={handleVehicleClick(0)}
                onPositionUpdate={handlePositionUpdate(0)}
                onComplete={() => handleVehicleComplete(0)}
                name={VEHICLE_ROUTES[0].name}
                isCycle={VEHICLE_ROUTES[0].isCycle}
              />
            )}
            {activeVehicles.has(1) && (
              <Vehicle 
                path={routePaths[1]}
                speed={VEHICLE_ROUTES[1].speed} 
                startPosition={0}
                onClick={handleVehicleClick(1)}
                onPositionUpdate={handlePositionUpdate(1)}
                onComplete={() => handleVehicleComplete(1)}
                name={VEHICLE_ROUTES[1].name}
                isCycle={VEHICLE_ROUTES[1].isCycle}
              />
            )}
            {activeVehicles.has(2) && (
              <Vehicle 
                path={routePaths[2]}
                speed={VEHICLE_ROUTES[2].speed} 
                startPosition={0}
                onClick={handleVehicleClick(2)}
                onPositionUpdate={handlePositionUpdate(2)}
                onComplete={() => handleVehicleComplete(2)}
                name={VEHICLE_ROUTES[2].name}
                isCycle={VEHICLE_ROUTES[2].isCycle}
              />
            )}
          </>
        )}
        
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
        {selectedVehicleId !== null ? (
          // 選択された車両の詳細情報
          <>
            <h2 style={{ margin: '0 0 10px 0', color: '#ff00ff', textAlign: 'left' }}>
              🎯 車両追跡中
            </h2>
            <div style={{ lineHeight: '1.6', textAlign: 'left' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                {VEHICLE_ROUTES[selectedVehicleId].name}
              </div>
              <div>📍 ルート: {getRouteNames(VEHICLE_ROUTES[selectedVehicleId].nodeIds)}</div>
              <div>⚡ 速度: {VEHICLE_ROUTES[selectedVehicleId].speed}</div>
              <div>🔄 モード: {VEHICLE_ROUTES[selectedVehicleId].isCycle ? '循環' : '片道'}</div>
              <div>🎨 カラー: <span style={{ color: VEHICLE_ROUTES[selectedVehicleId].color }}>■</span> {VEHICLE_ROUTES[selectedVehicleId].color}</div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
                再クリックで追跡解除
              </div>
            </div>
          </>
        ) : (
          // 全体情報
          <>
            <h2 style={{ margin: '0 0 10px 0', color: '#ff00ff', textAlign: 'left' }}>
              🚀 京都市街地ナビゲーション
            </h2>
            <div style={{ lineHeight: '1.6', textAlign: 'left' }}>
              {activeVehicles.has(0) && <div>🚗 車両1: {VEHICLE_ROUTES[0].name}</div>}
              {activeVehicles.has(1) && <div>🚙 車両2: {VEHICLE_ROUTES[1].name}</div>}
              {activeVehicles.has(2) && <div>🚕 車両3: {VEHICLE_ROUTES[2].name}</div>}
              <div>• {routePaths.length > 0 ? `✓ ${routePaths.length}ルート読み込み完了` : '⏳ ルート読み込み中...'}</div>
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
