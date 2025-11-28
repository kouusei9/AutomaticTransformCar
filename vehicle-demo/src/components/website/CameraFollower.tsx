/**
 * 相机跟踪组件
 * 独立的相机跟踪逻辑组件
 */

import { useFrame } from '@react-three/fiber'
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
  lerpFactor = 0.08
}: CameraFollowerProps) {
  useFrame(() => {
    if (!followMode || !vehiclePosition || !vehicleForward || !cameraRef.current || !controlsRef.current) {
      return
    }

    const offset = vehicleForward.clone().multiplyScalar(-followDistance)
    offset.y += followHeight
    const targetCameraPos = vehiclePosition.clone().add(offset)

    cameraRef.current.position.lerp(targetCameraPos, lerpFactor)

    const lookTarget = vehiclePosition.clone().add(vehicleForward.clone().multiplyScalar(lookAheadDistance))

    if (controlsRef.current.target) {
      controlsRef.current.target.lerp(lookTarget, lerpFactor)
    }
  })

  return null
}
