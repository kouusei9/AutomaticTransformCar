import React, { useEffect, useRef, useState } from 'react';
import useVehicleStore from '../store/useVehicleStore';

const FirstPersonScene = () => {
  const canvasRef = useRef(null);
  const { vehicle, route, weather, timeOfDay } = useVehicleStore();
  const [buildings, setBuildings] = useState([]);
  const [roadLines, setRoadLines] = useState([]);

  // 初始化建筑物和道路
  useEffect(() => {
    // 生成随机建筑物
    const newBuildings = [];
    for (let i = 0; i < 20; i++) {
      newBuildings.push({
        x: Math.random() > 0.5 ? Math.random() * 300 + 50 : -Math.random() * 300 - 50,
        y: 200 + Math.random() * 300,
        width: 60 + Math.random() * 100,
        height: 150 + Math.random() * 300,
        windows: Math.floor(Math.random() * 10) + 5,
        side: Math.random() > 0.5 ? 'left' : 'right',
      });
    }
    setBuildings(newBuildings);

    // 生成道路线
    const newRoadLines = [];
    for (let i = 0; i < 15; i++) {
      newRoadLines.push({
        z: i * 100,
        speed: 5,
      });
    }
    setRoadLines(newRoadLines);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;

    // 天气和时间配色
    const getSceneColors = () => {
      const colors = {
        morning: {
          sky: ['#1a3a5c', '#2d5a8f', '#4a7bb5'],
          buildings: '#0f2847',
          lights: '#ffd700',
          road: '#1a1a2e',
        },
        day: {
          sky: ['#4a90e2', '#6ab0f5', '#87ceeb'],
          buildings: '#2c3e50',
          lights: '#f39c12',
          road: '#34495e',
        },
        evening: {
          sky: ['#1a1a3e', '#2a2a5e', '#3a3a7e'],
          buildings: '#0d1b2a',
          lights: '#00d4ff',
          road: '#0f1419',
        },
        night: {
          sky: ['#0a0e27', '#141b3d', '#1e2a4f'],
          buildings: '#0a0f1e',
          lights: '#00d4ff',
          road: '#0d1117',
        },
      };

      return colors[timeOfDay] || colors.night;
    };

    const animate = () => {
      const colors = getSceneColors();
      const width = canvas.width;
      const height = canvas.height;

      // 绘制天空渐变
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.6);
      colors.sky.forEach((color, index) => {
        skyGradient.addColorStop(index / (colors.sky.length - 1), color);
      });
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height * 0.6);

      // 绘制道路
      const roadGradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
      roadGradient.addColorStop(0, colors.sky[colors.sky.length - 1]);
      roadGradient.addColorStop(1, colors.road);
      ctx.fillStyle = roadGradient;
      ctx.fillRect(0, height * 0.6, width, height * 0.4);

      // 绘制地平线光效
      ctx.fillStyle = 'rgba(0, 212, 255, 0.1)';
      ctx.fillRect(0, height * 0.55, width, height * 0.1);

      // 绘制建筑物
      buildings.forEach((building) => {
        const perspective = 800 / (building.y + 800);
        const screenX = width / 2 + building.x * perspective;
        const screenY = height * 0.6 - building.height * perspective * 0.3;
        const screenWidth = building.width * perspective;
        const screenHeight = building.height * perspective;

        if (screenX + screenWidth > 0 && screenX < width) {
          // 建筑主体
          ctx.fillStyle = colors.buildings;
          ctx.fillRect(screenX, screenY, screenWidth, screenHeight);

          // 建筑边缘高光
          ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, screenWidth, screenHeight);

          // 窗户
          const windowRows = Math.floor(building.windows / 2);
          const windowCols = 2;
          const windowWidth = screenWidth / (windowCols + 1);
          const windowHeight = screenHeight / (windowRows + 2);

          for (let row = 0; row < windowRows; row++) {
            for (let col = 0; col < windowCols; col++) {
              const wx = screenX + (col + 0.5) * windowWidth;
              const wy = screenY + (row + 1) * windowHeight;
              
              // 窗户光
              if (Math.random() > 0.3) {
                ctx.fillStyle = colors.lights;
                ctx.fillRect(wx, wy, windowWidth * 0.6, windowHeight * 0.5);
                
                // 窗户光晕
                ctx.fillStyle = `${colors.lights}33`;
                ctx.fillRect(wx - 2, wy - 2, windowWidth * 0.6 + 4, windowHeight * 0.5 + 4);
              }
            }
          }
        }
      });

      // 绘制道路线条（中间虚线）
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 4;
      ctx.setLineDash([30, 30]);

      roadLines.forEach((line, index) => {
        if (vehicle.isMoving) {
          roadLines[index].z -= line.speed;
          if (roadLines[index].z < -50) {
            roadLines[index].z = 1500;
          }
        }

        const perspective = 800 / (line.z + 100);
        const lineY = height * 0.6 + (height * 0.4) * (1 - perspective);
        const lineWidth = width * 0.1 * perspective;

        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth / 2, lineY);
        ctx.lineTo(width / 2 + lineWidth / 2, lineY);
        ctx.stroke();
      });

      ctx.setLineDash([]);

      // 绘制道路边缘
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
      ctx.lineWidth = 3;
      
      // 左边缘
      ctx.beginPath();
      ctx.moveTo(0, height * 0.6);
      ctx.lineTo(width * 0.15, height);
      ctx.stroke();

      // 右边缘
      ctx.beginPath();
      ctx.moveTo(width, height * 0.6);
      ctx.lineTo(width * 0.85, height);
      ctx.stroke();

      // 绘制路径指示（如果有路径）
      if (route.path.length > 0 && vehicle.isMoving) {
        // AR 路径指示线
        const pathY = height * 0.7;
        const pathWidth = width * 0.6;
        
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 8;
        ctx.shadowColor = 'rgba(0, 255, 136, 0.5)';
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.moveTo(width / 2 - pathWidth / 2, pathY);
        ctx.lineTo(width / 2 + pathWidth / 2, pathY);
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        // 路径箭头
        const arrowSize = 20;
        for (let i = 0; i < 5; i++) {
          const arrowX = width / 2 - pathWidth / 2 + (pathWidth / 4) * i + (Date.now() / 100 % 50);
          const arrowY = pathY;
          
          ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY - arrowSize / 2);
          ctx.lineTo(arrowX + arrowSize, arrowY);
          ctx.lineTo(arrowX, arrowY + arrowSize / 2);
          ctx.fill();
        }
      }

      // 绘制仪表盘底座
      const dashboardHeight = height * 0.25;
      const dashboardGradient = ctx.createLinearGradient(0, height - dashboardHeight, 0, height);
      dashboardGradient.addColorStop(0, 'rgba(10, 15, 30, 0)');
      dashboardGradient.addColorStop(0.5, 'rgba(10, 15, 30, 0.8)');
      dashboardGradient.addColorStop(1, 'rgba(10, 15, 30, 0.95)');
      ctx.fillStyle = dashboardGradient;
      ctx.fillRect(0, height - dashboardHeight, width, dashboardHeight);

      // 绘制车内边框（车窗框架）
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = 80;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, height * 0.7);
      ctx.lineTo(width * 0.15, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(width, height * 0.7);
      ctx.lineTo(width * 0.85, height);
      ctx.stroke();

      // 绘制顶部车顶弧线
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.ellipse(width / 2, 0, width * 0.6, height * 0.15, 0, 0, Math.PI);
      ctx.fill();

      // 天气效果
      if (weather === 'rain') {
        ctx.strokeStyle = 'rgba(200, 200, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 100; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height * 0.8;
          const length = 10 + Math.random() * 20;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 5, y + length);
          ctx.stroke();
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [vehicle, route, buildings, roadLines, weather, timeOfDay]);

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

export default FirstPersonScene;
