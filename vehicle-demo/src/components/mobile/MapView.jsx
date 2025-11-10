import React, { useState } from 'react';
import useVehicleStore from '../store/useVehicleStore';
import { Navigation, ChevronRight, ChevronLeft } from 'lucide-react';

const MapView = () => {
  const { vehicle, route } = useVehicleStore();
  const [isMinimized, setIsMinimized] = useState(false);

  const scale = 10; // 缩放比例
  const centerX = 200;
  const centerY = 200;

  const toScreenCoords = (x, z) => {
    return {
      x: centerX + x * scale,
      y: centerY + z * scale,
    };
  };

  // 最小化状态
  if (isMinimized) {
    return (
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-2xl p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">マップビュー</span>
          <ChevronLeft size={20} className="text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-2xl overflow-hidden">
      {/* 可折叠头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Navigation size={20} className="text-blue-500" />
          マップビュー
        </h2>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-2 hover:bg-white rounded-lg transition-colors"
          title="最小化"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>
      
      {/* 地图内容 */}
      <div className="p-4">
      <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ width: '400px', height: '400px' }}>
        <svg width="400" height="400" className="absolute inset-0">
          {/* 网格 */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#grid)" />

          {/* 中心线 */}
          <line x1="200" y1="0" x2="200" y2="400" stroke="#9ca3af" strokeWidth="1" />
          <line x1="0" y1="200" x2="400" y2="200" stroke="#9ca3af" strokeWidth="1" />

          {/* 路径 */}
          {route.path.length > 1 && (
            <polyline
              points={route.path.map(p => {
                const coords = toScreenCoords(p[0], p[2]);
                return `${coords.x},${coords.y}`;
              }).join(' ')}
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 起点 */}
          {route.start && (
            <circle
              cx={toScreenCoords(route.start[0], route.start[2]).x}
              cy={toScreenCoords(route.start[0], route.start[2]).y}
              r="8"
              fill="#22c55e"
              stroke="#fff"
              strokeWidth="2"
            />
          )}

          {/* 终点 */}
          {route.destination && (
            <circle
              cx={toScreenCoords(route.destination[0], route.destination[2]).x}
              cy={toScreenCoords(route.destination[0], route.destination[2]).y}
              r="8"
              fill="#ef4444"
              stroke="#fff"
              strokeWidth="2"
            />
          )}

          {/* 车辆 */}
          <g transform={`translate(${toScreenCoords(vehicle.position[0], vehicle.position[2]).x}, ${toScreenCoords(vehicle.position[0], vehicle.position[2]).y})`}>
            <circle r="6" fill="#3b82f6" />
            <circle r="10" fill="#3b82f6" opacity="0.3" />
            {vehicle.isMoving && (
              <circle r="14" fill="#3b82f6" opacity="0.2">
                <animate attributeName="r" from="10" to="20" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        </svg>

        {/* 图例 */}
        <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 rounded px-2 py-1 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>出発地</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>目的地</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>車両</span>
          </div>
        </div>

        {/* 比例尺 */}
        <div className="absolute bottom-2 right-2 bg-white bg-opacity-90 rounded px-2 py-1 text-xs">
          スケール: 1:{scale}
        </div>
      </div>
      </div>
    </div>
  );
};

export default MapView;
