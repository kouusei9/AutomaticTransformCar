/**
 * 相机跟踪功能 Hook
 */

import { useState, useCallback } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'

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
  followDistance: 12,
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
  const [vehiclePosition, setVehiclePosition] = useState<THREE.Vector3 | null>(null)
  const [vehicleForward, setVehicleForward] = useState<THREE.Vector3 | null>(null)

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
    setVehiclePosition(position)
    setVehicleForward(forward)

    const offset = forward.clone().multiplyScalar(-opts.followDistance)
    offset.y += opts.followHeight
    const followPos = position.clone().add(offset)
    const lookAtPoint = position.clone().add(forward.clone().multiplyScalar(opts.lookAheadDistance))

    gsap.to(cameraRef.current.position, {
      x: followPos.x,
      y: followPos.y,
      z: followPos.z,
      duration: opts.transitionDuration,
      ease: 'power2.inOut'
    })
    gsap.to(controlsRef.current.target, {
      x: lookAtPoint.x,
      y: lookAtPoint.y,
      z: lookAtPoint.z,
      duration: opts.transitionDuration,
      ease: 'power2.inOut'
    })
  }, [cameraRef, controlsRef, opts])

  /**
   * 停止跟踪
   */
  const stopFollowing = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return

    setFollowMode(false)
    setSelectedVehicleId(null)
    setVehiclePosition(null)
    setVehicleForward(null)

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
      setVehiclePosition(position)
      setVehicleForward(forward)
    }
  }, [followMode, selectedVehicleId])

  return {
    followMode,
    selectedVehicleId,
    vehiclePosition,
    vehicleForward,
    startFollowing,
    stopFollowing,
    toggleFollow,
    updateVehiclePosition
  }
}
