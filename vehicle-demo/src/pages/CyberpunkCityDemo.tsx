import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import CityGround from '../components/website/CityGround'
import SkyEnvironment from '../components/website/SkyEnvironment'
import DistantCityscape from '../components/website/DistantCityscape'
import Vehicle from '../components/website/Vehicle'
import { CameraFollower } from '../components/website/CameraFollower'
import { RouteMarkers } from '../components/website/RouteMarkers'
import { MultiLayerDustParticles } from '../components/website/DustParticles'
import { VolumetricFog, GodRays, AtmosphericParticles } from '../components/website/VolumetricFog'
import { useVehicleRoutes } from '../hooks/useVehicleRoutes'
import { useRoutePaths } from '../hooks/useRoutePaths'
import { useCameraFollow } from '../hooks/useCameraFollow'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAutoViewSwitch } from '../hooks/useAutoViewSwitch'
import { INITIAL_VEHICLE_ROUTES } from '../config/vehicleRoutes'
import { calculateTotalTime } from '../types/routeAPI'
import { latLngToPosition3D } from '../utils/coordinateConverter'

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
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false) // 全体情报展开状态
  const [isTechStackOpen, setIsTechStackOpen] = useState(false) // 技术栈面板状态
  const [floatingLandmarks, setFloatingLandmarks] = useState<Array<{
    position: [number, number, number]
    name: string
  }>>([]) // 浮动标记数据

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
    // VehicleRoute 继承自 RouteResponse，包含 nodes 数组
    if (route.nodes && Array.isArray(route.nodes)) {
      return route.nodes.map((node: any) => node.id)
    }
    // 备用：如果有 nodeIds 字段
    if (route.nodeIds) return route.nodeIds
    // 备用：如果有 path 字段
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
        
        /* 自定义滚动条样式 */
        .vehicle-list-scroll::-webkit-scrollbar {
          width: 6px;
        }
        
        .vehicle-list-scroll::-webkit-scrollbar-track {
          background: rgba(0, 255, 255, 0.05);
          border-radius: 3px;
        }
        
        .vehicle-list-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 255, 0.2);
          border-radius: 3px;
          transition: background 0.2s;
        }
        
        .vehicle-list-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 255, 0.4);
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
          followDistance={25}
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
        
        {/* 体积雾和神光效果 */}
        <VolumetricFog 
          color="#0a1a2e" 
          density={0.015} 
          height={35} 
        />
        <GodRays 
          count={12} 
          color="#88ddff" 
          intensity={0.25} 
        />
        <AtmosphericParticles 
          count={600} 
          size={0.25} 
        />
        
        {/* 漂浮粒子系统 */}
        <MultiLayerDustParticles />
        
        {/* 城市地面（集成建筑、神社和路线，包含全息网格地面） */}
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

          // 获取起点和终点位置
          const startPos = path.getPointAt(0);
          const endPos = path.getPointAt(1);
          const isFollowing = selectedVehicleId === route.id && followMode;

          return (
            <group key={route.id}>
              <Vehicle
                path={path}
                startPosition={0}
                onClick={handleVehicleClick(route.id)}
                onPositionUpdate={handlePositionUpdate(route.id)}
                onComplete={() => handleVehicleComplete(route.id)}
                name={route.name}
                isCycle={route.isCycle}
              />
              
              {/* 跟踪模式下显示起点和终点标志 */}
              {isFollowing && (
                <RouteMarkers
                  startPosition={startPos}
                  endPosition={endPos}
                  startName={route.nodes[0]?.id || 'START'}
                  endName={route.nodes[route.nodes.length - 1]?.id || 'END'}
                />
              )}
            </group>
          );
        })}

        {/* 黑色格子线（已注释） */}
        {/* <gridHelper args={[200, 20, '#444', '#222']} position={[0, 0.1, 0]} /> */}
        <fog attach="fog" args={['#000', 100, 400]} />

        {/* Bloom 后处理效果 - 让霓虹边发光 */}
        <EffectComposer>
          <Bloom 
            intensity={0.2}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.1}
            radius={0.9}
            // mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* UIオーバーレイ */}
      <div
        onClick={() => !selectedVehicleId && setIsOverviewExpanded(!isOverviewExpanded)}
        style={{
          position: 'absolute',
          top: 20,
          left: isOverviewExpanded ? '50%' : 20,
          transform: isOverviewExpanded ? 'translateX(-50%) scale(1)' : 'scale(1)',
          color: '#00ffff',
          fontFamily: 'monospace',
          fontSize: isOverviewExpanded ? '17px' : '16px',
          background: 'rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: isOverviewExpanded ? '35px 45px' : '20px',
          borderRadius: isOverviewExpanded ? '12px' : '10px',
          border: `2px solid ${selectedVehicleId !== null ? '#ff00ff' : '#00ffff'}`,
          zIndex: 10,
          pointerEvents: selectedVehicleId ? 'none' : 'auto',
          textAlign: 'left',
          width: isOverviewExpanded ? 'calc(100vw - 100px)' : 'auto',
          maxWidth: isOverviewExpanded ? '1600px' : '420px',
          minWidth: isOverviewExpanded ? '950px' : '320px',
          cursor: selectedVehicleId ? 'default' : 'pointer',
          transition: 'transform 0.3s ease-out, opacity 0.2s ease',
          transformOrigin: isOverviewExpanded ? 'top center' : 'top left',
          boxShadow: isOverviewExpanded 
            ? '0 0 60px rgba(0, 255, 255, 0.6), inset 0 0 30px rgba(0, 255, 255, 0.1)' 
            : '0 0 20px rgba(0, 255, 255, 0.3)'
        }}
      >
        {selectedVehicleId !== null && vehicleRoutes.find(r => r.id === selectedVehicleId) ? (
          // 選択された車両の詳細情報
          (() => {
            const selectedRoute = vehicleRoutes.find(r => r.id === selectedVehicleId)!;
            const totalTime = calculateTotalTime(selectedRoute.edges);
            const demoTime = Math.round(totalTime / 20);
            const totalDistance = selectedRoute.edges.reduce((sum, edge) => sum + edge.length, 0);
            return (
              <>
                <h2 style={{ margin: '0 0 20px 0', color: '#ff00ff', textAlign: 'left', fontSize: '28px', borderBottom: '2px solid #ff00ff', paddingBottom: '15px' }}>
                  🎯 車両追跡中
                </h2>
                <div style={{ lineHeight: '2', textAlign: 'left' }}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffffff', marginBottom: '15px' }}>
                    {selectedRoute.name}
                  </div>
                  <div style={{ fontSize: '17px', marginBottom: '12px' }}>ルート: {getRouteNames(extractNodeIdsFromRoute(selectedRoute))}</div>
                  <div style={{ fontSize: '17px', marginBottom: '12px' }}>総距離: <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{(totalDistance / 1000).toFixed(2)} km</span></div>
                  <div style={{ fontSize: '17px', marginBottom: '12px' }}>実際時間: <span style={{ color: '#ffaa00', fontWeight: 'bold' }}>{totalTime} 分</span></div>
                  <div style={{ fontSize: '17px', marginBottom: '12px' }}>デモ時間: <span style={{ color: '#ff00ff', fontWeight: 'bold' }}>{demoTime} 秒</span></div>
                  <div style={{ fontSize: '17px', marginBottom: '12px' }}>モード: <span style={{ fontWeight: 'bold' }}>{selectedRoute.isCycle ? '循環ルート' : '片道ルート'}</span></div>
                  {/* <div style={{ fontSize: '17px', marginBottom: '12px' }}>🎨 カラー: <span style={{ color: selectedRoute.color, fontSize: '20px' }}>■■■</span> {selectedRoute.color}</div> */}
                  <div style={{ marginTop: '20px', fontSize: '15px', color: '#888', padding: '12px', background: 'rgba(255, 0, 255, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 0, 255, 0.3)' }}>
                    💡 再クリックで追跡解除
                  </div>
                </div>
              </>
            );
          })()
        ) : (
          // 全体情報
          <>
            <h2 style={{ 
              margin: '0 0 18px 0', 
              color: '#00ffff', 
              textAlign: 'left',
              fontSize: isOverviewExpanded ? '28px' : '20px',
              fontWeight: 'bold',
              borderBottom: isOverviewExpanded ? '2px solid #00ffff' : 'none',
              paddingBottom: isOverviewExpanded ? '12px' : '0'
            }}>
              NEO TOKYO ナビゲーション {!isOverviewExpanded && '▼'}
            </h2>
            
            {!isOverviewExpanded ? (
              // 缩略版
              <div style={{ lineHeight: '2', textAlign: 'left' }}>
                {vehicleRoutes.filter(r => activeVehicles.has(r.id)).slice(0, 3).map((route, idx) => (
                  <div key={route.id} style={{ fontSize: '16px', marginBottom: '8px' }}>• 車両{idx + 1}: {route.name}</div>
                ))}
                {vehicleRoutes.filter(r => activeVehicles.has(r.id)).length > 3 && (
                  <div style={{ fontSize: '16px', color: '#888', marginBottom: '8px' }}>
                    ... 他 {vehicleRoutes.filter(r => activeVehicles.has(r.id)).length - 3} 台
                  </div>
                )}
                <div style={{ marginTop: '12px', fontSize: '15px', marginBottom: '6px' }}>
                  • {routePaths.size > 0 ? `✓ ${routePaths.size}ルート読み込み完了` : '⏳ ルート読み込み中...'}
                </div>
                <div style={{ fontSize: '15px', marginBottom: '6px' }}>• アクティブ車両: {activeVehicles.size}台</div>
                <div style={{ marginTop: '15px', fontSize: '14px', color: '#888' }}>
                  クリックで詳細表示 →
                </div>
              </div>
            ) : (
              // 展开版详细信息 - 横向布局
              <div style={{ textAlign: 'left' }}>
                {/* 顶部系统状态栏 */}
                <div style={{ 
                  display: 'flex',
                  gap: '30px',
                  marginBottom: '30px',
                  padding: '25px 30px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.08) 0%, rgba(0, 255, 255, 0.02) 100%)',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 255, 255, 0.4)',
                  boxShadow: '0 4px 15px rgba(0, 255, 255, 0.1)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', color: '#888', marginBottom: '8px' }}>ルート総数</div>
                    <div style={{ fontSize: '32px', color: '#00ffff', fontWeight: 'bold' }}>{routePaths.size}</div>
                  </div>
                  <div style={{ width: '2px', background: 'rgba(0, 255, 255, 0.3)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', color: '#888', marginBottom: '8px' }}>アクティブ車両</div>
                    <div style={{ fontSize: '32px', color: '#00ff00', fontWeight: 'bold' }}>{activeVehicles.size} 台</div>
                  </div>
                  <div style={{ width: '2px', background: 'rgba(0, 255, 255, 0.3)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', color: '#888', marginBottom: '8px' }}>ノード/エッジ</div>
                    <div style={{ fontSize: '32px', color: '#fff', fontWeight: 'bold' }}>
                      {routeData?.nodes?.length || 0} / {routeData?.edges?.length || 0}
                    </div>
                  </div>
                  {/* <div style={{ width: '2px', background: 'rgba(0, 255, 255, 0.3)' }} /> */}
                  {/* <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', color: '#888', marginBottom: '8px' }}>制御モード</div>
                    <div style={{ fontSize: '32px', color: isAutoMode ? '#00ff00' : '#ffaa00', fontWeight: 'bold' }}>
                      {isAutoMode ? '自動' : '手動'}
                    </div>
                  </div> */}
                </div>

                {/* 车辆详细信息 - 3列网格布局 */}
                <div 
                  className="vehicle-list-scroll"
                  style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '25px',
                    maxHeight: '450px',
                    overflowY: 'auto',
                    paddingRight: '10px',
                    marginBottom: '25px'
                  }}
                >
                  {vehicleRoutes.filter(r => activeVehicles.has(r.id)).map((route, idx) => {
                    const path = routePaths.get(route.id)
                    const totalTime = calculateTotalTime(route.edges)
                    const demoTime = Math.round(totalTime / 20)
                    const totalDistance = route.edges.reduce((sum, edge) => sum + edge.length, 0)
                    
                    // 统计各模式的边数量
                    const modeCounts = route.edges.reduce((acc, edge) => {
                      const modeType = edge.type || 'road'
                      acc[modeType] = (acc[modeType] || 0) + 1
                      return acc
                    }, {} as Record<string, number>)
                    
                    return (
                      <div 
                        key={route.id}
                        style={{ 
                          padding: '22px',
                          background: `linear-gradient(135deg, ${route.color}08 0%, rgba(0, 0, 0, 0.3) 100%)`,
                          borderRadius: '12px',
                          border: `2px solid ${route.color}`,
                          borderLeft: `6px solid ${route.color}`,
                          boxShadow: `0 4px 20px ${route.color}40`
                        }}
                      >
                        {/* 车辆标题 */}
                        <div style={{ 
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '18px',
                          paddingBottom: '15px',
                          borderBottom: `2px solid ${route.color}40`
                        }}>
                          <div style={{ 
                            fontSize: '22px', 
                            fontWeight: 'bold', 
                            color: route.color
                          }}>
                            車両 {idx + 1}
                          </div>
                          <div style={{
                            padding: '6px 16px',
                            background: route.isCycle ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 170, 0, 0.2)',
                            borderRadius: '14px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: route.isCycle ? '#00ff00' : '#ffaa00',
                            border: `1px solid ${route.isCycle ? '#00ff00' : '#ffaa00'}`
                          }}>
                            {route.isCycle ? '🔄 循環' : '➡️ 片道'}
                          </div>
                        </div>

                        {/* 路线名称 */}
                        <div style={{ fontSize: '19px', color: '#fff', marginBottom: '15px', fontWeight: '600' }}>
                          {route.name}
                        </div>

                        {/* 详细统计 - 两列布局 */}
                        <div style={{ 
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '12px',
                          fontSize: '16px',
                          marginBottom: '15px'
                        }}>
                          <div style={{ color: '#aaa' }}>
                          ノード: <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '17px' }}>{route.nodes?.length || 0}</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                          エッジ: <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '17px' }}>{route.edges?.length || 0}</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                            距離: <span style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '17px' }}>{(totalDistance / 1000).toFixed(2)} km</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                            実際: <span style={{ color: '#ffaa00', fontWeight: 'bold', fontSize: '17px' }}>{totalTime} 分</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                            デモ: <span style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '17px' }}>{demoTime} 秒</span>
                          </div>
                          {/* {path && (
                            <div style={{ color: '#aaa' }}>
                              Path: <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '17px' }}>{path.getLength().toFixed(1)} u</span>
                            </div>
                          )} */}
                        </div>

                        {/* 模式统计 */}
                        <div style={{ 
                          marginTop: '15px',
                          paddingTop: '15px',
                          borderTop: `2px dashed ${route.color}30`
                        }}>
                          <div style={{ fontSize: '15px', color: '#888', marginBottom: '10px', fontWeight: '500' }}>移動モード分布:</div>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {modeCounts.road && (
                              <div style={{ 
                                padding: '6px 14px',
                                background: 'rgba(0, 255, 255, 0.15)',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#00ffff',
                                border: '1px solid rgba(0, 255, 255, 0.3)'
                              }}>
                                🚗 道路 ×{modeCounts.road}
                              </div>
                            )}
                            {modeCounts.highway && (
                              <div style={{ 
                                padding: '6px 14px',
                                background: 'rgba(255, 170, 0, 0.15)',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#ffaa00',
                                border: '1px solid rgba(255, 170, 0, 0.3)'
                              }}>
                                🏎️ 高速 ×{modeCounts.highway}
                              </div>
                            )}
                            {modeCounts.drone && (
                              <div style={{ 
                                padding: '6px 14px',
                                background: 'rgba(0, 255, 0, 0.15)',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#00ff00',
                                border: '1px solid rgba(0, 255, 0, 0.3)'
                              }}>
                                🚁 ドローン ×{modeCounts.drone}
                              </div>
                            )}
                            {modeCounts.sky && (
                              <div style={{ 
                                padding: '6px 14px',
                                background: 'rgba(255, 0, 255, 0.15)',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#ff00ff',
                                border: '1px solid rgba(255, 0, 255, 0.3)'
                              }}>
                                ✈️ 飛行 ×{modeCounts.sky}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 路线节点详情 */}
                        <div style={{ 
                          marginTop: '15px',
                          paddingTop: '15px',
                          borderTop: `2px dashed ${route.color}30`
                        }}>
                          <div style={{ fontSize: '15px', color: '#888', marginBottom: '8px', fontWeight: '500' }}>経由ルート:</div>
                          <div style={{ fontSize: '15px', color: '#ccc', lineHeight: '2' }}>
                            {route.nodes?.slice(0, 6).map((node, i) => {
                              // 获取当前节点到下一个节点的边类型
                              const edgeToNext = i < route.edges?.length ? route.edges[i] : null
                              const edgeType = edgeToNext?.type || 'road'
                              
                              // 根据边类型选择颜色和图标
                              const edgeDisplay = {
                                road: { icon: '🚗', color: '#00ffff' },
                                highway: { icon: '🏎️', color: '#ffaa00' },
                                drone: { icon: '🚁', color: '#00ff00' },
                                sky: { icon: '✈️', color: '#ff00ff' }
                              }[edgeType] || { icon: '→', color: '#00ffff' }
                              
                              return (
                                <span key={node.id}>
                                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{getNodeName(node.id)}</span>
                                  {i < route.nodes.length - 1 && (
                                    <span style={{ color: edgeDisplay.color, margin: '0 6px', fontSize: '14px' }}>
                                      {edgeDisplay.icon}
                                    </span>
                                  )}
                                </span>
                              )
                            })}
                            {route.nodes && route.nodes.length > 6 && (
                              <span style={{ color: '#888', fontSize: '14px' }}> ... (+{route.nodes.length - 6})</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 底部提示 */}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '20px',
                  borderTop: '2px solid rgba(0, 255, 255, 0.3)',
                  fontSize: '16px'
                }}>
                  <div style={{ color: '#888' }}>
                    ヒント: 車両をクリックで追跡 | マウスで視点操作
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    color: '#00ffff',
                    cursor: 'pointer',
                    padding: '10px 20px',
                    background: 'rgba(0, 255, 255, 0.15)',
                    borderRadius: '8px',
                    border: '2px solid rgba(0, 255, 255, 0.4)',
                    transition: 'all 0.2s'
                  }}>
                    ✕ クリックで閉じる
                  </div>
                </div>
              </div>
            )}
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
            <span style={{ color: '#EBCF65', fontSize: '16px' }}>━━</span>
            <span>一般道路（金将）</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#F24B90', fontSize: '16px' }}>━━</span>
            <span>高速道路（香車）</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#B1C075', fontSize: '16px' }}>━━</span>
            <span>ドローン（桂馬）</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#98B5C2', fontSize: '16px' }}>━━</span>
            <span>航空路線（飛車）</span>
          </div>
        </div>
      </div>

      {/* 版本信息和技术栈按钮（右上角） */}
      <div
        onClick={() => setIsTechStackOpen(!isTechStackOpen)}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          padding: '12px 20px',
          fontSize: '16px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: '#00ffff',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '2px solid #00ffff',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 10,
          transition: 'all 0.3s ease',
          boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 255, 255, 0.6)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.3)'
        }}
      >
        v1.0 Beta
      </div>

      {/* 技术栈展示面板 */}
      {isTechStackOpen && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: 20,
            width: '450px',
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            color: '#00ffff',
            fontFamily: 'monospace',
            fontSize: '14px',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '25px',
            borderRadius: '12px',
            border: '2px solid #00ffff',
            zIndex: 9,
            boxShadow: '0 0 40px rgba(0, 255, 255, 0.4)',
            animation: 'fadeIn 0.3s ease-out'
          }}
          className="tech-stack-scroll"
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .tech-stack-scroll::-webkit-scrollbar {
              width: 8px;
            }
            .tech-stack-scroll::-webkit-scrollbar-track {
              background: rgba(0, 255, 255, 0.1);
              border-radius: 4px;
            }
            .tech-stack-scroll::-webkit-scrollbar-thumb {
              background: rgba(0, 255, 255, 0.3);
              border-radius: 4px;
            }
            .tech-stack-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(0, 255, 255, 0.5);
            }
          `}</style>

          <h2 style={{ 
            margin: '0 0 20px 0', 
            color: '#ff00ff', 
            fontSize: '24px',
            borderBottom: '2px solid #ff00ff',
            paddingBottom: '12px',
            textAlign: 'center'
          }}>
            技術スタック
          </h2>

          {/* 前端框架 */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#00ffff', fontSize: '16px', marginBottom: '12px', fontWeight: 'bold' }}>
              フロントエンド
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/react.svg" alt="React" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>React</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>19.1.1</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/typescript.svg" alt="TypeScript" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>TypeScript</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>5.9.3</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/vite.svg" alt="Vite" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Vite</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>7.1.7</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/react.svg" alt="React Router" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Router</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>7.10.0</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D 图形 */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#00ffff', fontSize: '16px', marginBottom: '12px', fontWeight: 'bold' }}>
              3Dグラフィックス
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/threejs.svg" alt="Three.js" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Three.js</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>0.180.0</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/react.svg" alt="R3F" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>R3F</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>9.4.0</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/react.svg" alt="Drei" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Drei</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>10.7.6</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/gsap.svg" alt="GSAP" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>GSAP</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>3.13.0</div>
                </div>
              </div>
            </div>
          </div>

          {/* 样式与通信 */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#00ffff', fontSize: '16px', marginBottom: '12px', fontWeight: 'bold' }}>
              スタイル & 通信
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/tailwind.svg" alt="Tailwind" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Tailwind</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>4.1.14</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/websocket.svg" alt="WebSocket" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>WebSocket</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>8.18.0</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <img src="/tech-logos/nodejs.svg" alt="Node.js" style={{ width: '32px', height: '32px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Node.js</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>20.19.0</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '6px' }}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f97583', borderRadius: '6px', fontWeight: 'bold', fontSize: '18px', color: '#000' }}>L</div>
                <div>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Lucide</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>0.548</div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部信息 */}
          <div style={{
            marginTop: '25px',
            paddingTop: '15px',
            borderTop: '2px solid rgba(0, 255, 255, 0.3)',
            textAlign: 'center',
            fontSize: '12px',
            color: '#888'
          }}>
            <div style={{ marginBottom: '8px' }}>
              🏗️ Built with Modern Web Tech
            </div>
            <div style={{ color: '#00ffff' }}>
              React • Three.js • TypeScript • Vite
            </div>
          </div>
        </div>
      )}

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
