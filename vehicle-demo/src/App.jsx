// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import ThreeScene from "./components/ThreeScene"



function App() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* 顶部标题 */}
      {/* <header className="absolute top-5 left-10 text-2xl font-bold z-10">
        未来自动驾驶 Demo 🚗
      </header> */}

      {/* Three.js 场景 */}
      <ThreeScene />

      {/* 底部说明区域 */}
      {/* <div className="absolute bottom-5 left-10 z-10 bg-black/50 p-4 rounded-lg">
        <h2 className="text-xl mb-2">行驶路径演示</h2>
        <p className="text-gray-300">
          本系统展示车辆从A点出发，在路径上自动变形为飞行模式，
          然后落地行驶至B点，全程自动控制。
        </p>
      </div> */}
    </div>
  )
}

export default App
