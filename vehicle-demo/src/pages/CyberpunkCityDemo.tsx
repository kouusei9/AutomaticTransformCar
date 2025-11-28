import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import CityGround from '../components/website/CityGround'
import SkyEnvironment from '../components/website/SkyEnvironment'
import DistantCityscape from '../components/website/DistantCityscape'
import Vehicle from '../components/website/Vehicle'
import { CameraFollower } from '../components/website/CameraFollower'
import { useVehicleRoutes } from '../hooks/useVehicleRoutes'
import { useRoutePaths } from '../hooks/useRoutePaths'
import { useCameraFollow } from '../hooks/useCameraFollow'
import { useWebSocket } from '../hooks/useWebSocket'
import { INITIAL_VEHICLE_ROUTES } from '../config/vehicleRoutes'
import { calculateTotalTime } from '../types/routeAPI'

/**
 * サイバーパンク都市デモページ
 */
export default function CyberpunkCityDemo() {
  const [routeData, setRouteData] = useState<any>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const controlsRef = useRef<any>(null!)

  // 车辆路线管理
  const {
    vehicleRoutes,
    activeVehicles,
    extractNodeIds,
    addVehicle,
    removeVehicle,
    getVehicleRoute
  } = useVehicleRoutes(INITIAL_VEHICLE_ROUTES)

  // 路径生成
  const routePaths = useRoutePaths(vehicleRoutes, routeData, extractNodeIds)

  // 相机跟踪
  const {
    followMode,
    selectedVehicleId,
    vehiclePosition,
    vehicleForward,
    toggleFollow,
    updateVehiclePosition
  } = useCameraFollow(cameraRef, controlsRef)

  // WebSocket 连接
  useWebSocket({
    onNewRoute: addVehicle
  })

  // ルートデータを読み込み
  useEffect(() => {
    fetch('/website-assets/kyoto_routes.json')
      .then(res => res.json())
      .then(data => {
        setRouteData(data)
      })
      .catch(err => console.error('ルートデータの読み込みに失敗:', err))
  }, [])

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

  // 从 VehicleRoute 中提取 nodeIds
  const extractNodeIdsFromRoute = (route: any): string[] => {
    if (route.nodeIds) return route.nodeIds
    if (route.path) {
      return route.path.map((segment: any) => 
        typeof segment === 'string' ? segment : segment.nodeId
      )
    }
    return []
  }

  // 车辆点击处理
  const handleVehicleClick = (vehicleId: string) => (position: THREE.Vector3, forward: THREE.Vector3) => {
    toggleFollow(vehicleId, position, forward)
  }

  // 车辆位置更新处理
  const handlePositionUpdate = (vehicleId: string) => (position: THREE.Vector3, forward: THREE.Vector3) => {
    updateVehiclePosition(vehicleId, position, forward)
  }

  // 车辆到达终点的回调
  const handleVehicleComplete = (vehicleId: string) => {
    const route = getVehicleRoute(vehicleId)
    if (!route || route.isCycle) return
    
    removeVehicle(vehicleId)
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
        <DistantCityscape />
        <CityGround
          onRouteDataLoaded={setRouteData}
          highlightedRoute={selectedVehicleId !== null ? (() => {
            const route = vehicleRoutes.find(r => r.id === selectedVehicleId)
            return route ? { nodeIds: extractNodeIdsFromRoute(route) } : null
          })() : null}
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
                  <div>📍 ルート: {getRouteNames(extractNodeIdsFromRoute(selectedRoute))}</div>
                  <div>⏱️ 所要時間: {calculateTotalTime(selectedRoute.edges)}分 (実際) → {Math.round(calculateTotalTime(selectedRoute.edges) / 20)}秒 (デモ)</div>
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
