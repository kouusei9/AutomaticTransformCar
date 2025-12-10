import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import HomePage from './pages/HomePage'
import CyberpunkCityDemo from './pages/CyberpunkCityDemo'
import CityRunDemo from './pages/CityRunDemo'
import CityRunSimulation from './pages/CityRunSimulation'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cyberpunk" element={<CyberpunkCityDemo />} />
        <Route path="/cityrun" element={<CityRunDemo />} />
        <Route path="/cityrun/simulation" element={<CityRunSimulation />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
