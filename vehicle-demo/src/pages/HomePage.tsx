import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      overflow: 'hidden',
      display: 'flex'
    }}>
      {/* 左侧 - CityRun Demo */}
      <div
        onClick={() => navigate('/cityrun')}
        style={{
          flex: 1,
          position: 'relative',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)',
          borderRight: '2px solid rgba(0, 255, 255, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.4s ease',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.flex = '1.2'
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 0, 0, 0.6) 100%)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.flex = '1'
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)'
        }}
      >
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(0, 255, 255, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* 内容 */}
        <div style={{
          position: 'relative',
          textAlign: 'center',
          zIndex: 1
        }}>
          <div style={{
            fontSize: '120px',
            marginBottom: '30px',
            filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.8))'
          }}>
            🏙️
          </div>
          <h2 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#00ffff',
            marginBottom: '20px',
            textShadow: '0 0 30px rgba(0, 255, 255, 0.8)',
            fontFamily: 'monospace',
            letterSpacing: '2px'
          }}>
            シティラン
          </h2>
          <p style={{
            fontSize: '20px',
            color: '#aaa',
            fontFamily: 'monospace',
            lineHeight: '1.8'
          }}>
            一人称視点で都市を走行<br />
            モード変換アニメーション体験
          </p>
          <div style={{
            marginTop: '40px',
            padding: '15px 40px',
            background: 'rgba(0, 255, 255, 0.2)',
            border: '2px solid #00ffff',
            borderRadius: '10px',
            display: 'inline-block',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#00ffff',
            fontFamily: 'monospace'
          }}>
            クリックして開始 →
          </div>
        </div>
      </div>

      {/* 右侧 - Cyberpunk City Monitor */}
      <div
        onClick={() => navigate('/cyberpunk')}
        style={{
          flex: 1,
          position: 'relative',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(255, 0, 255, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)',
          borderLeft: '2px solid rgba(255, 0, 255, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.4s ease',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.flex = '1.2'
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 0, 255, 0.2) 0%, rgba(0, 0, 0, 0.6) 100%)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.flex = '1'
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 0, 255, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)'
        }}
      >
        {/* 背景装饰 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(255, 0, 255, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* 内容 */}
        <div style={{
          position: 'relative',
          textAlign: 'center',
          zIndex: 1
        }}>
          <div style={{
            fontSize: '120px',
            marginBottom: '30px',
            filter: 'drop-shadow(0 0 20px rgba(255, 0, 255, 0.8))'
          }}>
            🌃
          </div>
          <h2 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#ff00ff',
            marginBottom: '20px',
            textShadow: '0 0 30px rgba(255, 0, 255, 0.8)',
            fontFamily: 'monospace',
            letterSpacing: '2px'
          }}>
            NEO TOKYO モニター
          </h2>
          <p style={{
            fontSize: '20px',
            color: '#aaa',
            fontFamily: 'monospace',
            lineHeight: '1.8'
          }}>
            多車両3Dナビゲーション<br />
            リアルタイム交通可視化
          </p>
          <div style={{
            marginTop: '40px',
            padding: '15px 40px',
            background: 'rgba(255, 0, 255, 0.2)',
            border: '2px solid #ff00ff',
            borderRadius: '10px',
            display: 'inline-block',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#ff00ff',
            fontFamily: 'monospace'
          }}>
            クリックして開始 →
          </div>
        </div>
      </div>

      {/* 中间分隔线装饰 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '2px',
        height: '80%',
        background: 'linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.5), transparent)',
        pointerEvents: 'none',
        zIndex: 10
      }} />

      {/* 顶部标题 */}
      <div style={{
        position: 'absolute',
        top: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        zIndex: 20,
        pointerEvents: 'none'
      }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #00ffff 0%, #ff00ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'monospace',
          letterSpacing: '4px',
          marginBottom: '10px',
          textShadow: '0 0 40px rgba(0, 255, 255, 0.5)'
        }}>
          未来都市システム
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#888',
          fontFamily: 'monospace',
          letterSpacing: '2px'
        }}>
          KYOTO FUTURE CITY NAVIGATION SYSTEM
        </p>
      </div>
    </div>
  )
}
