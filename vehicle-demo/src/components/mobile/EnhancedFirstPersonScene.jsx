import React, { useEffect, useRef, useState } from 'react';
import useVehicleStore from '../../store/useVehicleStore';

const EnhancedFirstPersonScene = () => {
  const canvasRef = useRef(null);
  const { vehicle, route, weather, timeOfDay } = useVehicleStore();
  const [images, setImages] = useState({});
  const roadOffsetRef = useRef(0);
  const waveOffsetRef = useRef(0);

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

    // 初始化远山
    const mountains = [];
    for (let i = 0; i < 5; i++) {
      mountains.push({
        x: (i - 2) * 600,
        baseHeight: 150 + Math.random() * 100,
        peaks: Array.from({ length: 8 }, () => ({
          offset: Math.random() * 150,
          height: Math.random() * 80,
        })),
      });
    }

    const getSceneColors = () => {
      const colors = {
        morning: {
          skyTop: '#b8c5e8',
          skyBottom: '#e8d5f0',
          water: ['#b8c5e8', '#d5c5e8', '#e8d5f0'],
          mountain1: 'rgba(150, 170, 220, 0.4)',
          mountain2: 'rgba(170, 180, 230, 0.5)',
          mountain3: 'rgba(190, 200, 240, 0.6)',
          trees: 'rgba(200, 210, 250, 0.7)',
          road: '#4a5568',
          horizon: '#f0e5ff',
        },
        day: {
          skyTop: '#a8b8e8',
          skyBottom: '#d8c5f0',
          water: ['#a8b8e8', '#c5b5e8', '#d8c5f0'],
          mountain1: 'rgba(140, 160, 210, 0.4)',
          mountain2: 'rgba(160, 170, 220, 0.5)',
          mountain3: 'rgba(180, 190, 230, 0.6)',
          trees: 'rgba(190, 200, 240, 0.7)',
          road: '#3a4558',
          horizon: '#e0d5ff',
        },
        evening: {
          skyTop: '#9895d4',
          skyBottom: '#d4a5d0',
          water: ['#9895d4', '#b895c4', '#d4a5d0'],
          mountain1: 'rgba(120, 110, 180, 0.4)',
          mountain2: 'rgba(140, 120, 190, 0.5)',
          mountain3: 'rgba(160, 140, 200, 0.6)',
          trees: 'rgba(180, 160, 210, 0.7)',
          road: '#2a3548',
          horizon: '#d0c5e8',
        },
        night: {
          skyTop: '#7878b8',
          skyBottom: '#b888c8',
          water: ['#7878b8', '#9878b8', '#b888c8'],
          mountain1: 'rgba(90, 90, 150, 0.4)',
          mountain2: 'rgba(110, 100, 160, 0.5)',
          mountain3: 'rgba(130, 120, 170, 0.6)',
          trees: 'rgba(150, 140, 180, 0.7)',
          road: '#1a2538',
          horizon: '#b0a5d8',
        },
      };
      return colors[timeOfDay] || colors.evening;
    };

    const animate = () => {
      const colors = getSceneColors();
      const width = canvas.width;
      const height = canvas.height;

      // 清空画布
      ctx.fillStyle = colors.skyTop;
      ctx.fillRect(0, 0, width, height);

      // 绘制天空渐变
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.5);
      skyGradient.addColorStop(0, colors.skyTop);
      skyGradient.addColorStop(1, colors.skyBottom);
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height * 0.5);

      // 绘制地平线
      const horizonY = height * 0.5;
      ctx.fillStyle = colors.horizon;
      ctx.fillRect(0, horizonY - 2, width, 4);

      // 绘制远山层次（3层）
      drawMountainLayer(ctx, mountains, width, height, colors.mountain1, 0.25, 1.5);
      drawMountainLayer(ctx, mountains, width, height, colors.mountain2, 0.28, 1.2);
      drawMountainLayer(ctx, mountains, width, height, colors.mountain3, 0.32, 1.0);

      // 绘制树林轮廓
      drawTreeLine(ctx, width, height, colors.trees);

      // 绘制水面
      const waterGradient = ctx.createLinearGradient(0, horizonY, 0, height * 0.75);
      colors.water.forEach((color, index) => {
        waterGradient.addColorStop(index / (colors.water.length - 1), color);
      });
      ctx.fillStyle = waterGradient;
      ctx.fillRect(0, horizonY, width, height * 0.25);

      // 绘制水面波纹
      if (vehicle.isMoving) {
        waveOffsetRef.current = (waveOffsetRef.current + 1) % 100;
      }
      drawWaterWaves(ctx, width, height, waveOffsetRef.current);

      // 绘制道路
      drawStylizedRoad(ctx, width, height, colors.road);

      // 更新道路偏移
      if (vehicle.isMoving) {
        roadOffsetRef.current = (roadOffsetRef.current + 8) % 100;
      }

      // 绘制车道线
      const vanishPointX = width / 2;
      const vanishPointY = height * 0.5;

      // 左侧车道线
      for (let i = 1; i <= 2; i++) {
        const leftX = width * (0.3 - i * 0.08);
        drawSoftRoadLine(
          ctx,
          leftX,
          height,
          vanishPointX - 30 * i,
          vanishPointY,
          roadOffsetRef.current
        );
      }

      // 右侧车道线
      for (let i = 1; i <= 2; i++) {
        const rightX = width * (0.7 + i * 0.08);
        drawSoftRoadLine(
          ctx,
          rightX,
          height,
          vanishPointX + 30 * i,
          vanishPointY,
          roadOffsetRef.current
        );
      }

      // 中央虚线
      drawCenterDashedLine(ctx, width, height, roadOffsetRef.current);

      // AR 导航路径
      if (route.path.length > 0 && vehicle.isMoving) {
        drawModernNavigationPath(ctx, width, height, roadOffsetRef.current);
      }

      // 绘制车内环境
      drawModernDashboard(ctx, width, height);

      // 绘制车窗框架
      drawSoftWindowFrame(ctx, width, height);

      // 天气效果
      if (weather === 'rain') {
        drawSoftRainEffect(ctx, width, height);
      }

      animationId = requestAnimationFrame(animate);
    };

    // 绘制山脉层
    function drawMountainLayer(ctx, mountains, width, height, color, heightRatio, scale) {
      const horizonY = height * 0.5;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-100, horizonY);

      mountains.forEach((mountain) => {
        const baseX = width / 2 + mountain.x * scale;
        const baseY = horizonY - mountain.baseHeight * heightRatio;

        mountain.peaks.forEach((peak, index) => {
          const peakX = baseX + index * 80 * scale;
          const peakY = baseY - peak.height * heightRatio;

          if (index === 0) {
            ctx.lineTo(peakX, baseY);
          }

          ctx.quadraticCurveTo(
            peakX - 20 * scale,
            peakY - 10 * heightRatio,
            peakX,
            peakY
          );
          ctx.quadraticCurveTo(
            peakX + 20 * scale,
            peakY - 10 * heightRatio,
            peakX + 40 * scale,
            baseY
          );
        });
      });

      ctx.lineTo(width + 100, horizonY);
      ctx.lineTo(width + 100, horizonY + 10);
      ctx.lineTo(-100, horizonY + 10);
      ctx.closePath();
      ctx.fill();
    }

    // 绘制树林轮廓
    function drawTreeLine(ctx, width, height, color) {
      const treeY = height * 0.48;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(0, treeY);

      for (let x = 0; x < width; x += 5) {
        const treeHeight = 20 + Math.sin(x * 0.1) * 10 + Math.random() * 15;
        ctx.lineTo(x, treeY - treeHeight);
      }

      ctx.lineTo(width, treeY);
      ctx.lineTo(width, treeY + 20);
      ctx.lineTo(0, treeY + 20);
      ctx.closePath();
      ctx.fill();
    }

    // 绘制水面波纹
    function drawWaterWaves(ctx, width, height, offset) {
      const horizonY = height * 0.5;
      const waterBottom = height * 0.75;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      for (let y = horizonY + 20; y < waterBottom; y += 15) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 5) {
          const wave = Math.sin((x + offset * 2) * 0.05) * 3;
          if (x === 0) {
            ctx.moveTo(x, y + wave);
          } else {
            ctx.lineTo(x, y + wave);
          }
        }
        ctx.stroke();
      }
    }

    // 绘制柔和的道路
    function drawStylizedRoad(ctx, width, height, color) {
      const roadY = height * 0.75;
      const roadGradient = ctx.createLinearGradient(0, roadY, 0, height);
      roadGradient.addColorStop(0, color + '40');
      roadGradient.addColorStop(0.5, color + 'a0');
      roadGradient.addColorStop(1, color);
      ctx.fillStyle = roadGradient;
      ctx.fillRect(0, roadY, width, height - roadY);
    }

    // 绘制柔和的车道线
    function drawSoftRoadLine(ctx, x1, y1, x2, y2, offset) {
      const segments = 15;
      const dashLength = 30;
      const gapLength = 25;

      ctx.strokeStyle = 'rgba(100, 120, 180, 0.5)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(150, 170, 220, 0.3)';
      ctx.shadowBlur = 8;

      for (let i = 0; i < segments; i++) {
        const t1 = i / segments;
        const t2 = Math.min((i + 0.4) / segments, 1);

        const sx = x1 + (x2 - x1) * t1;
        const sy = y1 + (y2 - y1) * t1;
        const ex = x1 + (x2 - x1) * t2;
        const ey = y1 + (y2 - y1) * t2;

        const phase = (offset + i * 15) % (dashLength + gapLength);

        if (phase < dashLength) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }

      ctx.shadowBlur = 0;
    }

    // 绘制中央虚线
    function drawCenterDashedLine(ctx, width, height, offset) {
      const vanishY = height * 0.5;
      ctx.strokeStyle = 'rgba(180, 180, 220, 0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([25, 25]);
      ctx.lineDashOffset = -offset * 2;

      ctx.beginPath();
      ctx.moveTo(width / 2, height);
      ctx.lineTo(width / 2, vanishY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    // 绘制现代导航路径
    function drawModernNavigationPath(ctx, width, height, offset) {
      const pathY = height * 0.8;
      const pathWidth = width * 0.35;

      // 主导航线
      const pathGradient = ctx.createLinearGradient(
        width / 2 - pathWidth / 2,
        pathY,
        width / 2 + pathWidth / 2,
        pathY
      );
      pathGradient.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
      pathGradient.addColorStop(0.5, 'rgba(100, 200, 255, 0.8)');
      pathGradient.addColorStop(1, 'rgba(100, 200, 255, 0.3)');

      ctx.strokeStyle = pathGradient;
      ctx.lineWidth = 8;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.5)';
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.moveTo(width / 2 - pathWidth / 2, pathY);
      ctx.lineTo(width / 2 + pathWidth / 2, pathY);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 流动光点
      const dotSize = 6;
      const dotCount = 8;
      for (let i = 0; i < dotCount; i++) {
        const progress = (i / dotCount + offset / 100) % 1;
        const dotX = width / 2 - pathWidth / 2 + pathWidth * progress;
        const dotY = pathY;
        const opacity = Math.sin(progress * Math.PI) * 0.8 + 0.2;

        const dotGradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotSize * 2);
        dotGradient.addColorStop(0, `rgba(100, 200, 255, ${opacity})`);
        dotGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = dotGradient;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotSize * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 绘制现代仪表盘
    function drawModernDashboard(ctx, width, height) {
      const dashHeight = height * 0.25;
      const dashY = height - dashHeight;

      // 仪表盘渐变背景
      const dashGradient = ctx.createLinearGradient(0, dashY, 0, height);
      dashGradient.addColorStop(0, 'rgba(20, 30, 60, 0)');
      dashGradient.addColorStop(0.3, 'rgba(20, 30, 60, 0.6)');
      dashGradient.addColorStop(1, 'rgba(15, 25, 50, 0.95)');
      ctx.fillStyle = dashGradient;
      ctx.fillRect(0, dashY, width, dashHeight);

      // 方向盘顶部弧线
      const steeringY = height - 60;
      ctx.strokeStyle = 'rgba(60, 80, 140, 0.8)';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(100, 120, 180, 0.4)';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(width / 2, steeringY + 40, 90, Math.PI, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 仪表盘装饰线
      ctx.strokeStyle = 'rgba(80, 100, 160, 0.5)';
      ctx.lineWidth = 2;

      // 左侧
      ctx.beginPath();
      ctx.moveTo(width * 0.15, dashY + 20);
      ctx.lineTo(width * 0.12, height);
      ctx.stroke();

      // 右侧
      ctx.beginPath();
      ctx.moveTo(width * 0.85, dashY + 20);
      ctx.lineTo(width * 0.88, height);
      ctx.stroke();
    }

    // 绘制柔和的车窗框架
    function drawSoftWindowFrame(ctx, width, height) {
      // 左侧A柱
      const leftGradient = ctx.createLinearGradient(0, 0, width * 0.12, 0);
      leftGradient.addColorStop(0, 'rgba(10, 20, 40, 1)');
      leftGradient.addColorStop(1, 'rgba(10, 20, 40, 0.3)');

      ctx.fillStyle = leftGradient;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, height * 0.7);
      ctx.lineTo(width * 0.12, height);
      ctx.lineTo(width * 0.08, 0);
      ctx.fill();

      // 右侧A柱
      const rightGradient = ctx.createLinearGradient(width, 0, width * 0.88, 0);
      rightGradient.addColorStop(0, 'rgba(10, 20, 40, 1)');
      rightGradient.addColorStop(1, 'rgba(10, 20, 40, 0.3)');

      ctx.fillStyle = rightGradient;
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(width, height * 0.7);
      ctx.lineTo(width * 0.88, height);
      ctx.lineTo(width * 0.92, 0);
      ctx.fill();

      // 顶部车顶
      const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.15);
      topGradient.addColorStop(0, 'rgba(10, 20, 40, 1)');
      topGradient.addColorStop(1, 'rgba(10, 20, 40, 0.3)');

      ctx.fillStyle = topGradient;
      ctx.beginPath();
      ctx.ellipse(width / 2, -20, width * 0.45, height * 0.12, 0, 0, Math.PI);
      ctx.fill();

      // 柔和的边缘高光
      ctx.strokeStyle = 'rgba(100, 120, 180, 0.3)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(width * 0.08, 0);
      ctx.lineTo(width * 0.12, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width * 0.92, 0);
      ctx.lineTo(width * 0.88, height);
      ctx.stroke();
    }

    // 绘制柔和的雨效果
    function drawSoftRainEffect(ctx, width, height) {
      ctx.strokeStyle = 'rgba(200, 210, 240, 0.3)';
      ctx.lineWidth = 1;

      for (let i = 0; i < 100; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.8;
        const length = 10 + Math.random() * 20;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + length);
        ctx.stroke();
      }
    }

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [vehicle, route, weather, timeOfDay, images]);

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
      style={{ background: '#9895d4' }}
    />
  );
};

export default EnhancedFirstPersonScene;
