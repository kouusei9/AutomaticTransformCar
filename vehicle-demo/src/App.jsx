import { useState } from 'react'
import './App.css'
// import NavigationPage from './pages/NavigationPage.jsx'
// import MonitorPage from './pages/MonitorPage.jsx'
import CyberpunkCityDemo from './pages/CyberpunkCityDemo.tsx'
import MobileDemo from './pages/MobileDemo.jsx'

function App() {

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* トップナビゲーションバー */}
      {/* <nav className="absolute top-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">未来都市システム</h1>
          </div>
         </div> 
      </nav> */}
      <CyberpunkCityDemo />
      <MobileDemo />
    </div>

  )
}

export default App
