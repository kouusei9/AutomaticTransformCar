/**
 * 车辆纹理选择配置
 * 统一管理不同模式下的纹理选择逻辑，消除重复的 if-else
 */

import * as THREE from 'three'
import type { EdgeType, VehicleTextures, TextureAspects, SelectedTextureInfo } from '../types/vehicleTypes'

/**
 * 根据边缘类型和相机角度选择合适的纹理
 */
export function selectVehicleTexture(
  edgeType: EdgeType,
  dotForward: number,
  dotRight: number,
  textures: VehicleTextures,
  aspects: TextureAspects
): SelectedTextureInfo {
  // 判断主要视角方向
  const isFrontBackView = Math.abs(dotForward) > Math.abs(dotRight)
  const isFrontView = dotForward > 0
  const isRightView = dotRight > 0

  // 根据边缘类型选择纹理集
  const textureSet = getTextureSet(edgeType, textures, aspects)

  if (isFrontBackView) {
    // 前后视图
    if (isFrontView) {
      return {
        texture: textureSet.front,
        aspectRatio: textureSet.frontAspect,
        flipScale: 1,
        isSideView: false
      }
    } else {
      return {
        texture: textureSet.back,
        aspectRatio: textureSet.backAspect,
        flipScale: 1,
        isSideView: false
      }
    }
  } else {
    // 侧视图
    return {
      texture: textureSet.side,
      aspectRatio: textureSet.sideAspect,
      flipScale: isRightView ? 1 : -1,
      isSideView: true
    }
  }
}

/**
 * 根据边缘类型获取对应的纹理集
 */
function getTextureSet(
  edgeType: EdgeType,
  textures: VehicleTextures,
  aspects: TextureAspects
) {
  switch (edgeType) {
    case 'airplane':
      return {
        front: textures.airplaneFront,
        back: textures.airplaneBack,
        side: textures.airplaneSide,
        frontAspect: aspects.airplaneFront,
        backAspect: aspects.airplaneBack,
        sideAspect: aspects.airplaneSide
      }
    
    case 'drone':
      return {
        front: textures.droneFront,
        back: textures.droneBack,
        side: textures.droneSide,
        frontAspect: aspects.droneFront,
        backAspect: aspects.droneBack,
        sideAspect: aspects.droneSide
      }
    
    case 'highway':
      return {
        front: textures.highwayFront,
        back: textures.highwayBack,
        side: textures.highwaySide,
        frontAspect: aspects.highwayFront,
        backAspect: aspects.highwayBack,
        sideAspect: aspects.highwaySide
      }
    
    case 'road':
    default:
      return {
        front: textures.front,
        back: textures.back,
        side: textures.side,
        frontAspect: aspects.front,
        backAspect: aspects.back,
        sideAspect: aspects.side
      }
  }
}

/**
 * 计算纹理的宽高比
 */
export function calculateTextureAspect(texture: THREE.Texture, divisor: number = 1): number {
  const image = texture.image as any
  if (image && image.width && image.height) {
    return (image.width / image.height) / divisor
  }
  return 1
}
