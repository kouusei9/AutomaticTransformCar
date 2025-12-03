import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

// 粒子系统常量 - iPad优化版本
const isIPad = typeof navigator !== 'undefined' && (
  /iPad/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
);

const SPEED_PARTICLE_COUNT = isIPad ? 30 : 60; // iPad减半粒子数量
const PARTICLE_SPEED = 2.0; // 粒子移动速度

// 创建圆形纹理用于粒子
function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;

  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 创建将棋形状的赛博朋克风格指示牌纹理
function createShogiSignTexture(modeText: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext('2d')!;

  // 透明背景
  ctx.clearRect(0, 0, 256, 256);

  // 绘制将棋形状（扁平五角形，左右更宽）
  const centerX = 128;
  const centerY = 128;
  const width = 80; // 水平方向更长
  const height = 100; // 垂直方向较短

  ctx.beginPath();
  // 顶点
  ctx.moveTo(centerX, centerY - height);
  // 右上
  ctx.lineTo(centerX + width * 0.7, centerY - height * 0.8);
  // 右下
  ctx.lineTo(centerX + width, centerY + height);
  // 左下
  ctx.lineTo(centerX - width, centerY + height);
  // 左上
  ctx.lineTo(centerX - width * 0.7, centerY - height * 0.8);
  ctx.closePath();

  // 赛博朋克发光边框
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.stroke();

  // 半透明填充
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  ctx.fillStyle = hexToRgba(color, 0.15);
  ctx.shadowBlur = 0;
  ctx.fill();

  // 内外双层边框
  const innerWidth = width - 15;
  const innerHeight = height - 12;

  ctx.beginPath();
  // 顶点
  ctx.moveTo(centerX, centerY - innerHeight);
  // 右上
  ctx.lineTo(centerX + innerWidth * 0.7, centerY - innerHeight * 0.8);
  // 右下
  ctx.lineTo(centerX + innerWidth, centerY + innerHeight);
  // 左下
  ctx.lineTo(centerX - innerWidth, centerY + innerHeight);
  // 左上
  ctx.lineTo(centerX - innerWidth * 0.7, centerY - innerHeight * 0.8);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // 绘制中心文字
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  ctx.fillText(modeText, centerX, centerY + 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface ThirdPersonViewProps {
  isMoving: boolean;
  currentMode: number; // 当前车辆模式：1=金将, 2=香車, 3=桂馬, 4=飛車
  isTransitioning?: boolean; // 是否正在播放过渡动画
  isEntering?: boolean; // 是否正在进入第三视角（true=进入，false=退出）
}

export default function ThirdPersonView({
  isMoving,
  currentMode,
  isTransitioning = false,
  isEntering = true
}: ThirdPersonViewProps) {
  const carRef = useRef<THREE.Sprite>(null);
  const speedParticlesRef = useRef<THREE.Points>(null); // 速度粒子参照
  const signRef = useRef<THREE.Mesh>(null); // 指示牌参照（改为Mesh）
  const signRotation = useRef(0); // 跟踪旋转角度
  const animationProgress = useRef(0);
  const initialOpacity = useRef(isEntering ? 0 : 1); // 初始透明度

  // 根据模式获取将棋文字
  const getModeText = (mode: number): string => {
    switch (mode) {
      case 1:
        return '金'; // 金将
      case 2:
        return '香'; // 香車
      case 3:
        return '桂'; // 桂馬
      case 4:
        return '飛'; // 飛車
      default:
        return '金';
    }
  };

  // 根据模式获取颜色
  const getModeColor = (mode: number): string => {
    switch (mode) {
      case 1:
        return '#F2D56A'; // 金将
      case 2:
        return '#E8BAA0'; // 香車
      case 3:
        return '#C1CB93'; // 桂馬
      case 4:
        return '#ADC6D7'; // 飛車
      default:
        return '#F2D56A';
    }
  };

  // 创建指示牌纹理（每次模式变化时重新创建）
  const signTexture = useMemo(() => {
    return createShogiSignTexture(getModeText(currentMode), getModeColor(currentMode));
  }, [currentMode]);

  // 创建速度粒子系统（在普通模式下显示向后飞散的粒子）
  const speedParticles = useMemo(() => {
    const positions = new Float32Array(SPEED_PARTICLE_COUNT * 3);
    const lifetimes = new Float32Array(SPEED_PARTICLE_COUNT);
    const velocities = new Float32Array(SPEED_PARTICLE_COUNT * 3);

    for (let i = 0; i < SPEED_PARTICLE_COUNT; i++) {
      // 初始位置在车辆周围
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = -3.5 + (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 2] = Math.random() * 5;

      // 随机生命周期
      lifetimes[i] = Math.random();

      // 初始速度
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00ffff, // 默认青色，会根据模式动态更新
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true, // 启用透视缩放
      map: createCircleTexture(), // 使用圆形纹理
    });

    return { geometry, material };
  }, []);

  // 加载所有车辆纹理
  const carTexture = useLoader(THREE.TextureLoader, '/assets/car_back.png');          // 通常モード (金将)
  const highCarTexture = useLoader(THREE.TextureLoader, '/assets/high_car_back.png'); // 高速モード (香車)
  const droneTexture = useLoader(THREE.TextureLoader, '/assets/drone_back.png');      // 短距離飛行モード (桂馬)
  const airplaneTexture = useLoader(THREE.TextureLoader, '/assets/airplane_back.png'); // 長距離飛行モード (飛車)

  // 根据当前模式选择纹理
  const getCurrentTexture = () => {
    switch (currentMode) {
      case 2: // 香車 (高速モード)
        return highCarTexture;
      case 3: // 桂馬 (短距離飛行モード)
        return droneTexture;
      case 4: // 飛車 (長距離飛行モード)
        return airplaneTexture;
      default: // 1 = 金将 (通常モード)
        return carTexture;
    }
  };

  const currentTexture = getCurrentTexture();

  // 根据纹理图片的实际尺寸计算宽高比
  const textureAspectRatio = currentTexture.image
    ? currentTexture.image.width / currentTexture.image.height
    : 1.5; // 默认比例

  // 设置车辆高度，宽度根据比例自动计算
  const carHeight = 2;
  const carWidth = carHeight * textureAspectRatio;

  // 动画参数
  const ANIMATION_DURATION = 1.0; // 1秒动画时长
  const ENTER_OFFSET_Z = 10; // 进入时从远处开始的距离（Z轴）
  const EXIT_OFFSET_Z = 10; // 退出时向远方移动的距离（Z轴）

  // 根据模式设置车辆高度
  const getBaseYByMode = () => {
    switch (currentMode) {
      case 1 && 4: return -2.5; // 金模式（地面） 飞模式（高空）
      case 2: return -1.5; // 香模式（低空）
      case 3: return 0.5; // 桂模式（中空）
      default: return -2.5;
    }
  };

  const BASE_Y = getBaseYByMode(); // 车辆的基础Y位置
  const BASE_Z = 0; // 车辆的基础Z位置
  const MIN_SCALE = 0.3; // 远处时的最小缩放比例

  // 重置动画进度
  useEffect(() => {
    if (isTransitioning) {
      animationProgress.current = 0;
      initialOpacity.current = isEntering ? 0 : 1;

      // 立即设置初始透明度
      if (carRef.current && carRef.current.material) {
        (carRef.current.material as THREE.SpriteMaterial).opacity = initialOpacity.current;
      }
    }
  }, [isTransitioning, isEntering]);

  // 车辆摇晃动画和过渡动画
  useFrame((state, delta) => {
    if (!carRef.current) return;

    let baseY = BASE_Y;
    let baseZ = BASE_Z;
    let scale = 1.0;
    let opacity = 1.0;

    // 处理过渡动画
    if (isTransitioning) {
      animationProgress.current = Math.min(1, animationProgress.current + delta / ANIMATION_DURATION);

      const progress = animationProgress.current;
      // 使用缓动函数（ease-in-out）
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      if (isEntering) {
        // 进入动画：从远处（正Z轴）驶来，逐渐变大
        baseZ = ENTER_OFFSET_Z * (1 - easeProgress);
        scale = MIN_SCALE + (1.0 - MIN_SCALE) * easeProgress;
        opacity = easeProgress;
      } else {
        // 退出动画：向远方（正Z轴）驶去，逐渐变小
        baseZ = EXIT_OFFSET_Z * easeProgress;
        scale = 1.0 - (1.0 - MIN_SCALE) * easeProgress;
        opacity = 1 - easeProgress;
      }
    }

    // 添加摇晃效果（只在行驶时）
    if (isMoving && !isTransitioning) {
      carRef.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      carRef.current.position.x = Math.sin(state.clock.elapsedTime * 2) * 0.03;
      carRef.current.position.z = baseZ;
    } else {
      carRef.current.position.y = baseY;
      carRef.current.position.x = 0;
      carRef.current.position.z = baseZ;
    }

    // 更新缩放比例
    carRef.current.scale.set(carWidth * scale, carHeight * scale, 1);

    // 更新透明度
    if (carRef.current.material) {
      (carRef.current.material as THREE.SpriteMaterial).opacity = opacity;
    }

    // 更新速度粒子（所有模式下显示不同效果）
    if (speedParticlesRef.current) {
      const shouldShowParticles = isMoving && !isTransitioning && currentMode >= 1 && currentMode <= 4;
      speedParticlesRef.current.visible = shouldShowParticles;

      if (shouldShowParticles) {
        // 根据模式更新粒子颜色和大小
        const material = speedParticlesRef.current.material as THREE.PointsMaterial;
        if (currentMode === 4) {
          // Airplane模式：红色喷火效果
          material.color.setHex(0xff3300);
          material.size = 0.12;
        } else if (currentMode === 3) {
          // Drone模式：青色
          material.color.setHex(0x00ffff);
          material.size = 0.08;
        } else if (currentMode === 2) {
          // Highway模式：白色
          material.color.setHex(0xffffff);
          material.size = 0.06;
        } else {
          // 普通模式：青色
          material.color.setHex(0x00ffff);
          material.size = 0.05;
        }

        const positions = speedParticles.geometry.attributes.position.array as Float32Array;
        const lifetimes = speedParticles.geometry.attributes.lifetime.array as Float32Array;

        for (let i = 0; i < SPEED_PARTICLE_COUNT; i++) {
          const i3 = i * 3;

          // 更新生命周期
          lifetimes[i] -= delta * 2.5;

          // 重置粒子
          if (lifetimes[i] <= 0) {
            if (currentMode === 1) {
              // 普通模式：从车辆前方中央生成
              positions[i3] = (Math.random() - 0.5) * 2.5; // X轴散布
              positions[i3 + 1] = BASE_Y - 1.0 + (Math.random() - 0.5) * 1.5; // Y轴（车辆高度附近）
              positions[i3 + 2] = -3 + Math.random() * 2; // 从车辆前方开始
            } else if (currentMode === 2) {
              // 高速模式：从车辆两侧生成（左侧或右侧）
              const side = Math.random() > 0.5 ? 1 : -1; // 随机选择左侧或右侧
              positions[i3] = side * (0.5 + Math.random() * 0.5); // X轴：在两侧
              positions[i3 + 1] = BASE_Y - 0.5 + (Math.random() - 0.5) * 1.0; // Y轴（车辆高度附近）
              positions[i3 + 2] = -2 + Math.random() * 1; // 从车辆侧面开始
            } else if (currentMode === 3) {
              // Drone模式：从车辆两侧生成（左侧或右侧）
              const side = Math.random() > 0.5 ? 1 : -1; // 随机选择左侧或右侧
              positions[i3] = side * (1.0 + Math.random() * 0.5); // X轴：在两侧
              positions[i3 + 1] = BASE_Y - 0.5 + (Math.random() - 0.5) * 1.0; // Y轴（车辆高度附近）
              positions[i3 + 2] = -2 + Math.random() * 1; // 从车辆侧面开始 
            }
            else if (currentMode === 4) {
              // Airplane模式：从车辆后方中央生成
              const side = Math.random() > 0.5 ? 1 : -1; // 随机选择左侧或右侧
              positions[i3] = side * (0.5 + Math.random() * 0.5); // X轴：在两侧
              positions[i3 + 1] = BASE_Y - 0.5 + (Math.random() - 0.5) * 1.0; // Y轴（车辆高度附近）
              positions[i3 + 2] = -2 + Math.random() * 1; // 从车辆侧面开始
            }

            lifetimes[i] = 0.4 + Math.random() * 0.3;
          } else {
            // 粒子向后飞散（正Z轴方向）
            const speedMultiplier = currentMode === 4 ? 15 : 10; // Airplane更快
            positions[i3 + 2] += PARTICLE_SPEED * delta * speedMultiplier;

            if (currentMode === 1) {
              // 普通模式：添加左右散开效果
              positions[i3] += (Math.random() - 0.5) * delta * 2;
            } else if (currentMode === 2 || currentMode === 3 || currentMode === 4) {
              // 高速/Drone/Airplane模式：向外侧散开（远离车辆中心）
              const currentX = positions[i3];
              const expandDirection = currentX > 0 ? 1 : -1;
              const expandSpeed = currentMode === 4 ? 2.5 : 1.5; // Airplane扩散更快
              positions[i3] += expandDirection * delta * expandSpeed;
            }

            // 轻微下降
            positions[i3 + 1] -= delta * 0.5;
          }
        }

        speedParticles.geometry.attributes.position.needsUpdate = true;
        speedParticles.geometry.attributes.lifetime.needsUpdate = true;
      }
    }

    // 更新指示牌旋转（绕Y轴旋转，3D空间旋转）
    if (signRef.current) {
      signRotation.current += delta * 2; // 每秒旋转2弧度
      signRef.current.rotation.y = signRotation.current;
    }
  });

  return (
    <group>
      {/* 车辆精灵 */}
      <sprite ref={carRef} position={[0, -2.5, 0]} scale={[carWidth, carHeight, 1]}>
        <spriteMaterial
          map={currentTexture}
          transparent
          opacity={isTransitioning && !isEntering ? 0 : (isTransitioning && isEntering ? 0 : 1.0)}
        />
      </sprite>

      {/* 将棋形状指示牌（车顶上方） */}
      <mesh ref={signRef} position={[0, BASE_Y + 1.3, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          map={signTexture}
          transparent
          opacity={isTransitioning ? 0 : 0.95}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 速度粒子系统（普通模式下的向后飞散效果） */}
      <points ref={speedParticlesRef} geometry={speedParticles.geometry} material={speedParticles.material} />

      {/* 车辆周围的霓虹光晕 */}
      <pointLight position={[0, -3, 0]} color={0x00d4ff} intensity={1} distance={5} />
      <pointLight position={[-1, -3.5, 0]} color={0xff00ff} intensity={0.5} distance={3} />
      <pointLight position={[1, -3.5, 0]} color={0xff00ff} intensity={0.5} distance={3} />
    </group>
  );
}
