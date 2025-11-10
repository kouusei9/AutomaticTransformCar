import React, { useEffect, useRef } from 'react';
import useVehicleStore from '../store/useVehicleStore';

const TwoDScene = () => {
  const canvasRef = useRef(null);
  const { vehicle, route } = useVehicleStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const scale = 20; // 缩放比例
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

    // 坐标转换函数
    const toCanvasCoords = (x, z) => ({
      x: offsetX + x * scale,
      y: offsetY + z * scale,
    });

    // 动画循环
    const animate = () => {
      // 清空画布
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制网格
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;

      // 垂直线
      for (let x = 0; x < canvas.width; x += scale) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // 水平线
      for (let y = 0; y < canvas.height; y += scale) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 绘制主轴线
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;

      // X 轴
      ctx.beginPath();
      ctx.moveTo(0, offsetY);
      ctx.lineTo(canvas.width, offsetY);
      ctx.stroke();

      // Y 轴
      ctx.beginPath();
      ctx.moveTo(offsetX, 0);
      ctx.lineTo(offsetX, canvas.height);
      ctx.stroke();

      // 绘制坐标标签
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.fillText('0', offsetX + 5, offsetY - 5);
      ctx.fillText('X', canvas.width - 20, offsetY - 5);
      ctx.fillText('Z', offsetX + 5, 15);

      // 绘制路径
      if (route.path.length > 1) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const firstPoint = toCanvasCoords(route.path[0][0], route.path[0][2]);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < route.path.length; i++) {
          const point = toCanvasCoords(route.path[i][0], route.path[i][2]);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();

        // 绘制路径点
        ctx.fillStyle = '#10b981';
        route.path.forEach((p, index) => {
          if (index % 3 === 0) { // 每3个点画一个
            const point = toCanvasCoords(p[0], p[2]);
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // 绘制起点
      if (route.start) {
        const startPos = toCanvasCoords(route.start[0], route.start[2]);
        
        // 外圈光晕
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 主圆
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // 边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 标签
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('出発', startPos.x, startPos.y - 25);
      }

      // 绘制终点
      if (route.destination) {
        const endPos = toCanvasCoords(route.destination[0], route.destination[2]);
        
        // 外圈光晕
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.beginPath();
        ctx.arc(endPos.x, endPos.y, 20, 0, Math.PI * 2);
        ctx.fill();

        // 主圆
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(endPos.x, endPos.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // 边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 标签
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('目的地', endPos.x, endPos.y - 25);
      }

      // 绘制车辆
      const carPos = toCanvasCoords(vehicle.position[0], vehicle.position[2]);
      
      ctx.save();
      ctx.translate(carPos.x, carPos.y);

      // 如果移动中，绘制运动光晕
      if (vehicle.isMoving) {
        const time = Date.now() / 1000;
        const pulseSize = 20 + Math.sin(time * 3) * 5;
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // 车身主体（矩形）
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2;
      
      // 车身
      ctx.fillRect(-15, -25, 30, 50);
      ctx.strokeRect(-15, -25, 30, 50);

      // 车顶
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(-12, -15, 24, 20);
      ctx.strokeRect(-12, -15, 24, 20);

      // 车窗
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(-10, -12, 20, 6);
      ctx.fillRect(-10, 0, 20, 6);

      // 车灯
      ctx.fillStyle = vehicle.isMoving ? '#fef08a' : '#fde047';
      ctx.beginPath();
      ctx.arc(-8, -28, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8, -28, 3, 0, Math.PI * 2);
      ctx.fill();

      // 车轮
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(-12, -15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(12, -15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-12, 15, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(12, 15, 4, 0, Math.PI * 2);
      ctx.fill();

      // 方向指示器（移动时显示）
      if (vehicle.isMoving && route.path.length > 0) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(-5, -25);
        ctx.moveTo(0, -35);
        ctx.lineTo(5, -25);
        ctx.stroke();
      }

      ctx.restore();

      // 绘制速度指示器
      if (vehicle.isMoving) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('移動中', carPos.x, carPos.y + 45);
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, [vehicle, route]);

  // 处理画布尺寸
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: '#1f2937' }}
      />
      
      {/* 图例 */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white rounded-lg p-3 text-xs space-y-1">
        <div className="font-semibold mb-2">凡例</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span>出発地</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span>目的地</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-blue-500"></div>
          <span>車両</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-green-500"></div>
          <span>経路</span>
        </div>
      </div>

      {/* 缩放提示 */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white rounded-lg p-2 text-xs">
        スケール: 1マス = 1m
      </div>
    </div>
  );
};

export default TwoDScene;
