import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface SideSceneryProps {
    isMoving: boolean;
    speed?: number;
    currentMode?: number;
}

// 创建柔和的径向渐变影子纹理
function createShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');      // 中心较暗
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');   // 中间过渡
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');   // 边缘很淡
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');        // 完全透明

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// 樱花树的位置和大小数据
interface TreeData {
    id: number;
    side: 'left' | 'right';
    x: number;
    z: number;
    scale: number;
    type: 'sakura01' | 'sakura02' | 'sakura03' | 'building03' | 'building04' | 'building05' | 'building06' | 'building07' | 'building08' | 'building09' | 'building10';
}

export default function SideScenery({ isMoving, speed = 50, currentMode = 1 }: SideSceneryProps) {
    // 配置参数
    const ITEM_COUNT = 100; // 每侧物体数量
    const SPACING = 4; // 物体间距
    const RANDOM_OFFSET = 4; // 随机偏移范围
    const BUILDING_PROBABILITY = 0.6; // 建筑物出现的概率（0-1），0.6表示60%概率是建筑，40%概率是树

    // 淡入效果状态
    const [fadeOpacity, setFadeOpacity] = useState(0);
    const fadeTimeRef = useRef(0);

    // 加载所有纹理
    const sakura01Texture = useLoader(THREE.TextureLoader, '/assets/sakura01.png');
    const sakura02Texture = useLoader(THREE.TextureLoader, '/assets/sakura02.png');
    const sakura03Texture = useLoader(THREE.TextureLoader, '/assets/sakura03.png');
    // const building01Texture = useLoader(THREE.TextureLoader, '/assets/building01.png');
    // const building02Texture = useLoader(THREE.TextureLoader, '/assets/building02.png');
    const building03Texture = useLoader(THREE.TextureLoader, '/assets/building03.png');
    const building04Texture = useLoader(THREE.TextureLoader, '/assets/building04.png');
    const building05Texture = useLoader(THREE.TextureLoader, '/assets/building05.png');
    const building06Texture = useLoader(THREE.TextureLoader, '/assets/building06.png');
    const building07Texture = useLoader(THREE.TextureLoader, '/assets/building07.png');
    const building08Texture = useLoader(THREE.TextureLoader, '/assets/building08.png');
    const building09Texture = useLoader(THREE.TextureLoader, '/assets/building09.png');
    const building10Texture = useLoader(THREE.TextureLoader, '/assets/building10.png');
    const asphaltTexture = useLoader(THREE.TextureLoader, '/assets/asphalt_texture.jpg');

    // 等待所有纹理加载完成后开始淡入
    useEffect(() => {
        // 检查所有纹理是否加载完成
        const allTexturesLoaded = [
            sakura01Texture,
            sakura02Texture,
            sakura03Texture,
            building03Texture,
            building04Texture,
            building05Texture,
            building06Texture,
            building07Texture,
            building08Texture,
            building09Texture,
            building10Texture,
            asphaltTexture
        ].every(texture => texture.image);

        if (allTexturesLoaded) {
            // 启动淡入动画
            fadeTimeRef.current = 0;
        }
    }, [sakura01Texture, sakura02Texture, sakura03Texture, building03Texture, building04Texture, building05Texture, building06Texture, building07Texture, building08Texture, building09Texture, building10Texture, asphaltTexture]);

    const group1Ref = useRef<THREE.Group>(null);
    const group2Ref = useRef<THREE.Group>(null);
    const groundOffsetRef = useRef(0);

    // 创建影子纹理（只创建一次）
    const shadowTexture = useMemo(() => createShadowTexture(), []);

    // 配置地面纹理
    useMemo(() => {
        asphaltTexture.wrapS = THREE.RepeatWrapping;
        asphaltTexture.wrapT = THREE.RepeatWrapping;
        asphaltTexture.repeat.set(20, 100); // 横向和纵向重复
    }, [asphaltTexture]);

    // 纹理映射（为右侧创建翻转版本）和宽高比
    const textureMap = useMemo(() => {
        // 创建翻转纹理的函数
        const createFlippedTexture = (originalTexture: THREE.Texture) => {
            const flippedTexture = originalTexture.clone();
            flippedTexture.repeat.x = -1;
            flippedTexture.offset.x = 1;
            flippedTexture.needsUpdate = true;
            return flippedTexture;
        };

        return {
            left: {
                sakura01: sakura01Texture,
                sakura02: sakura02Texture,
                sakura03: sakura03Texture,
                // building01: building01Texture,
                // building02: building02Texture,
                building03: building03Texture,
                building04: building04Texture,
                building05: building05Texture,
                building06: building06Texture,
                building07: building07Texture,
                building08: building08Texture,
                building09: building09Texture,
                building10: building10Texture,
            },
            right: {
                sakura01: createFlippedTexture(sakura01Texture),
                sakura02: createFlippedTexture(sakura02Texture),
                sakura03: createFlippedTexture(sakura03Texture),
                // building01: createFlippedTexture(building01Texture),
                // building02: createFlippedTexture(building02Texture),
                building03: createFlippedTexture(building03Texture),
                building04: createFlippedTexture(building04Texture),
                building05: createFlippedTexture(building05Texture),
                building06: createFlippedTexture(building06Texture),
                building07: createFlippedTexture(building07Texture),
                building08: createFlippedTexture(building08Texture),
                building09: createFlippedTexture(building09Texture),
                building10: createFlippedTexture(building10Texture),
            }
        };
    }, [sakura01Texture, sakura02Texture, sakura03Texture, building03Texture, building04Texture, building05Texture, building06Texture, building07Texture, building08Texture, building09Texture, building10Texture]);

    // 计算每个纹理的宽高比
    const aspectRatios = useMemo(() => {
        const getAspectRatio = (texture: THREE.Texture) => {
            if (texture.image && texture.image instanceof HTMLImageElement) {
                return texture.image.width / texture.image.height;
            }
            return 1; // 默认比例
        };

        return {
            sakura01: getAspectRatio(sakura01Texture),
            sakura02: getAspectRatio(sakura02Texture),
            sakura03: getAspectRatio(sakura03Texture),
            // building01: getAspectRatio(building01Texture),
            // building02: getAspectRatio(building02Texture),
            building03: getAspectRatio(building03Texture),
            building04: getAspectRatio(building04Texture),
            building05: getAspectRatio(building05Texture),
            building06: getAspectRatio(building06Texture),
            building07: getAspectRatio(building07Texture),
            building08: getAspectRatio(building08Texture),
            building09: getAspectRatio(building09Texture),
            building10: getAspectRatio(building10Texture),
        };
    }, [sakura01Texture, sakura02Texture, sakura03Texture, building03Texture, building04Texture, building05Texture, building06Texture, building07Texture, building08Texture, building09Texture, building10Texture]);

    // 生成随机樱花树和楼房位置（只在首次渲染时生成）
    const trees = useMemo(() => {
        const treeList: TreeData[] = [];
        const buildingTypes: Array<'building03' | 'building04' | 'building05' | 'building06' | 'building07' | 'building08' | 'building09' | 'building10'> =
            ['building03', 'building04', 'building05', 'building06', 'building07', 'building08', 'building09', 'building10'];
        const treeTypes: Array<'sakura01' | 'sakura02' | 'sakura03'> =
            ['sakura01', 'sakura02', 'sakura03'];

        for (let i = 0; i < ITEM_COUNT; i++) {
            // 左侧：根据概率选择建筑或树
            const isLeftBuilding = Math.random() < BUILDING_PROBABILITY;
            const leftType = isLeftBuilding
                ? buildingTypes[Math.floor(Math.random() * buildingTypes.length)]
                : treeTypes[Math.floor(Math.random() * treeTypes.length)];

            treeList.push({
                id: i,
                side: 'left',
                x: isLeftBuilding ? -25 : -8 - Math.random() * 5, // -10 到 -18
                z: -200 + i * SPACING + Math.random() * RANDOM_OFFSET,
                scale: isLeftBuilding ? 1.2 + Math.random() * 0.8 : 0.8 + Math.random() * 0.6,
                type: leftType,
            });

            // 右侧：根据概率选择建筑或树（独立随机）
            const isRightBuilding = Math.random() < BUILDING_PROBABILITY;
            const rightType = isRightBuilding
                ? buildingTypes[Math.floor(Math.random() * buildingTypes.length)]
                : treeTypes[Math.floor(Math.random() * treeTypes.length)];

            treeList.push({
                id: i + ITEM_COUNT,
                side: 'right',
                x: isRightBuilding ? 25 : 8 + Math.random() * 5, // 10 到 18
                z: -200 + i * SPACING + Math.random() * RANDOM_OFFSET,
                scale: isRightBuilding ? 1.2 + Math.random() * 0.8 : 0.8 + Math.random() * 0.6,
                type: rightType,
            });
        }

        return treeList;
    }, [ITEM_COUNT, SPACING, RANDOM_OFFSET, BUILDING_PROBABILITY]);

    // 计算循环距离（覆盖所有物体的总长度）
    const loopDistance = ITEM_COUNT * SPACING;

    useFrame((_state, delta) => {
        // 淡入动画（1秒内从0到1）
        if (fadeOpacity < 1) {
            fadeTimeRef.current += delta;
            const newOpacity = Math.min(1, fadeTimeRef.current / 1.0); // 1秒淡入
            setFadeOpacity(newOpacity);
        }

        if (!isMoving) return;

        // 更新地面纹理偏移
        groundOffsetRef.current += delta * speed / 100;
        asphaltTexture.offset.y = groundOffsetRef.current;

        // 两个group都向前移动
        if (group1Ref.current) {
            group1Ref.current.position.z += delta * speed / 10;

            // 当第一组完全移动到视野前方后，重置到第二组后面
            if (group1Ref.current.position.z > loopDistance) {
                group1Ref.current.position.z -= loopDistance * 2;
            }
        }

        if (group2Ref.current) {
            group2Ref.current.position.z += delta * speed / 10;

            // 当第二组完全移动到视野前方后，重置到第一组后面
            if (group2Ref.current.position.z > loopDistance) {
                group2Ref.current.position.z -= loopDistance * 2;
            }
        }
    });

    return (
        <>
            {/* 左侧地面 */}
            <mesh position={[-15, currentMode === 3 ? -13 : -6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[20, 400]} />
                <meshBasicMaterial
                    map={asphaltTexture}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 右侧地面 */}
            <mesh position={[15, currentMode === 3 ? -13 : -6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[20, 400]} />
                <meshBasicMaterial
                    map={asphaltTexture}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 第一组树和楼房 */}
            <group ref={group1Ref}>
                {trees.map((tree) => {
                    const isBuilding = tree.type.startsWith('building');
                    // 根据左右侧选择对应的纹理
                    const texture = textureMap[tree.side][tree.type];
                    // 获取图片的实际宽高比
                    const aspectRatio = aspectRatios[tree.type];
                    // 基于高度和实际宽高比计算宽度
                    const baseHeight = isBuilding ? 10 : 5;
                    const height = baseHeight * tree.scale;
                    const width = height * aspectRatio;
                    // 底边对齐：Y坐标 = 高度的一半（因为sprite的中心点在中间）
                    // drone 模式下降低位置，只露出顶部
                    const baseYPosition = isBuilding ? -1 : height / 2 - 5;
                    const yPosition = currentMode === 3 ? baseYPosition - (isBuilding ? 7 : 4) : baseYPosition;
                    const groundY = currentMode === 3 ? -13 : -6;

                    return (
                        <group key={tree.id}>
                            {/* 建筑或树的精灵 */}
                            <sprite
                                position={[tree.x, yPosition, tree.z]}
                                scale={[width, height, 1]}
                            >
                                <spriteMaterial
                                    map={texture}
                                    transparent
                                    opacity={0.95 * fadeOpacity}
                                    depthTest={true}
                                    depthWrite={true}
                                />
                            </sprite>

                            {/* 建筑的影子（只有建筑有影子） */}
                            {isBuilding && (
                                <mesh
                                    position={[tree.x, groundY + 0.01, tree.z]}
                                    rotation={[-Math.PI / 2, 0, 0]}
                                    scale={[width * 0.5, width * 0.3, 1]}
                                >
                                    <planeGeometry args={[2, 2]} />
                                    <meshBasicMaterial
                                        map={shadowTexture}
                                        transparent
                                        opacity={Math.min(0.8, 0.4 + height * 0.03) * fadeOpacity}
                                        depthWrite={false}
                                    />
                                </mesh>
                            )}
                        </group>
                    );
                })}
            </group>

            {/* 第二组树和楼房（用于无缝循环） */}
            <group ref={group2Ref} position={[0, 0, -loopDistance]}>
                {trees.map((tree) => {
                    const isBuilding = tree.type.startsWith('building');
                    const texture = textureMap[tree.side][tree.type];
                    // 获取图片的实际宽高比
                    const aspectRatio = aspectRatios[tree.type];
                    // 基于高度和实际宽高比计算宽度
                    const baseHeight = isBuilding ? 10 : 5;
                    const height = baseHeight * tree.scale;
                    const width = height * aspectRatio;
                    const baseYPosition = isBuilding ? -1 : height / 2 - 5;
                    const yPosition = currentMode === 3 ? baseYPosition - (isBuilding ? 7 : 4) : baseYPosition;
                    const groundY = currentMode === 3 ? -13 : -6;

                    return (
                        <group key={`clone-${tree.id}`}>
                            {/* 建筑或树的精灵 */}
                            <sprite
                                position={[tree.x, yPosition, tree.z]}
                                scale={[width, height, 1]}
                            >
                                <spriteMaterial
                                    map={texture}
                                    transparent
                                    opacity={0.95 * fadeOpacity}
                                    depthTest={true}
                                    depthWrite={true}
                                />
                            </sprite>

                            {/* 建筑的影子（只有建筑有影子） */}
                            {isBuilding && (
                                <mesh
                                    position={[tree.x, groundY + 0.01, tree.z]}
                                    rotation={[-Math.PI / 2, 0, 0]}
                                    scale={[width * 0.5, width * 0.3, 1]}
                                >
                                    <planeGeometry args={[2, 2]} />
                                    <meshBasicMaterial
                                        map={shadowTexture}
                                        transparent
                                        opacity={Math.min(0.8, 0.4 + height * 0.03) * fadeOpacity}
                                        depthWrite={false}
                                    />
                                </mesh>
                            )}
                        </group>
                    );
                })}
            </group>
        </>
    );
}
