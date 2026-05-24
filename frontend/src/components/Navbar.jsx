import { useState } from 'react'
import {
  Activity,
  Bot,
  BrainCircuit,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react'

export const NAV_LINKS = [
  { id: 'dashboard', label: 'Market', icon: <LayoutDashboard size={16} /> },
  { id: 'screener', label: 'Screener', icon: <SlidersHorizontal size={16} /> },
  { id: 'research', label: 'Research', icon: <BrainCircuit size={16} /> },
  { id: 'chat', label: 'AI Chat', icon: <Bot size={16} /> },
  { id: 'predict', label: 'Predict', icon: <Activity size={16} /> },
]

export default function Navbar({ page, setPage, onSymbolSearch, theme = 'dark', onToggleTheme }) {
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const go = (id) => {
    setPage(id)
    setMobileOpen(false)
  }

  const submitSearch = (event) => {
    event.preventDefault()
    onSymbolSearch?.(search)
    setMobileOpen(false)
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 80, background: 'var(--nav-bg)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)',
      display: 'flex', alignItems: 'center',
      padding: '0 32px', gap: 32
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => go('dashboard')}>
        <div style={{
          width: 40, height: 40,
          background: 'linear-gradient(135deg, #d4af37, #f1c40f)',
          borderRadius: 8, transform: 'rotate(3deg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(212,175,55,0.3)'
        }}>
          <Activity size={20} color={theme === 'dark' ? '#0f111a' : '#3a2d12'} strokeWidth={2.5} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 18 }}>
          PSX<span style={{ color: 'var(--gold)' }}>·AI</span>
        </span>
      </div>

      <div className="desktop-nav-links" style={{ display: 'flex', gap: 28, flex: 1, justifyContent: 'center' }}>
        {NAV_LINKS.map(link => (
          <button key={link.id} onClick={() => go(link.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'none', border: 'none', cursor: 'pointer',
            color: page === link.id ? 'var(--text)' : 'var(--muted)',
            fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-ui)',
            paddingBottom: 5,
            borderBottom: page === link.id ? '2px solid var(--gold)' : '2px solid transparent',
          }}>
            {link.icon}
            {link.label}
          </button>
        ))}
      </div>

      <div className="desktop-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <form onSubmit={submitSearch} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--input-bg)', border: '1px solid var(--line)',
          borderRadius: 20, padding: '6px 14px'
        }}>
          <button type="submit" aria-label="Search symbol" style={{ display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>
            <Search size={14} />
          </button>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search symbol..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)',
              width: 130
            }}
          />
        </form>
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--input-bg)',
            color: 'var(--gold)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <button
        className="mobile-menu-button"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        style={{
          marginLeft: 'auto',
          width: 38,
          height: 38,
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'var(--input-bg)',
          color: 'var(--gold)',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        {mobileOpen ? <X size={17} /> : <Menu size={17} />}
      </button>

      {mobileOpen && (
        <div className="mobile-nav-panel">
          <form onSubmit={submitSearch} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--input-bg)', border: '1px solid var(--line)',
            borderRadius: 10, padding: '8px 10px'
          }}>
            <Search size={14} color="var(--muted)" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search symbol..."
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-mono)' }}
            />
          </form>
          {NAV_LINKS.map(link => (
            <button key={link.id} onClick={() => go(link.id)} style={{
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: page === link.id ? 'rgba(212,175,55,0.11)' : 'var(--surface-soft)',
              color: page === link.id ? 'var(--gold)' : 'var(--text)',
              padding: '0 12px',
              cursor: 'pointer',
              fontWeight: 800,
            }}>
              {link.icon}
              {link.label}
            </button>
          ))}
          <button
            onClick={onToggleTheme}
            style={{
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              borderRadius: 10,
              border: '1px solid var(--line)',
              background: 'var(--surface-soft)',
              color: 'var(--gold)',
              padding: '0 12px',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      )}
    </nav>
  )
}
