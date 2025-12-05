import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleMode } from '../../types/vehicleMode';

// ===== 类型定义 =====
interface OncomingVehiclesProps {
    isMoving: boolean;
    speed?: number;
    currentMode?: VehicleMode;
}

interface VehicleData {
    id: number;
    x: number;
    z: number;
    lane: number;
    vehicleType: VehicleMode;
}

interface VehicleVisualProps {
    width: number;
    height: number;
    y: number;
    texture: THREE.Texture;
}

// ===== 常量定义 =====
const VEHICLE_COUNT = 5;
const SPAWN_DISTANCE = 150;
const DESPAWN_DISTANCE = 20;

const MIN_SPACING: Record<VehicleMode, number> = {
    [VehicleMode.NORMAL]: 40,
    [VehicleMode.HIGHWAY]: 40,
    [VehicleMode.DRONE]: 40,
    [VehicleMode.FLIGHT]: 80
};

const LANE_POSITIONS = {
    left: -2,
    right: 2
} as const;

const FLIGHT_LANE_MULTIPLIER = 4;

// 速度倍率
const SPEED_MULTIPLIERS: Record<VehicleMode, number> = {
    [VehicleMode.NORMAL]: 1.7,
    [VehicleMode.HIGHWAY]: 1.7,
    [VehicleMode.DRONE]: 1.7,
    [VehicleMode.FLIGHT]: 0.425
};

// 车辆视觉属性
const VEHICLE_VISUALS: Record<VehicleMode, Omit<VehicleVisualProps, 'texture'>> = {
    [VehicleMode.NORMAL]: { width: 2, height: 1.5, y: -2.5 },
    [VehicleMode.HIGHWAY]: { width: 2.2, height: 1.6, y: -1.5 },
    [VehicleMode.DRONE]: { width: 1.8, height: 1.2, y: 0.5 },
    [VehicleMode.FLIGHT]: { width: 4, height: 2.5, y: -2.5 }
};

// 车辆类型生成概率配置
const VEHICLE_TYPE_PROBABILITIES: Record<VehicleMode, Array<{ threshold: number; type: VehicleMode }>> = {
    [VehicleMode.NORMAL]: [
        { threshold: 1, type: VehicleMode.NORMAL }
    ],
    [VehicleMode.HIGHWAY]: [
        { threshold: 0.6, type: VehicleMode.HIGHWAY },
        { threshold: 1, type: VehicleMode.NORMAL }
    ],
    [VehicleMode.DRONE]: [
        { threshold: 0.5, type: VehicleMode.DRONE },
        { threshold: 0.8, type: VehicleMode.HIGHWAY },
        { threshold: 1, type: VehicleMode.NORMAL }
    ],
    [VehicleMode.FLIGHT]: [
        { threshold: 1, type: VehicleMode.FLIGHT }
    ]
};

const TEXTURE_PATHS = {
    [VehicleMode.NORMAL]: '/website-assets/car_front.png',
    [VehicleMode.HIGHWAY]: '/website-assets/high_car_front.png',
    [VehicleMode.DRONE]: '/website-assets/drone_front.png',
    [VehicleMode.FLIGHT]: '/website-assets/airplane_front.png'
} as const;

// ===== 工具函数 =====
/**
 * 根据概率配置生成车辆类型
 */
function generateVehicleType(currentMode: VehicleMode): VehicleMode {
    const probabilities = VEHICLE_TYPE_PROBABILITIES[currentMode];
    const rand = Math.random();

    for (const { threshold, type } of probabilities) {
        if (rand < threshold) return type;
    }

    return VehicleMode.NORMAL;
}

/**
 * 计算车道X位置
 */
function calculateLaneX(lane: number, currentMode: VehicleMode): number {
    const baseX = lane === 1 ? LANE_POSITIONS.left : LANE_POSITIONS.right;
    return currentMode === VehicleMode.FLIGHT ? baseX * FLIGHT_LANE_MULTIPLIER : baseX;
}

/**
 * 生成初始车辆数据
 */
function generateInitialVehicles(currentMode: VehicleMode): VehicleData[] {
    const spacing = MIN_SPACING[currentMode];

    return Array.from({ length: VEHICLE_COUNT }, (_, i) => {
        const lane = Math.random() > 0.5 ? 1 : 2;
        const vehicleType = generateVehicleType(currentMode);

        return {
            id: i,
            x: calculateLaneX(lane, currentMode),
            z: -SPAWN_DISTANCE - i * spacing - Math.random() * 20,
            lane,
            vehicleType
        };
    });
}

// ===== 主组件 =====
export default function OncomingVehicles({
    isMoving,
    speed = 50,
    currentMode = VehicleMode.NORMAL
}: OncomingVehiclesProps) {
    const vehiclesRef = useRef<THREE.Group>(null);

    // 加载纹理
    const carTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS[VehicleMode.NORMAL]);
    const highCarTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS[VehicleMode.HIGHWAY]);
    const droneTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS[VehicleMode.DRONE]);
    const airplaneTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS[VehicleMode.FLIGHT]);

    // 纹理映射
    const textureMap = useMemo(() => ({
        [VehicleMode.NORMAL]: carTexture,
        [VehicleMode.HIGHWAY]: highCarTexture,
        [VehicleMode.DRONE]: droneTexture,
        [VehicleMode.FLIGHT]: airplaneTexture
    }), [carTexture, highCarTexture, droneTexture, airplaneTexture]);

    // 获取车辆视觉属性
    const getVehicleProps = useCallback((vehicleType: VehicleMode): VehicleVisualProps => {
        const visual = VEHICLE_VISUALS[vehicleType] ?? VEHICLE_VISUALS[VehicleMode.NORMAL];
        const texture = textureMap[vehicleType] ?? textureMap[VehicleMode.NORMAL];
        return { ...visual, texture };
    }, [textureMap]);

    // 生成车辆数据
    const vehicles = useMemo(
        () => generateInitialVehicles(currentMode),
        [currentMode]
    );

    // 动画更新
    useFrame((_state, delta) => {
        if (!isMoving || !vehiclesRef.current) return;

        const relativeSpeed = speed * SPEED_MULTIPLIERS[currentMode];

        vehiclesRef.current.children.forEach((vehicle) => {
            vehicle.position.z += delta * relativeSpeed;

            // 重生逻辑
            if (vehicle.position.z > DESPAWN_DISTANCE) {
                vehicle.position.z = -SPAWN_DISTANCE - Math.random() * 50;

                // 随机切换车道
                const newLane = Math.random() > 0.5 ? 1 : 2;

                if (currentMode === VehicleMode.FLIGHT) {
                    vehicle.position.x = (newLane === 1 ? -4 : 4) * Math.random() * 6;
                } else {
                    vehicle.position.x = newLane === 1 ? LANE_POSITIONS.left : LANE_POSITIONS.right;
                }
            }
        });
    });

    return (
        <group ref={vehiclesRef}>
            {vehicles.map((vehicle) => {
                const props = getVehicleProps(vehicle.vehicleType);
                return (
                    <sprite
                        key={vehicle.id}
                        position={[vehicle.x, props.y, vehicle.z]}
                        scale={[props.width, props.height, 1]}
                    >
                        <spriteMaterial
                            map={props.texture}
                            transparent
                            opacity={0.95}
                            depthTest
                            depthWrite
                        />
                    </sprite>
                );
            })}
        </group>
    );
}