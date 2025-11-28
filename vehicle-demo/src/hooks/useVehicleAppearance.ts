/**
 * 车辆外观管理 Hook
 * 处理纹理选择、缩放、材质更新等视觉相关逻辑
 */

import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { selectVehicleTexture } from '../utils/vehicleTextureConfig'
import type { EdgeType, VehicleTextures, TextureAspects } from '../types/vehicleTypes'

interface UseVehicleAppearanceParams {
  textures: VehicleTextures
  textureAspects: TextureAspects
  material: THREE.MeshStandardMaterial
  xrayMaterial: THREE.MeshBasicMaterial
  vehicleScale: number
}

interface UseVehicleAppearanceReturn {
  currentTextureRef: React.MutableRefObject<THREE.Texture | null>
  flipScaleRef: React.MutableRefObject<number>
  currentAspectRef: React.MutableRefObject<number>
  updateAppearance: (
    edgeType: EdgeType,
    tangent: THREE.Vector3,
    cameraPosition: THREE.Vector3,
    meshRef: React.RefObject<THREE.Mesh | null>,
    xrayMeshRef: React.RefObject<THREE.Mesh | null>
  ) => { scaleX: number; scaleY: number; isSideView: boolean }
}

/**
 * 车辆外观管理 Hook
 */
export function useVehicleAppearance({
  textures,
  textureAspects,
  material,
  xrayMaterial,
  vehicleScale
}: UseVehicleAppearanceParams): UseVehicleAppearanceReturn {
  const currentTextureRef = useRef<THREE.Texture | null>(textures.front)
  const flipScaleRef = useRef(1)
  const currentAspectRef = useRef(1)

  // 复用的临时向量，避免每帧创建新对象
  const toCameraDirRef = useRef(new THREE.Vector3())
  const rightDirRef = useRef(new THREE.Vector3())
  const upVectorRef = useRef(new THREE.Vector3(0, 1, 0))

  /**
   * 更新车辆外观
   */
  const updateAppearance = useCallback((
    edgeType: EdgeType,
    tangent: THREE.Vector3,
    cameraPosition: THREE.Vector3,
    meshRef: React.RefObject<THREE.Mesh | null>,
    xrayMeshRef: React.RefObject<THREE.Mesh | null>
  ) => {
    const mesh = meshRef.current
    if (!mesh) {
      return { scaleX: -vehicleScale, scaleY: vehicleScale, isSideView: false }
    }

    // 计算相机方向（复用向量）
    toCameraDirRef.current
      .subVectors(cameraPosition, mesh.position)
      .normalize()

    // 计算前进方向和相机方向的内积
    const dotForward = tangent.dot(toCameraDirRef.current)

    // 计算右侧方向（复用向量）
    rightDirRef.current.crossVectors(tangent, upVectorRef.current).normalize()
    const dotRight = rightDirRef.current.dot(toCameraDirRef.current)

    // 选择合适的纹理
    const textureInfo = selectVehicleTexture(
      edgeType,
      dotForward,
      dotRight,
      textures,
      textureAspects
    )

    // 更新纹理（仅在变化时）
    if (currentTextureRef.current !== textureInfo.texture) {
      currentTextureRef.current = textureInfo.texture
      material.map = textureInfo.texture
      material.needsUpdate = true
      xrayMaterial.map = textureInfo.texture
      xrayMaterial.needsUpdate = true
    }

    // 更新缩放（仅在变化时）
    if (
      flipScaleRef.current !== textureInfo.flipScale ||
      currentAspectRef.current !== textureInfo.aspectRatio
    ) {
      flipScaleRef.current = textureInfo.flipScale
      currentAspectRef.current = textureInfo.aspectRatio

      const scaleX = -vehicleScale * textureInfo.flipScale * textureInfo.aspectRatio
      const scaleY = vehicleScale

      mesh.scale.set(scaleX, scaleY, 1)

      // 同步透视网格的缩放
      if (xrayMeshRef.current) {
        xrayMeshRef.current.scale.set(scaleX, scaleY, 1)
      }
    }

    // 始终返回当前的缩放值（基于ref中存储的值）
    const scaleX = -vehicleScale * flipScaleRef.current * currentAspectRef.current
    const scaleY = vehicleScale

    return {
      scaleX,
      scaleY,
      isSideView: textureInfo.isSideView
    }
  }, [textures, textureAspects, material, xrayMaterial, vehicleScale])

  return {
    currentTextureRef,
    flipScaleRef,
    currentAspectRef,
    updateAppearance
  }
}
