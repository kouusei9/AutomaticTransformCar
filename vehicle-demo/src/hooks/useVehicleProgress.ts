/**
 * 车辆路径进度管理 Hook
 * 处理车辆在路径上的移动、方向切换、完成回调等逻辑
 */

import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { EdgeType, PathSegmentInfo, CurveUserData } from '../types/vehicleTypes'

interface UseVehicleProgressParams {
  path: THREE.Curve<THREE.Vector3> | undefined
  startPosition: number
  isCycle: boolean
  onComplete?: () => void
}

interface UseVehicleProgressReturn {
  progressRef: React.MutableRefObject<number>
  directionRef: React.MutableRefObject<1 | -1>
  hasCompletedRef: React.MutableRefObject<boolean>
  segmentInfoRef: React.MutableRefObject<PathSegmentInfo | null>
  updateProgress: (delta: number) => void
  getCurrentSegmentInfo: () => PathSegmentInfo
  getPositionAndTangent: () => { position: THREE.Vector3; tangent: THREE.Vector3 }
}

const TIME_RATIO = 20 // 时间比例：1分钟真实时间 = 1分钟演示时间

/**
 * 车辆进度管理 Hook
 */
export function useVehicleProgress({
  path,
  startPosition,
  isCycle,
  onComplete
}: UseVehicleProgressParams): UseVehicleProgressReturn {
  const progressRef = useRef(startPosition)
  const directionRef = useRef<1 | -1>(1) // 1: 前进, -1: 后退
  const hasCompletedRef = useRef(false)
  const segmentInfoRef = useRef<PathSegmentInfo | null>(null)
  const lastUpdateTimeRef = useRef(Date.now()) // 真实时间追踪

  /**
   * 获取当前路径段信息（带缓存）
   */
  const getCurrentSegmentInfo = useCallback((): PathSegmentInfo => {
    if (!path || !(path as THREE.CurvePath<THREE.Vector3>).curves) {
      return { edgeType: 'road', cost: 60000, speed: 1 / 60, length: 0 }
    }

    const curves = (path as THREE.CurvePath<THREE.Vector3>).curves
    const t = progressRef.current

    // 根据累积长度找到当前曲线段
    const curveLengths = curves.map(curve => curve.getLength())
    const totalLength = curveLengths.reduce((a, b) => a + b, 0)
    const travelDist = t * totalLength

    let acc = 0
    let curveIndex = 0
    for (let i = 0; i < curveLengths.length; i++) {
      acc += curveLengths[i]
      if (travelDist <= acc) {
        curveIndex = i
        break
      }
    }

    const curve = curves[curveIndex] as any
    const userData = curve.userData as CurveUserData | undefined
    const edgeType: EdgeType = userData?.edgeType || 'road'
    const cost = userData?.cost || 80000

    // 计算速度
    const realTimeSeconds = cost / 1000
    const demoTimeSeconds = realTimeSeconds / TIME_RATIO
    const distancePerSecond = curve.getLength() / demoTimeSeconds

    // 使用距离可以解决，使用 1/demoTimeSeconds 在某些情况下会导致速度过慢的问题
    const speed = distancePerSecond / totalLength // t/秒
    // console.log(`当前曲线段 ${curveIndex}: 类型=${edgeType}, cost=${cost}ms, 速度=${speed.toFixed(4)} (t/秒)`)

    return {
      edgeType,
      cost,
      speed,
      length: curveLengths[curveIndex]
    }
  }, [path])

  /**
   * 更新进度
   */
  const updateProgress = useCallback((delta: number) => {
    if (!path) return

    // 使用真实时间而非帧时间（避免卡顿影响时间计算）
    const now = Date.now()
    const realDelta = Math.min((now - lastUpdateTimeRef.current) / 1000, 0.1) // 限制最大 100ms
    lastUpdateTimeRef.current = now

    // 获取当前段信息
    const segmentInfo = getCurrentSegmentInfo()
    segmentInfoRef.current = segmentInfo

    // 使用真实时间增量更新进度
    progressRef.current += segmentInfo.speed * realDelta * directionRef.current

    // 到达终点或起点时的处理
    if (isCycle) {
      // 循环模式：到达终点反向，到达起点再反向
      if (progressRef.current >= 1.0) {
        progressRef.current = 1.0
        directionRef.current = -1
      } else if (progressRef.current <= 0.0) {
        progressRef.current = 0.0
        directionRef.current = 1
      }
    } else {
      // 非循环模式：到达终点触发完成回调
      if (progressRef.current >= 1.0) {
        if (!hasCompletedRef.current && onComplete) {
          hasCompletedRef.current = true
          onComplete()
        }
        progressRef.current = 1.0
      }
    }
  }, [path, isCycle, onComplete, getCurrentSegmentInfo])

  /**
   * 获取当前位置和切线
   */
  const getPositionAndTangent = useCallback((): { position: THREE.Vector3; tangent: THREE.Vector3 } => {
    if (!path) {
      return {
        position: new THREE.Vector3(),
        tangent: new THREE.Vector3(0, 0, 1)
      }
    }

    const t = progressRef.current
    const position = path.getPointAt(t)
    let tangent = path.getTangentAt(t).normalize()

    // 反向行驶时反转切线方向
    if (directionRef.current === -1) {
      tangent = tangent.negate()
    }

    return { position, tangent }
  }, [path])

  return {
    progressRef,
    directionRef,
    hasCompletedRef,
    segmentInfoRef,
    updateProgress,
    getCurrentSegmentInfo,
    getPositionAndTangent
  }
}
