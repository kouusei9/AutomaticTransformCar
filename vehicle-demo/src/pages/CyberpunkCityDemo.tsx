import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import CityGround from '../components/CityGround'
import SkyEnvironment from '../components/SkyEnvironment'
import Vehicle from '../components/Vehicle'
import DistantCityscape from '../components/DistantCityscape'
import { createRoutePathFromNodeIds } from '../utils/routePathGenerator'

// 車両ルート設定（後でAPIから取得可能）
// 主要な経由点のみ指定すれば、システムが自動的にエッジに基づいて最短経路を探索
const VEHICLE_ROUTES = [
  {
    id: 1,
    name: 'テストルート1',
    nodeIds: ['A1', 'A2', 'A3', 'A4'],  // 簡略化：京都駅 → 七条 → 五条 → 西本願寺
    color: '#00ffff',
    speed: 0.008
  },
  {
    id: 2,
    name: 'テストルート2',
    nodeIds: ['C1', 'C2', 'C3'],  // 簡略化：東福寺 → 三十三間堂 → 祇園
    color: '#ff00ff',
    speed: 0.012
  },
  {
    id: 3,
    name: 'テストルート3',
    nodeIds: ['A1', 'B1', 'F1'],  // 簡略化：京都駅 → 九条 → 桂
    color: '#ffff00',
    speed: 0.010
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
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!)
  const controlsRef = useRef<any>(null!)
  const defaultCameraPos = new THREE.Vector3(100, 80, 100)
  const defaultTarget = new THREE.Vector3(0, 0, 0)

  // ルートデータを読み込み
  useEffect(() => {
    fetch('/kyoto_routes.json')
      .then(res => res.json())
      .then(data => {
        console.log('ルートデータ読み込み完了:', data)
        setRouteData(data)
      })
      .catch(err => console.error('ルートデータの読み込みに失敗:', err))
  }, [])

  // 設定に基づいて複数の経路を生成
  useEffect(() => {
    if (routeData) {
      const paths: THREE.CurvePath<THREE.Vector3>[] = []
      
      VEHICLE_ROUTES.forEach(route => {
        const path = createRoutePathFromNodeIds(
          routeData.nodes,
          routeData.edges,
          route.nodeIds
        )
        
        if (path) {
          paths.push(path)
        }
      })
      
      setRoutePaths(paths)
    }
  }, [routeData])

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
        <CityGround onRouteDataLoaded={setRouteData} />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.3} transparent />
        </mesh>
        
        {/* 各車両が異なる経路を走行 */}
        {(() => {
          console.log('車両レンダリング中、routePaths.length:', routePaths.length)
          return routePaths.length >= 3 ? (
            <>
              <Vehicle 
                path={routePaths[0]}
                speed={VEHICLE_ROUTES[0].speed} 
                startPosition={0} 
                onClick={handleVehicleClick(0)}
                onPositionUpdate={handlePositionUpdate(0)}
              />
              <Vehicle 
                path={routePaths[1]}
                speed={VEHICLE_ROUTES[1].speed} 
                startPosition={0}
                onClick={handleVehicleClick(1)}
                onPositionUpdate={handlePositionUpdate(1)}
              />
              <Vehicle 
                path={routePaths[2]}
                speed={VEHICLE_ROUTES[2].speed} 
                startPosition={0}
                onClick={handleVehicleClick(2)}
                onPositionUpdate={handlePositionUpdate(2)}
              />
            </>
          ) : (
            <group>
              <mesh position={[0, 5, 0]}>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial color="red" />
              </mesh>
            </group>
          )
        })()}
        
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
          border: '1px solid #00ffff',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <h2 style={{ margin: '0 0 10px 0', color: '#ff00ff' }}>
          🚀 京都市街地ナビゲーション
        </h2>
        <div style={{ lineHeight: '1.6' }}>
          <div>🚗 車両1: {VEHICLE_ROUTES[0].name}</div>
          <div>🚙 車両2: {VEHICLE_ROUTES[1].name}</div>
          <div>🚕 車両3: {VEHICLE_ROUTES[2].name}</div>
          <div>• {routePaths.length > 0 ? `✓ ${routePaths.length}ルート読み込み完了` : '⏳ ルート読み込み中...'}</div>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
            クリックで車両を追跡 | マウスで視点操作
          </div>
        </div>
      </div>
    </div>
  )
}
