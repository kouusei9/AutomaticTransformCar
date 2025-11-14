import { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

interface SideSceneryProps {
    isMoving: boolean;
    speed?: number;
}

// 樱花树的位置和大小数据
interface TreeData {
    id: number;
    side: 'left' | 'right';
    x: number;
    z: number;
    scale: number;
    type: 'sakura01' | 'sakura02' | 'sakura03' | 'building01' | 'building02';
}

export default function SideScenery({ isMoving, speed = 50 }: SideSceneryProps) {
    // 配置参数
    const ITEM_COUNT = 100; // 每侧物体数量
    const SPACING = 4; // 物体间距
    const RANDOM_OFFSET = 4; // 随机偏移范围

    // 加载所有纹理
    const sakura01Texture = useLoader(THREE.TextureLoader, '/assets/sakura01.png');
    const sakura02Texture = useLoader(THREE.TextureLoader, '/assets/sakura02.png');
    const sakura03Texture = useLoader(THREE.TextureLoader, '/assets/sakura03.png');
    const building01Texture = useLoader(THREE.TextureLoader, '/assets/building01.png');
    const building02Texture = useLoader(THREE.TextureLoader, '/assets/building02.png');

    const group1Ref = useRef<THREE.Group>(null);
    const group2Ref = useRef<THREE.Group>(null);

    // 纹理映射（为右侧创建翻转版本）
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
                building01: building01Texture,
                building02: building02Texture,
            },
            right: {
                sakura01: createFlippedTexture(sakura01Texture),
                sakura02: createFlippedTexture(sakura02Texture),
                sakura03: createFlippedTexture(sakura03Texture),
                building01: createFlippedTexture(building01Texture),
                building02: createFlippedTexture(building02Texture),
            }
        };
    }, [sakura01Texture, sakura02Texture, sakura03Texture, building01Texture, building02Texture]);

    // 生成随机樱花树和楼房位置（只在首次渲染时生成）
    const trees = useMemo(() => {
        const treeList: TreeData[] = [];
        const types: Array<'sakura01' | 'sakura02' | 'sakura03' | 'sakura01' | 'sakura02' | 'sakura03' | 'building01' | 'building02'> =
            ['sakura01', 'sakura02', 'sakura03', 'building01', 'building02'];

        for (let i = 0; i < ITEM_COUNT; i++) {
            // 随机选择类型
            const randomType = types[Math.floor(Math.random() * types.length)];
            const isBuilding = randomType.startsWith('building');

            // 左侧
            treeList.push({
                id: i,
                side: 'left',
                x: isBuilding ? -15 : -8 - Math.random() * 5, // -10 到 -18
                z: -200 + i * SPACING + Math.random() * RANDOM_OFFSET,
                scale: isBuilding ? 1.2 + Math.random() * 0.8 : 0.8 + Math.random() * 0.6,
                type: randomType,
            });

            // 右侧（独立随机）
            const randomTypeRight = types[Math.floor(Math.random() * types.length)];
            const isBuildingRight = randomTypeRight.startsWith('building');

            treeList.push({
                id: i + ITEM_COUNT,
                side: 'right',
                x: isBuilding ? 15 : 8 + Math.random() * 5, // 10 到 18
                z: -200 + i * SPACING + Math.random() * RANDOM_OFFSET,
                scale: isBuildingRight ? 1.2 + Math.random() * 0.8 : 0.8 + Math.random() * 0.6,
                type: randomTypeRight,
            });
        }

        return treeList;
    }, [ITEM_COUNT, SPACING, RANDOM_OFFSET]);

    // 计算循环距离（覆盖所有物体的总长度）
    const loopDistance = ITEM_COUNT * SPACING;

    useFrame((_state, delta) => {
        if (!isMoving) return;

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
            {/* 第一组树和楼房 */}
            <group ref={group1Ref}>
                {trees.map((tree) => {
                    const isBuilding = tree.type.startsWith('building');
                    const width = 4 * tree.scale;
                    const height = isBuilding ? 8 * tree.scale : 5 * tree.scale;
                    // 根据左右侧选择对应的纹理
                    const texture = textureMap[tree.side][tree.type];
                    // 底边对齐：Y坐标 = 高度的一半（因为sprite的中心点在中间）
                    const yPosition = height / 2 - 5;

                    return (
                        <sprite
                            key={tree.id}
                            position={[tree.x, yPosition, tree.z]}
                            scale={[width, height, 1]}
                        >
                            <spriteMaterial
                                map={texture}
                                transparent
                                opacity={0.95}
                                depthTest={true}
                                depthWrite={true}
                            />
                        </sprite>
                    );
                })}
            </group>

            {/* 第二组树和楼房（用于无缝循环） */}
            <group ref={group2Ref} position={[0, 0, -loopDistance]}>
                {trees.map((tree) => {
                    const isBuilding = tree.type.startsWith('building');
                    const width = 4 * tree.scale;
                    const height = isBuilding ? 8 * tree.scale : 5 * tree.scale;
                    const texture = textureMap[tree.side][tree.type];
                    const yPosition = height / 2 - 5;

                    return (
                        <sprite
                            key={`clone-${tree.id}`}
                            position={[tree.x, yPosition, tree.z]}
                            scale={[width, height, 1]}
                        >
                            <spriteMaterial
                                map={texture}
                                transparent
                                opacity={0.95}
                                depthTest={true}
                                depthWrite={true}
                            />
                        </sprite>
                    );
                })}
            </group>
        </>
    );
}
