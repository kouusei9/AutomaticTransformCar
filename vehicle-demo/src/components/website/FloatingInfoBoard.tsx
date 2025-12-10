import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

interface FloatingInfoBoardProps {
    position: [number, number, number]
    title?: string
}

/**
 * 悬浮信息公告板组件
 * 始终朝向相机，显示虚拟的城市信息
 */
export function FloatingInfoBoard({
    position,
    title = 'CITY INFO'
}: FloatingInfoBoardProps) {
    const boardRef = useRef<THREE.Group>(null!)
    const { camera } = useThree()

    // 动态更新的虚拟数据
    const [weather, setWeather] = useState('Sunny')
    const [temperature, setTemperature] = useState(23)
    const [traffic, setTraffic] = useState('Light')
    const [activeVehicles, setActiveVehicles] = useState(3)
    const [time, setTime] = useState('14:32')

    // 天气图标
    const weatherIcon = useMemo(() => {
        const icons: Record<string, string> = {
            'Sunny': '☀️',
            'Cloudy': '☁️',
            'Rainy': '🌧️',
            'Night': '🌙'
        }
        return icons[weather] || '☀️'
    }, [weather])

    // 交通状态颜色
    const trafficColor = useMemo(() => {
        const colors: Record<string, string> = {
            'Light': '#00ff00',
            'Moderate': '#ffaa00',
            'Heavy': '#ff0000'
        }
        return colors[traffic] || '#00ff00'
    }, [traffic])

    // 模拟动态数据更新
    useEffect(() => {
        const interval = setInterval(() => {
            // 随机天气变化
            const weathers = ['Sunny', 'Cloudy', 'Rainy', 'Night']
            setWeather(weathers[Math.floor(Math.random() * weathers.length)])

            // 随机温度 (18-28度)
            setTemperature(18 + Math.floor(Math.random() * 11))

            // 随机交通状况
            const traffics = ['Light', 'Moderate', 'Heavy']
            setTraffic(traffics[Math.floor(Math.random() * traffics.length)])

            // 随机活跃车辆数 (2-8)
            setActiveVehicles(2 + Math.floor(Math.random() * 7))

            // 更新时间
            const now = new Date()
            setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`)
        }, 5000) // 每5秒更新一次

        return () => clearInterval(interval)
    }, [])

    // Billboard效果：始终朝向相机，并保持恒定视觉大小
    useFrame(() => {
        if (boardRef.current) {
            // 面向相机
            boardRef.current.quaternion.copy(camera.quaternion)

            // 根据距离动态调整缩放，保持恒定视觉大小
            const distance = camera.position.distanceTo(boardRef.current.position)
            const scale = distance * 0.03 // 调整这个系数来改变视觉大小 (越大越大)
            boardRef.current.scale.setScalar(scale)
        }
    })

    // 创建圆角矩形形状 (参考UIオーバーレイ的borderRadius)
    const roundedRectShape = useMemo(() => {
        const shape = new THREE.Shape()
        const width = 12
        const height = 8
        const radius = 0.5 // 圆角半径

        const x = -width / 2
        const y = -height / 2

        shape.moveTo(x + radius, y)
        shape.lineTo(x + width - radius, y)
        shape.quadraticCurveTo(x + width, y, x + width, y + radius)
        shape.lineTo(x + width, y + height - radius)
        shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        shape.lineTo(x + radius, y + height)
        shape.quadraticCurveTo(x, y + height, x, y + height - radius)
        shape.lineTo(x, y + radius)
        shape.quadraticCurveTo(x, y, x + radius, y)

        return shape
    }, [])

    return (
        <group ref={boardRef} position={position}>
            {/* 主背景板 - 圆角矩形 (参考UIオーバーレイ) */}
            <mesh position={[0, 0, -0.05]}>
                <shapeGeometry args={[roundedRectShape]} />
                <meshStandardMaterial
                    color="#000000"
                    transparent
                    opacity={0.2}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 模糊玻璃层效果 */}
            <mesh position={[0, 0, -0.04]}>
                <shapeGeometry args={[roundedRectShape]} />
                <meshBasicMaterial
                    color="#00ffff"
                    transparent
                    opacity={0.03}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 圆角边框 - 2px宽度 (参考UIオーバーレイ的border) */}
            <lineSegments position={[0, 0, 0.01]}>
                <edgesGeometry args={[new THREE.ShapeGeometry(roundedRectShape)]} />
                <lineBasicMaterial color="#00ffff" transparent opacity={0.9} />
            </lineSegments>

            {/* 标题 - 日文科技感 */}
            <Text
                position={[0, 3.2, 0]}
                fontSize={0.7}
                color="#00ffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.05}
                outlineColor="#000000"
                letterSpacing={0.05}
            >
                {title}
            </Text>

            {/* 分隔线 - 科技感双线 */}
            <mesh position={[0, 2.5, 0]}>
                <planeGeometry args={[11, 0.06]} />
                <meshBasicMaterial color="#00ffff" transparent opacity={0.9} />
            </mesh>

            {/* 天气信息 - 日文 */}
            <group position={[-5, 1.2, 0]}>
                <Text
                    position={[0, 0.6, 0]}
                    fontSize={0.44}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    天気
                </Text>
                <Text
                    position={[0, -0.2, 0]}
                    fontSize={1.0}
                    color="#ffffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    {weatherIcon}
                </Text>
                <Text
                    position={[1.6, -0.2, 0]}
                    fontSize={0.56}
                    color="#ffffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    {weather === 'Sunny' ? '晴れ' : weather === 'Cloudy' ? '曇り' : weather === 'Rainy' ? '雨' : '夜'}
                </Text>
                <Text
                    position={[0, -1.0, 0]}
                    fontSize={0.6}
                    color="#ffaa00"
                    anchorX="left"
                    anchorY="middle"
                >
                    {temperature}°C
                </Text>
            </group>

            {/* 交通状况 - 日文 */}
            <group position={[1, 1.2, 0]}>
                <Text
                    position={[0, 0.6, 0]}
                    fontSize={0.44}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    交通状況
                </Text>
                <Text
                    position={[0, -0.2, 0]}
                    fontSize={0.64}
                    color={trafficColor}
                    anchorX="left"
                    anchorY="middle"
                >
                    {traffic === 'Light' ? '円滑' : traffic === 'Moderate' ? '混雑' : '渋滞'}
                </Text>
                <mesh position={[0, -0.9, 0.01]}>
                    <planeGeometry args={[3.6, 0.3]} />
                    <meshBasicMaterial color={trafficColor} transparent opacity={0.2} />
                </mesh>
                <mesh position={[-1.8 + (traffic === 'Light' ? 0.6 : traffic === 'Moderate' ? 1.8 : 3.0), -0.9, 0.02]}>
                    <planeGeometry args={[traffic === 'Light' ? 1.2 : traffic === 'Moderate' ? 3.6 : 6, 0.3]} />
                    <meshBasicMaterial color={trafficColor} transparent opacity={0.9} />
                </mesh>
            </group>

            {/* 活跃车辆数 - 日文 */}
            <group position={[-5, -1.0, 0]}>
                <Text
                    position={[0, 0.4, 0]}
                    fontSize={0.44}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    稼働車両
                </Text>
                <Text
                    position={[0, -0.4, 0]}
                    fontSize={0.9}
                    color="#00ff00"
                    anchorX="left"
                    anchorY="middle"
                >
                    {activeVehicles} 台
                </Text>
            </group>

            {/* 系统时间 - 日文 */}
            <group position={[1, -1.0, 0]}>
                <Text
                    position={[0, 0.4, 0]}
                    fontSize={0.44}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    システム時刻
                </Text>
                <Text
                    position={[0, -0.4, 0]}
                    fontSize={0.9}
                    color="#ff00ff"
                    anchorX="left"
                    anchorY="middle"
                >
                    {time}
                </Text>
            </group>

            {/* 底部状态指示灯 - 日文科技感 */}
            <group position={[0, -3.0, 0]}>
                <mesh position={[-3, 0, 0.01]}>
                    <circleGeometry args={[0.16, 16]} />
                    <meshBasicMaterial color="#00ff00" transparent opacity={0.9} />
                </mesh>
                <Text
                    position={[-2.4, 0, 0]}
                    fontSize={0.3}
                    color="#00ff00"
                    anchorX="left"
                    anchorY="middle"
                >
                    接続中
                </Text>

                <mesh position={[1, 0, 0.01]}>
                    <circleGeometry args={[0.16, 16]} />
                    <meshBasicMaterial color="#00ffff" transparent opacity={0.9} />
                </mesh>
                <Text
                    position={[1.6, 0, 0]}
                    fontSize={0.3}
                    color="#00ffff"
                    anchorX="left"
                    anchorY="middle"
                >
                    同期済
                </Text>
            </group>

            {/* 发光效果 - 增强科技感 */}
            <pointLight
                position={[0, 0, 1]}
                color="#00ffff"
                intensity={1.2}
                distance={25}
            />
            <pointLight
                position={[0, 3, 0.5]}
                color="#ff00ff"
                intensity={0.6}
                distance={15}
            />
        </group>
    )
}

/**
 * 多个公告板管理组件
 */
export function FloatingInfoBoards() {
    // 在城市中心上方悬浮一个大型公告板
    return (
        <FloatingInfoBoard
            position={[0, 50, 0]}
            title="ネオ東京 都市情報"
        />
    )
}
