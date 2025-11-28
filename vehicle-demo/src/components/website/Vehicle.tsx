import React, { useRef, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useVehicleProgress } from '../../hooks/useVehicleProgress'
import { useVehicleAppearance } from '../../hooks/useVehicleAppearance'
import { useOcclusionDetection } from '../../hooks/useOcclusionDetection'
import { WindParticles } from './WindParticles'
import { FlameParticles } from './FlameParticles'
import { calculateTextureAspect } from '../../utils/vehicleTextureConfig'
import type { VehicleTextures, TextureAspects } from '../../types/vehicleTypes'

// ==================== 定数 ====================

const HOVER_HEIGHT_BASE = 0.5
const VEHICLE_SCALE = 6.0

// サイドビューモード：
// true = 固定モード（車両が経路に垂直、路線の傾斜に追従、カメラ回転に影響されない）
// false = 追従モード（Billboard効果、常にカメラに向く）
const SIDE_VIEW_FIXED_MODE = false

// デバッグモード：遮蔽検出を可視化
const DEBUG_OCCLUSION = false

// ==================== インターフェース ====================

interface VehicleProps {
  /** 車両が追従するカスタムパス */
  path?: THREE.Curve<THREE.Vector3>
  /** パス上の開始位置（0-1） */
  startPosition?: number
  /** クリックハンドラー */
  onClick?: (position: THREE.Vector3, forward: THREE.Vector3) => void
  /** 位置更新コールバック */
  onPositionUpdate?: (position: THREE.Vector3, forward: THREE.Vector3) => void
  /** 完成回调（到达终点时触发）*/
  onComplete?: () => void
  /** 車両名 */
  name?: string
  /** 循环模式 */
  isCycle?: boolean
}

// ==================== コンポーネント ====================

export const Vehicle: React.FC<VehicleProps> = ({
  path,
  startPosition = 0,
  onClick,
  onPositionUpdate,
  onComplete,
  name,
  isCycle = false
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const xrayMeshRef = useRef<THREE.Mesh>(null)
  const textRef = useRef<any>(null)
  const windParticlesRef = useRef<THREE.Points>(null)
  const flameParticlesRef = useRef<THREE.Points>(null)
  const [currentScale, setCurrentScale] = useState<[number, number, number]>([-VEHICLE_SCALE, VEHICLE_SCALE, 1])

  // 複数の車両テクスチャを読み込み
  const textures: VehicleTextures = {
    front: useLoader(THREE.TextureLoader, '/website-assets/car_front.png'),
    back: useLoader(THREE.TextureLoader, '/website-assets/car_back.png'),
    side: useLoader(THREE.TextureLoader, '/website-assets/car_side.png'),
    droneFront: useLoader(THREE.TextureLoader, '/website-assets/drone_front.png'),
    droneBack: useLoader(THREE.TextureLoader, '/website-assets/drone_back.png'),
    droneSide: useLoader(THREE.TextureLoader, '/website-assets/drone_side.png'),
    highwayFront: useLoader(THREE.TextureLoader, '/website-assets/high_car_front.png'),
    highwayBack: useLoader(THREE.TextureLoader, '/website-assets/high_car_back.png'),
    highwaySide: useLoader(THREE.TextureLoader, '/website-assets/high_car_side.png'),
    airplaneFront: useLoader(THREE.TextureLoader, '/website-assets/airplane_front.png'),
    airplaneBack: useLoader(THREE.TextureLoader, '/website-assets/airplane_back.png'),
    airplaneSide: useLoader(THREE.TextureLoader, '/website-assets/airplane_side.png'),
  }

  // 各テクスチャのアスペクト比を計算
  const textureAspects: TextureAspects = useMemo(() => ({
    front: calculateTextureAspect(textures.front),
    back: calculateTextureAspect(textures.back),
    side: calculateTextureAspect(textures.side),
    droneFront: calculateTextureAspect(textures.droneFront),
    droneBack: calculateTextureAspect(textures.droneBack),
    droneSide: calculateTextureAspect(textures.droneSide),
    highwayFront: calculateTextureAspect(textures.highwayFront),
    highwayBack: calculateTextureAspect(textures.highwayBack),
    highwaySide: calculateTextureAspect(textures.highwaySide),
    airplaneFront: calculateTextureAspect(textures.airplaneFront),
    airplaneBack: calculateTextureAspect(textures.airplaneBack),
    airplaneSide: calculateTextureAspect(textures.airplaneSide),
  }), [textures])

  // ピボットポイントを調整したジオメトリを作成
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.translate(0, 0.5, 0)
    return geo
  }, [])

  // マテリアルを作成（正常材質）
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: textures.front,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      opacity: 1.0,
    })
  }, [textures.front])

  // 透視用の青色発光マテリアル（遮蔽時用）
  const xrayMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: textures.front,
      transparent: true,
      opacity: 0.8,
      color: new THREE.Color(0x00ffff),
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  }, [textures.front])

  // ==================== カスタムフック ====================

  // 路径进度管理
  const {
    updateProgress,
    getCurrentSegmentInfo,
    getPositionAndTangent
  } = useVehicleProgress({
    path,
    startPosition,
    isCycle,
    onComplete
  })

  // 外观管理
  const { updateAppearance } = useVehicleAppearance({
    textures,
    textureAspects,
    material,
    xrayMaterial,
    vehicleScale: VEHICLE_SCALE
  })

  // 遮挡检测
  const { isOccluded, checkOcclusion } = useOcclusionDetection({
    meshRef,
    xrayMeshRef,
    windParticlesRef,
    flameParticlesRef,
    name,
    debugMode: DEBUG_OCCLUSION
  })

  // ==================== イベントハンドラー ====================

  const handleClick = (e: any) => {
    e.stopPropagation()
    if (onClick && meshRef.current && path) {
      const { position, tangent } = getPositionAndTangent()
      onClick(position, tangent)
    }
  }

  // ==================== アニメーションループ ====================

  useFrame((state, delta) => {
    if (!meshRef.current || !path) return

    delta = Math.min(delta, 0.033) // 大きなフレーム時間を制限

    const mesh = meshRef.current
    const camera = state.camera

    // 更新进度
    updateProgress(delta)

    // 获取当前段信息
    const segmentInfo = getCurrentSegmentInfo()
    const { position: pathPos, tangent } = getPositionAndTangent()

    // パス高度に対する浮遊効果を適用
    const hoverOffset = HOVER_HEIGHT_BASE
    const position = pathPos.clone()
    position.y = pathPos.y + hoverOffset

    // 車両位置を設定
    mesh.position.copy(position)

    // 透視メッシュの位置も同期
    if (xrayMeshRef.current) {
      xrayMeshRef.current.position.copy(position)
      const toCamera = new THREE.Vector3().subVectors(camera.position, position).normalize()
      xrayMeshRef.current.position.addScaledVector(toCamera, 0.01)
    }

    // 遮挡检测
    checkOcclusion(position, camera, state.scene)

    // 更新外观
    const { scaleX, scaleY, isSideView } = updateAppearance(
      segmentInfo.edgeType,
      tangent,
      camera.position,
      meshRef,
      xrayMeshRef
    )

    // 更新缩放状态
    if (currentScale[0] !== scaleX || currentScale[1] !== scaleY) {
      setCurrentScale([scaleX, scaleY, 1])
    }

    // 車両の向きを処理
    if (isSideView && SIDE_VIEW_FIXED_MODE) {
      // サイドビュー + 固定モード：車両は経路の前進方向に垂直で、経路の傾斜に追従
      const pathHorizontal = new THREE.Vector3(tangent.x, 0, tangent.z).normalize()
      const sideAxis = new THREE.Vector3().crossVectors(pathHorizontal, new THREE.Vector3(0, 1, 0)).normalize()
      const camToVehicle = new THREE.Vector3().subVectors(mesh.position, camera.position)
      camToVehicle.y = 0
      camToVehicle.normalize()
      const facingDirection = camToVehicle.dot(sideAxis) > 0 ? sideAxis.clone().negate() : sideAxis
      const lookAtPoint = mesh.position.clone().add(facingDirection)
      mesh.lookAt(lookAtPoint)
      const horizontalDistance = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z)
      const pathPitchAngle = Math.atan2(tangent.y, horizontalDistance)
      const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(pathHorizontal, pathPitchAngle)
      mesh.quaternion.multiply(pitchQuaternion)
    } else {
      // 追従モードまたは前後ビュー：Billboard効果
      mesh.lookAt(camera.position)
    }

    // 透視メッシュの回転も同期
    if (xrayMeshRef.current) {
      xrayMeshRef.current.rotation.copy(mesh.rotation)
    }

    // 更新Text位置
    if (textRef.current && mesh) {
      textRef.current.position.set(
        mesh.position.x,
        mesh.position.y + VEHICLE_SCALE + 2,
        mesh.position.z
      )
      textRef.current.lookAt(camera.position)
    }

    // 毎フレーム位置情報を更新
    if (onPositionUpdate) {
      onPositionUpdate(mesh.position.clone(), tangent.clone())
    }
  })

  return (
    <group>
      {/* 車両メッシュ（正常表示） */}
      <mesh
        ref={meshRef}
        scale={currentScale}
        onClick={handleClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'default'}
        castShadow
        receiveShadow
        renderOrder={0}
      >
        <primitive object={geometry} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* 透視用メッシュ（遮蔽時のみレンダリング） */}
      {isOccluded && (
        <mesh
          ref={xrayMeshRef}
          scale={currentScale}
          renderOrder={10000}
        >
          <primitive object={geometry} />
          <primitive object={xrayMaterial} attach="material" />
        </mesh>
      )}

      {/* 車両名表示 */}
      {name && (
        <Text
          ref={textRef}
          position={[0, VEHICLE_SCALE + 2, 0]}
          fontSize={1.5}
          color="#00ffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.15}
          outlineColor="#000000"
          renderOrder={10001}
        >
          {name}
        </Text>
      )}

      {/* 風パーティクルシステム（地上時のみ） */}
      <WindParticles
        visible={getCurrentSegmentInfo().edgeType !== 'drone'}
        position={meshRef.current?.position || new THREE.Vector3()}
        tangent={getPositionAndTangent().tangent}
      />

      {/* 炎パーティクルシステム（飛行時のみ） */}
      <FlameParticles
        visible={getCurrentSegmentInfo().edgeType === 'drone'}
        position={meshRef.current?.position || new THREE.Vector3()}
        tangent={getPositionAndTangent().tangent}
        vehicleScale={VEHICLE_SCALE}
      />
    </group>
  )
}

export default Vehicle
