/**
 * 自动视角切换 Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface AutoViewSwitchOptions {
    switchInterval: number  // 切换间隔（毫秒）
    enabled: boolean        // 是否启用自动切换
}

const DEFAULT_OPTIONS: AutoViewSwitchOptions = {
    switchInterval: 8000,   // 默认 8 秒切换一次
    enabled: false
}

/**
 * 自动视角切换 Hook
 */
export function useAutoViewSwitch(
    vehicleIds: string[],
    onSwitchToVehicle: (vehicleId: string) => void,
    onSwitchToOverview: () => void,
    options: Partial<AutoViewSwitchOptions> = {},
    getStickyVehicleId?: () => string | null // 获取粘性跟踪车辆ID的函数
) {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    const [isAutoMode, setIsAutoMode] = useState(false)
    const [currentViewIndex, setCurrentViewIndex] = useState(-1) // -1 表示全视角，>=0 表示车辆索引
    const timerRef = useRef<number | null>(null)
    const lastVehicleCountRef = useRef(vehicleIds.length) // 初始化为当前车辆数量
    const lastVehicleIdsRef = useRef<string[]>(vehicleIds) // 跟踪车辆ID列表的变化

    /**
     * 清除定时器
     */
    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    /**
     * 切换到下一个视角
     */
    const switchToNextView = useCallback(() => {
        // 检查是否有粘性跟踪
        if (getStickyVehicleId && getStickyVehicleId()) {
            console.log(`🔒 粘性跟踪激活中，跳过自动切换`)
            return
        }

        if (vehicleIds.length === 0) {
            setCurrentViewIndex(-1)
            onSwitchToOverview()
            return
        }

        // 计算下一个视角索引
        let nextIndex: number
        if (currentViewIndex === -1) {
            nextIndex = 0
        } else if (currentViewIndex >= vehicleIds.length - 1) {
            nextIndex = -1
        } else {
            nextIndex = currentViewIndex + 1
        }

        setCurrentViewIndex(nextIndex)

        if (nextIndex === -1) {
            onSwitchToOverview()
        } else {
            onSwitchToVehicle(vehicleIds[nextIndex])
        }
    }, [currentViewIndex, vehicleIds, onSwitchToVehicle, onSwitchToOverview, getStickyVehicleId])

    const switchToNextViewRef = useRef(switchToNextView)
    useEffect(() => {
        switchToNextViewRef.current = switchToNextView
    }, [switchToNextView])

    /**
     * 切换自动模式
     */
    const toggleAutoMode = useCallback(() => {
        setIsAutoMode(prev => {
            const newMode = !prev
            if (newMode) {
                setCurrentViewIndex(-1)
                setTimeout(() => {
                    switchToNextView()
                }, 100)
            } else {
                clearTimer()
            }
            return newMode
        })
    }, [clearTimer, switchToNextView])

    /**
     * 手动禁用自动模式（用户点击车辆时）
     */
    const disableAutoMode = useCallback(() => {
        if (isAutoMode) {
            setIsAutoMode(false)
            clearTimer()
        }
    }, [isAutoMode, clearTimer])

    /**
     * 更新车辆列表引用（不再需要自动检测，由回调机制处理）
     */
    useEffect(() => {
        lastVehicleIdsRef.current = vehicleIds
        lastVehicleCountRef.current = vehicleIds.length
    }, [vehicleIds])

    /**
     * 自动模式启动/停止 - 当视角索引变化时重新启动定时器
     */
    useEffect(() => {
        if (!isAutoMode) {
            clearTimer()
            return
        }

        clearTimer()
        timerRef.current = window.setTimeout(() => {
            switchToNextViewRef.current()
        }, opts.switchInterval) as unknown as number

        return () => {
            clearTimer()
        }
    }, [isAutoMode, currentViewIndex, opts.switchInterval, clearTimer])

    return {
        isAutoMode,
        currentViewIndex,
        toggleAutoMode,
        disableAutoMode,
        switchToNextView
    }
}
