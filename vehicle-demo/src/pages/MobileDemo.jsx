import React from 'react';
import EnhancedFirstPersonScene from '../components/mobile/EnhancedFirstPersonScene';
import HUDControlPanel from '../components/mobile/HUDControlPanel';
import MiniMap from '../components/mobile/MiniMap';
import useVehicleStore from '../store/useVehicleStore';

const Dashboard = () => {
  const { ui } = useVehicleStore();

  return (
    <div className="relative w-full h-[calc(100vh-5rem)] bg-black overflow-hidden">
      {/* 增强版第一人称驾驶场景 */}
      <EnhancedFirstPersonScene />

      {/* HUD 中控台控制面板 */}
      <HUDControlPanel />

      {/* 右上角小地图（可拖动） */}
      <MiniMap />

      {/* 时序图覆盖层 */}
      {ui.showSequenceDiagram && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-8 max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-cyan-500">
            <h2 className="text-3xl font-bold mb-6 text-cyan-400">システムシーケンス図</h2>
            <div className="mb-6 bg-gray-800 p-4 rounded-lg">
              <img 
                src="/mnt/user-data/uploads/1761526990579_image.png" 
                alt="Sequence Diagram"
                className="w-full rounded"
              />
            </div>
            <button
              onClick={() => useVehicleStore.getState().toggleSequenceDiagram()}
              className="w-full py-3 rounded-lg font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
                color: '#0a0f1e',
                boxShadow: '0 0 30px rgba(0, 212, 255, 0.5)',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
