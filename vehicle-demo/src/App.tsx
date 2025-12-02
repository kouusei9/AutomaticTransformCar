import { useState, useEffect } from 'react'
import './App.css'
import CyberpunkCityDemo from './pages/CyberpunkCityDemo.tsx'
import CityRunDemo from './pages/CityRunDemo.tsx'

function App() {
  const [currentPage, setCurrentPage] = useState('cityrun') // 'cyberpunk', or 'cityrun'
  const [isNavVisible, setIsNavVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    let timeoutId: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      // 鼠标靠近顶部时显示导航栏
      if (e.clientY < 100) {
        setIsNavVisible(true)
        
        // 清除之前的定时器
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
      } else {
        // 鼠标离开顶部，3秒后自动隐藏
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        timeoutId = window.setTimeout(() => {
          setIsNavVisible(false)
        }, 2000)
      }
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // 向上滚动时显示导航栏
      if (currentScrollY < lastScrollY) {
        setIsNavVisible(true)
      } else if (currentScrollY > 50) {
        // 向下滚动且超过50px时隐藏
        setIsNavVisible(false)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [lastScrollY])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* トップナビゲーションバー - 自动隐藏 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-gray-700 transition-all duration-300 ${
        isNavVisible ? 'translate-y-0' : '-translate-y-full'
      } ${currentPage === 'cityrun'
        ? 'bg-black/30 backdrop-blur-sm'
        : 'bg-black/80 backdrop-blur-sm'
        }`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">未来都市システム</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentPage('cyberpunk')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${currentPage === 'cyberpunk'
                ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              NEO TOKYO ナビゲーション
            </button>
            <button
              onClick={() => setCurrentPage('cityrun')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${currentPage === 'cityrun'
                ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/50'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              シティランデモ
            </button>
          </div>
        </div>
      </nav>

      {/* ページコンテンツ */}
      <div className={currentPage === 'cityrun' ? '' : 'pt-20'}>
        {currentPage === 'cyberpunk' && <CyberpunkCityDemo />}
        {currentPage === 'cityrun' && <CityRunDemo />}
      </div>
    </div>
  )
}

export default App
