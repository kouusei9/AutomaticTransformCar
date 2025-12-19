import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import CityGround from '../components/website/CityGround'
import SkyEnvironment from '../components/website/SkyEnvironment'
import Vehicle from '../components/website/Vehicle'
import { CameraFollower } from '../components/website/CameraFollower'
import { RouteMarkers } from '../components/website/RouteMarkers'
import { MultiLayerDustParticles } from '../components/website/DustParticles'
import { VolumetricFog, GodRays, AtmosphericParticles } from '../components/website/VolumetricFog'
import { FloatingInfoBoard, FloatingInfoBoards } from '../components/website/FloatingInfoBoard'
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
  const uiOverlayRef = useRef<HTMLDivElement>(null) // UI 面板 ref
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false) // 全体情报展开状态
  const [notificationTop, setNotificationTop] = useState(380) // 通知面板动态位置
  const [floatingLandmarks, setFloatingLandmarks] = useState<Array<{
    position: [number, number, number]
    name: string
  }>>([]) // 浮动标记数据

  // 道路状况板数据
  const [roadConditions, setRoadConditions] = useState<Array<{
    id: string
    position: [number, number, number]
    condition: string
    severity: 'low' | 'medium' | 'high'
    description: string
    timestamp: number
  }>>([])

  // 通知消息数据
  const [notifications, setNotifications] = useState<Array<{
    id: string
    message: string
    timestamp: number
  }>>([])

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

  // 实时状态数据的 ref（避免每帧更新 state 导致的无限循环）
  const vehicleStatusRef = useRef<{
    currentMode: string
    currentSpeed: number
    distanceToDestination: number
    remainingTime: number
    progress: number
  } | null>(null)

  // 用于跟踪所有通知和道路状况的 timer
  const activeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // 存储getVehicleRoute函数的ref，避免在useCallback中依赖它
  const getVehicleRouteRef = useRef<((vehicleId: string) => any) | null>(null)

  // 车辆路线管理
  const {
    vehicleRoutes,
    activeVehicles,
    extractNodeIds,
    addVehicle,
    removeVehicle,
    getVehicleRoute
  } = useVehicleRoutes(INITIAL_VEHICLE_ROUTES)

  // 同步 getVehicleRoute 到 ref
  getVehicleRouteRef.current = getVehicleRoute

  // 相机跟踪
  const {
    followMode,
    selectedVehicleId,
    vehiclePositionRef,
    vehicleForwardRef,
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

              const totalDistance = route.edges.reduce((sum, edge) => sum + edge.length, 0)
              setVehicleStatus({
                routeName: route.name,
                totalDistance: totalDistance,
                remainingEnergy: 35 + Math.random() * 30,
                isOnline: true,
                currentMode: route.edges[0]?.type || 'road',
                currentSpeed: 60,
                distanceToDestination: totalDistance,
                remainingTime: 0,
                progress: 0
              })
              
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

  // 监听 UI 面板高度变化，动态调整通知位置
  useEffect(() => {
    if (!uiOverlayRef.current) return

    const updateNotificationPosition = () => {
      const rect = uiOverlayRef.current!.getBoundingClientRect()
      const newTop = rect.bottom + 10 // UI 面板底部 + 10px 间距
      setNotificationTop(newTop)
    }

    // 初始计算
    updateNotificationPosition()

    // 使用 ResizeObserver 监听尺寸变化
    const observer = new ResizeObserver(updateNotificationPosition)
    observer.observe(uiOverlayRef.current)

    return () => observer.disconnect()
  }, [selectedVehicleId, isOverviewExpanded, activeVehicleIds]) // 依赖关键状态

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
    vehicleStatusRef.current = null
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

  // 随机生成道路状况板（最多5个）
  useEffect(() => {
    const generateRoadCondition = () => {
      // 使用函数式更新，在回调中检查长度
      setRoadConditions(prev => {
        if (prev.length >= 5) return prev

        const conditions = [
          { condition: '工事中', severity: 'medium' as const, description: '道路工事のため片側通行' },
          // { condition: '渋滞発生', severity: 'high' as const, description: '事故により渋滞中' },
          { condition: '速度制限', severity: 'low' as const, description: '一時的に速度制限実施中' },
          { condition: '路面凍結', severity: 'high' as const, description: '路面凍結注意' },
          { condition: '濃霧注意', severity: 'medium' as const, description: '視界不良のため注意' }
        ]

        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)]
        const randomX = (Math.random() - 0.5) * 150
        const randomZ = (Math.random() - 0.5) * 150
        const randomY = 25 + Math.random() * 20

        const newCondition = {
          id: `road-${Date.now()}-${Math.random()}`,
          position: [randomX, randomY, randomZ] as [number, number, number],
          ...randomCondition,
          timestamp: Date.now()
        }

        // 添加通知
        const notification = {
          id: `notif-${Date.now()}-${Math.random()}`,
          message: `🚧 ${randomCondition.condition}: ${randomCondition.description}`,
          timestamp: Date.now()
        }
        setNotifications(prevNotif => [...prevNotif, notification])

        // 5秒后自动移除通知 - 保存 timer 引用
        const notificationTimer = setTimeout(() => {
          setNotifications(prevNotif => prevNotif.filter(n => n.id !== notification.id))
          activeTimersRef.current.delete(notificationTimer)
        }, 5000)
        activeTimersRef.current.add(notificationTimer)

        // 5秒后自动移除道路状况板 - 保存 timer 引用
        const conditionTimer = setTimeout(() => {
          setRoadConditions(prevCond => prevCond.filter(c => c.id !== newCondition.id))
          activeTimersRef.current.delete(conditionTimer)
        }, 5000)
        activeTimersRef.current.add(conditionTimer)

        return [...prev, newCondition]
      })
    }

    // 初始延迟5秒后开始，然后每15-30秒随机生成一次
    const initialTimeout = setTimeout(() => {
      generateRoadCondition()

      const interval = setInterval(() => {
        generateRoadCondition()
      }, 15000 + Math.random() * 15000)

      activeTimersRef.current.add(interval)

      return () => {
        clearInterval(interval)
        activeTimersRef.current.delete(interval)
      }
    }, 5000)

    activeTimersRef.current.add(initialTimeout)

    return () => {
      clearTimeout(initialTimeout)
      activeTimersRef.current.delete(initialTimeout)
    }
  }, []) // 空依赖数组，只在组件挂载时运行一次

  // 组件卸载时清理所有 timer
  useEffect(() => {
    return () => {
      // 清理所有通知和道路状况的 timer
      activeTimersRef.current.forEach(timer => clearTimeout(timer))
      activeTimersRef.current.clear()
    }
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

  // 车辆位置更新处理 - 只更新 ref，不触发 state 更新
  const handlePositionUpdate = useCallback(
    (vehicleId: string) =>
      (position: THREE.Vector3, forward: THREE.Vector3, progressData?: {
        curveIndex: number
        edgeType: string
        speedKmh: number
        progress: number
      }) => {
        updateVehiclePosition(vehicleId, position, forward)

        if (vehicleId !== selectedVehicleId || !progressData) return

        const { edgeType, speedKmh, progress } = progressData
        const route = getVehicleRouteRef.current?.(vehicleId)
        if (!route) return

        const totalDistance = route.edges.reduce((sum, edge) => sum + edge.length, 0)
        const distanceToDestination = totalDistance * (1 - progress)

        // 只更新 ref，不触发重渲染
        vehicleStatusRef.current = {
          currentMode: edgeType,
          currentSpeed: speedKmh,
          distanceToDestination,
          remainingTime: speedKmh > 0 ? (distanceToDestination / 1000 / speedKmh) * 60 : 0,
          progress: progress * 100
        }
      },
    [selectedVehicleId, updateVehiclePosition]
  )

  // 定期将 ref 中的实时数据同步到 state（200ms = 5fps，避免每帧更新）
  useEffect(() => {
    const interval = setInterval(() => {
      if (!vehicleStatusRef.current) return

      setVehicleStatus(prev => {
        if (!prev) return prev

        return {
          ...prev,
          ...vehicleStatusRef.current
        }
      })
    }, 200) // 5fps 更新 UI，足够顺滑

    return () => clearInterval(interval)
  }, [])

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
          vehiclePositionRef={vehiclePositionRef}
          vehicleForwardRef={vehicleForwardRef}
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

        {/* 道路状况信息板 */}
        {roadConditions.map(condition => (
          <FloatingInfoBoard
            key={condition.id}
            position={condition.position}
            title={condition.condition}
            type="roadCondition"
            roadConditionData={{
              severity: condition.severity,
              description: condition.description
            }}
          />
        ))}

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
        ref={uiOverlayRef}
        onClick={() => !selectedVehicleId && setIsOverviewExpanded(!isOverviewExpanded)}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          transform: isOverviewExpanded ? 'translateX(20px) scale(1)' : 'scale(1)',
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
          width: isOverviewExpanded ? 'calc(100vw - 250px)' : 'auto',
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
              drone: { icon: '🚁', name: '桂馬', color: '#13632cff' },
              airplane: { icon: '✈️', name: '飛車', color: '#0670b2ff' }
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
                  marginBottom: '8px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #ff00ff'
                }}>
                  <h2 style={{ margin: 0, color: '#ff00ff', fontSize: '20px', fontWeight: 'bold' }}>
                    RYU-O K01
                  </h2>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    background: vehicleStatus.isOnline ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
                    border: `1px solid ${vehicleStatus.isOnline ? '#00ff00' : '#ff0000'}`,
                    borderRadius: '10px',
                    color: vehicleStatus.isOnline ? '#00ff00' : '#ff0000',
                    fontWeight: 'bold'
                  }}>
                    {vehicleStatus.isOnline ? '● ONLINE' : '● OFFLINE'}
                  </div>
                </div>

                <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>
                  {vehicleStatus.routeName}
                </div>

                {/* 静态状态信息 */}
                <div style={{
                  marginBottom: '10px',
                  padding: '10px',
                  background: 'rgba(0, 255, 255, 0.08)',
                  borderRadius: '6px',
                  border: '2px solid rgba(0, 255, 255, 0.3)'
                }}>
                  <div style={{ fontSize: '13px', color: '#00ffff', marginBottom: '6px', fontWeight: 'bold' }}>
                    状態情報
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px' }}>
                    <div>
                      <span style={{ color: '#888' }}>ルート:</span>
                      <div style={{ color: '#fff', fontWeight: 'bold', marginTop: '2px', fontSize: '13px' }}>
                        {getRouteNames(extractNodeIdsFromRoute(selectedRoute))}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>残りエネルギー:</span>
                      <div style={{ marginTop: '3px' }}>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '3px',
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
                          fontSize: '12px',
                          fontWeight: 'bold',
                          marginTop: '2px'
                        }}>
                          {vehicleStatus.remainingEnergy.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>総距離:</span>
                      <div style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '16px', marginTop: '2px' }}>
                        {(vehicleStatus.totalDistance / 1000).toFixed(2)} km
                      </div>
                    </div>
                  </div>
                </div>

                {/* 实时动态信息 */}
                <div style={{
                  marginBottom: '10px',
                  padding: '10px',
                  background: 'rgba(255, 0, 255, 0.08)',
                  borderRadius: '6px',
                  border: '2px solid rgba(255, 0, 255, 0.3)'
                }}>
                  <div style={{ fontSize: '13px', color: '#ff00ff', marginBottom: '6px', fontWeight: 'bold' }}>
                    リアルタイム情報
                  </div>

                  {/* 第一行：模式和速度 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    {/* 当前模式 */}
                    <div style={{
                      padding: '8px',
                      background: `${modeDisplay.color}25`,
                      borderRadius: '6px',
                      border: `2px solid ${modeDisplay.color}`,
                      textAlign: 'center',
                      boxShadow: `0 0 10px ${modeDisplay.color}40, inset 0 2px 8px ${modeDisplay.color}20`
                    }}>
                      <div style={{ fontSize: '10px', color: '#ffffffff', marginBottom: '2px' }}>現在のモード</div>
                      {/* <div style={{ fontSize: '24px', marginBottom: '2px' }}>{modeDisplay.icon}</div> */}
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: modeDisplay.color }}>
                        {modeDisplay.name}
                      </div>
                    </div>

                    {/* 当前速度 */}
                    <div style={{
                      padding: '8px',
                      background: 'rgba(0, 255, 255, 0.15)',
                      borderRadius: '6px',
                      border: '2px solid #00ffff',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '10px', color: '#ffffffff', marginBottom: '2px' }}>スピード</div>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ffff', lineHeight: '1.2' }}>
                        {vehicleStatus.currentSpeed.toFixed(0)}/KM
                      </div>
                    </div>
                  </div>

                  {/* 第二行：距离和时间 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {/* 到目的地距离 */}
                    <div>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>目的地まで</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00ff88' }}>
                        {(vehicleStatus.distanceToDestination / 1000).toFixed(2)} km
                      </div>
                    </div>

                    {/* 剩余时间 */}
                    <div>
                      <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>残り時間</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffaa00' }}>
                      </div>
                    </div>
                  </div>

                  {/* 进度条 */}
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>進行状況</span>
                      <span style={{ fontSize: '12px', color: '#ff00ff', fontWeight: 'bold' }}>
                        {displayInteger}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: '3px',
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
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#888',
                  textAlign: 'center',
                  padding: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px'
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
                {vehicleRoutes.filter(r => activeVehicles.has(r.id)).slice(0, 10).map((route, idx) => (
                  <div key={route.id} style={{ fontSize: '16px', marginBottom: '8px' }}>• 車両{idx + 1}: {route.name}</div>
                ))}
                {vehicleRoutes.filter(r => activeVehicles.has(r.id)).length > 10 && (
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
                  gap: '8px',
                  marginBottom: '15px',
                  padding: '12px 15px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.08) 0%, rgba(0, 255, 255, 0.02) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 255, 255, 0.4)',
                  boxShadow: '0 2px 10px rgba(0, 255, 255, 0.1)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>ルート総数</div>
                    <div style={{ fontSize: '20px', color: '#00ffff', fontWeight: 'bold' }}>{routePaths.size}</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(0, 255, 255, 0.3)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>アクティブ車両</div>
                    <div style={{ fontSize: '20px', color: '#00ff00', fontWeight: 'bold' }}>{activeVehicles.size} 台</div>
                  </div>
                  <div style={{ width: '1px', background: 'rgba(0, 255, 255, 0.3)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>ノード/エッジ</div>
                    <div style={{ fontSize: '20px', color: '#fff', fontWeight: 'bold' }}>
                      {routeData?.nodes?.length || 0} / {routeData?.edges?.length || 0}
                    </div>
                  </div>
                </div>

                {/* 车辆详细信息 - 3列网格布局 */}
                <div
                  className="vehicle-list-scroll"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    maxHeight: '350px',
                    overflowY: 'auto',
                    paddingRight: '8px',
                    marginBottom: '10px'
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
                          padding: '12px',
                          background: `linear-gradient(135deg, ${route.color}08 0%, rgba(0, 0, 0, 0.3) 100%)`,
                          borderRadius: '8px',
                          border: `1.5px solid ${route.color}`,
                          borderLeft: `4px solid ${route.color}`,
                          boxShadow: `0 2px 12px ${route.color}40`
                        }}
                      >
                        {/* 车辆标题 */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px',
                          paddingBottom: '8px',
                          borderBottom: `1.5px solid ${route.color}40`
                        }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: route.color
                          }}>
                            車両 {idx + 1}
                          </div>
                          <div style={{
                            padding: '3px 10px',
                            background: route.isCycle ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 170, 0, 0.2)',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: route.isCycle ? '#00ff00' : '#ffaa00',
                            border: `1px solid ${route.isCycle ? '#00ff00' : '#ffaa00'}`
                          }}>
                            {route.isCycle ? '🔄 循環' : '➡️ 片道'}
                          </div>
                        </div>

                        {/* 路线名称 */}
                        <div style={{ fontSize: '13px', color: '#fff', marginBottom: '10px', fontWeight: '600', lineHeight: '1.3' }}>
                          {route.name}
                        </div>

                        {/* 详细统计 - 两列布局 */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                          fontSize: '12px',
                          marginBottom: '10px'
                        }}>
                          <div style={{ color: '#aaa' }}>
                            ノード: <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>{route.nodes?.length || 0}</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                            エッジ: <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>{route.edges?.length || 0}</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                            距離: <span style={{ color: '#00ffff', fontWeight: 'bold', fontSize: '13px' }}>{(totalDistance / 1000).toFixed(2)} km</span>
                          </div>
                          <div style={{ color: '#aaa' }}>
                            実際: <span style={{ color: '#ffaa00', fontWeight: 'bold', fontSize: '13px' }}>{totalTime} 分</span>
                          </div>
                          <div style={{ color: '#aaa', gridColumn: 'span 2' }}>
                            デモ: <span style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '13px' }}>{demoTime} 秒</span>
                          </div>
                        </div>

                        {/* 模式统计 */}
                        <div style={{
                          marginTop: '10px',
                          paddingTop: '10px',
                          borderTop: `1.5px dashed ${route.color}30`
                        }}>
                          <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: '500' }}>移動モード:</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {modeCounts.road && (
                              <div style={{
                                padding: '3px 8px',
                                background: 'rgba(0, 255, 255, 0.15)',
                                borderRadius: '6px',
                                fontSize: '11px',
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
                  paddingTop: '10px',
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

      {/* 通知面板（UIオーバーレイ下方） */}
      {notifications.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: `${notificationTop}px`, // 使用动态计算的值
            left: 20,
            zIndex: 9,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '400px',
            transition: 'top 0.3s ease'
          }}
        >
          {notifications.map(notif => (
            <div
              key={notif.id}
              style={{
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '13px',
                background: 'rgba(255, 100, 0, 0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '2px solid rgba(255, 150, 0, 0.6)',
                boxShadow: '0 0 15px rgba(255, 150, 0, 0.4)',
                animation: 'slideInLeft 0.3s ease-out, fadeOut 0.5s ease-out 4.5s forwards'
              }}
            >
              {notif.message}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>

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
            <span style={{ color: '#13632cff', fontSize: '16px' }}>━━</span>
            <span>ドローン（桂馬）</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#0670b2ff', fontSize: '16px' }}>━━</span>
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

        <div
          style={{
            marginTop: '18px',
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
