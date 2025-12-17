/**
 * 相机跟踪功能 Hook
 */

import { useState, useCallback, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'

export interface CameraFollowOptions {
  defaultPosition: THREE.Vector3
  defaultTarget: THREE.Vector3
  followDistance: number
  followHeight: number
  lookAheadDistance: number
  transitionDuration: number
}

const DEFAULT_OPTIONS: CameraFollowOptions = {
  defaultPosition: new THREE.Vector3(100, 80, 100),
  defaultTarget: new THREE.Vector3(0, 0, 0),
  followDistance: 100,
  followHeight: 6,
  lookAheadDistance: 15,
  transitionDuration: 1.2
}

/**
 * 相机跟踪 Hook
 */
export function useCameraFollow(
  cameraRef: React.RefObject<THREE.PerspectiveCamera>,
  controlsRef: React.RefObject<any>,
  options: Partial<CameraFollowOptions> = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  const [followMode, setFollowMode] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  // 使用ref而不是state，避免Vector3对象变化导致无限重渲染
  const vehiclePositionRef = useRef<THREE.Vector3 | null>(null)
  const vehicleForwardRef = useRef<THREE.Vector3 | null>(null)

  /**
   * 开始跟踪车辆
   */
  const startFollowing = useCallback((
    vehicleId: string,
    position: THREE.Vector3,
    forward: THREE.Vector3
  ) => {
    if (!cameraRef.current || !controlsRef.current) return

    setFollowMode(true)
    setSelectedVehicleId(vehicleId)
    vehiclePositionRef.current = position.clone()
    vehicleForwardRef.current = forward.clone()

    // const offset = forward.clone().multiplyScalar(-opts.followDistance)
    // offset.y += opts.followHeight
    // const followPos = position.clone().add(offset)
    // const lookAtPoint = position.clone().add(forward.clone().multiplyScalar(opts.lookAheadDistance))

    // gsap.to(cameraRef.current.position, {
    //   x: followPos.x,
    //   y: followPos.y,
    //   z: followPos.z,
    //   duration: opts.transitionDuration,
    //   ease: 'power2.inOut'
    // })
    // gsap.to(controlsRef.current.target, {
    //   x: lookAtPoint.x,
    //   y: lookAtPoint.y,
    //   z: lookAtPoint.z,
    //   duration: opts.transitionDuration,
    //   ease: 'power2.inOut'
    // })
  }, [cameraRef, controlsRef, opts])

  /**
   * 停止跟踪
   */
  const stopFollowing = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return

    setFollowMode(false)
    setSelectedVehicleId(null)
    vehiclePositionRef.current = null
    vehicleForwardRef.current = null

    gsap.to(cameraRef.current.position, {
      x: opts.defaultPosition.x,
      y: opts.defaultPosition.y,
      z: opts.defaultPosition.z,
      duration: opts.transitionDuration,
      ease: 'power2.inOut'
    })
    gsap.to(controlsRef.current.target, {
      x: opts.defaultTarget.x,
      y: opts.defaultTarget.y,
      z: opts.defaultTarget.z,
      duration: opts.transitionDuration,
      ease: 'power2.inOut'
    })
  }, [cameraRef, controlsRef, opts])

  /**
   * 切换跟踪状态
   */
  const toggleFollow = useCallback((
    vehicleId: string,
    position: THREE.Vector3,
    forward: THREE.Vector3
  ) => {
    if (!followMode || selectedVehicleId !== vehicleId) {
      startFollowing(vehicleId, position, forward)
    } else {
      stopFollowing()
    }
  }, [followMode, selectedVehicleId, startFollowing, stopFollowing])

  /**
   * 更新车辆位置
   */
  const updateVehiclePosition = useCallback((
    vehicleId: string,
    position: THREE.Vector3,
    forward: THREE.Vector3
  ) => {
    if (followMode && selectedVehicleId === vehicleId) {
      vehiclePositionRef.current = position.clone()
      vehicleForwardRef.current = forward.clone()
    }
  }, [followMode, selectedVehicleId])

  return {
    followMode,
    selectedVehicleId,
    vehiclePositionRef,
    vehicleForwardRef,
    startFollowing,
    stopFollowing,
    toggleFollow,
    updateVehiclePosition
  }
}

interface CameraFollowerProps {
  followMode: boolean
  vehiclePositionRef: React.RefObject<THREE.Vector3 | null>
  vehicleForwardRef: React.RefObject<THREE.Vector3 | null>
  cameraRef: React.RefObject<THREE.PerspectiveCamera>
  controlsRef: React.RefObject<any>
  isAutoMode?: boolean        // 是否为自动模式
  rotationSpeed?: number      // 旋转速度（弧度/秒）
}

export function CameraFollower({
  followMode,
  vehiclePositionRef,
  vehicleForwardRef,
  cameraRef,
  controlsRef,
  isAutoMode = false,
  rotationSpeed = 0.1
}: CameraFollowerProps) {
  const vehicleRotationRef = useRef(0)      // 车辆跟踪时的旋转角度
  const overviewRotationRef = useRef(0)     // 全视角时的旋转角度
  const lastModeRef = useRef<'vehicle' | 'overview' | null>(null)

  useFrame((state, delta) => {
    // 模式切换检测（在useFrame中进行，避免useEffect无限循环）
    const currentMode = followMode ? 'vehicle' : 'overview'
    if (lastModeRef.current !== currentMode) {
      if (currentMode === 'overview') {
        // 切换到全视角时，从当前相机角度开始
        const camera = cameraRef.current
        if (camera) {
          overviewRotationRef.current = Math.atan2(
            camera.position.z,
            camera.position.x
          )
        }
      } else {
        // 切换到车辆跟踪时重置
        vehicleRotationRef.current = 0
      }
      lastModeRef.current = currentMode
    }
    if (!cameraRef.current || !controlsRef.current) return
    const camera = cameraRef.current
    const controls = controlsRef.current

    // 自动模式下的全视角旋转
    if (isAutoMode && !followMode) {
      // 全视角：围绕城市中心缓慢旋转
      overviewRotationRef.current += rotationSpeed * delta
      
      const radius = 150        // 旋转半径
      const height = 80         // 相机高度
      const targetHeight = 10   // 🎯 目标点高度（城市中心高度）
      
      // 计算相机位置（圆周运动）
      const x = Math.cos(overviewRotationRef.current) * radius
      const z = Math.sin(overviewRotationRef.current) * radius
      
      camera.position.set(x, height, z)
      
      // 🎯 关键：让相机看向城市中心的合适高度
      controls.target.set(0, targetHeight, 0)
      controls.update()
      return
    }

    // 车辆跟踪模式
    const vehiclePosition = vehiclePositionRef.current
    const vehicleForward = vehicleForwardRef.current
    if (followMode && vehiclePosition && vehicleForward) {
      const distance = 16
      const height = 6
      const lookAheadDistance = 15

      if (isAutoMode) {
        // 自动模式：围绕车辆旋转
        vehicleRotationRef.current += rotationSpeed * delta

        const offsetX = Math.cos(vehicleRotationRef.current) * distance
        const offsetZ = Math.sin(vehicleRotationRef.current) * distance

        camera.position.set(
          vehiclePosition.x + offsetX,
          vehiclePosition.y + height,
          vehiclePosition.z + offsetZ
        )

        controls.target.copy(vehiclePosition)
      } else {
        // 手动模式：跟随车辆前进方向
        const backward = vehicleForward.clone().multiplyScalar(-distance)
        const targetPos = vehiclePosition.clone().add(backward)
        targetPos.y += height

        camera.position.lerp(targetPos, 0.1)

        const lookAhead = vehiclePosition.clone().add(
          vehicleForward.clone().multiplyScalar(lookAheadDistance)
        )
        controls.target.lerp(lookAhead, 0.1)
      }

      controls.update()
    }
  })

  return null
}
