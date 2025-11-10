import { useState } from 'react'
import './App.css'
// import NavigationPage from './pages/NavigationPage.jsx'
// import MonitorPage from './pages/MonitorPage.jsx'
import CyberpunkCityDemo from './pages/CyberpunkCityDemo.tsx'
import MobileDemo from './pages/MobileDemo.jsx'

function App() {
  const [currentPage, setCurrentPage] = useState('cyberpunk') // 'cyberpunk' or 'mobile'

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* トップナビゲーションバー */}
      <nav className="absolute top-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">未来都市システム</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentPage('cyberpunk')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                currentPage === 'cyberpunk'
                  ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              京都市街地ナビゲーション
            </button>
            <button
              onClick={() => setCurrentPage('mobile')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                currentPage === 'mobile'
                  ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              モバイルデモ
            </button>
          </div>
        </div> 
      </nav>
      
      {/* ページコンテンツ */}
      <div className="pt-20">
        {currentPage === 'cyberpunk' && <CyberpunkCityDemo />}
        {currentPage === 'mobile' && <MobileDemo />}
      </div>
    </div>

  )
}

export default App
