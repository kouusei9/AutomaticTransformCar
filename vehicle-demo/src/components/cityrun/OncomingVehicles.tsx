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
}

export default function OncomingVehicles({ isMoving, speed = 50, currentMode = 1 }: OncomingVehiclesProps) {
    const VEHICLE_COUNT = 5; // 对向车辆数量
    const SPAWN_DISTANCE = 150; // 生成距离
    const MIN_SPACING = 40; // 车辆最小间距
    
    // 加载所有车辆前视图纹理
    const carTexture = useLoader(THREE.TextureLoader, '/website-assets/car_front.png');
    const highCarTexture = useLoader(THREE.TextureLoader, '/website-assets/high_car_front.png');
    const droneTexture = useLoader(THREE.TextureLoader, '/website-assets/drone_front.png');
    const airplaneTexture = useLoader(THREE.TextureLoader, '/website-assets/airplane_front.png');

    const vehiclesRef = useRef<THREE.Group>(null);

    // 根据模式选择纹理
    const getCurrentTexture = () => {
        switch (currentMode) {
            case 1: return carTexture;      // 普通车
            case 2: return highCarTexture;  // 高速车
            case 3: return droneTexture;    // 无人机
            case 4: return airplaneTexture; // 飞机
            default: return carTexture;
        }
    };

    // 生成随机车辆位置
    const vehicles = useMemo(() => {
        const vehicleList: VehicleData[] = [];
        
        for (let i = 0; i < VEHICLE_COUNT; i++) {
            // 随机选择车道（左或右）
            const lane = Math.random() > 0.5 ? 1 : 2;
            // 左车道 x=-2，右车道 x=2
            const x = lane === 1 ? -2 : 2;
            
            vehicleList.push({
                id: i,
                x,
                z: -SPAWN_DISTANCE - i * MIN_SPACING - Math.random() * 20,
                lane
            });
        }
        
        return vehicleList;
    }, [VEHICLE_COUNT, SPAWN_DISTANCE, MIN_SPACING]);

    // 根据模式计算车辆尺寸和高度
    const getVehicleProperties = () => {
        switch (currentMode) {
            case 1: // 普通车
                return { width: 2, height: 1.5, y: -2.5 };
            case 2: // 高速车
                return { width: 2.2, height: 1.6, y: -2.5 };
            case 3: // 无人机
                return { width: 1.8, height: 1.2, y: -2.5 + Math.random()*1.0};
            case 4: // 飞机
                return { width: 4, height: 2.5, y: -2.5 };
            default:
                return { width: 2, height: 1.5, y: -2.5 };
        }
    };

    const vehicleProps = getVehicleProperties();
    const currentTexture = getCurrentTexture();

    useFrame((_state, delta) => {
        if (!isMoving || !vehiclesRef.current) return;

        // 对向车辆相对速度（玩家速度 + 对向车速度）
        const relativeSpeed = speed * 1.7; // 增加速度，让车辆更快驶来

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
            {vehicles.map((vehicle) => (
                <sprite
                    key={vehicle.id}
                    position={[vehicle.x, vehicleProps.y, vehicle.z]}
                    scale={[vehicleProps.width, vehicleProps.height, 1]}
                >
                    <spriteMaterial
                        map={currentTexture}
                        transparent
                        opacity={0.95}
                        depthTest={true}
                        depthWrite={true}
                    />
                </sprite>
            ))}
        </group>
    );
}
