import React, { useEffect, useRef, useState } from 'react';
import useVehicleStore from '../../store/useVehicleStore';

const EnhancedFirstPersonScene = () => {
  const canvasRef = useRef(null);
  const { vehicle, route, weather, timeOfDay } = useVehicleStore();
  const [images, setImages] = useState({});
  const roadOffsetRef = useRef(0); // 🔥 改用 ref 而不是 state

  // 加载图片资源
  useEffect(() => {
    const loadImages = async () => {
      const imageUrls = {
        car02: '/assets/car02.png',
        car03: '/assets/car03.png',
        sunshine: '/assets/sunshine.png',
      };

      const loadedImages = {};
      for (const [key, url] of Object.entries(imageUrls)) {
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        loadedImages[key] = img;
      }
      setImages(loadedImages);
    };

    loadImages();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let buildings = [];

    // 初始化建筑物
    for (let i = 0; i < 30; i++) {
      buildings.push({
        x: Math.random() > 0.5 ? Math.random() * 400 + 100 : -Math.random() * 400 - 100,
        z: 500 + Math.random() * 2000,
        width: 80 + Math.random() * 150,
        height: 200 + Math.random() * 400,
        windows: Math.floor(Math.random() * 15) + 8,
        side: Math.random() > 0.5 ? 'left' : 'right',
        offsetY: Math.random() * 50,
      });
    }

    const getSceneColors = () => {
      const colors = {
        morning: {
          sky: ['#2c5282', '#4299e1', '#63b3ed', '#90cdf4'],
          skyTop: '#1a365d',
          buildings: '#1a2332',
          buildingLight: '#ffd700',
          road: '#2d3748',
          roadGlow: 'rgba(100, 200, 255, 0.3)',
          horizon: 'rgba(255, 200, 150, 0.4)',
        },
        day: {
          sky: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
          skyTop: '#1e40af',
          buildings: '#334155',
          buildingLight: '#fbbf24',
          road: '#475569',
          roadGlow: 'rgba(100, 200, 255, 0.3)',
          horizon: 'rgba(255, 220, 180, 0.3)',
        },
        evening: {
          sky: ['#1e293b', '#334155', '#475569', '#64748b'],
          skyTop: '#0f172a',
          buildings: '#0f1419',
          buildingLight: '#00d4ff',
          road: '#1a1d29',
          roadGlow: 'rgba(0, 212, 255, 0.4)',
          horizon: 'rgba(255, 150, 100, 0.5)',
        },
        night: {
          sky: ['#0a0e27', '#0f172a', '#1e293b', '#334155'],
          skyTop: '#020617',
          buildings: '#0a0f1e',
          buildingLight: '#00d4ff',
          road: '#0d1117',
          roadGlow: 'rgba(0, 212, 255, 0.5)',
          horizon: 'rgba(0, 150, 255, 0.2)',
        },
      };
      return colors[timeOfDay] || colors.night;
    };

    const animate = () => {
      const colors = getSceneColors();
      const width = canvas.width;
      const height = canvas.height;

      // 清空画布
      ctx.fillStyle = colors.skyTop;
      ctx.fillRect(0, 0, width, height);

      // 绘制天空渐变
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.55);
      colors.sky.forEach((color, index) => {
        skyGradient.addColorStop(index / (colors.sky.length - 1), color);
      });
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height * 0.55);

      // 绘制太阳/月亮（融入背景）
      if ((timeOfDay === 'morning' || timeOfDay === 'evening') && images.sunshine) {
        const sunSize = 120; // 缩小太阳尺寸
        const sunY = height * 0.35;
        ctx.save();
        ctx.globalAlpha = 0.6; // 更透明，融入背景
        ctx.globalCompositeOperation = 'screen'; // 混合模式，让太阳更自然
        ctx.drawImage(
          images.sunshine,
          width / 2 - sunSize / 2,
          sunY - sunSize / 2,
          sunSize,
          sunSize
        );
        ctx.restore();
      }

      // 绘制地平线光效
      ctx.fillStyle = colors.horizon;
      ctx.fillRect(0, height * 0.5, width, height * 0.1);

      // 绘制建筑物（更远的建筑）
      buildings.forEach((building) => {
        const perspective = 1200 / (building.z + 1200);
        const screenX = width / 2 + building.x * perspective;
        const baseY = height * 0.55;
        const screenY = baseY - building.height * perspective * 0.35 + building.offsetY * perspective;
        const screenWidth = building.width * perspective;
        const screenHeight = building.height * perspective;

        if (screenX + screenWidth > 0 && screenX < width && perspective > 0.05) {
          // 建筑剪影
          ctx.fillStyle = colors.buildings;
          ctx.fillRect(screenX, screenY, screenWidth, screenHeight);

          // 建筑边缘高光
          ctx.strokeStyle = `rgba(0, 212, 255, ${0.15 * perspective})`;
          ctx.lineWidth = Math.max(0.5, 1 * perspective);
          ctx.strokeRect(screenX, screenY, screenWidth, screenHeight);

          // 窗户灯光
          const windowRows = Math.floor(building.windows / 3);
          const windowCols = 3;
          const windowWidth = screenWidth / (windowCols + 1);
          const windowHeight = screenHeight / (windowRows + 3);

          for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
              if (Math.random() > 0.25) {
                const wx = screenX + (col + 0.5) * windowWidth;
                const wy = screenY + (row + 1.5) * windowHeight;
                const ww = windowWidth * 0.5;
                const wh = windowHeight * 0.4;

                // 窗户光晕
                ctx.fillStyle = building.z > 1000
                  ? `${colors.buildingLight}20`
                  : `${colors.buildingLight}40`;
                ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

                // 窗户主体
                ctx.fillStyle = colors.buildingLight;
                ctx.fillRect(wx, wy, ww, wh);
              }
            }
          }
        }
      });

      // 绘制道路
      const roadY = height * 0.55;
      const roadGradient = ctx.createLinearGradient(0, roadY, 0, height);
      roadGradient.addColorStop(0, colors.sky[colors.sky.length - 1]);
      roadGradient.addColorStop(0.3, colors.road);
      roadGradient.addColorStop(1, colors.road);
      ctx.fillStyle = roadGradient;
      ctx.fillRect(0, roadY, width, height - roadY);

      // 🔥 更新 roadOffset - 使用 ref 而不是 state
      if (vehicle.isMoving) {
        roadOffsetRef.current = (roadOffsetRef.current + 8) % 100;
      }

      const vanishPointX = width / 2;
      const vanishPointY = height * 0.55;

      // 左侧车道线（3条）
      for (let i = 1; i <= 3; i++) {
        const leftX = width * (0.25 - i * 0.05);
        drawNeonRoadLine(
          ctx,
          leftX,
          height,
          vanishPointX - 40 * i,
          vanishPointY,
          colors.roadGlow,
          roadOffsetRef.current
        );
      }

      // 右侧车道线（3条）
      for (let i = 1; i <= 3; i++) {
        const rightX = width * (0.75 + i * 0.05);
        drawNeonRoadLine(
          ctx,
          rightX,
          height,
          vanishPointX + 40 * i,
          vanishPointY,
          colors.roadGlow,
          roadOffsetRef.current
        );
      }

      // 中央虚线
      drawCenterDashedLine(ctx, width, height, roadOffsetRef.current);

      // AR 导航路径指示
      if (route.path.length > 0 && vehicle.isMoving) {
        drawARNavigationPath(ctx, width, height, roadOffsetRef.current);
      }

      // 绘制车内仪表盘框架（使用图片，调整大小）
      if (images.car02 && images.car03) {
        // 绘制车内框架（car02 或 car03）
        const dashboardImg = images.car03;
        const dashHeight = 200; // 缩小仪表盘高度
        ctx.drawImage(dashboardImg, 0, height - dashHeight, width, dashHeight);
      } else {
        // 备用：绘制简单的仪表盘底座
        const dashboardHeight = height * 0.28;
        const dashGradient = ctx.createLinearGradient(0, height - dashboardHeight, 0, height);
        dashGradient.addColorStop(0, 'rgba(5, 10, 20, 0)');
        dashGradient.addColorStop(0.4, 'rgba(5, 10, 20, 0.7)');
        dashGradient.addColorStop(1, 'rgba(5, 10, 20, 0.95)');
        ctx.fillStyle = dashGradient;
        ctx.fillRect(0, height - dashboardHeight, width, dashboardHeight);

        // 仪表盘细节
        drawDashboardDetails(ctx, width, height, colors);
      }

      // 绘制车窗框架
      drawWindowFrame(ctx, width, height);

      // 天气粒子效果
      if (weather === 'rain') {
        drawRainEffect(ctx, width, height);
      }

      animationId = requestAnimationFrame(animate);
    };

    // 辅助绘制函数
    function drawNeonRoadLine(ctx, x1, y1, x2, y2, glowColor, offset) {
      const segments = 20;
      const dashLength = 40;
      const gapLength = 30;

      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 15;

      for (let i = 0; i < segments; i++) {
        const t1 = i / segments;
        const t2 = Math.min((i + 0.5) / segments, 1);

        const sx = x1 + (x2 - x1) * t1;
        const sy = y1 + (y2 - y1) * t1;
        const ex = x1 + (x2 - x1) * t2;
        const ey = y1 + (y2 - y1) * t2;

        const dist = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        const phase = (offset + i * 20) % (dashLength + gapLength);

        if (phase < dashLength) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }

      ctx.shadowBlur = 0;
    }

    function drawCenterDashedLine(ctx, width, height, offset) {
      const vanishY = height * 0.55;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 4;
      ctx.setLineDash([30, 30]);
      ctx.lineDashOffset = -offset * 2;

      ctx.beginPath();
      ctx.moveTo(width / 2, height);
      ctx.lineTo(width / 2, vanishY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    function drawARNavigationPath(ctx, width, height, offset) {
      const pathY = height * 0.72;
      const pathWidth = width * 0.4;

      // 主导航线
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)';
      ctx.lineWidth = 10;
      ctx.shadowColor = 'rgba(0, 255, 136, 0.6)';
      ctx.shadowBlur = 20;

      ctx.beginPath();
      ctx.moveTo(width / 2 - pathWidth / 2, pathY);
      ctx.lineTo(width / 2 + pathWidth / 2, pathY);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 动态箭头
      const arrowSize = 25;
      const arrowCount = 6;
      for (let i = 0; i < arrowCount; i++) {
        const progress = (i / arrowCount) + (offset / 100);
        const arrowX = width / 2 - pathWidth / 2 + (pathWidth * (progress % 1));
        const arrowY = pathY;

        ctx.fillStyle = 'rgba(0, 255, 136, 0.95)';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - arrowSize / 2);
        ctx.lineTo(arrowX + arrowSize, arrowY);
        ctx.lineTo(arrowX, arrowY + arrowSize / 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawDashboardDetails(ctx, width, height, colors) {
      // 方向盘底部轮廓
      const steeringY = height - 80;
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(width / 2, steeringY + 50, 100, Math.PI, Math.PI * 2);
      ctx.stroke();

      // 左右侧边缘高光
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(width * 0.2, height - 200);
      ctx.lineTo(width * 0.15, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width * 0.8, height - 200);
      ctx.lineTo(width * 0.85, height);
      ctx.stroke();
    }

    function drawWindowFrame(ctx, width, height) {
      // 左侧A柱
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, height * 0.7);
      ctx.lineTo(width * 0.12, height);
      ctx.lineTo(width * 0.08, 0);
      ctx.fill();

      // 右侧A柱
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(width, height * 0.7);
      ctx.lineTo(width * 0.88, height);
      ctx.lineTo(width * 0.92, 0);
      ctx.fill();

      // 顶部车顶
      ctx.beginPath();
      ctx.ellipse(width / 2, -20, width * 0.45, height * 0.12, 0, 0, Math.PI);
      ctx.fill();

      // A柱青色边缘线
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(width * 0.08, 0);
      ctx.lineTo(width * 0.12, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width * 0.92, 0);
      ctx.lineTo(width * 0.88, height);
      ctx.stroke();
    }

    function drawRainEffect(ctx, width, height) {
      ctx.strokeStyle = 'rgba(200, 220, 255, 0.4)';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < 150; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8;
        const length = 15 + Math.random() * 25;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + length);
        ctx.stroke();
      }
    }

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [vehicle, route, weather, timeOfDay, images]); // 🔥 移除 roadOffset 依赖

  // 处理画布尺寸
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ background: '#0a0e27' }}
    />
  );
};

export default EnhancedFirstPersonScene;
