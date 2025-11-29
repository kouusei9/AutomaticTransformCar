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
    options: Partial<AutoViewSwitchOptions> = {}
) {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    const [isAutoMode, setIsAutoMode] = useState(false)
    const [currentViewIndex, setCurrentViewIndex] = useState(-1) // -1 表示全视角，>=0 表示车辆索引
    const timerRef = useRef<number | null>(null)
    const lastVehicleCountRef = useRef(0)

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
        if (vehicleIds.length === 0) {
            // 没有车辆，保持全视角
            console.log('🔄 自动切换: 无车辆，保持全视角')
            setCurrentViewIndex(-1)
            onSwitchToOverview()
            return
        }

        // 计算下一个视角索引
        // 顺序：全视角 (-1) -> 车辆0 (0) -> 车辆1 (1) -> ... -> 全视角 (-1) -> ...
        let nextIndex: number
        if (currentViewIndex === -1) {
            // 从全视角切换到第一个车辆
            nextIndex = 0
        } else if (currentViewIndex >= vehicleIds.length - 1) {
            // 从最后一个车辆切换回全视角
            nextIndex = -1
        } else {
            // 切换到下一个车辆
            nextIndex = currentViewIndex + 1
        }

        console.log(`🔄 自动切换: 从索引 ${currentViewIndex} 切换到 ${nextIndex}`, {
            totalVehicles: vehicleIds.length,
            nextVehicleId: nextIndex >= 0 ? vehicleIds[nextIndex] : 'overview',
            vehicleIds: vehicleIds
        })

        setCurrentViewIndex(nextIndex)

        if (nextIndex === -1) {
            // 切换到全视角
            console.log('📷 切换到全视角')
            onSwitchToOverview()
        } else {
            // 切换到指定车辆
            console.log(`📷 切换到车辆 [${nextIndex}]: ${vehicleIds[nextIndex]}`)
            onSwitchToVehicle(vehicleIds[nextIndex])
        }
    }, [currentViewIndex, vehicleIds, onSwitchToVehicle, onSwitchToOverview])

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
            console.log(`🎮 切换自动模式: ${prev ? '关闭' : '开启'} → ${newMode ? '开启' : '关闭'}`)
            if (newMode) {
                // 启用自动模式时，立即执行第一次切换
                setCurrentViewIndex(-1)
                console.log('🚀 启用自动模式，准备首次切换...')
                setTimeout(() => {
                    switchToNextView()
                }, 100)
            } else {
                // 关闭自动模式时清除定时器
                console.log('⏹️ 关闭自动模式，清除定时器')
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
     * 检测新车辆添加
     */
    useEffect(() => {
        if (isAutoMode && vehicleIds.length > lastVehicleCountRef.current) {
            // 有新车辆添加，立即切换到新车辆
            const newVehicleId = vehicleIds[vehicleIds.length - 1]
            setCurrentViewIndex(vehicleIds.length - 1)
            onSwitchToVehicle(newVehicleId)
        }
        lastVehicleCountRef.current = vehicleIds.length
    }, [vehicleIds, isAutoMode, onSwitchToVehicle])

    /**
     * 自动模式启动/停止 - 当视角索引变化时重新启动定时器
     */
    useEffect(() => {
        if (!isAutoMode) {
            clearTimer()
            return
        }

        clearTimer()
        console.log(`⏰ 启动自动切换定时器，间隔: ${opts.switchInterval}ms，当前索引: ${currentViewIndex}`)
        timerRef.current = window.setTimeout(() => {
            console.log('⏰ 定时器触发，执行切换')
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
