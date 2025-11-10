import React, { useState } from 'react';
import { Play, Square, MapPin, Navigation, Activity, Server, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import useVehicleStore from '../store/useVehicleStore';

const ControlPanel = () => {
  const { vehicle, route, requestRoute, setVehicleMoving, serverStatus, toggleSequenceDiagram } = useVehicleStore();
  const [startPoint, setStartPoint] = useState({ x: 0, z: 0 });
  const [endPoint, setEndPoint] = useState({ x: 10, z: 10 });
  const [isMinimized, setIsMinimized] = useState(false);

  const handleRequestRoute = async () => {
    const start = [startPoint.x, 0.5, startPoint.z];
    const destination = [endPoint.x, 0.5, endPoint.z];
    await requestRoute(start, destination);
  };

  const handleStartMoving = () => {
    if (route.path.length > 0) {
      setVehicleMoving(true);
    }
  };

  const handleStopMoving = () => {
    setVehicleMoving(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'processing': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'waiting': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  // 最小化状态
  if (isMinimized) {
    return (
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-2xl p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <ChevronRight size={20} className="text-blue-500" />
          <span className="font-semibold text-gray-800">制御パネル</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-2xl w-96 max-h-[90vh] overflow-hidden flex flex-col">
      {/* 可折叠头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div>
          <h1 className="text-xl font-bold text-gray-800">自動運転システム</h1>
          <p className="text-xs text-gray-600">Control Panel</p>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-2 hover:bg-white rounded-lg transition-colors"
          title="最小化"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
      </div>

      {/* 滚动内容区域 */}
      <div className="overflow-y-auto p-6 flex-1">

      {/* 路径规划 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <MapPin size={20} className="text-blue-500" />
          経路設定
        </h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              出発地 (X, Z)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={startPoint.x}
                onChange={(e) => setStartPoint({ ...startPoint, x: Number(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="X"
              />
              <input
                type="number"
                value={startPoint.z}
                onChange={(e) => setStartPoint({ ...startPoint, z: Number(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Z"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目的地 (X, Z)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={endPoint.x}
                onChange={(e) => setEndPoint({ ...endPoint, x: Number(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="X"
              />
              <input
                type="number"
                value={endPoint.z}
                onChange={(e) => setEndPoint({ ...endPoint, z: Number(e.target.value) })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Z"
              />
            </div>
          </div>

          <button
            onClick={handleRequestRoute}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <Navigation size={18} />
            経路を請求する
          </button>
        </div>
      </div>

      {/* 服务器状态 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Activity size={20} className="text-green-500" />
          サーバ状態
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-purple-500" />
              <span className="text-sm">Webサーバ</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(serverStatus.webServer)}`}></div>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-orange-500" />
              <span className="text-sm">AIサーバ</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(serverStatus.aiServer)}`}></div>
          </div>
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-pink-500" />
              <span className="text-sm">Webサイト</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${getStatusColor(serverStatus.website)}`}></div>
          </div>
        </div>
      </div>

      {/* 路径信息 */}
      {route.path.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="text-sm font-semibold text-green-800 mb-2">経路情報</h3>
          <div className="space-y-1 text-sm text-green-700">
            <p>距離: {route.distance}m</p>
            <p>予想時間: {route.eta}秒</p>
            <p>ウェイポイント: {route.path.length}</p>
          </div>
        </div>
      )}

      {/* 车辆控制 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">車両制御</h2>
        <div className="flex gap-2">
          <button
            onClick={handleStartMoving}
            disabled={vehicle.isMoving || route.path.length === 0}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <Play size={18} />
            出発
          </button>
          <button
            onClick={handleStopMoving}
            disabled={!vehicle.isMoving}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
          >
            <Square size={18} />
            停止
          </button>
        </div>
      </div>

      {/* 时序图按钮 */}
      <button
        onClick={toggleSequenceDiagram}
        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        シーケンス図を表示
      </button>

      {/* 车辆状态 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">車両状態</h3>
        <div className="space-y-1 text-xs text-gray-600">
          <p>位置: X: {vehicle.position[0].toFixed(2)}, Z: {vehicle.position[2].toFixed(2)}</p>
          <p>状態: {vehicle.isMoving ? '移動中' : '停止中'}</p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ControlPanel;
