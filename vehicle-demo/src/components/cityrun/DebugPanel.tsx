import { useState, useEffect } from 'react';

interface LogEntry {
  time: string;
  type: 'log' | 'error' | 'warn';
  message: string;
}

export default function DebugPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (type: 'log' | 'error' | 'warn', ...args: any[]) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      const time = new Date().toLocaleTimeString('ja-JP');
      setLogs(prev => [...prev.slice(-50), { time, type, message }]);
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('log', ...args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('error', ...args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('warn', ...args);
    };

    const handleError = (event: ErrorEvent) => {
      addLog('error', `Uncaught: ${event.message}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      addLog('error', `Promise Rejection: ${event.reason}`);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '10px 15px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#0ff',
          border: '2px solid #0ff',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'monospace',
          cursor: 'pointer',
          pointerEvents: 'auto'
        }}
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40vh',
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.95)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: '12px',
        overflowY: 'auto',
        padding: '10px',
        borderTop: '2px solid #0ff',
        pointerEvents: 'auto'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        borderBottom: '1px solid #0ff',
        paddingBottom: '5px'
      }}>
        <span style={{ color: '#0ff', fontWeight: 'bold' }}>
          🐛 Debug Console ({logs.length})
        </span>
        <div>
          <button
            onClick={() => setLogs([])}
            style={{
              padding: '2px 8px',
              background: '#333',
              color: '#fff',
              border: '1px solid #666',
              borderRadius: '4px',
              marginRight: '5px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              padding: '2px 8px',
              background: '#333',
              color: '#fff',
              border: '1px solid #666',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
        {logs.map((log, index) => (
          <div
            key={index}
            style={{
              padding: '4px 0',
              borderBottom: '1px solid #333',
              color: log.type === 'error' ? '#f00' : log.type === 'warn' ? '#ff0' : '#0f0'
            }}
          >
            <span style={{ color: '#888' }}>[{log.time}]</span>{' '}
            <span style={{ fontWeight: 'bold' }}>
              {log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : 'ℹ️'}
            </span>{' '}
            {log.message}
          </div>
        ))}
      </div>
    </div>
  );
}