import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ExternalLink,
  Newspaper,
  Play,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { readJson } from '../api'

import { API_BASE } from '../config'

const API = API_BASE

function Card({ children, style }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018))',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      boxShadow: '0 18px 50px rgba(0,0,0,0.20)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value) {
  if (!value) return ''
  if (typeof value === 'number') {
    return new Date(value * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
  }
  return value
}

function Metric({ label, value, tone = 'gold' }) {
  const color = tone === 'rise' ? 'var(--rise)' : tone === 'fall' ? 'var(--fall)' : 'var(--gold)'
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, marginTop: 8 }}>{value}</div>
    </Card>
  )
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#101522', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {payload.map(item => (
        <div key={item.dataKey} style={{ color: item.color, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {item.name}: {typeof item.value === 'number' ? formatPrice(item.value) : item.value}
        </div>
      ))}
    </div>
  )
}

export default function ResearchPage() {
  const [symbol, setSymbol] = useState('OGDC')
  const [strategy, setStrategy] = useState('ma_cross')
  const [lookback, setLookback] = useState(260)
  const [cash, setCash] = useState(100000)
  const [backtest, setBacktest] = useState(null)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestError, setBacktestError] = useState('')

  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsQuery, setNewsQuery] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const future = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(future)
  const [calendar, setCalendar] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  const runBacktest = async () => {
    const clean = symbol.toUpperCase().trim()
    if (!clean) return
    setBacktestLoading(true)
    setBacktestError('')
    try {
      const res = await fetch(`${API}/api/backtest/${clean}?strategy=${strategy}&lookback=${lookback}&cash=${cash}`)
      setBacktest(await readJson(res, 'Could not run backtest for this symbol and strategy.'))
    } catch (err) {
      setBacktestError('Could not run backtest for this symbol and strategy.')
    } finally {
      setBacktestLoading(false)
    }
  }

  const fetchNews = async () => {
    setNewsLoading(true)
    try {
      const res = await fetch(`${API}/api/news?limit=36`)
      if (res.ok) {
        const payload = await readJson(res, 'Could not load API data.')
        setNews(payload.data || [])
      }
    } finally {
      setNewsLoading(false)
    }
  }

  const fetchCalendar = async () => {
    setCalendarLoading(true)
    try {
      const res = await fetch(`${API}/api/calendar?from=${fromDate}&to=${toDate}`)
      if (res.ok) {
        const payload = await readJson(res, 'Could not load API data.')
        setCalendar(payload.data || [])
      }
    } finally {
      setCalendarLoading(false)
    }
  }

  useEffect(() => {
    runBacktest()
    fetchNews()
    fetchCalendar()
  }, [])

  const filteredNews = useMemo(() => {
    const text = newsQuery.trim().toUpperCase()
    return news.filter(item => (
      !text ||
      item.symbol?.toUpperCase().includes(text) ||
      item.company?.toUpperCase().includes(text) ||
      item.title?.toUpperCase().includes(text)
    ))
  }, [news, newsQuery])

  const equity = (backtest?.equity || []).map(item => ({
    ...item,
    label: formatDate(item.date),
  }))

  const returnTone = (backtest?.total_return_pct || 0) >= 0 ? 'rise' : 'fall'
  const upcoming = calendar.filter(item => item.date >= today)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18 }}>
        <Card style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(212,175,55,0.13), transparent 42%, rgba(167,139,250,0.08))' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}>Research Lab</div>
            <h1 style={{ fontSize: 31, marginTop: 10, letterSpacing: 0 }}>Backtests, News, and Calendar</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10, maxWidth: 760 }}>
              Test trading ideas, track official PSX announcements, and keep upcoming AGM/EOGM events in one place.
            </p>
          </div>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>News</div><strong style={{ color: 'var(--gold)', fontSize: 22 }}>{news.length}</strong></div>
            <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>Events</div><strong style={{ color: 'var(--rise)', fontSize: 22 }}>{upcoming.length}</strong></div>
            <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>Trades</div><strong style={{ color: 'var(--gold)', fontSize: 22 }}>{backtest?.trade_count ?? '-'}</strong></div>
          </div>
        </Card>
      </section>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={18} color="var(--gold)" />
            <h2 style={{ fontSize: 17 }}>Strategy Backtesting</h2>
          </div>
          <button onClick={runBacktest} disabled={backtestLoading} style={{ height: 36, borderRadius: 9, border: '1px solid rgba(212,175,55,0.32)', background: 'rgba(212,175,55,0.10)', color: 'var(--gold)', cursor: 'pointer', fontWeight: 800, padding: '0 14px' }}>
            <Play size={14} style={{ marginRight: 8, verticalAlign: -2 }} />
            {backtestLoading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Symbol</span>
            <input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px', outline: 'none', fontFamily: 'var(--font-mono)' }} />
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Strategy</span>
            <select value={strategy} onChange={event => setStrategy(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px' }}>
              <option value="ma_cross">MA10 / MA30 Cross</option>
              <option value="rsi">RSI Bounce</option>
              <option value="breakout">20-Day Breakout</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Lookback Days</span>
            <input type="number" value={lookback} onChange={event => setLookback(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Starting Cash</span>
            <input type="number" value={cash} onChange={event => setCash(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px', outline: 'none' }} />
          </label>
        </div>

        {backtestError && <div style={{ color: 'var(--fall)', marginBottom: 12 }}>{backtestError}</div>}

        {backtest && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
              <Metric label="Return" value={`${backtest.total_return_pct >= 0 ? '+' : ''}${backtest.total_return_pct}%`} tone={returnTone} />
              <Metric label="Buy & Hold" value={`${backtest.buy_hold_return_pct >= 0 ? '+' : ''}${backtest.buy_hold_return_pct}%`} tone={backtest.buy_hold_return_pct >= 0 ? 'rise' : 'fall'} />
              <Metric label="Final Value" value={`PKR ${formatPrice(backtest.final_value)}`} />
              <Metric label="Max Drawdown" value={`${backtest.max_drawdown_pct}%`} tone="fall" />
              <Metric label="Win Rate" value={`${backtest.win_rate_pct}%`} tone="rise" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
              <Card style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Equity Curve</div>
                <div style={{ height: 270 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equity}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip content={<TooltipBox />} />
                      <Line type="monotone" dataKey="value" name="Value" stroke="#d4af37" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card style={{ padding: 16 }}>
                <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Recent Trades</div>
                <div style={{ display: 'grid', gap: 8, maxHeight: 270, overflow: 'auto' }}>
                  {(backtest.trades || []).slice().reverse().map((trade, index) => (
                    <div key={`${trade.type}-${trade.date}-${index}`} style={{ padding: 10, borderRadius: 9, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}>
                      <div style={{ color: trade.type === 'BUY' ? 'var(--rise)' : 'var(--fall)', fontWeight: 800 }}>{trade.type} @ PKR {formatPrice(trade.price)}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{formatDate(trade.date)} | {trade.reason}</div>
                      {typeof trade.pnl_pct === 'number' && <div style={{ color: trade.pnl_pct >= 0 ? 'var(--rise)' : 'var(--fall)', fontSize: 12, marginTop: 3 }}>P/L {trade.pnl_pct}%</div>}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </Card>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.54fr) minmax(0, 0.46fr)', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Newspaper size={18} color="var(--gold)" />
              <h2 style={{ fontSize: 17 }}>News & Announcements</h2>
            </div>
            <button onClick={fetchNews} style={{ height: 32, borderRadius: 8, border: '1px solid rgba(212,175,55,0.32)', background: 'rgba(212,175,55,0.10)', color: 'var(--gold)', cursor: 'pointer' }}>
              <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: -2, animation: newsLoading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', padding: '0 10px', marginBottom: 14 }}>
            <Search size={15} color="var(--muted)" />
            <input value={newsQuery} onChange={event => setNewsQuery(event.target.value)} placeholder="Filter by symbol, company, title" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--text)' }} />
          </label>
          <div style={{ display: 'grid', gap: 10, maxHeight: 520, overflow: 'auto' }}>
            {filteredNews.map((item, index) => (
              <a key={`${item.symbol}-${index}`} href={item.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ color: 'var(--gold)' }}>{item.symbol || 'PSX'}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.time}</span>
                </div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{item.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>{item.company} {item.date ? `| ${item.date}` : ''}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Open PSX filing <ExternalLink size={12} style={{ verticalAlign: -2 }} /></div>
              </a>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} color="var(--gold)" />
              <h2 style={{ fontSize: 17 }}>Market Calendar</h2>
            </div>
            <button onClick={fetchCalendar} style={{ height: 32, borderRadius: 8, border: '1px solid rgba(212,175,55,0.32)', background: 'rgba(212,175,55,0.10)', color: 'var(--gold)', cursor: 'pointer' }}>
              <RefreshCw size={13} style={{ marginRight: 6, verticalAlign: -2, animation: calendarLoading ? 'spin 1s linear infinite' : 'none' }} />
              Load
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>From</span>
              <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} style={{ height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px' }} />
            </label>
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>To</span>
              <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} style={{ height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px' }} />
            </label>
          </div>
          <div style={{ display: 'grid', gap: 10, maxHeight: 560, overflow: 'auto' }}>
            {calendar.map(item => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '78px 1fr', gap: 12, padding: 12, borderRadius: 10, background: item.date >= today ? 'rgba(0,208,132,0.055)' : 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}>
                <div style={{ color: item.date >= today ? 'var(--rise)' : 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{item.date?.slice(5)}</div>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.symbol} | {item.type}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{item.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{item.time || 'TBA'} | {item.city || 'Location TBA'} | Period {item.period_end || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1120px) {
          section, div[style*="repeat(5"], div[style*="repeat(4"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

