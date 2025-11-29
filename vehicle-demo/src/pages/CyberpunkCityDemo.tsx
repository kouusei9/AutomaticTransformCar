import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
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
import { useAutoViewSwitch } from '../hooks/useAutoViewSwitch'
import { INITIAL_VEHICLE_ROUTES } from '../config/vehicleRoutes'
import { calculateTotalTime } from '../types/routeAPI'

// 自动切换间隔时间（毫秒）
const AUTO_SWITCH_INTERVAL = 10000 // 10 秒

/**
 * サイバーパンク都市デモページ
 */
export default function CyberpunkCityDemo() {
  const [routeData, setRouteData] = useState<any>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const controlsRef = useRef<any>(null!)
  const isAutoModeRef = useRef(false) // 跟踪自动模式状态
  const stickyVehicleIdRef = useRef<string | null>(null) // 粘性跟踪的车辆ID
  const routePathsRef = useRef<Map<string, THREE.CurvePath<THREE.Vector3>>>(new Map()) // 路径 ref

  // 车辆路线管理
  const {
    vehicleRoutes,
    activeVehicles,
    extractNodeIds,
    addVehicle,
    removeVehicle,
    getVehicleRoute
  } = useVehicleRoutes(INITIAL_VEHICLE_ROUTES)

  // 相机跟踪
  const {
    followMode,
    selectedVehicleId,
    vehiclePosition,
    vehicleForward,
    toggleFollow,
    updateVehiclePosition,
    startFollowing,
    stopFollowing
  } = useCameraFollow(cameraRef, controlsRef)

  // 获取活跃车辆ID列表
  const activeVehicleIds = useMemo(() => {
    return vehicleRoutes
      .filter(route => activeVehicles.has(route.id))
      .map(route => route.id)
  }, [vehicleRoutes, activeVehicles])

  // 路径生成（使用回调通知新路径生成）
  const routePaths = useRoutePaths(
    vehicleRoutes, 
    routeData, 
    extractNodeIds, 
    useCallback((vehicleId: string) => {
      console.log(`📢 路径生成回调触发: ${vehicleId}`)
      console.log(`  自动模式: ${isAutoModeRef.current}`)
      
      // 如果在自动模式下，立即切换到新车辆并设置粘性跟踪
      if (isAutoModeRef.current) {
        console.log(`🆕 新车辆加入，切换跟踪: ${vehicleId}`)
        setTimeout(() => {
          const route = getVehicleRoute(vehicleId)
          console.log(`  找到路线:`, route?.name || '无')
          
          if (route) {
            // 从 ref 获取最新的路径 Map
            const path = routePathsRef.current.get(vehicleId)
            console.log(`  找到路径:`, path ? '是' : '否')
            console.log(`  当前 routePathsRef 大小:`, routePathsRef.current.size)
            console.log(`  当前 routePathsRef keys:`, Array.from(routePathsRef.current.keys()))
            
            if (path) {
              const startPos = path.getPointAt(0)
              const startTangent = path.getTangentAt(0).normalize()
              startFollowing(vehicleId, startPos, startTangent)
              // 设置粘性跟踪标记
              stickyVehicleIdRef.current = vehicleId
              console.log(`🔒 粘性跟踪启用: ${route.name}`)
            } else {
              console.warn(`⚠️ 未找到路径: ${vehicleId}`)
            }
          }
        }, 100) // 增加延迟到 100ms
      }
    }, [getVehicleRoute, startFollowing])
  )

  // 同步 routePaths 到 ref
  useEffect(() => {
    routePathsRef.current = routePaths
  }, [routePaths])

  // 切换到指定车辆的回调
  const handleSwitchToVehicle = useCallback((vehicleId: string) => {
    const route = getVehicleRoute(vehicleId)
    if (route) {
      const path = routePaths.get(vehicleId)
      if (path) {
        const startPos = path.getPointAt(0)
        const startTangent = path.getTangentAt(0).normalize()
        startFollowing(vehicleId, startPos, startTangent)
      }
    }
  }, [routePaths, getVehicleRoute, startFollowing])

  // 切换到全视角的回调
  const handleSwitchToOverview = useCallback(() => {
    stopFollowing()
  }, [stopFollowing])

  // 自动视角切换
  const {
    isAutoMode,
    toggleAutoMode,
    disableAutoMode
  } = useAutoViewSwitch(
    activeVehicleIds,
    handleSwitchToVehicle,
    handleSwitchToOverview,
    { switchInterval: AUTO_SWITCH_INTERVAL },
    () => stickyVehicleIdRef.current // 传递获取粘性跟踪状态的函数
  )

  // 同步 isAutoMode 到 ref
  useEffect(() => {
    isAutoModeRef.current = isAutoMode
  }, [isAutoMode])

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
    // 手动点击时关闭自动模式
    disableAutoMode()
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
    // 如果是粘性跟踪的车辆完成了，解除粘性跟踪
    if (stickyVehicleIdRef.current === vehicleId) {
      console.log(`🔓 粘性跟踪解除: ${route?.name || vehicleId}`)
      stickyVehicleIdRef.current = null
      // 恢复自动切换
      if (isAutoModeRef.current) {
        console.log(`🔄 恢复自动切换模式`)
        stopFollowing()
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
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
      
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
          isAutoMode={isAutoMode}
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

      {/* 自动/手动切换按钮（左下角） */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 10
        }}
      >
        <button
          onClick={toggleAutoMode}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: isAutoMode ? '#000' : '#00ffff',
            background: isAutoMode 
              ? 'linear-gradient(135deg, #00ffff 0%, #00ff88 100%)' 
              : 'rgba(0, 0, 0, 0.7)',
            border: `2px solid ${isAutoMode ? '#00ffff' : '#00ffff'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: isAutoMode 
              ? '0 0 20px rgba(0, 255, 255, 0.5)' 
              : '0 0 10px rgba(0, 255, 255, 0.2)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 255, 0.8)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = isAutoMode 
              ? '0 0 20px rgba(0, 255, 255, 0.5)' 
              : '0 0 10px rgba(0, 255, 255, 0.2)'
          }}
        >
          {isAutoMode ? '🤖 自動モード' : '👤 手動モード'}
        </button>
        
        {isAutoMode && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#00ffff',
              background: 'rgba(0, 0, 0, 0.7)',
              border: '1px solid #00ffff',
              borderRadius: '6px',
              textAlign: 'center',
              animation: 'pulse 2s infinite'
            }}
          >
            ⏱️ {AUTO_SWITCH_INTERVAL / 1000}秒ごとに視点切替中
          </div>
        )}
      </div>
    </div>
  )
}
