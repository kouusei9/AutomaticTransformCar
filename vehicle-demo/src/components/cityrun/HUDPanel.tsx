import { useState, useEffect } from 'react';

interface HUDPanelProps {
  onStartStop: (isMoving: boolean) => void;
  onViewToggle: (isFirstPerson: boolean) => void;
  onTransform: () => void;
  isMoving?: boolean;
}

export default function HUDPanel({ onStartStop, onViewToggle, onTransform, isMoving: externalIsMoving }: HUDPanelProps) {
  const [isMoving, setIsMoving] = useState(false);

  // 同步外部isMoving状态
  useEffect(() => {
    if (externalIsMoving !== undefined) {
      setIsMoving(externalIsMoving);
    }
  }, [externalIsMoving]);

  const handleStart = () => {
    if (!isMoving) {
      setIsMoving(true);
      onStartStop(true);
      // 点击START时切换到第三人称视角
      onViewToggle(false);
    } else {
      // 点击STOP时结束行驶并切换回第一人称
      setIsMoving(false);
      onStartStop(false);
      onViewToggle(true);
    }
  };

  const handleTransform = () => {
    onTransform();
  };

  return (
    <div 
      className={`fixed pointer-events-none z-50 transition-all duration-1000 ease-in-out ${
        isMoving 
          ? 'top-6 left-6' 
          : 'flex items-center justify-center'
      }`}
      style={{
        perspective: '1000px',
        top: isMoving ? undefined : '50%',
        left: isMoving ? undefined : '46%',
        transform: isMoving ? undefined : 'translate(-50%, -50%)',
      }}
    >
      {/* PAD 容器 */}
      <div 
        className={`bg-gradient-to-br from-gray-900/95 to-black/95 shadow-2xl border-2 border-cyan-500/50 pointer-events-auto backdrop-blur-md transition-all duration-1000 ${
          isMoving ? 'p-3' : 'p-6'
        }`}
        style={{
          width: isMoving ? '300px' : '500px',
          boxShadow: '0 0 40px rgba(6, 182, 212, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)',
          transform: 'perspective(800px) rotateX(10deg)',
          borderRadius: '30px 30px 40px 40px',
          borderBottomWidth: '3px',
          borderTopWidth: '1px',
        }}
      >
        {/* 顶部标题 */}
        <div className="text-center mb-3">
          <h2 
            className={`font-bold text-cyan-400 mb-1 transition-all duration-1000 ${
              isMoving ? 'text-base' : 'text-xl'
            }`}
            style={{ textShadow: '0 0 10px rgba(6, 182, 212, 0.8)' }}
          >
            車両コントロールパネル
          </h2>
          <div className="h-1 w-20 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto"></div>
        </div>

        {/* 状态显示区域 */}
        <div className="bg-black/40 rounded-xl p-2.5 mb-3 border border-cyan-500/30">
          {isMoving ? (
            /* 行驶中显示路线信息 */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">当前路线</span>
                <span className="text-cyan-400 text-sm font-bold">城市环线</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">已行驶</span>
                <span className="text-green-400 text-sm font-bold">2.5 km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">预计到达</span>
                <span className="text-purple-400 text-sm font-bold">5 分钟</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div className="bg-cyan-500 h-2 rounded-full animate-pulse" style={{ width: '45%' }}></div>
              </div>
            </div>
          ) : (
            /* 停止时显示速度和状态 */
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-gray-400 text-xs mb-1">スピード</div>
                <div className="text-cyan-400 text-lg font-bold font-mono">
                  {isMoving ? '50' : '0'} <span className="text-xs">km/h</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 text-xs mb-1">状态</div>
                <div className={`text-lg font-bold ${isMoving ? 'text-green-400' : 'text-red-400'}`}>
                  {isMoving ? '行驶中' : '停止'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 按钮组 */}
        <div className={`transition-all duration-1000 ${isMoving ? 'space-y-2' : 'space-y-2.5'}`}>
          {/* START/STOP 按钮 */}
          <button
            onClick={handleStart}
            className={`w-full rounded-xl font-bold transition-all duration-300 shadow-lg ${
              isMoving
                ? 'py-2 text-sm bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white'
                : 'py-3 text-base bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white'
            }`}
            style={{
              boxShadow: isMoving
                ? '0 0 20px rgba(239, 68, 68, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)'
                : '0 0 20px rgba(6, 182, 212, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
            }}
          >
            {isMoving ? '⏸ ストップ' : '▶ スタート'}
          </button>

          {/* 变形按钮 - 只在停止时显示 */}
          {!isMoving && (
            <button
              onClick={handleTransform}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-700 hover:to-orange-600 text-white font-bold text-base transition-all duration-300 shadow-lg"
              style={{
                boxShadow: '0 0 20px rgba(234, 179, 8, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
            >
              ⚡ トランスフォーム
            </button>
          )}
        </div>

        {/* 底部装饰线 - 只在停止时显示 */}
        {!isMoving && (
          <div className="mt-4 flex justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        )}
      </div>
    </div>
  );
}
