/**
 * 遮挡检测 Hook
 * 优化 raycaster 性能，仅在必要时检测遮挡
 */

import { useRef, useState, useCallback } from 'react'
import * as THREE from 'three'

interface UseOcclusionDetectionParams {
  meshRef: React.RefObject<THREE.Mesh | null>
  xrayMeshRef: React.RefObject<THREE.Mesh | null>
  windParticlesRef: React.RefObject<THREE.Points | null>
  flameParticlesRef: React.RefObject<THREE.Points | null>
  name?: string
  debugMode?: boolean
}

interface UseOcclusionDetectionReturn {
  isOccluded: boolean
  checkOcclusion: (
    position: THREE.Vector3,
    camera: THREE.Camera,
    scene: THREE.Scene
  ) => boolean
}

/**
 * 遮挡检测 Hook
 */
export function useOcclusionDetection({
  meshRef,
  xrayMeshRef,
  windParticlesRef,
  flameParticlesRef,
  name,
  debugMode = false
}: UseOcclusionDetectionParams): UseOcclusionDetectionReturn {
  const [isOccluded, setIsOccluded] = useState(false)
  const raycasterRef = useRef(new THREE.Raycaster())

  /**
   * 检查遮挡
   */
  const checkOcclusion = useCallback((
    position: THREE.Vector3,
    camera: THREE.Camera,
    scene: THREE.Scene
  ): boolean => {
    const mesh = meshRef.current
    if (!mesh) return false

    const raycaster = raycasterRef.current
    const direction = new THREE.Vector3().subVectors(position, camera.position).normalize()
    const distance = position.distanceTo(camera.position)

    // 设置 raycaster
    raycaster.camera = camera
    raycaster.set(camera.position, direction)
    raycaster.near = (camera as any).near || 0.1
    raycaster.far = Math.max(distance - 0.5, 0.1)

    // 检测交叉
    const intersects = raycaster.intersectObjects(scene.children, true)

    // 排除自身和特定类型的对象
    let occluded = false
    for (const intersect of intersects) {
      const obj = intersect.object

      if (
        obj !== mesh &&
        obj !== xrayMeshRef.current &&
        obj !== windParticlesRef.current &&
        obj !== flameParticlesRef.current &&
        obj.type !== 'Points' &&
        obj.type !== 'Line' &&
        obj.type !== 'LineLoop' &&
        obj.type !== 'LineSegments' &&
        !obj.type.includes('Helper') &&
        !obj.name.includes('Text')
      ) {
        occluded = true
        break
      }
    }

    // 更新状态（仅在变化时）
    setIsOccluded(prev => {
      if (prev !== occluded) {
        if (debugMode) {
          console.log(`Vehicle ${name}: isOccluded=${occluded}, intersects=${intersects.length}`)
        }
        return occluded
      }
      return prev
    })

    return occluded
  }, [meshRef, xrayMeshRef, windParticlesRef, flameParticlesRef, name, debugMode])

  return {
    isOccluded,
    checkOcclusion
  }
}
