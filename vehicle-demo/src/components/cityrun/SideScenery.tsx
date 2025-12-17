import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleMode } from '../../types/vehicleMode';

// ===== 类型定义 =====
interface SideSceneryProps {
    isMoving: boolean;
    speed?: number;
    currentMode?: VehicleMode;
}

interface TreeData {
    id: number;
    side: 'left' | 'right';
    x: number;
    z: number;
    scale: number;
    type: TreeType;
}

interface CloudData {
    id: number;
    side: 'left' | 'right';
    x: number;
    y: number;
    z: number;
    scale: number;
    cloudType: CloudType;
}

type TreeType = 'sakura01' | 'sakura02' | 'sakura03' |
    'building01' | 'building02' | 'building03' | 'building04' | 'building05' | 'building06' |
    'building07' | 'building08' | 'building09' | 'building10';

type CloudType = 'cloud01' | 'cloud02' | 'cloud03' | 'cloud04' | 'cloud05' |
    'cloud06' | 'cloud07' | 'cloud08' | 'cloud09';

type TextureKey = TreeType | CloudType;

// ===== 常量定义 =====
const TREE_CONFIG = {
    count: 100,
    spacing: 4,
    randomOffset: 4,
    buildingProbability: 0.6,
    startZ: -200
} as const;

const DRONE_BUILDING_CONFIG = {
    count: 50,
    spacing: 5,
    randomOffset: 4,
    buildingProbability: 0.6,
    startZ: -200
} as const;

const CLOUD_CONFIG = {
    count: 80,
    spacing: 5,
    startZ: -200
} as const;

const GROUND_Y = {
    normal: -6,
    drone: -12
} as const;

const FADE_DURATION = 1.0; // 秒
const BASE_OPACITY = 0.95;
const CLOUD_OPACITY = 0.7;

const TEXTURE_PATHS = {
    sakura01: '/assets/sakura01.png',
    sakura02: '/assets/sakura02.png',
    sakura03: '/assets/sakura03.png',
    building01: '/assets/building/01.png',
    building02: '/assets/building/02.png',
    building03: '/assets/building/03.png',
    building04: '/assets/building/04.png',
    building05: '/assets/building/05.png',
    building06: '/assets/building/06.png',
    building07: '/assets/building/07.png',
    building08: '/assets/building08.png',
    building09: '/assets/building09.png',
    building10: '/assets/building10.png',
    cloud01: '/assets/cloud/01.png',
    cloud02: '/assets/cloud/02.png',
    cloud03: '/assets/cloud/03.png',
    cloud04: '/assets/cloud/04.png',
    cloud05: '/assets/cloud/05.png',
    cloud06: '/assets/cloud/06.png',
    cloud07: '/assets/cloud/07.png',
    cloud08: '/assets/cloud/08.png',
    cloud09: '/assets/cloud/09.png',
    asphalt: '/assets/asphalt_texture.jpg',
} as const;

const BUILDING_TYPES: TreeType[] = [
    'building01', 'building02', 'building03', 'building04', 'building05', 'building06',
    'building07', 'building08', 'building09', 'building10'
];

const TREE_TYPES: TreeType[] = ['sakura01', 'sakura02', 'sakura03'];

const CLOUD_TYPES: CloudType[] = [
    'cloud01', 'cloud02', 'cloud03', 'cloud04', 'cloud05',
    'cloud06', 'cloud07', 'cloud08', 'cloud09'
];

// ===== 工具函数 =====
/**
 * 创建柔和的径向渐变影子纹理
 */
function createShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

/**
 * 创建翻转纹理
 */
function createFlippedTexture(originalTexture: THREE.Texture): THREE.Texture {
    const flippedTexture = originalTexture.clone();
    flippedTexture.repeat.x = -1;
    flippedTexture.offset.x = 1;
    flippedTexture.needsUpdate = true;
    return flippedTexture;
}

/**
 * 获取纹理的宽高比
 */
function getAspectRatio(texture: THREE.Texture): number {
    if (texture.image && texture.image instanceof HTMLImageElement) {
        return texture.image.width / texture.image.height;
    }
    return 1;
}

/**
 * 随机选择数组元素
 */
function randomChoice<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成树木/建筑数据
 */
function generateTrees(): TreeData[] {
    const trees: TreeData[] = [];
    const { count, spacing, randomOffset, buildingProbability, startZ } = TREE_CONFIG;

    for (let i = 0; i < count; i++) {
        // 左侧
        const isLeftBuilding = Math.random() < buildingProbability;
        trees.push({
            id: i,
            side: 'left',
            x: isLeftBuilding ? -25 : -8 - Math.random() * 5,
            z: startZ + i * spacing + Math.random() * randomOffset,
            scale: isLeftBuilding ? 1.2 + Math.random() * 0.8 : 0.8 + Math.random() * 0.6,
            type: isLeftBuilding ? randomChoice(BUILDING_TYPES) : randomChoice(TREE_TYPES)
        });

        // 右侧
        const isRightBuilding = Math.random() < buildingProbability;
        trees.push({
            id: i + count,
            side: 'right',
            x: isRightBuilding ? 25 : 8 + Math.random() * 5,
            z: startZ + i * spacing + Math.random() * randomOffset,
            scale: isRightBuilding ? 1.2 + Math.random() * 0.8 : 0.8 + Math.random() * 0.6,
            type: isRightBuilding ? randomChoice(BUILDING_TYPES) : randomChoice(TREE_TYPES)
        });
    }

    return trees;
}

/**
 * 生成云数据
 */
function generateClouds(): CloudData[] {
    const clouds: CloudData[] = [];
    const { count, spacing, startZ } = CLOUD_CONFIG;

    for (let i = 0; i < count; i++) {
        // 左侧
        clouds.push({
            id: i,
            side: 'left',
            x: -5 - Math.random() * 35,
            y: -Math.random() * 5,
            z: startZ + i * spacing + Math.random() * 3,
            scale: 2 + Math.random() * 2,
            cloudType: randomChoice(CLOUD_TYPES)
        });

        // 右侧
        clouds.push({
            id: i + count,
            side: 'right',
            x: 5 + Math.random() * 35,
            y: -Math.random() * 5,
            z: startZ + i * spacing + Math.random() * 3,
            scale: 2 + Math.random() * 2,
            cloudType: randomChoice(CLOUD_TYPES)
        });
    }

    return clouds;
}

/**
 * 生成无人机模式专用建筑数据（只有建筑，无树木）
 */
function generateDroneBuildings(): TreeData[] {
    const buildings: TreeData[] = [];
    const { count, spacing, randomOffset, startZ } = DRONE_BUILDING_CONFIG;

    for (let i = 0; i < count; i++) {
        // 左侧 - 只生成建筑
        buildings.push({
            id: i,
            side: 'left',
            x: -25 - Math.random() * 10,
            z: startZ + i * spacing + Math.random() * randomOffset,
            scale: 2.5 + Math.random() * 1.5, // 更大的缩放
            type: randomChoice(BUILDING_TYPES)
        });

        // 右侧 - 只生成建筑
        buildings.push({
            id: i + count,
            side: 'right',
            x: 25 + Math.random() * 10,
            z: startZ + i * spacing + Math.random() * randomOffset,
            scale: 2.5 + Math.random() * 1.5, // 更大的缩放
            type: randomChoice(BUILDING_TYPES)
        });
    }

    return buildings;
}

// ===== 子组件 =====
interface SceneryItemProps {
    data: TreeData;
    texture: THREE.Texture;
    aspectRatio: number;
    shadowTexture: THREE.CanvasTexture;
    groundY: number;
    opacity: number;
    isDroneMode: boolean;
}

function SceneryItem({
    data,
    texture,
    aspectRatio,
    shadowTexture,
    groundY,
    opacity,
    isDroneMode
}: SceneryItemProps) {
    const isBuilding = data.type.startsWith('building');
    const baseHeight = isBuilding ? 10 : 5;
    const height = baseHeight * data.scale;
    const width = height * aspectRatio;

    // Drone mode: 下移建筑以只显示顶部
    const baseYPosition = isBuilding ? -1 : height / 2 - 5;
    const yPosition = isDroneMode ? baseYPosition - height * 0.6 : baseYPosition;

    return (
        <group>
            <sprite position={[data.x, yPosition, data.z]} scale={[width, height, 1]}>
                <spriteMaterial
                    map={texture}
                    transparent
                    opacity={BASE_OPACITY * opacity}
                    depthTest
                    depthWrite
                />
            </sprite>

            {isBuilding && (
                <mesh
                    position={[data.x, groundY + 0.01, data.z]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    scale={[width * 0.5, width * 0.3, 1]}
                >
                    <planeGeometry args={[2, 2]} />
                    <meshBasicMaterial
                        map={shadowTexture}
                        transparent
                        opacity={Math.min(0.8, 0.4 + height * 0.03) * opacity}
                        depthWrite={false}
                    />
                </mesh>
            )}
        </group>
    );
}

interface CloudItemProps {
    data: CloudData;
    texture: THREE.Texture;
    aspectRatio: number;
    opacity: number;
}

function CloudItem({ data, texture, aspectRatio, opacity }: CloudItemProps) {
    const baseHeight = 3;
    const height = baseHeight * data.scale;
    const width = height * aspectRatio;

    return (
        <sprite position={[data.x, data.y, data.z]} scale={[width, height, 1]}>
            <spriteMaterial
                map={texture}
                transparent
                opacity={CLOUD_OPACITY * opacity}
                depthTest
                depthWrite={false}
            />
        </sprite>
    );
}

// ===== 主组件 =====
export default function SideScenery({
    isMoving,
    speed = 50,
    currentMode = VehicleMode.NORMAL
}: SideSceneryProps) {
    // Refs
    const group1Ref = useRef<THREE.Group>(null);
    const group2Ref = useRef<THREE.Group>(null);
    const cloudGroup1Ref = useRef<THREE.Group>(null);
    const cloudGroup2Ref = useRef<THREE.Group>(null);
    const groundOffsetRef = useRef(0);
    const fadeOpacityRef = useRef(0);
    const fadeTimeRef = useRef(0);

    const isFlyMode = currentMode === VehicleMode.FLIGHT;
    const isDroneMode = currentMode === VehicleMode.DRONE;
    const groundY = isDroneMode ? GROUND_Y.drone : GROUND_Y.normal;

    // 加载纹理
    const sakura01 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.sakura01);
    const sakura02 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.sakura02);
    const sakura03 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.sakura03);
    const building01 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building01);
    const building02 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building02);
    const building03 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building03);
    const building04 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building04);
    const building05 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building05);
    const building06 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building06);
    const building07 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building07);
    const building08 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building08);
    const building09 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building09);
    const building10 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.building10);
    const cloud01 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud01);
    const cloud02 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud02);
    const cloud03 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud03);
    const cloud04 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud04);
    const cloud05 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud05);
    const cloud06 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud06);
    const cloud07 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud07);
    const cloud08 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud08);
    const cloud09 = useLoader(THREE.TextureLoader, TEXTURE_PATHS.cloud09);
    const asphaltTexture = useLoader(THREE.TextureLoader, TEXTURE_PATHS.asphalt);

    // 创建影子纹理
    const shadowTexture = useMemo(() => createShadowTexture(), []);

    // 配置地面纹理
    useEffect(() => {
        asphaltTexture.wrapS = THREE.RepeatWrapping;
        asphaltTexture.wrapT = THREE.RepeatWrapping;
        asphaltTexture.repeat.set(20, 100);
    }, [asphaltTexture]);

    // 纹理映射
    const textureMap = useMemo(() => {
        const leftTextures: Record<TextureKey, THREE.Texture> = {
            sakura01, sakura02, sakura03,
            building01, building02, building03, building04, building05, building06,
            building07, building08, building09, building10,
            cloud01, cloud02, cloud03, cloud04, cloud05,
            cloud06, cloud07, cloud08, cloud09
        };

        const rightTextures: Record<TextureKey, THREE.Texture> = {} as Record<TextureKey, THREE.Texture>;
        for (const [key, texture] of Object.entries(leftTextures)) {
            rightTextures[key as TextureKey] = createFlippedTexture(texture);
        }

        return { left: leftTextures, right: rightTextures };
    }, [
        sakura01, sakura02, sakura03,
        building01, building02, building03, building04, building05, building06,
        building07, building08, building09, building10,
        cloud01, cloud02, cloud03, cloud04, cloud05,
        cloud06, cloud07, cloud08, cloud09
    ]);

    // 宽高比映射
    const aspectRatios = useMemo(() => {
        const textures = {
            sakura01, sakura02, sakura03,
            building01, building02, building03, building04, building05, building06,
            building07, building08, building09, building10,
            cloud01, cloud02, cloud03, cloud04, cloud05,
            cloud06, cloud07, cloud08, cloud09
        };

        const ratios: Record<TextureKey, number> = {} as Record<TextureKey, number>;
        for (const [key, texture] of Object.entries(textures)) {
            ratios[key as TextureKey] = getAspectRatio(texture);
        }
        return ratios;
    }, [
        sakura01, sakura02, sakura03,
        building01, building02, building03, building04, building05, building06,
        building07, building08, building09, building10,
        cloud01, cloud02, cloud03, cloud04, cloud05,
        cloud06, cloud07, cloud08, cloud09
    ]);

    // 生成数据（只生成一次）
    const trees = useMemo(() => generateTrees(), []);
    const clouds = useMemo(() => generateClouds(), []);
    const droneBuildings = useMemo(() => generateDroneBuildings(), []);

    // 循环距离
    const loopDistance = TREE_CONFIG.count * TREE_CONFIG.spacing;
    const droneBuildingLoopDistance = DRONE_BUILDING_CONFIG.count * DRONE_BUILDING_CONFIG.spacing;
    const cloudLoopDistance = CLOUD_CONFIG.count * CLOUD_CONFIG.spacing;

    // 动画更新
    useFrame((_state, delta) => {
        // 淡入动画（使用ref避免重渲染）
        if (fadeOpacityRef.current < 1) {
            fadeTimeRef.current += delta;
            fadeOpacityRef.current = Math.min(1, fadeTimeRef.current / FADE_DURATION);
        }

        if (!isMoving) return;

        // 统一处理 Z 轴移动逻辑
        const speedMultiplier = isDroneMode ? 1.5 : (isFlyMode ? 2.0 : 1.0);

        // 云移动
        const cloudSpeed = delta * speed / 20 * speedMultiplier;
        [cloudGroup1Ref, cloudGroup2Ref].forEach(ref => {
            if (ref.current) {
                ref.current.position.z += cloudSpeed;
                if (ref.current.position.z > cloudLoopDistance) {
                    ref.current.position.z -= cloudLoopDistance * 2;
                }
            }
        });

        // 地面和树木移动
        groundOffsetRef.current += delta * speed / 100 * speedMultiplier;
        asphaltTexture.offset.y = groundOffsetRef.current;
        
        const treeSpeed = delta * speed / 10 * speedMultiplier;
        const currentLoopDistance = isDroneMode ? droneBuildingLoopDistance : loopDistance;
        [group1Ref, group2Ref].forEach(ref => {
            if (ref.current) {
                ref.current.position.z += treeSpeed;
                if (ref.current.position.z > currentLoopDistance) {
                    ref.current.position.z -= currentLoopDistance * 2;
                }
            }
        });
    });

    // 当前淡入透明度（从ref读取用于渲染）
    const currentOpacity = fadeOpacityRef.current;

    // 渲染树木组
    const renderTreeGroup = (groupRef: React.RefObject<THREE.Group | null>, offset: number, keyPrefix: string) => (
        <group ref={groupRef} position={[0, 0, offset]}>
            {trees.map(tree => (
                <SceneryItem
                    key={`${keyPrefix}-${tree.id}`}
                    data={tree}
                    texture={textureMap[tree.side][tree.type]}
                    aspectRatio={aspectRatios[tree.type]}
                    shadowTexture={shadowTexture}
                    groundY={groundY}
                    opacity={currentOpacity}
                    isDroneMode={isDroneMode}
                />
            ))}
        </group>
    );

    // 渲染无人机模式建筑组（只有建筑顶部）
    const renderDroneBuildingGroup = (groupRef: React.RefObject<THREE.Group | null>, offset: number, keyPrefix: string) => (
        <group ref={groupRef} position={[0, 0, offset]}>
            {droneBuildings.map(building => (
                <SceneryItem
                    key={`${keyPrefix}-${building.id}`}
                    data={building}
                    texture={textureMap[building.side][building.type]}
                    aspectRatio={aspectRatios[building.type]}
                    shadowTexture={shadowTexture}
                    groundY={groundY}
                    opacity={currentOpacity}
                    isDroneMode={true}
                />
            ))}
        </group>
    );

    // 渲染云组
    const renderCloudGroup = (groupRef: React.RefObject<THREE.Group | null>, offset: number, keyPrefix: string) => (
        <group ref={groupRef} position={[0, 0, offset]}>
            {clouds.map(cloud => (
                <CloudItem
                    key={`${keyPrefix}-${cloud.id}`}
                    data={cloud}
                    texture={textureMap[cloud.side][cloud.cloudType]}
                    aspectRatio={aspectRatios[cloud.cloudType]}
                    opacity={currentOpacity}
                />
            ))}
        </group>
    );

    if (isFlyMode) {
        return (
            <>
                {renderCloudGroup(cloudGroup1Ref, 0, 'cloud1')}
                {renderCloudGroup(cloudGroup2Ref, cloudLoopDistance, 'cloud2')}
            </>
        );
    }

    if (isDroneMode) {
        return (
            <>
                {/* Drone mode: 只显示建筑顶部 */}
                {renderDroneBuildingGroup(group1Ref, 0, 'drone-building1')}
                {renderDroneBuildingGroup(group2Ref, droneBuildingLoopDistance, 'drone-building2')}
            </>
        );
    }

    return (
        <>
            {/* 地面 */}
            {['left', 'right'].map(side => (
                <mesh
                    key={`ground-${side}`}
                    position={[side === 'left' ? -15 : 15, groundY, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <planeGeometry args={[20, 400]} />
                    <meshBasicMaterial map={asphaltTexture} side={THREE.DoubleSide} />
                </mesh>
            ))}

            {/* 树木和建筑 */}
            {renderTreeGroup(group1Ref, 0, 'tree1')}
            {renderTreeGroup(group2Ref, -loopDistance, 'tree2')}
        </>
    );
}