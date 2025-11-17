import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WeatherTimeSystemProps {
  isMoving: boolean;
}

// 天气类型
export type WeatherType = 'clear' | 'rain' | 'snow';
// 时间段类型
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

// 雨滴粒子系统
const RAIN_COUNT = 500;
const SNOW_COUNT = 300;

export default function WeatherTimeSystem({ isMoving }: WeatherTimeSystemProps) {
  const rainParticlesRef = useRef<THREE.Points>(null);
  const snowParticlesRef = useRef<THREE.Points>(null);
  const timeProgress = useRef(0);
  
  // 当前天气和时间状态
  const weatherType = useRef<WeatherType>('clear');
  const timeOfDay = useRef<TimeOfDay>('day');

  // 创建雨粒子系统
  const rainParticles = useMemo(() => {
    const positions = new Float32Array(RAIN_COUNT * 3);
    const velocities = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      velocities[i] = 20 + Math.random() * 10;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    const material = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
    });

    return { geometry, material };
  }, []);

  // 创建雪粒子系统
  const snowParticles = useMemo(() => {
    const positions = new Float32Array(SNOW_COUNT * 3);
    const velocities = new Float32Array(SNOW_COUNT);

    for (let i = 0; i < SNOW_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
      velocities[i] = 5 + Math.random() * 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.8,
    });

    return { geometry, material };
  }, []);

  // 获取时间段对应的颜色和雾效
  const getTimeColors = (time: TimeOfDay) => {
    switch (time) {
      case 'dawn':
        return {
          background: new THREE.Color('#ff6b35'), // 橙红色黎明
          fog: new THREE.Color('#ff8c5a'),
          ambient: 0.6,
        };
      case 'day':
        return {
          background: new THREE.Color('#87ceeb'), // 天蓝色白天
          fog: new THREE.Color('#b0d8f0'),
          ambient: 1.0,
        };
      case 'dusk':
        return {
          background: new THREE.Color('#ff4500'), // 橙色黄昏
          fog: new THREE.Color('#ff6347'),
          ambient: 0.5,
        };
      case 'night':
        return {
          background: new THREE.Color('#050510'), // 深蓝黑色夜晚
          fog: new THREE.Color('#0a0a20'),
          ambient: 0.3,
        };
      default:
        return {
          background: new THREE.Color('#87ceeb'),
          fog: new THREE.Color('#b0d8f0'),
          ambient: 1.0,
        };
    }
  };

  useFrame((state, delta) => {
    if (!isMoving) return;

    // 时间进度更新（每30秒完整循环一次：黎明→白天→黄昏→夜晚）
    timeProgress.current += delta / 30;
    if (timeProgress.current >= 1) {
      timeProgress.current = 0;
    }

    // 根据进度确定时间段
    if (timeProgress.current < 0.25) {
      timeOfDay.current = 'dawn';
    } else if (timeProgress.current < 0.5) {
      timeOfDay.current = 'day';
    } else if (timeProgress.current < 0.75) {
      timeOfDay.current = 'dusk';
    } else {
      timeOfDay.current = 'night';
    }

    // 每20秒随机切换天气
    const weatherCycle = Math.floor(state.clock.elapsedTime / 20) % 3;
    if (weatherCycle === 0) {
      weatherType.current = 'clear';
    } else if (weatherCycle === 1) {
      weatherType.current = 'rain';
    } else {
      weatherType.current = 'snow';
    }

    // 更新背景和雾效颜色
    const colors = getTimeColors(timeOfDay.current);
    state.scene.background = colors.background;
    if (state.scene.fog && state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color = colors.fog;
    }

    // 更新环境光强度
    state.scene.traverse((obj) => {
      if (obj instanceof THREE.AmbientLight) {
        obj.intensity = colors.ambient;
      }
    });

    // 更新雨粒子
    if (rainParticlesRef.current) {
      rainParticlesRef.current.visible = weatherType.current === 'rain';
      
      if (weatherType.current === 'rain') {
        const positions = rainParticles.geometry.attributes.position.array as Float32Array;
        const velocities = rainParticles.geometry.attributes.velocity.array as Float32Array;

        for (let i = 0; i < RAIN_COUNT; i++) {
          const i3 = i * 3;
          positions[i3 + 1] -= velocities[i] * delta;

          if (positions[i3 + 1] < -10) {
            positions[i3] = (Math.random() - 0.5) * 100;
            positions[i3 + 1] = 50;
            positions[i3 + 2] = (Math.random() - 0.5) * 100;
          }
        }

        rainParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 更新雪粒子
    if (snowParticlesRef.current) {
      snowParticlesRef.current.visible = weatherType.current === 'snow';
      
      if (weatherType.current === 'snow') {
        const positions = snowParticles.geometry.attributes.position.array as Float32Array;
        const velocities = snowParticles.geometry.attributes.velocity.array as Float32Array;

        for (let i = 0; i < SNOW_COUNT; i++) {
          const i3 = i * 3;
          positions[i3 + 1] -= velocities[i] * delta;
          positions[i3] += Math.sin(state.clock.elapsedTime + i) * delta * 0.5;
          positions[i3 + 2] += Math.cos(state.clock.elapsedTime + i) * delta * 0.5;

          if (positions[i3 + 1] < -10) {
            positions[i3] = (Math.random() - 0.5) * 100;
            positions[i3 + 1] = 50;
            positions[i3 + 2] = (Math.random() - 0.5) * 100;
          }
        }

        snowParticles.geometry.attributes.position.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {/* 环境光（强度由时间控制） */}
      <ambientLight intensity={1.0} />
      
      {/* 方向光（模拟太阳/月亮） */}
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={0.8} 
        color="#ffffff"
      />

      {/* 雨粒子 */}
      <points ref={rainParticlesRef} geometry={rainParticles.geometry} material={rainParticles.material} />

      {/* 雪粒子 */}
      <points ref={snowParticlesRef} geometry={snowParticles.geometry} material={snowParticles.material} />
    </group>
  );
}
