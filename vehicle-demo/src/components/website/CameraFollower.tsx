/**
 * 相机跟踪组件
 * 独立的相机跟踪逻辑组件
 */

import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

interface CameraFollowerProps {
  followMode: boolean
  vehiclePosition: THREE.Vector3 | null
  vehicleForward: THREE.Vector3 | null
  cameraRef: React.RefObject<THREE.PerspectiveCamera>
  controlsRef: React.RefObject<any>
  followDistance?: number
  followHeight?: number
  lookAheadDistance?: number
  lerpFactor?: number
  isAutoMode?: boolean  // 自动模式启用围绕旋转
  rotationSpeed?: number // 旋转速度（弧度/秒）
}

export function CameraFollower({
  followMode,
  vehiclePosition,
  vehicleForward,
  cameraRef,
  controlsRef,
  followDistance = 12,
  followHeight = 6,
  lookAheadDistance = 15,
  lerpFactor = 0.08,
  isAutoMode = false,
  rotationSpeed = 0.05
}: CameraFollowerProps) {
  const vehicleRotationAngleRef = useRef(0)
  const overviewRotationAngleRef = useRef(0)
  const overviewInitializedRef = useRef(false)
  const radiusRef = useRef(100);  // 默认半径

  useFrame((_, delta) => {
    if (!cameraRef.current || !controlsRef.current) {
      return
    }

    if (!isAutoMode) {
      overviewInitializedRef.current = false
    }

    if (followMode && vehiclePosition && vehicleForward) {
      let offset: THREE.Vector3

      if (isAutoMode) {
        // 自动模式：优雅地围绕车辆旋转
        vehicleRotationAngleRef.current += rotationSpeed * delta

        const radius = followDistance
        const x = Math.sin(vehicleRotationAngleRef.current) * radius
        const z = Math.cos(vehicleRotationAngleRef.current) * radius

        offset = new THREE.Vector3(x, followHeight, z)
      } else {
        // 手动模式：跟随车辆前进方向
        offset = vehicleForward.clone().multiplyScalar(-followDistance)
        offset.y += followHeight
      }

      const targetCameraPos = vehiclePosition.clone().add(offset)

      cameraRef.current.position.lerp(targetCameraPos, lerpFactor)

      const lookTarget = vehiclePosition.clone().add(
        isAutoMode
          ? new THREE.Vector3(0, 0, 0)
          : vehicleForward.clone().multiplyScalar(lookAheadDistance)
      )

      if (controlsRef.current.target) {
        controlsRef.current.target.lerp(lookTarget, lerpFactor)
      }

      // 重新进入车辆追踪时，重置全视角旋转
      overviewInitializedRef.current = false
      return
    }

    if (isAutoMode) {
      const target = new THREE.Vector3(0, 0, 0)
      const defaultCameraPos = new THREE.Vector3(100, 80, 100)

      // 初始化一次 overview 的状态
      if (!overviewInitializedRef.current) {

        // 半径 = 默认位置到中心的水平距离
        const offset = new THREE.Vector3(
          defaultCameraPos.x - target.x,
          0,
          defaultCameraPos.z - target.z
        )

        radiusRef.current = offset.length()

        // 初始角度
        overviewRotationAngleRef.current = Math.atan2(offset.x, offset.z)

        // 设置相机位置
        cameraRef.current.position.copy(defaultCameraPos)

        // 设置 target
        controlsRef.current.target.copy(target)

        overviewInitializedRef.current = true
      }

      // 每帧更新旋转角度
      overviewRotationAngleRef.current += rotationSpeed * delta

      // 旋转相机
      const desiredPos = new THREE.Vector3(
        target.x + Math.sin(overviewRotationAngleRef.current) * radiusRef.current,
        80, // 固定高度
        target.z + Math.cos(overviewRotationAngleRef.current) * radiusRef.current
      )

      cameraRef.current.position.lerp(desiredPos, lerpFactor)

      // 看向中心
      controlsRef.current.target.lerp(target, lerpFactor)
    }
  })
  return null
}
