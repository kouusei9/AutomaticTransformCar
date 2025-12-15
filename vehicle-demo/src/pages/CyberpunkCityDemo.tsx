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
import { FloatingInfoBoards } from '../components/website/FloatingInfoBoard'
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
  const [floatingLandmarks, setFloatingLandmarks] = useState<Array<{
    position: [number, number, number]
    name: string
  }>>([]) // 浮动标记数据

  // 车辆状态数据（分为静态和实时两部分）
  const [vehicleStatus, setVehicleStatus] = useState<{
    // 静态状态信息
    routeName: string
    totalDistance: number
    remainingEnergy: number
    isOnline: boolean
    // 实时信息
    currentMode: string
    currentSpeed: number
    distanceToDestination: number
    remainingTime: number
    progress: number
  } | null>(null)

  // 用于延迟更新速度的 ref
  const speedUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSpeedRef = useRef<number | null>(null)

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
        
        // 初始化车辆状态（静态信息）
        const totalDistance = route.edges.reduce((sum, edge) => sum + edge.length, 0)
        setVehicleStatus({
          // 静态状态
          routeName: route.name,
          totalDistance: totalDistance,
          remainingEnergy: 35 + Math.random() * 30,
          isOnline: true,
          // 实时信息（初始值）
          currentMode: route.edges[0]?.type || 'road',
          currentSpeed: 60,
          distanceToDestination: totalDistance,
          remainingTime: 0,
          progress: 0
        })
      }
    }
  }, [routePaths, getVehicleRoute, startFollowing])

  // 切换到全视角的回调
  const handleSwitchToOverview = useCallback(() => {
    stopFollowing()
    setVehicleStatus(null)
    
    // 清除速度更新定时器
    if (speedUpdateTimerRef.current) {
      clearTimeout(speedUpdateTimerRef.current)
      speedUpdateTimerRef.current = null
    }
    pendingSpeedRef.current = null
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
    
    // 初始化车辆状态
    const route = getVehicleRoute(vehicleId)
    if (route) {
      const totalDistance = route.edges.reduce((sum, edge) => sum + edge.length, 0)
      setVehicleStatus({
        // 静态状态
        routeName: route.name,
        totalDistance: totalDistance,
        remainingEnergy: 35 + Math.random() * 30,
        isOnline: true,
        // 实时信息（初始值）
        currentMode: route.edges[0]?.type || 'road',
        currentSpeed: 60,
        distanceToDestination: totalDistance,
        remainingTime: 0,
        progress: 0
      })
    }
  }

  // 车辆位置更新处理
  const handlePositionUpdate = (vehicleId: string) => (position: THREE.Vector3, forward: THREE.Vector3, progressData?: { curveIndex: number; edgeType: string; speedKmh: number; progress: number }) => {
    updateVehiclePosition(vehicleId, position, forward)
    
    // 如果是当前跟踪的车辆且有进度数据
    if (vehicleId === selectedVehicleId && progressData) {
      const { edgeType, speedKmh, progress } = progressData
      
      // 调试日志（每60帧输出一次）
      if (Math.random() < 0.016) {
        console.log(`📊 更新数据: mode=${edgeType}, speed=${speedKmh.toFixed(1)} km/h, progress=${progress.toFixed(1)}%`)
      }
      
      // vehicleStatus 已初始化才更新
      if (vehicleStatus) {
        const route = getVehicleRoute(vehicleId)
        if (route) {
          // 计算进度百分比（直接使用传入的progress）
          const progressPercent = progress * 100
          
          // 计算到终点的距离（根据总距离和进度）
          const distanceToDestination = vehicleStatus.totalDistance * (1 - progress)
          
          // 计算剩余时间（基于当前速度）
          const remainingTime = speedKmh > 0 ? (distanceToDestination / 1000) / speedKmh * 60 : 0
          
          // 立即更新模式和进度相关信息（放宽更新条件）
          if (edgeType !== vehicleStatus.currentMode || 
              Math.abs(progressPercent - vehicleStatus.progress) > 0.05 ||
              Math.abs(distanceToDestination - vehicleStatus.distanceToDestination) > 50) {
            
            setVehicleStatus(prev => prev ? { 
              ...prev, 
              currentMode: edgeType,
              distanceToDestination: distanceToDestination,
              remainingTime: remainingTime,
              progress: progressPercent
            } : null)
            
            if (edgeType !== vehicleStatus.currentMode) {
              console.log(`🔄 模式更新: ${vehicleStatus.currentMode} → ${edgeType}`)
            }
          }
          
          // 延迟更新速度（降低阈值到10 km/h）
          if (pendingSpeedRef.current === null) {
            pendingSpeedRef.current = speedKmh
          }
          
          const speedDiff = Math.abs(speedKmh - vehicleStatus.currentSpeed)
          if (speedDiff > 10) {
            pendingSpeedRef.current = speedKmh
            
            // 清除之前的定时器
            if (speedUpdateTimerRef.current) {
              clearTimeout(speedUpdateTimerRef.current)
            }
            
            // 设置新的延迟更新（500ms后更新）
            speedUpdateTimerRef.current = setTimeout(() => {
              if (pendingSpeedRef.current !== null) {
                setVehicleStatus(prev => prev ? { ...prev, currentSpeed: pendingSpeedRef.current! } : null)
                console.log(`💨 速度更新: ${pendingSpeedRef.current.toFixed(1)} km/h`)
              }
              speedUpdateTimerRef.current = null
            }, 50)
          }
        }
      }
    }
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
        
        /* 优化的按钮hover效果 - 使用CSS而非JS */
        .tech-stack-button {
          will-change: transform;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .tech-stack-button:hover {
          transform: scale(1.05);
          box-shadow: 0 0 15px rgba(0, 255, 255, 0.6) !important;
        }
        
        .auto-mode-button {
          will-change: transform;
          transition: all 0.3s ease;
        }
        
        .auto-mode-button:hover {
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(0, 255, 255, 0.8) !important;
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
          // followDistance={100}
        />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
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
          count={6} 
          color="#88ddff" 
          intensity={0.25} 
        />
        <AtmosphericParticles 
          count={300} 
          size={0.25} 
        />
        
        {/* 漂浮粒子系统 */}
        <MultiLayerDustParticles />
        
        {/* 悬浮信息公告板 */}
        <FloatingInfoBoards />
        
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
            intensity={0.15}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.05}
            radius={0.7}
            mipmapBlur
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
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
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
        {selectedVehicleId !== null && vehicleRoutes.find(r => r.id === selectedVehicleId) && vehicleStatus ? (
          // 選択された車両の詳細情報
          (() => {
            const selectedRoute = vehicleRoutes.find(r => r.id === selectedVehicleId)!;
            
            // 模式显示配置
            const modeDisplay = {
              road: { icon: '🚗', name: '金将', color: '#EBCF65' },
              highway: { icon: '🏎️', name: '香車', color: '#F24B90' },
              drone: { icon: '🚁', name: '桂馬', color: '#B1C075' },
              airplane: { icon: '✈️', name: '飛車', color: '#98B5C2' }
            }[vehicleStatus.currentMode] || { icon: '🚗', name: '金将', color: '#EBCF65' };

            const displayInteger = Math.round(vehicleStatus.progress);
            
            return (
              <>
                <style>{`
                  @keyframes modeChange {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                  }
                  .mode-card-animated {
                    animation: modeChange 0.5s ease-in-out;
                  }
                `}</style>
                
                {/* 标题 */}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  paddingBottom: '15px',
                  borderBottom: '2px solid #ff00ff'
                }}>
                  <h2 style={{ margin: 0, color: '#ff00ff', fontSize: '24px', fontWeight: 'bold' }}>
                    RYO-O K01
                  </h2>
                  <div style={{ 
                    fontSize: '13px', 
                    padding: '6px 14px', 
                    background: vehicleStatus.isOnline ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                    border: `1px solid ${vehicleStatus.isOnline ? '#00ff00' : '#ff0000'}`,
                    borderRadius: '12px',
                    color: vehicleStatus.isOnline ? '#00ff00' : '#ff0000',
                    fontWeight: 'bold'
                  }}>
                    {vehicleStatus.isOnline ? '● ONLINE' : '● OFFLINE'}
                  </div>
                </div>
                
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '20px' }}>
                  {vehicleStatus.routeName}
                </div>
                
                {/* 静态状态信息 */}
                <div style={{ 
                  marginBottom: '20px',
                  padding: '15px',
                  background: 'rgba(0, 255, 255, 0.08)',
                  borderRadius: '8px',
                  border: '2px solid rgba(0, 255, 255, 0.3)'
                }}>
                  <div style={{ fontSize: '14px', color: '#00ffff', marginBottom: '12px', fontWeight: 'bold' }}>
                    状態情報
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '15px' }}>
                    <div>
                      <span style={{ color: '#888' }}>ルート:</span>
                      <div style={{ color: '#fff', fontWeight: 'bold', marginTop: '4px' }}>
                        {getRouteNames(extractNodeIdsFromRoute(selectedRoute))}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>総距離:</span>
                      <div style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '18px', marginTop: '4px' }}>
                        {(vehicleStatus.totalDistance / 1000).toFixed(2)} km
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>残りエネルギー:</span>
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ 
                          width: '100%', 
                          height: '8px', 
                          background: 'rgba(0, 0, 0, 0.3)', 
                          borderRadius: '4px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.2)'
                        }}>
                          <div style={{ 
                            width: `${vehicleStatus.remainingEnergy}%`, 
                            height: '100%',
                            background: vehicleStatus.remainingEnergy > 50 
                              ? 'linear-gradient(90deg, #00ff00, #00ff88)' 
                              : vehicleStatus.remainingEnergy > 20 
                              ? 'linear-gradient(90deg, #ffaa00, #ff8800)'
                              : 'linear-gradient(90deg, #ff0000, #ff4444)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <div style={{ 
                          color: vehicleStatus.remainingEnergy > 50 ? '#00ff00' : vehicleStatus.remainingEnergy > 20 ? '#ffaa00' : '#ff0000',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          marginTop: '4px'
                        }}>
                          {vehicleStatus.remainingEnergy.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* 实时动态信息 */}
                <div style={{ 
                  marginBottom: '15px',
                  padding: '15px',
                  background: 'rgba(255, 0, 255, 0.08)',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 0, 255, 0.3)'
                }}>
                  <div style={{ fontSize: '14px', color: '#ff00ff', marginBottom: '12px', fontWeight: 'bold' }}>
                    リアルタイム情報
                  </div>
                  
                  {/* 第一行：模式和速度 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    {/* 当前模式 */}
                    <div style={{ 
                      padding: '12px',
                      background: `${modeDisplay.color}25`,
                      borderRadius: '8px',
                      border: `2px solid ${modeDisplay.color}`,
                      textAlign: 'center',
                      boxShadow: `0 0 10px ${modeDisplay.color}40, inset 0 2px 8px ${modeDisplay.color}20`
                    }}>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>現在のモード</div>
                      {/* <div style={{ fontSize: '24px', marginBottom: '2px' }}>{modeDisplay.icon}</div> */}
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: modeDisplay.color }}>
                        {modeDisplay.name}
                      </div>
                    </div>
                    
                    {/* 当前速度 */}
                    <div style={{ 
                      padding: '12px',
                      background: 'rgba(0, 255, 255, 0.15)',
                      borderRadius: '8px',
                      border: '2px solid #00ffff',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>スピード</div>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#00ffff', lineHeight: '1.2' }}>
                        {vehicleStatus.currentSpeed.toFixed(0)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#888' }}>km/h</div>
                    </div>
                  </div>
                  
                  {/* 第二行：距离和时间 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {/* 到目的地距离 */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>目的地まで</div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#00ff88' }}>
                        {(vehicleStatus.distanceToDestination / 1000).toFixed(2)} km
                      </div>
                    </div>
                    
                    {/* 剩余时间 */}
                    <div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>残り時間</div>
                      <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ffaa00' }}>
                        {vehicleStatus.remainingTime.toFixed(1)} 分
                      </div>
                    </div>
                  </div>
                  
                  {/* 进度条 */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#888' }}>進行状況</span>
                      <span style={{ fontSize: '13px', color: '#ff00ff', fontWeight: 'bold' }}>
                        {displayInteger}%
                      </span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '10px', 
                      background: 'rgba(0, 0, 0, 0.4)', 
                      borderRadius: '5px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 0, 255, 0.3)'
                    }}>
                      <div style={{ 
                        width: `${displayInteger}%`, 
                        height: '100%',
                        background: 'linear-gradient(90deg, #ff00ff, #00ffff)',
                        transition: 'width 0.3s ease',
                        boxShadow: '0 0 10px rgba(255, 0, 255, 0.6)'
                      }} />
                    </div>
                  </div>
                </div>
                
                {/* 底部提示 */}
                <div style={{ 
                  marginTop: '15px', 
                  fontSize: '13px', 
                  color: '#888', 
                  textAlign: 'center',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px'
                }}>
                  💡 再クリックで追跡解除
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



      {/* 技术栈展示面板 - 始终显示 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 20,
          zIndex: 10
        }}
      >
        {/* 技术栈面板 */}
        (
          <div
            style={{
              marginTop: '0px',
              width: '140px',
              maxHeight: 'calc(100vh - 250px)',
              overflowY: 'auto',
              color: '#00ffff',
              fontFamily: 'monospace',
              fontSize: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              padding: '15px',
              borderRadius: '10px',
              border: '2px solid #00ffff',
              boxShadow: '0 0 20px rgba(0, 255, 255, 0.3)',
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

          {/* <h2 style={{ 
            margin: '0 0 12px 0', 
            color: '#ff00ff', 
            fontSize: '16px',
            borderBottom: '1px solid rgba(255, 0, 255, 0.3)',
            paddingBottom: '8px',
            textAlign: 'center'
          }}>
            技術スタック
          </h2> */}

          {/* 前端框架 */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ color: '#00ffff', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>
              {/* フロントエンド */}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/react.svg" alt="React" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>React</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>19.1.1</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/typescript.svg" alt="TypeScript" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>TypeScript</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>5.9.3</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/vite.svg" alt="Vite" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Vite</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>7.1.7</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/react.svg" alt="React Router" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Router</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>7.10.0</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D 图形 */}
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ color: '#00ffff', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>
              {/* 3Dグラフィックス */}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/threejs.svg" alt="Three.js" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Three.js</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>0.180</div>
                </div>
              </div>
              {/* <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/react.svg" alt="R3F" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>R3F</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>9.4.0</div>
                </div>
              </div> */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/react.svg" alt="Drei" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Drei</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>10.7.6</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/gsap.svg" alt="GSAP" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>GSAP</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>3.13.0</div>
                </div>
              </div>
            </div>
          </div>

          {/* 样式与通信 */}
          <div style={{ marginBottom: '10px' }}>
            <h3 style={{ color: '#00ffff', fontSize: '13px', marginBottom: '8px', fontWeight: 'bold' }}>
              {/* スタイル & 通信 */}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/tailwind.svg" alt="Tailwind" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Tailwind</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>4.1.14</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/websocket.svg" alt="WebSocket" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>WebSocket</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>8.18.0</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <img src="/tech-logos/nodejs.svg" alt="Node.js" style={{ width: '20px', height: '20px' }} />
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Node.js</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>20.19</div>
                </div>
              </div>
              {/* <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px', background: 'rgba(0, 255, 255, 0.05)', borderRadius: '4px' }}>
                <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f97583', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>L</div>
                <div>
                  <div style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>Lucide</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>0.548</div>
                </div>
              </div> */}
            </div>
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
          className="auto-mode-button"
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
            boxShadow: isAutoMode 
              ? '0 0 15px rgba(0, 255, 255, 0.5)' 
              : '0 0 8px rgba(0, 255, 255, 0.2)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
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
