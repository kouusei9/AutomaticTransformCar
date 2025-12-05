import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleMode, MODE_CONFIG } from '../../types/vehicleMode';

// ===== 类型定义 =====
interface ThirdPersonViewProps {
  isMoving: boolean;
  currentMode: VehicleMode;
  isTransitioning?: boolean;
  isEntering?: boolean;
}

interface ModeVisualConfig {
  text: string;
  color: string;
  outerColor: string;
  particleColor: number;
  particleSize: number;
  baseY: number;
}

// ===== 常量定义 =====
const TEXTURE_PATHS = {
  [VehicleMode.NORMAL]: '../assets/car_back.png',
  [VehicleMode.HIGHWAY]: '../assets/high_car_back.png',
  [VehicleMode.DRONE]: '../assets/drone_back.png',
  [VehicleMode.FLIGHT]: '../assets/airplane_back.png'
} as const;

// 模式视觉配置
const MODE_VISUAL_CONFIG: Record<VehicleMode, ModeVisualConfig> = {
  [VehicleMode.NORMAL]: {
    text: '金',
    color: '#A5821D',
    outerColor: '#F2D56A',
    particleColor: 0x00ffff,
    particleSize: 0.05,
    baseY: -2.5
  },
  [VehicleMode.HIGHWAY]: {
    text: '香',
    color: '#F24B90',
    outerColor: '#EFD6D5',
    particleColor: 0xffffff,
    particleSize: 0.06,
    baseY: -1.5
  },
  [VehicleMode.DRONE]: {
    text: '桂',
    color: '#64673E',
    outerColor: '#B1C075',
    particleColor: 0x00ffff,
    particleSize: 0.08,
    baseY: 0.5
  },
  [VehicleMode.FLIGHT]: {
    text: '飛',
    color: '#396177',
    outerColor: '#98B5C2',
    particleColor: 0xff3300,
    particleSize: 0.12,
    baseY: -2.5
  }
};

// 粒子配置
const isIPad = typeof navigator !== 'undefined' && (
  /iPad/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
);

const PARTICLE_COUNT = isIPad ? 30 : 60;
const PARTICLE_SPEED = 2.0;

// 动画配置
const ANIMATION = {
  duration: 1.0,
  enterOffsetZ: 10,
  exitOffsetZ: 10,
  minScale: 0.3
} as const;

const CAR_HEIGHT = 2;
const SIGN_SIZE = 1.5;

// ===== 工具函数 =====
/**
 * 创建圆形纹理用于粒子
 */
function createCircleTexture(): THREE.CanvasTexture {
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

/**
 * 创建将棋形状指示牌纹理
 */
function createShogiSignTexture(config: ModeVisualConfig): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  const centerX = 128;
  const centerY = 128;
  const width = 80;
  const height = 100;

  const drawPentagon = (w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - h);
    ctx.lineTo(centerX + w * 0.7, centerY - h * 0.8);
    ctx.lineTo(centerX + w, centerY + h);
    ctx.lineTo(centerX - w, centerY + h);
    ctx.lineTo(centerX - w * 0.7, centerY - h * 0.8);
    ctx.closePath();
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // 外层边框
  drawPentagon(width + 6, height + 5);
  ctx.strokeStyle = config.outerColor;
  ctx.lineWidth = 6;
  ctx.shadowColor = config.outerColor;
  ctx.shadowBlur = 25;
  ctx.stroke();

  // 主边框
  drawPentagon(width, height);
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 4;
  ctx.shadowColor = config.color;
  ctx.shadowBlur = 20;
  ctx.stroke();

  // 半透明填充
  ctx.fillStyle = hexToRgba(config.color, 0.35);
  ctx.shadowBlur = 0;
  ctx.fill();

  // 内层边框
  drawPentagon(width - 15, height - 12);
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;
  ctx.shadowColor = config.color;
  ctx.shadowBlur = 10;
  ctx.stroke();

  // 文字
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = config.outerColor;
  ctx.shadowColor = config.color;
  ctx.shadowBlur = 25;
  ctx.fillText(config.text, centerX, centerY + 10);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 缓动函数 (ease-in-out)
 */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 创建粒子系统
 */
function createParticleSystem() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const lifetimes = new Float32Array(PARTICLE_COUNT);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = -3.5 + (Math.random() - 0.5) * 1.5;
    positions[i * 3 + 2] = Math.random() * 5;
    lifetimes[i] = Math.random();
    velocities[i * 3] = 0;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

  const material = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.05,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    map: createCircleTexture()
  });

  return { geometry, material };
}

// ===== 主组件 =====
export default function ThirdPersonView({
  isMoving,
  currentMode,
  isTransitioning = false,
  isEntering = true
}: ThirdPersonViewProps) {
  // Refs
  const carRef = useRef<THREE.Sprite>(null);
  const speedParticlesRef = useRef<THREE.Points>(null);
  const signRef = useRef<THREE.Mesh>(null);
  const signRotation = useRef(0);
  const animationProgress = useRef(0);
  const initialOpacity = useRef(isEntering ? 0 : 1);

  // 获取当前模式配置
  const modeConfig = MODE_VISUAL_CONFIG[currentMode];
  const baseY = modeConfig.baseY;

  // 创建指示牌纹理
  const signTexture = useMemo(
    () => createShogiSignTexture(modeConfig),
    [currentMode] // modeConfig会随currentMode变化
  );

  // 创建粒子系统
  const speedParticles = useMemo(() => createParticleSystem(), []);

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

  const currentTexture = textureMap[currentMode];

  // 计算车辆尺寸
  const textureAspectRatio = currentTexture.image
    ? currentTexture.image.width / currentTexture.image.height
    : 1.5;
  const carWidth = CAR_HEIGHT * textureAspectRatio;

  // 重置动画
  useEffect(() => {
    if (isTransitioning) {
      animationProgress.current = 0;
      initialOpacity.current = isEntering ? 0 : 1;

      if (carRef.current?.material) {
        (carRef.current.material as THREE.SpriteMaterial).opacity = initialOpacity.current;
      }
    }
  }, [isTransitioning, isEntering]);

  // 动画帧更新
  useFrame((state, delta) => {
    if (!carRef.current) return;

    let posY = baseY;
    let posZ = 0;
    let scale = 1.0;
    let opacity = 1.0;

    // 过渡动画
    if (isTransitioning) {
      animationProgress.current = Math.min(1, animationProgress.current + delta / ANIMATION.duration);
      const progress = easeInOutQuad(animationProgress.current);

      if (isEntering) {
        posZ = ANIMATION.enterOffsetZ * (1 - progress);
        scale = ANIMATION.minScale + (1.0 - ANIMATION.minScale) * progress;
        opacity = progress;
      } else {
        posZ = ANIMATION.exitOffsetZ * progress;
        scale = 1.0 - (1.0 - ANIMATION.minScale) * progress;
        opacity = 1 - progress;
      }
    }

    // 摇晃效果
    if (isMoving && !isTransitioning) {
      carRef.current.position.y = posY + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      carRef.current.position.x = Math.sin(state.clock.elapsedTime * 2) * 0.03;
    } else {
      carRef.current.position.y = posY;
      carRef.current.position.x = 0;
    }
    carRef.current.position.z = posZ;
    carRef.current.scale.set(carWidth * scale, CAR_HEIGHT * scale, 1);

    if (carRef.current.material) {
      (carRef.current.material as THREE.SpriteMaterial).opacity = opacity;
    }

    // 粒子系统更新
    if (speedParticlesRef.current) {
      const shouldShowParticles = isMoving && !isTransitioning;
      speedParticlesRef.current.visible = shouldShowParticles;

      if (shouldShowParticles) {
        const material = speedParticlesRef.current.material as THREE.PointsMaterial;
        material.color.setHex(modeConfig.particleColor);
        material.size = modeConfig.particleSize;

        const positions = speedParticles.geometry.attributes.position.array as Float32Array;
        const lifetimes = speedParticles.geometry.attributes.lifetime.array as Float32Array;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          lifetimes[i] -= delta * 2.5;

          if (lifetimes[i] <= 0) {
            // 重生粒子
            const side = Math.random() > 0.5 ? 1 : -1;
            if (currentMode === VehicleMode.NORMAL) {
              positions[i3] = (Math.random() - 0.5) * 2.5;
              positions[i3 + 1] = baseY - 1.0 + (Math.random() - 0.5) * 1.5;
              positions[i3 + 2] = -3 + Math.random() * 2;
            } else {
              positions[i3] = side * (0.5 + Math.random() * 0.5);
              positions[i3 + 1] = baseY - 0.5 + (Math.random() - 0.5) * 1.0;
              positions[i3 + 2] = -2 + Math.random() * 1;
            }
            lifetimes[i] = 0.4 + Math.random() * 0.3;
          } else {
            // 移动粒子
            const speedMultiplier = currentMode === VehicleMode.FLIGHT ? 15 : 10;
            positions[i3 + 2] += PARTICLE_SPEED * delta * speedMultiplier;

            if (currentMode === VehicleMode.NORMAL) {
              positions[i3] += (Math.random() - 0.5) * delta * 2;
            } else {
              const expandDirection = positions[i3] > 0 ? 1 : -1;
              const expandSpeed = currentMode === VehicleMode.FLIGHT ? 2.5 : 1.5;
              positions[i3] += expandDirection * delta * expandSpeed;
            }
            positions[i3 + 1] -= delta * 0.5;
          }
        }

        speedParticles.geometry.attributes.position.needsUpdate = true;
        speedParticles.geometry.attributes.lifetime.needsUpdate = true;
      }
    }

    // 指示牌旋转
    if (signRef.current) {
      signRotation.current += delta * 2;
      signRef.current.rotation.y = signRotation.current;
    }
  });

  return (
    <group>
      {/* 车辆 */}
      <sprite ref={carRef} position={[0, baseY, 0]} scale={[carWidth, CAR_HEIGHT, 1]}>
        <spriteMaterial
          map={currentTexture}
          transparent
          opacity={isTransitioning ? (isEntering ? 0 : 1) : 1.0}
        />
      </sprite>

      {/* 指示牌 */}
      <mesh ref={signRef} position={[0, baseY + 1.3, 0]}>
        <planeGeometry args={[SIGN_SIZE, SIGN_SIZE]} />
        <meshBasicMaterial
          map={signTexture}
          transparent
          opacity={isTransitioning ? 0 : 0.95}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 粒子系统 */}
      <points
        ref={speedParticlesRef}
        geometry={speedParticles.geometry}
        material={speedParticles.material}
      />

      {/* 光效 */}
      <pointLight position={[0, -3, 0]} color={0x00d4ff} intensity={1} distance={5} />
      <pointLight position={[-1, -3.5, 0]} color={0xff00ff} intensity={0.5} distance={3} />
      <pointLight position={[1, -3.5, 0]} color={0xff00ff} intensity={0.5} distance={3} />
    </group>
  );
}