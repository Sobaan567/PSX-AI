import { useState, useEffect } from 'react'

export default function Footer() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '16px 32px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 11, color: '#6b7280',
      background: 'rgba(22,26,43,0.5)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: '#00d084',
          boxShadow: '0 0 6px #00d084',
          animation: 'pulse-dot 2s ease-in-out infinite'
        }} />
        <span>Server Online</span>
        <span style={{ color: 'rgba(107,114,128,0.5)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>12ms</span>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)' }}>
        {time.toUTCString().replace('GMT', 'UTC')}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {['Privacy', 'Terms', 'Disclaimer'].map(l => (
          <a key={l} href="#" style={{
            color: '#6b7280', textDecoration: 'none',
            transition: 'color 0.15s'
          }}
            onMouseEnter={e => e.target.style.color = 'white'}
            onMouseLeave={e => e.target.style.color = '#6b7280'}
          >{l}</a>
        ))}
        <span style={{ color: 'rgba(107,114,128,0.5)' }}>·</span>
        <span>PSX·AI © 2025</span>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </footer>
  )
}
