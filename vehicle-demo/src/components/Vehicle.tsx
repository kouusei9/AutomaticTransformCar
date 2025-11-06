import React, { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader } from '@react-three/fiber'

// ==================== 定数 ====================

const VEHICLE_SPEED = 0.1
const HOVER_HEIGHT_BASE = 0.5
const HOVER_LIFT_FACTOR = 0
const VEHICLE_SCALE = 6.0
const WIND_PARTICLE_COUNT = 50 // 風パーティクル数
const WIND_SPEED = 2.0 // 風パーティクル速度
const DRONE_ALTITUDE_THRESHOLD = 1 // 高度が1を超えると飛行状態と判定（昇天開始時に切替）
const FLAME_PARTICLE_COUNT = 50 // 炎パーティクル数
const FLAME_SPEED = 4.0 // 炎パーティクル速度

// サイドビューモード：
// true = 固定モード（車両が経路に垂直、路線の傾斜に追従、カメラ回転に影響されない）
// false = 追従モード（Billboard効果、常にカメラに向く）
const SIDE_VIEW_FIXED_MODE = false

// ==================== インターフェース ====================

interface VehicleProps {
  /** 車両が追従するカスタムパス */
  path?: THREE.Curve<THREE.Vector3>
  /** 速度倍率（デフォルト：VEHICLE_SPEED） */
  speed?: number
  /** パス上の開始位置（0-1） */
  startPosition?: number
  /** クリックハンドラー */
  onClick?: (position: THREE.Vector3, forward: THREE.Vector3) => void
  /** 位置更新コールバック */
  onPositionUpdate?: (position: THREE.Vector3, forward: THREE.Vector3) => void
}

// ==================== コンポーネント ====================

export const Vehicle: React.FC<VehicleProps> = ({ 
  path,
  speed = VEHICLE_SPEED,
  startPosition = 0,
  onClick,
  onPositionUpdate
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef(startPosition)
  const currentTextureRef = useRef<THREE.Texture | null>(null)
  const flipScaleRef = useRef(1)
  const currentAspectRef = useRef(1) // 現在のテクスチャのアスペクト比
  const windParticlesRef = useRef<THREE.Points>(null)
  const flameParticlesRef = useRef<THREE.Points>(null) // 炎パーティクル参照
  const isFlyingRef = useRef(false) // 現在の飛行状態を記録
  
  // 風パーティクルシステムを作成
  const windParticles = useMemo(() => {
    const positions = new Float32Array(WIND_PARTICLE_COUNT * 3)
    const velocities = new Float32Array(WIND_PARTICLE_COUNT * 3)
    const lifetimes = new Float32Array(WIND_PARTICLE_COUNT)
    
    for (let i = 0; i < WIND_PARTICLE_COUNT; i++) {
      // 初期位置は車両周辺にランダム分布
      positions[i * 3] = (Math.random() - 0.5) * 10
      positions[i * 3 + 1] = Math.random() * 5
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
      
      // ランダムなライフサイクル
      lifetimes[i] = Math.random()
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1))
    
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    })
    
    return { geometry, material }
  }, [])

  // 炎パーティクルシステムを作成（飛行時に使用）
  const flameParticles = useMemo(() => {
    const positions = new Float32Array(FLAME_PARTICLE_COUNT * 3)
    const lifetimes = new Float32Array(FLAME_PARTICLE_COUNT)
    
    for (let i = 0; i < FLAME_PARTICLE_COUNT; i++) {
      // 初期位置
      positions[i * 3] = 0
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = 0
      
      // ランダムなライフサイクル
      lifetimes[i] = Math.random()
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1))
    
    const material = new THREE.PointsMaterial({
      color: 0xff3300, // 赤い炎
      size: 0.5,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    })
    
    return { geometry, material }
  }, [])

  // 複数の車両テクスチャを読み込み
  const textures = {
    front: useLoader(THREE.TextureLoader, '/car_front.png'),
    back: useLoader(THREE.TextureLoader, '/car_back.png'),
    side: useLoader(THREE.TextureLoader, '/car_side.png'),
    droneFront: useLoader(THREE.TextureLoader, '/drone_front.png'),
    droneBack: useLoader(THREE.TextureLoader, '/drone_back.png'),
    droneSide: useLoader(THREE.TextureLoader, '/drone_side.png'),
  }
  
  // 各テクスチャのアスペクト比を計算
  const textureAspects = useMemo(() => {
    return {
      front: textures.front.image ? textures.front.image.width / textures.front.image.height : 1,
      back: textures.back.image ? textures.back.image.width / textures.back.image.height : 1,
      side: textures.side.image ? textures.side.image.width / textures.side.image.height : 1,
      droneFront: textures.droneFront.image ? textures.droneFront.image.width / textures.droneFront.image.height : 1,
      droneBack: textures.droneBack.image ? textures.droneBack.image.width / textures.droneBack.image.height : 1,
      droneSide: textures.droneSide.image ? textures.droneSide.image.width / textures.droneSide.image.height : 1,
    }
  }, [textures.front, textures.back, textures.side, textures.droneFront, textures.droneBack, textures.droneSide])

  // ピボットポイントを調整したジオメトリを作成
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.translate(0, 0.5, 0)
    return geo
  }, [])

  // マテリアルを作成（発光効果を除去）
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: textures.front,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    })
  }, [textures.front])

  // 現在のテクスチャを初期化
  useEffect(() => {
    currentTextureRef.current = textures.front
    currentAspectRef.current = textureAspects.front
  }, [textures.front, textureAspects.front])

  // クリックイベントを処理
  const handleClick = (e: any) => {
    e.stopPropagation()
    if (onClick && meshRef.current && path) {
      const t = progressRef.current
      const tangent = path.getTangentAt(t).normalize()
      onClick(meshRef.current.position.clone(), tangent)
    }
  }

  // アニメーションループ
  useFrame((state, delta) => {
    if (!meshRef.current || !path) return
    
    const mesh = meshRef.current
    const camera = state.camera
    
    // 進行状況を更新（0から1までループ）
    progressRef.current += speed * delta
    if (progressRef.current >= 1.0) {
      progressRef.current -= 1.0
    }
    
  const t = progressRef.current

  // パス位置と接線
  const pathPos = path.getPointAt(t)
  const tangent = path.getTangentAt(t).normalize()

  // 速度係数を計算（車両が移動する速さ）
  const nextT = (t + speed * delta * 0.1) % 1.0
  const nextPos = path.getPointAt(nextT)
  const speedFactor = pathPos.distanceTo(nextPos) / delta

  // パス高度に対する浮遊効果を適用
  const hoverOffset = HOVER_HEIGHT_BASE + (speedFactor * HOVER_LIFT_FACTOR)
  const position = pathPos.clone()
  position.y = pathPos.y + hoverOffset

  // 車両位置を設定
  mesh.position.copy(position)
    
    // 車両のカメラに対する方向を計算し、適切なテクスチャを選択
    const toCameraDir = new THREE.Vector3()
      .subVectors(camera.position, position)
      .normalize()
    
    // 車両の前進方向とカメラ方向の内積を計算
    const dotForward = tangent.dot(toCameraDir)
    
    // 車両の右側方向を計算
    const rightDir = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
    const dotRight = rightDir.dot(toCameraDir)
    
    // 飛行状態かどうかを判定（パス高度に基づき、現在位置高度ではない）
    // これにより昇天開始時にテクスチャが切り替わる
    const isFlying = pathPos.y >= DRONE_ALTITUDE_THRESHOLD
    
    // 角度に基づいてテクスチャとミラーリングを選択
    let selectedTexture: THREE.Texture
    let flipScale = 1
    let aspectRatio = 1
    let isSideView = false // サイドビューかどうか
    
    if (isFlying) {
      // 飛行状態：droneテクスチャを使用、ロジックは地上と同じ
      if (Math.abs(dotForward) > Math.abs(dotRight)) {
        // 主に前後方向
        if (dotForward > 0) {
          selectedTexture = textures.droneFront
          aspectRatio = textureAspects.droneFront
        } else {
          selectedTexture = textures.droneBack
          aspectRatio = textureAspects.droneBack
        }
      } else {
        // 主に左右方向 - サイドビュー
        selectedTexture = textures.droneSide
        aspectRatio = textureAspects.droneSide
        isSideView = true
        if (dotRight > 0) {
          flipScale = 1
        } else {
          flipScale = -1
        }
      }
    } else {
      // 地上状態：視点に基づいてテクスチャを選択
      if (Math.abs(dotForward) > Math.abs(dotRight)) {
        // 主に前後方向
        if (dotForward > 0) {
          selectedTexture = textures.front
          aspectRatio = textureAspects.front
        } else {
          selectedTexture = textures.back
          aspectRatio = textureAspects.back
        }
      } else {
        // 主に左右方向 - サイドビュー
        selectedTexture = textures.side
        aspectRatio = textureAspects.side
        isSideView = true
        if (dotRight > 0) {
          flipScale = 1
        } else {
          flipScale = -1
        }
      }
    }
    
    // テクスチャを更新（変更された場合）
    if (currentTextureRef.current !== selectedTexture) {
      currentTextureRef.current = selectedTexture
      material.map = selectedTexture
      material.needsUpdate = true
    }
    
    // アスペクト比とミラーリング状態を更新
    if (flipScaleRef.current !== flipScale || currentAspectRef.current !== aspectRatio) {
      flipScaleRef.current = flipScale
      currentAspectRef.current = aspectRatio
      // アスペクト比を使用してX軸スケールを調整
      mesh.scale.x = -VEHICLE_SCALE * flipScale * aspectRatio
      mesh.scale.y = VEHICLE_SCALE
    }
    
    // 車両の向きを処理
    if (isSideView && SIDE_VIEW_FIXED_MODE) {
      // サイドビュー + 固定モード：車両は経路の前進方向に垂直で、経路の傾斜に追従
      
      // 経路の水平面上の方向を計算
      const pathHorizontal = new THREE.Vector3(tangent.x, 0, tangent.z).normalize()
      
      // サイド軸を計算（経路の水平方向に垂直）
      const sideAxis = new THREE.Vector3().crossVectors(pathHorizontal, new THREE.Vector3(0, 1, 0)).normalize()
      
      // カメラ方向を取得し、どちら側を向くべきか判定
      const camToVehicle = new THREE.Vector3().subVectors(mesh.position, camera.position)
      camToVehicle.y = 0
      camToVehicle.normalize()
      
      // カメラ位置に基づいて車両が左側か右側を向くかを決定（方向を反転）
      const facingDirection = camToVehicle.dot(sideAxis) > 0 ? sideAxis.clone().negate() : sideAxis
      
      // 車両をサイド方向に向ける（経路に垂直）
      const lookAtPoint = mesh.position.clone().add(facingDirection)
      mesh.lookAt(lookAtPoint)
      
      // 経路の傾斜角度を計算
      const horizontalDistance = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z)
      const pathPitchAngle = Math.atan2(tangent.y, horizontalDistance)
      
      // サイド軸（車両の左右軸）周りにpitch回転を適用
      const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(pathHorizontal, pathPitchAngle)
      mesh.quaternion.multiply(pitchQuaternion)
      
    } else {
      // 追従モードまたは前後ビュー：Billboard効果、常にカメラに向く
      mesh.lookAt(camera.position)
    }
    
    // 風パーティクルを更新（地上時のみ）
    if (windParticlesRef.current) {
      if (!isFlying) {
        // 地上時：風パーティクルを表示・更新
        windParticlesRef.current.visible = true
        
        const positions = windParticles.geometry.attributes.position.array as Float32Array
        const lifetimes = windParticles.geometry.attributes.lifetime.array as Float32Array
        
        for (let i = 0; i < WIND_PARTICLE_COUNT; i++) {
          const i3 = i * 3
          
          // ライフサイクルを更新
          lifetimes[i] -= delta * 2
          
          // パーティクルをリセット
          if (lifetimes[i] <= 0) {
            // 車両後方に新しいパーティクルを生成
            const spawnDistance = 5
            const spawnOffset = tangent.clone().multiplyScalar(-spawnDistance)
            
            positions[i3] = position.x + spawnOffset.x + (Math.random() - 0.5) * 3
            positions[i3 + 1] = position.y + (Math.random() - 0.5) * 2
            positions[i3 + 2] = position.z + spawnOffset.z + (Math.random() - 0.5) * 3
            
            lifetimes[i] = 0.5 + Math.random() * 0.5
          } else {
            // パーティクルが車両の前進方向と反対方向に移動（後方から風が吹く効果）
            const windDirection = tangent.clone().multiplyScalar(-WIND_SPEED * delta * 10)
            positions[i3] += windDirection.x
            positions[i3 + 1] += windDirection.y - delta * 2 // わずかに下降
            positions[i3 + 2] += windDirection.z
          }
        }
        
        windParticles.geometry.attributes.position.needsUpdate = true
        windParticles.geometry.attributes.lifetime.needsUpdate = true
      } else {
        // 飛行時：風パーティクルを非表示
        windParticlesRef.current.visible = false
      }
    }

    // 炎パーティクルを更新（飛行時のみ）
    if (flameParticlesRef.current) {
      const flamePositions = flameParticles.geometry.attributes.position.array as Float32Array
      const flameLifetimes = flameParticles.geometry.attributes.lifetime.array as Float32Array
      
      // 飛行状態を更新
      isFlyingRef.current = isFlying
      
      if (isFlying) {
        // 飛行時：炎パーティクルを更新
        for (let i = 0; i < FLAME_PARTICLE_COUNT; i++) {
          const i3 = i * 3
          
          // ライフサイクルを更新
          flameLifetimes[i] -= delta * 3
          
          // パーティクルをリセット
          if (flameLifetimes[i] <= 0) {
            // 車両後方に新しいパーティクルを生成（テール噴射位置）
            const spawnOffset = tangent.clone().multiplyScalar(-VEHICLE_SCALE * 0.3) // 車両後方
            
            flamePositions[i3] = position.x + spawnOffset.x + (Math.random() - 0.5) * 1.5
            flamePositions[i3 + 1] = position.y + (Math.random() - 0.5) * 1.5
            flamePositions[i3 + 2] = position.z + spawnOffset.z + (Math.random() - 0.5) * 1.5
            
            flameLifetimes[i] = 0.3 + Math.random() * 0.3
          } else {
            // パーティクルが進行方向と反対方向に噴射（推進効果）
            const flameDirection = tangent.clone().multiplyScalar(-FLAME_SPEED * delta * 8)
            flamePositions[i3] += flameDirection.x
            flamePositions[i3 + 1] += flameDirection.y
            flamePositions[i3 + 2] += flameDirection.z
            
            // ランダムな拡散を追加
            flamePositions[i3] += (Math.random() - 0.5) * delta * 3
            flamePositions[i3 + 1] += (Math.random() - 0.5) * delta * 3
            flamePositions[i3 + 2] += (Math.random() - 0.5) * delta * 3
          }
        }
        
        // 炎パーティクルを表示
        flameParticlesRef.current.visible = true
      } else {
        // 地上時：炎パーティクルを非表示
        flameParticlesRef.current.visible = false
      }
      
      flameParticles.geometry.attributes.position.needsUpdate = true
      flameParticles.geometry.attributes.lifetime.needsUpdate = true
    }

    // 毎フレーム位置情報を更新（追従モード用）
    if (onPositionUpdate) {
      onPositionUpdate(mesh.position.clone(), tangent.clone())
    }
  })

  return (
    <group>
      {/* 車両メッシュ */}
      <mesh 
        ref={meshRef} 
        scale={[-VEHICLE_SCALE, VEHICLE_SCALE, 1]}
        onClick={handleClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'default'}
        castShadow
        receiveShadow
      >
        <primitive object={geometry} />
        <primitive object={material} attach="material" />
      </mesh>
      
      {/* 風パーティクルシステム */}
      <points ref={windParticlesRef} geometry={windParticles.geometry} material={windParticles.material} />
      
      {/* 炎パーティクルシステム（飛行時） */}
      <points ref={flameParticlesRef} geometry={flameParticles.geometry} material={flameParticles.material} />
    </group>
  )
}

export default Vehicle
