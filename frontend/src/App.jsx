import { useEffect, useState } from 'react'
import Navbar, { NAV_LINKS } from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import ScreenerPage from './components/ScreenerPage.jsx'
import ResearchPage from './components/ResearchPage.jsx'
import ChatPage from './components/ChatPage.jsx'
import PredictPage from './components/PredictPage.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [dashboardSearch, setDashboardSearch] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('psx-theme') || 'dark')

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem('psx-theme', theme)
  }, [theme])

  const searchSymbol = (value) => {
    const text = String(value || '').trim().toUpperCase()
    if (!text) return
    setDashboardSearch({ text, id: Date.now() })
    setPage('dashboard')
  }

  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const minutes = hour * 60 + minute
  const isWeekday = day >= 1 && day <= 5
  const marketOpen = isWeekday && minutes >= 9 * 60 + 30 && minutes <= 15 * 60 + 30

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        page={page}
        setPage={setPage}
        onSymbolSearch={searchSymbol}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
      <div className="market-status-bar" aria-label="Market status">
        <span><strong>{marketOpen ? 'Market Open' : 'Market Closed'}</strong></span>
        <span>PKT {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>Source: PSX market-watch + EOD history</span>
        <span>Theme: {theme}</span>
      </div>
      <main className="app-main">
        {page === 'dashboard' && <Dashboard searchRequest={dashboardSearch} />}
        {page === 'screener' && <ScreenerPage />}
        {page === 'research' && <ResearchPage />}
        {page === 'chat' && <ChatPage />}
        {page === 'predict' && <PredictPage />}
      </main>
      <div className="bottom-tabs" aria-label="Mobile navigation">
        {NAV_LINKS.map(link => (
          <button key={link.id} onClick={() => setPage(link.id)} className={page === link.id ? 'active' : ''}>
            <span style={{ display: 'grid', placeItems: 'center', gap: 2 }}>
              {link.icon}
              {link.label}
            </span>
          </button>
        ))}
      </div>
      <Footer />
    </div>
  )
}
