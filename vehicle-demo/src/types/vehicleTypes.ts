/**
 * 车辆相关类型定义
 */

import * as THREE from 'three'

/**
 * 边缘类型
 */
export type EdgeType = 'road' | 'highway' | 'drone' | 'airplane'

/**
 * 曲线用户数据接口
 */
export interface CurveUserData {
  edgeType: EdgeType
  cost: number
}

/**
 * 车辆模式配置
 */
export interface VehicleModeConfig {
  frontTexture: THREE.Texture
  backTexture: THREE.Texture
  sideTexture: THREE.Texture
  frontAspect: number
  backAspect: number
  sideAspect: number
}

/**
 * 纹理集合
 */
export interface VehicleTextures {
  front: THREE.Texture
  back: THREE.Texture
  side: THREE.Texture
  droneFront: THREE.Texture
  droneBack: THREE.Texture
  droneSide: THREE.Texture
  highwayFront: THREE.Texture
  highwayBack: THREE.Texture
  highwaySide: THREE.Texture
  airplaneFront: THREE.Texture
  airplaneBack: THREE.Texture
  airplaneSide: THREE.Texture
}

/**
 * 纹理宽高比集合
 */
export interface TextureAspects {
  front: number
  back: number
  side: number
  droneFront: number
  droneBack: number
  droneSide: number
  highwayFront: number
  highwayBack: number
  highwaySide: number
  airplaneFront: number
  airplaneBack: number
  airplaneSide: number
}

/**
 * 路径段信息（缓存用）
 */
export interface PathSegmentInfo {
  edgeType: EdgeType
  cost: number
  speed: number
  length: number
}

/**
 * 选择的纹理信息
 */
export interface SelectedTextureInfo {
  texture: THREE.Texture
  aspectRatio: number
  flipScale: number
  isSideView: boolean
}
