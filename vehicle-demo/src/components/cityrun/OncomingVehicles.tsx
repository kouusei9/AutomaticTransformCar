import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface OncomingVehiclesProps {
    isMoving: boolean;
    speed?: number;
    currentMode?: number;
}

// 对向车辆数据
interface VehicleData {
    id: number;
    x: number; // 横向位置（道路内）
    z: number; // 纵向位置
    lane: number; // 车道（1=左车道，2=右车道）
    vehicleType: number; // 车辆类型 (1=金, 2=香, 3=桂, 4=飞)
}

export default function OncomingVehicles({ isMoving, speed = 50, currentMode = 1 }: OncomingVehiclesProps) {
    const VEHICLE_COUNT = 5; // 对向车辆数量
    const SPAWN_DISTANCE = 150; // 生成距离
    // 飞模式增加车辆间距
    const MIN_SPACING = currentMode === 4 ? 80 : 40; // 车辆最小间距

    // 加载所有车辆前视图纹理
    const carTexture = useLoader(THREE.TextureLoader, '/website-assets/car_front.png');
    const highCarTexture = useLoader(THREE.TextureLoader, '/website-assets/high_car_front.png');
    const droneTexture = useLoader(THREE.TextureLoader, '/website-assets/drone_front.png');
    const airplaneTexture = useLoader(THREE.TextureLoader, '/website-assets/airplane_front.png');

    const vehiclesRef = useRef<THREE.Group>(null);

    // 生成随机车辆位置
    const vehicles = useMemo(() => {
        const vehicleList: VehicleData[] = [];

        for (let i = 0; i < VEHICLE_COUNT; i++) {
            // 随机选择车道（左或右）
            const lane = Math.random() > 0.5 ? 1 : 2;
            // 左车道 x=-2，右车道 x=2
            const x = lane === 1 ? -2 : 2;

            let vehicleType = 1; // 默认金模式

            if (currentMode === 2) {
                // 香模式时: 60%香模式, 40%金模式
                const rand = Math.random();
                if (rand < 0.6) {
                    vehicleType = 2; // 香模式
                } else {
                    vehicleType = 1; // 金模式
                }
            } else if (currentMode === 3) {
                // 桂模式时: 50%桂模式, 30%香模式, 20%金模式
                const rand = Math.random();
                if (rand < 0.5) {
                    vehicleType = 3; // 桂模式
                } else if (rand < 0.8) {
                    vehicleType = 2; // 香模式
                } else {
                    vehicleType = 1; // 金模式
                }
            } else if (currentMode === 4) {
                // 飞模式时: 仅出现飞模式车辆
                vehicleType = 4; // 飞模式
            }

            vehicleList.push({
                id: i,
                x,
                z: -SPAWN_DISTANCE - i * MIN_SPACING - Math.random() * 20,
                lane,
                vehicleType
            });
        }

        return vehicleList;
    }, [VEHICLE_COUNT, SPAWN_DISTANCE, MIN_SPACING, currentMode]);

    // 根据车辆类型计算属性
    const getVehiclePropertiesByType = (vehicleType: number) => {
        switch (vehicleType) {
            case 1: // 金模式（普通车）
                return { width: 2, height: 1.5, y: -2.5, texture: carTexture };
            case 2: // 香模式（高速车）
                return { width: 2.2, height: 1.6, y: -1.5, texture: highCarTexture };
            case 3: // 桂模式（无人机）
                return { width: 1.8, height: 1.2, y: 0.5, texture: droneTexture };
            case 4: // 飞模式（飞机）
                return { width: 4, height: 2.5, y: -2.5, texture: airplaneTexture };
            default:
                return { width: 2, height: 1.5, y: -2.5, texture: carTexture };
        }
    };

    useFrame((_state, delta) => {
        if (!isMoving || !vehiclesRef.current) return;

        // 对向车辆相对速度（玩家速度 + 对向车速度）
        // 飞模式时速度为本体的25% (0.85的0.5倍)
        const speedMultiplier = currentMode === 4 ? 0.425 : 1.7;
        const relativeSpeed = speed * speedMultiplier;

        vehiclesRef.current.children.forEach((vehicle) => {
            // 向玩家方向移动（z轴增加）
            vehicle.position.z += delta * relativeSpeed;

            // 当车辆超过玩家位置时，重新生成到后方
            if (vehicle.position.z > 20) {
                vehicle.position.z = -SPAWN_DISTANCE - Math.random() * 50;
                // 随机切换车道
                const newLane = Math.random() > 0.5 ? 1 : 2;
                vehicle.position.x = newLane === 1 ? -2 : 2;
            }
        });
    });

    return (
        <group ref={vehiclesRef}>
            {vehicles.map((vehicle) => {
                const props = getVehiclePropertiesByType(vehicle.vehicleType);
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
                            depthTest={true}
                            depthWrite={true}
                        />
                    </sprite>
                );
            })}
        </group>
    );
}
