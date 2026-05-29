import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Briefcase,
  Cpu,
  Flame,
  Gauge,
  Layers3,
  Radar,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const MOCK_STOCKS = [
  { symbol: 'OGDC', sector: 'Oil & Gas Exploration', ldcp: 316.7, current: 318.53, high: 319.9, low: 315.5, open: 317.7, change: 1.83, pchange: 0.58, volume: 3194694 },
  { symbol: 'LUCK', sector: 'Cement', ldcp: 407.89, current: 410.88, high: 412.25, low: 405.01, open: 410.01, change: 2.99, pchange: 0.73, volume: 3983677 },
  { symbol: 'TRG', sector: 'Technology', ldcp: 60.9, current: 61.22, high: 61.67, low: 60.1, open: 60.99, change: 0.32, pchange: 0.53, volume: 4128643 },
  { symbol: 'PSO', sector: 'Oil & Gas Marketing', ldcp: 348.7, current: 347.82, high: 350.59, low: 345.22, open: 348.05, change: -0.88, pchange: -0.25, volume: 1492267 },
  { symbol: 'HBL', sector: 'Banking', ldcp: 267.45, current: 268.68, high: 271.99, low: 266.2, open: 268.99, change: 1.23, pchange: 0.46, volume: 1260506 },
  { symbol: 'UBL', sector: 'Banking', ldcp: 382.07, current: 388.73, high: 389.9, low: 380, open: 384, change: 6.66, pchange: 1.74, volume: 938216 },
  { symbol: 'MLCF', sector: 'Cement', ldcp: 81.96, current: 83.56, high: 83.99, low: 80.61, open: 82.4, change: 1.6, pchange: 1.95, volume: 8917688 },
]

const sectorLabels = {
  '0801': 'Automobile Assembler', '0802': 'Automobile Parts', '0803': 'Cable & Electrical', '0804': 'Cement',
  '0805': 'Chemical', '0806': 'Closed-End Fund', '0807': 'Banking', '0808': 'Engineering', '0809': 'Fertilizer',
  '0810': 'Food & Personal Care', '0812': 'Insurance', '0813': 'Financial Services', '0816': 'Leather & Tanneries',
  '0818': 'Investment Companies', '0819': 'Leasing Companies', '0820': 'Oil & Gas Exploration',
  '0821': 'Oil & Gas Marketing', '0822': 'Paper & Board', '0823': 'Pharmaceuticals', '0824': 'Power Generation',
  '0825': 'Refinery', '0826': 'Sugar & Allied', '0827': 'Synthetic & Rayon', '0828': 'Technology',
  '0829': 'Textile Composite', '0830': 'Textile Spinning', '0831': 'Textile Weaving', '0832': 'Tobacco',
  '0833': 'Transport', '0834': 'Vanaspati & Allied', '0836': 'Real Estate', '0837': 'ETF', '0838': 'Miscellaneous',
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVolume(value) {
  const num = Number(value || 0)
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return num.toLocaleString()
}

function normalizeStock(stock) {
  const current = Number(stock.current || stock.ldcp || 0)
  const ldcp = Number(stock.ldcp || current || 0)
  const change = Number.isFinite(Number(stock.change)) ? Number(stock.change) : current - ldcp
  const pchange = Number.isFinite(Number(stock.pchange)) && Number(stock.pchange) !== 0 ? Number(stock.pchange) : (ldcp ? (change / ldcp) * 100 : 0)
  const isLive = stock.is_live !== false && current > 0 && (Number(stock.current || 0) > 0)
  return {
    ...stock,
    current,
    ldcp,
    open: Number(stock.open || ldcp || current),
    high: Number(stock.high || Math.max(current, ldcp)),
    low: Number(stock.low || Math.min(current, ldcp)),
    change,
    pchange,
    volume: Number(stock.volume || 0),
    sector: sectorLabels[String(stock.sector)] || stock.sector || 'Market',
    is_live: isLive,
    price_basis: stock.price_basis || (isLive ? 'Live market watch' : 'Previous close'),
  }
}

function Card({ children, style }) {
  return (
    <div className="premium-card" style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 10,
      boxShadow: 'var(--shadow)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Stat({ icon, label, value, sub, tone = 'gold' }) {
  const color = tone === 'rise' ? 'var(--rise)' : tone === 'fall' ? 'var(--fall)' : 'var(--gold)'
  return (
    <Card style={{ padding: 18, minHeight: 112 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
          <div style={{ color, fontFamily: 'var(--font-mono)', fontSize: 23, fontWeight: 800, marginTop: 9 }}>{value}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 7 }}>{sub}</div>
        </div>
        <div style={{ color, width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(212,175,55,0.09)' }}>{icon}</div>
      </div>
    </Card>
  )
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {payload.map(item => (
        <div key={item.dataKey} style={{ color: item.color, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {item.name}: {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
        </div>
      ))}
    </div>
  )
}

function RankList({ title, icon, stocks, tone, onSelect }) {
  const color = tone === 'rise' ? 'var(--rise)' : 'var(--fall)'
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color }}>{icon}</span>
        <h3 style={{ fontSize: 14 }}>{title}</h3>
      </div>
      {stocks.slice(0, 6).map((stock, index) => (
        <button key={stock.symbol} onClick={() => onSelect(stock)} style={{
          width: '100%', display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 10,
          padding: '9px 0', border: 0, borderBottom: '1px solid rgba(255,255,255,0.045)', background: 'transparent',
          color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
        }}>
          <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{index + 1}</span>
          <span>
            <strong style={{ fontSize: 13 }}>{stock.symbol}</strong>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>PKR {formatPrice(stock.current)}</div>
          </span>
          <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13 }}>{stock.pchange >= 0 ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
        </button>
      ))}
    </Card>
  )
}

function MarketPulseEngine({ market, topGainers, topLosers, volumeLeaders, mood, breadth, totalVolume, turnover, staleCount, lastUpdate, loading, onRefresh, onSelect }) {
  const leaders = volumeLeaders.slice(0, 8)
  const orbitStocks = [...topGainers.slice(0, 3), ...topLosers.slice(0, 3)].slice(0, 6)
  const maxVolume = Math.max(...leaders.map(stock => stock.volume), 1)
  const maxAbsChange = Math.max(...market.map(stock => Math.abs(stock.pchange || 0)), 1)
  const advancing = market.filter(stock => stock.change > 0).length
  const declining = market.filter(stock => stock.change < 0).length
  const flat = Math.max(market.length - advancing - declining, 0)
  const moodColor = mood === 'Bullish' ? 'var(--rise)' : mood === 'Bearish' ? 'var(--fall)' : 'var(--gold)'
  const breadthWidth = Math.max(4, Math.min(100, Math.abs(breadth)))
  const tape = [...topGainers.slice(0, 5), ...topLosers.slice(0, 5), ...leaders.slice(0, 5)]
  const breakout = [...market]
    .map(stock => {
      const range = Math.max((stock.high || stock.current) - (stock.low || stock.current), 0.01)
      return { ...stock, rangePosition: ((stock.current - stock.low) / range) * 100 }
    })
    .filter(stock => stock.rangePosition >= 80 && stock.pchange > 0)
    .sort((a, b) => (b.rangePosition + b.pchange * 8) - (a.rangePosition + a.pchange * 8))[0]
  const pressure = topLosers[0]
  const volumeKing = leaders[0]
  const stealth = leaders.find(stock => stock.pchange > 0.2) || topGainers[0]
  const anomalyCards = [
    { label: 'Breakout Lock', icon: <Target size={15} />, stock: breakout, fallback: 'No clean breakout', tone: 'rise', metric: breakout ? `${breakout.rangePosition.toFixed(0)}% range` : '--' },
    { label: 'Pressure Leak', icon: <AlertTriangle size={15} />, stock: pressure, fallback: 'No major pressure', tone: 'fall', metric: pressure ? `${pressure.pchange.toFixed(2)}%` : '--' },
    { label: 'Volume King', icon: <Flame size={15} />, stock: volumeKing, fallback: 'No volume leader', tone: 'gold', metric: volumeKing ? formatVolume(volumeKing.volume) : '--' },
    { label: 'Stealth Bid', icon: <Activity size={15} />, stock: stealth, fallback: 'No stealth bid', tone: 'blue', metric: stealth ? `${stealth.pchange >= 0 ? '+' : ''}${stealth.pchange.toFixed(2)}%` : '--' },
  ]
  const sectorRadar = [...market.reduce((map, stock) => {
    const row = map.get(stock.sector) || { sector: stock.sector, count: 0, change: 0, volume: 0 }
    row.count += 1
    row.change += stock.pchange
    row.volume += stock.volume
    map.set(stock.sector, row)
    return map
  }, new Map()).values()]
    .map(row => ({ ...row, avgChange: row.change / row.count }))
    .sort((a, b) => Math.abs(b.avgChange) - Math.abs(a.avgChange))
    .slice(0, 6)

  return (
    <Card style={{ padding: 0, overflow: 'hidden', position: 'relative', borderColor: 'rgba(212,175,55,0.2)' }}>
      <div className="pulse-shell">
        <div className="pulse-grid" />
        <div className="pulse-scan" />

        <div className="pulse-header">
          <div>
            <div className="pulse-kicker"><Radar size={15} /> PSX Market Pulse Engine</div>
            <h1 className="pulse-title">Live Intelligence Dashboard</h1>
            <div className="pulse-sub">
              {market.length} symbols tracked | {lastUpdate.toLocaleTimeString()}{staleCount ? ` | ${staleCount} previous-close rows` : ''}
            </div>
          </div>
          <button onClick={onRefresh} className="pulse-refresh">
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>

        <div className="pulse-layout">
          <div className="pulse-left">
            <div className="pulse-metric">
              <span>Market Mood</span>
              <strong style={{ color: moodColor }}>{mood}</strong>
              <div className="pulse-meter">
                <i style={{ width: `${breadthWidth}%`, background: moodColor, marginLeft: breadth < 0 ? `${100 - breadthWidth}%` : 0 }} />
              </div>
              <small>{breadth.toFixed(1)} breadth | {advancing} up / {declining} down / {flat} flat</small>
            </div>
            <div className="pulse-metric-grid">
              <div><span>Volume</span><strong>{formatVolume(totalVolume)}</strong></div>
              <div><span>Turnover</span><strong>{formatVolume(turnover)}</strong></div>
              <div><span>Shock Range</span><strong>{maxAbsChange.toFixed(2)}%</strong></div>
              <div><span>Leaders</span><strong>{leaders.length}</strong></div>
            </div>
          </div>

          <div className="pulse-core-wrap">
            <div className="pulse-core">
              <div className="pulse-ring ring-a" />
              <div className="pulse-ring ring-b" />
              <div className="pulse-ring ring-c" />
              <div className="pulse-core-center">
                <Cpu size={28} />
                <strong>{mood}</strong>
                <span>{Math.abs(breadth).toFixed(1)} signal</span>
              </div>
              {orbitStocks.map((stock, index) => {
                const angle = (index / Math.max(orbitStocks.length, 1)) * 360
                const positive = stock.pchange >= 0
                return (
                  <button
                    key={`${stock.symbol}-${index}`}
                    onClick={() => onSelect(stock)}
                    className="pulse-orbit-node"
                    style={{
                      '--angle': `${angle}deg`,
                      '--node-color': positive ? 'var(--rise)' : 'var(--fall)',
                      '--delay': `${index * -0.7}s`,
                    }}
                  >
                    <span>{stock.symbol}</span>
                    <b>{positive ? '+' : ''}{stock.pchange.toFixed(1)}%</b>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pulse-right">
            <div className="pulse-panel-title"><Zap size={15} /> Volume Shockwave</div>
            <div className="shock-bars">
              {leaders.map(stock => {
                const positive = stock.pchange >= 0
                return (
                  <button key={stock.symbol} onClick={() => onSelect(stock)} className="shock-row">
                    <span>{stock.symbol}</span>
                    <i style={{
                      width: `${Math.max(8, (stock.volume / maxVolume) * 100)}%`,
                      background: positive ? 'linear-gradient(90deg, rgba(0,208,132,0.1), rgba(0,208,132,0.9))' : 'linear-gradient(90deg, rgba(255,71,87,0.1), rgba(255,71,87,0.9))',
                    }} />
                    <b style={{ color: positive ? 'var(--rise)' : 'var(--fall)' }}>{formatVolume(stock.volume)}</b>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="signal-command">
          <div className="signal-cards">
            {anomalyCards.map(card => {
              const color = card.tone === 'rise' ? 'var(--rise)' : card.tone === 'fall' ? 'var(--fall)' : card.tone === 'blue' ? '#38bdf8' : 'var(--gold)'
              return (
                <button
                  key={card.label}
                  onClick={() => card.stock && onSelect(card.stock)}
                  className="signal-card"
                  style={{ '--signal-color': color }}
                >
                  <span>{card.icon}{card.label}</span>
                  <strong>{card.stock?.symbol || card.fallback}</strong>
                  <b>{card.metric}</b>
                </button>
              )
            })}
          </div>

          <div className="sector-constellation">
            <div className="pulse-panel-title"><Layers3 size={15} /> Sector Constellation</div>
            <div className="sector-stars">
              {sectorRadar.map((sector, index) => {
                const positive = sector.avgChange >= 0
                const intensity = Math.min(Math.abs(sector.avgChange) / Math.max(maxAbsChange, 1), 1)
                return (
                  <div
                    key={sector.sector}
                    className="sector-star"
                    style={{
                      '--star-color': positive ? 'var(--rise)' : 'var(--fall)',
                      '--star-size': `${34 + intensity * 36}px`,
                      '--star-delay': `${index * -0.35}s`,
                    }}
                    title={`${sector.sector}: ${sector.avgChange.toFixed(2)}%`}
                  >
                    <span>{sector.sector.slice(0, 3).toUpperCase()}</span>
                    <b>{sector.avgChange >= 0 ? '+' : ''}{sector.avgChange.toFixed(1)}%</b>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="pulse-tape" aria-label="Market ticker">
          <div>
            {[...tape, ...tape].map((stock, index) => (
              <button key={`${stock.symbol}-${index}`} onClick={() => onSelect(stock)}>
                <strong>{stock.symbol}</strong>
                <span style={{ color: stock.pchange >= 0 ? 'var(--rise)' : 'var(--fall)' }}>{stock.pchange >= 0 ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
                <em>PKR {formatPrice(stock.current)}</em>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function CandleStrip({ stock }) {
  const high = Math.max(stock.high, stock.current, stock.open)
  const low = Math.min(stock.low, stock.current, stock.open)
  const range = Math.max(high - low, 0.01)
  const top = ((high - Math.max(stock.open, stock.current)) / range) * 100
  const bottom = ((Math.min(stock.open, stock.current) - low) / range) * 100
  const positive = stock.current >= stock.open
  return (
    <div style={{ height: 86, display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: 38, height: 72 }}>
        <div style={{ position: 'absolute', left: 18, top: 0, bottom: 0, width: 2, background: positive ? 'rgba(0,208,132,0.6)' : 'rgba(255,71,87,0.6)' }} />
        <div style={{
          position: 'absolute', left: 8, right: 8, top: `${top}%`, bottom: `${bottom}%`, minHeight: 8,
          borderRadius: 4, background: positive ? 'rgba(0,208,132,0.78)' : 'rgba(255,71,87,0.78)',
          border: positive ? '1px solid rgba(0,208,132,0.95)' : '1px solid rgba(255,71,87,0.95)',
        }} />
      </div>
    </div>
  )
}

function movingAverage(rows, window) {
  return rows.map((row, index) => {
    if (index + 1 < window) return null
    const slice = rows.slice(index + 1 - window, index + 1)
    return slice.reduce((sum, item) => sum + item.close, 0) / window
  })
}

function calculateRsi(rows, period = 14) {
  return rows.map((row, index) => {
    if (index < period) return 50
    let gains = 0
    let losses = 0
    for (let i = index - period + 1; i <= index; i += 1) {
      const change = rows[i].close - rows[i - 1].close
      if (change >= 0) gains += change
      else losses += Math.abs(change)
    }
    if (losses === 0) return gains > 0 ? 100 : 50
    const rs = gains / losses
    return 100 - (100 / (1 + rs))
  })
}

function formatDateLabel(value) {
  const seconds = Number(value || 0)
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function CandlestickChart({ rows, liveStock }) {
  const [range, setRange] = useState(60)
  const [hovered, setHovered] = useState(null)
  const width = 880
  const candleHeight = 260
  const volumeHeight = 72
  const rsiHeight = 86
  const pad = { left: 54, right: 22, top: 18, bottom: 20 }

  const chartRows = useMemo(() => {
    const normalized = rows
      .filter(row => Number(row.close) > 0)
      .map((row, index) => {
        const open = Number(row.open || row.previous || row.close)
        const close = Number(row.close)
        const bodyHigh = Math.max(open, close)
        const bodyLow = Math.min(open, close)
        const syntheticRange = Math.max(close * 0.004, Math.abs(close - open) * 0.45)
        return {
          ...row,
          label: formatDateLabel(row.time),
          open,
          close,
          high: Number(row.high || bodyHigh + syntheticRange),
          low: Number(row.low || bodyLow - syntheticRange),
          volume: Number(row.volume || 0),
          index,
        }
      })

    if (liveStock) {
      normalized.push({
        time: Date.now() / 1000,
        label: 'Live',
        open: liveStock.open,
        close: liveStock.current,
        high: liveStock.high,
        low: liveStock.low,
        volume: liveStock.volume,
        index: normalized.length,
      })
    }
    return normalized.slice(-range)
  }, [liveStock, range, rows])

  const ma7 = movingAverage(chartRows, 7)
  const ma20 = movingAverage(chartRows, 20)
  const rsi = calculateRsi(chartRows, 14)
  const values = chartRows.flatMap(row => [row.high, row.low]).filter(Number.isFinite)
  const minPrice = Math.min(...values)
  const maxPrice = Math.max(...values)
  const priceRange = Math.max(maxPrice - minPrice, 0.01)
  const maxVolume = Math.max(...chartRows.map(row => row.volume), 1)
  const innerWidth = width - pad.left - pad.right
  const candleSlot = innerWidth / Math.max(chartRows.length, 1)
  const candleWidth = Math.max(4, Math.min(13, candleSlot * 0.58))

  const xFor = index => pad.left + index * candleSlot + candleSlot / 2
  const yFor = price => pad.top + ((maxPrice - price) / priceRange) * (candleHeight - pad.top - pad.bottom)
  const rsiY = value => 20 + ((100 - value) / 100) * (rsiHeight - 34)

  const pathFor = series => series
    .map((value, index) => value == null ? null : `${index === 0 || series[index - 1] == null ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`)
    .filter(Boolean)
    .join(' ')

  const rsiPath = rsi.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${rsiY(value).toFixed(1)}`).join(' ')
  const active = hovered == null ? chartRows[chartRows.length - 1] : chartRows[hovered]

  if (!chartRows.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>No history loaded yet.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Interactive Candlestick</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 5 }}>
            {active?.label} O {formatPrice(active?.open)} H {formatPrice(active?.high)} L {formatPrice(active?.low)} C {formatPrice(active?.close)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[30, 60, 120, 240].map(option => (
            <button key={option} onClick={() => setRange(option)} style={{
              height: 30,
              minWidth: 42,
              borderRadius: 8,
              border: range === option ? '1px solid rgba(212,175,55,0.55)' : '1px solid rgba(255,255,255,0.09)',
              background: range === option ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.025)',
              color: range === option ? 'var(--gold)' : 'var(--muted)',
              cursor: 'pointer',
              fontWeight: 800,
            }}>{option}</button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${candleHeight + volumeHeight + rsiHeight + 24}`} style={{ width: '100%', minWidth: 720, display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(step => {
            const y = pad.top + step * (candleHeight - pad.top - pad.bottom)
            const price = maxPrice - step * priceRange
            return (
              <g key={step}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
                <text x={10} y={y + 4} fill="#6b7280" fontSize="11" fontFamily="monospace">{formatPrice(price)}</text>
              </g>
            )
          })}

          {chartRows.map((row, index) => {
            const x = xFor(index)
            const positive = row.close >= row.open
            const top = yFor(Math.max(row.open, row.close))
            const bottom = yFor(Math.min(row.open, row.close))
            const bodyHeight = Math.max(bottom - top, 2)
            return (
              <g key={`${row.time}-${index}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)}>
                <rect x={x - candleSlot / 2} y={0} width={candleSlot} height={candleHeight + volumeHeight + rsiHeight} fill="transparent" />
                <line x1={x} x2={x} y1={yFor(row.high)} y2={yFor(row.low)} stroke={positive ? '#00d084' : '#ff4757'} strokeWidth="1.5" />
                <rect x={x - candleWidth / 2} y={top} width={candleWidth} height={bodyHeight} rx="2" fill={positive ? '#00d084' : '#ff4757'} opacity="0.82" />
                {index % Math.ceil(chartRows.length / 8) === 0 && <text x={x} y={candleHeight - 3} fill="#6b7280" fontSize="10" textAnchor="middle">{row.label}</text>}
              </g>
            )
          })}

          <path d={pathFor(ma7)} fill="none" stroke="#d4af37" strokeWidth="1.7" />
          <path d={pathFor(ma20)} fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.86" />
          <text x={pad.left} y={14} fill="#d4af37" fontSize="11">MA7</text>
          <text x={pad.left + 42} y={14} fill="#38bdf8" fontSize="11">MA20</text>

          <g transform={`translate(0 ${candleHeight})`}>
            <text x={10} y={16} fill="#6b7280" fontSize="11">Volume</text>
            {chartRows.map((row, index) => {
              const x = xFor(index)
              const barHeight = (row.volume / maxVolume) * (volumeHeight - 22)
              const positive = row.close >= row.open
              return <rect key={`v-${row.time}-${index}`} x={x - candleWidth / 2} y={volumeHeight - barHeight - 6} width={candleWidth} height={barHeight} rx="2" fill={positive ? '#00d084' : '#ff4757'} opacity="0.42" />
            })}
          </g>

          <g transform={`translate(0 ${candleHeight + volumeHeight + 8})`}>
            <text x={10} y={18} fill="#6b7280" fontSize="11">RSI</text>
            {[30, 70].map(level => <line key={level} x1={pad.left} x2={width - pad.right} y1={rsiY(level)} y2={rsiY(level)} stroke="rgba(212,175,55,0.20)" strokeDasharray="5 5" />)}
            <path d={rsiPath} fill="none" stroke="#a78bfa" strokeWidth="1.8" />
            <text x={width - pad.right - 28} y={rsiY(70) - 4} fill="#6b7280" fontSize="10">70</text>
            <text x={width - pad.right - 28} y={rsiY(30) - 4} fill="#6b7280" fontSize="10">30</text>
          </g>
        </svg>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.5, marginTop: 10 }}>
        Historical PSX rows provide open, close, and volume. Intraday high/low is shown for the live candle when available.
      </div>
    </div>
  )
}

function StockModal({ stock, forecast, history, onClose, isWatched, onToggleWatch }) {
  if (!stock) return null
  const positive = stock.change >= 0
  return (
    <div className="stock-drawer-overlay" onClick={onClose}>
      <div className="stock-drawer" onClick={event => event.stopPropagation()}>
        <div style={{ padding: 22, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 14, position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface-solid)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12 }}>
              <span>{stock.sector}</span>
              <span className={`ui-badge ${positive ? 'rise' : 'fall'}`}>{positive ? 'Moving up' : 'Under pressure'}</span>
              {stock.is_live === false && <span className="ui-badge gold">Prev close</span>}
            </div>
            <h2 style={{ fontSize: 28, marginTop: 4 }}>{stock.symbol}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onToggleWatch} title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: isWatched ? 'rgba(212,175,55,0.15)' : 'var(--surface-soft)', color: 'var(--gold)', cursor: 'pointer' }}>
              <Star size={18} fill={isWatched ? 'currentColor' : 'none'} />
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-soft)', color: 'var(--text)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="drawer-grid" style={{ padding: 22 }}>
          <Card style={{ padding: 18, background: positive ? 'rgba(0,208,132,0.06)' : 'rgba(255,71,87,0.06)' }}>
            <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Current Price</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, marginTop: 8 }}>PKR {formatPrice(stock.current)}</div>
            <div style={{ color: positive ? 'var(--rise)' : 'var(--fall)', fontFamily: 'var(--font-mono)', fontWeight: 800, marginTop: 8 }}>
              {positive ? '+' : ''}{stock.change.toFixed(2)} ({positive ? '+' : ''}{stock.pchange.toFixed(2)}%)
            </div>
            <CandleStrip stock={stock} />
            <div style={{ display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
              <span>Open PKR {formatPrice(stock.open)}</span>
              <span>High PKR {formatPrice(stock.high)}</span>
              <span>Low PKR {formatPrice(stock.low)}</span>
              <span>Volume {formatVolume(stock.volume)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-soft)', border: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--muted)', fontSize: 10 }}>Support</div>
                <strong style={{ color: 'var(--rise)', fontFamily: 'var(--font-mono)' }}>PKR {formatPrice(forecast?.support || stock.low)}</strong>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface-soft)', border: '1px solid var(--line)' }}>
                <div style={{ color: 'var(--muted)', fontSize: 10 }}>Resistance</div>
                <strong style={{ color: 'var(--fall)', fontFamily: 'var(--font-mono)' }}>PKR {formatPrice(forecast?.resistance || stock.high)}</strong>
              </div>
            </div>
          </Card>
          <div style={{ display: 'grid', gap: 16 }}>
            <Card style={{ padding: 16 }}>
              <CandlestickChart rows={history} liveStock={stock} />
            </Card>
            <Card style={{ padding: 16 }}>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>AI Snapshot</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                <div className="ui-badge gold">Target {forecast?.target_price ? `PKR ${formatPrice(forecast.target_price)}` : 'Loading'}</div>
                <div className={`ui-badge ${forecast?.trend === 'DOWN' ? 'fall' : 'rise'}`}>{forecast?.rating || 'Signal pending'}</div>
                <div className="ui-badge">{forecast?.confidence ? `${forecast.confidence}% confidence` : stock.price_basis}</div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(forecast?.explanation || ['Open a forecast to load explanation signals.']).map(item => (
                  <div key={item} style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', gap: 8 }}>
                    <Target size={14} color="var(--gold)" /> {item}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ searchRequest }) {
  const [stocks, setStocks] = useState(MOCK_STOCKS.map(normalizeStock))
  const [gainers, setGainers] = useState([])
  const [losers, setLosers] = useState([])
  const [brief, setBrief] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('volume')
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [selected, setSelected] = useState(null)
  const [selectedHistory, setSelectedHistory] = useState([])
  const [selectedForecast, setSelectedForecast] = useState(null)
  const [compare, setCompare] = useState(['OGDCXD', 'LUCK', 'HBL'])
  const [alerts, setAlerts] = useState([{ symbol: 'OGDCXD', type: 'above', price: 320 }, { symbol: 'TRG', type: 'below', price: 60 }])
  const [portfolio, setPortfolio] = useState([{ symbol: 'HBL', qty: 100, avg: 260 }, { symbol: 'LUCK', qty: 20, avg: 398 }])
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('psx-watchlist') || '[]')
      return Array.isArray(saved) && saved.length ? saved : ['OGDC', 'HBL', 'LUCK']
    } catch {
      return ['OGDC', 'HBL', 'LUCK']
    }
  })

  useEffect(() => {
    localStorage.setItem('psx-watchlist', JSON.stringify(watchlist))
  }, [watchlist])

  const fetchMarket = async () => {
    setLoading(true)
    try {
      const [marketRes, gainersRes, losersRes, briefRes] = await Promise.all([
        fetch(`${API}/api/market`),
        fetch(`${API}/api/gainers`),
        fetch(`${API}/api/losers`),
        fetch(`${API}/api/brief`),
      ])
      if (marketRes.ok) {
        const data = await readJson(marketRes, 'Could not load market data.')
        const list = Array.isArray(data) ? data : data?.data
        if (list?.length) setStocks(list.map(normalizeStock))
      }
      if (gainersRes.ok) setGainers((await readJson(gainersRes, 'Could not load gainers.')).map(normalizeStock))
      if (losersRes.ok) setLosers((await readJson(losersRes, 'Could not load losers.')).map(normalizeStock))
      if (briefRes.ok) setBrief(await readJson(briefRes, 'Could not load market brief.'))
    } catch {
      const fallback = MOCK_STOCKS.map(normalizeStock)
      setStocks(fallback)
    } finally {
      setLoading(false)
      setLastUpdate(new Date())
    }
  }

  useEffect(() => { fetchMarket() }, [])

  const market = useMemo(() => stocks.map(normalizeStock), [stocks])
  const topGainers = gainers.length ? gainers : market.filter(s => s.pchange > 0).sort((a, b) => b.pchange - a.pchange)
  const topLosers = losers.length ? losers : market.filter(s => s.pchange < 0).sort((a, b) => a.pchange - b.pchange)
  const volumeLeaders = [...market].sort((a, b) => b.volume - a.volume).slice(0, 10)
  const advancing = market.filter(s => s.change > 0).length
  const declining = market.filter(s => s.change < 0).length
  const active = market.filter(s => s.volume > 0)
  const staleCount = market.filter(s => s.current > 0 && s.is_live === false).length
  const totalVolume = active.reduce((sum, stock) => sum + stock.volume, 0)
  const turnover = active.reduce((sum, stock) => sum + stock.volume * stock.current, 0)
  const breadth = market.length ? ((advancing - declining) / market.length) * 100 : 0
  const mood = breadth > 12 ? 'Bullish' : breadth < -12 ? 'Bearish' : 'Mixed'

  const sectorHeat = useMemo(() => {
    const buckets = new Map()
    market.forEach(stock => {
      const item = buckets.get(stock.sector) || { sector: stock.sector, count: 0, change: 0, volume: 0 }
      item.count += 1
      item.change += stock.pchange
      item.volume += stock.volume
      buckets.set(stock.sector, item)
    })
    return [...buckets.values()].map(item => ({ ...item, avgChange: item.change / item.count })).sort((a, b) => b.volume - a.volume).slice(0, 12)
  }, [market])

  const filtered = useMemo(() => {
    const text = query.trim().toUpperCase()
    return market
      .filter(stock => !text || stock.symbol.includes(text) || stock.sector.toUpperCase().includes(text))
      .filter(stock => filter === 'gainers' ? stock.change > 0 : filter === 'losers' ? stock.change < 0 : true)
      .sort((a, b) => sortBy === 'symbol' ? a.symbol.localeCompare(b.symbol) : Number(b[sortBy] || 0) - Number(a[sortBy] || 0))
      .slice(0, 32)
  }, [filter, market, query, sortBy])

  const chartData = volumeLeaders.map(stock => ({
    symbol: stock.symbol,
    volume: Number((stock.volume / 1e6).toFixed(2)),
    price: stock.current,
    change: stock.pchange,
  })).reverse()

  const compareRows = compare.map(symbol => market.find(stock => stock.symbol === symbol)).filter(Boolean)
  const alertRows = alerts.map(alert => {
    const stock = market.find(item => item.symbol === alert.symbol)
    const triggered = stock ? (alert.type === 'above' ? stock.current >= alert.price : stock.current <= alert.price) : false
    return { ...alert, stock, triggered }
  })
  const portfolioRows = portfolio.map(row => {
    const stock = market.find(item => item.symbol === row.symbol)
    const current = stock?.current || row.avg
    const value = current * row.qty
    const cost = row.avg * row.qty
    return { ...row, stock, current, value, pnl: value - cost, pnlPct: cost ? ((value - cost) / cost) * 100 : 0 }
  })
  const portfolioValue = portfolioRows.reduce((sum, row) => sum + row.value, 0)
  const portfolioPnl = portfolioRows.reduce((sum, row) => sum + row.pnl, 0)
  const watchlistRows = watchlist
    .map(symbol => market.find(stock => stock.symbol === symbol || stock.symbol.replace(/XD$|NC$/g, '') === symbol))
    .filter(Boolean)

  const toggleWatch = (symbol) => {
    const clean = String(symbol || '').replace(/XD$|NC$/g, '')
    setWatchlist(prev => prev.includes(clean) ? prev.filter(item => item !== clean) : [clean, ...prev].slice(0, 12))
  }

  const openStock = async (stock) => {
    setSelected(stock)
    setSelectedForecast(null)
    setSelectedHistory([])
    const cleanSymbol = stock.symbol.replace(/XD$|NC$/g, '')
    try {
      const [historyRes, forecastRes] = await Promise.all([
        fetch(`${API}/api/history/${cleanSymbol}`),
        fetch(`${API}/api/predict/${cleanSymbol}`),
      ])
      if (historyRes.ok) {
        const payload = await readJson(historyRes, 'Could not load price history.')
        const rows = Array.isArray(payload.data?.data) ? payload.data.data : []
        setSelectedHistory(rows.map(row => ({
          time: row[0],
          close: Number(row[1]),
          volume: Number(row[2] || 0),
          open: Number(row[3] || row[1]),
        })).reverse())
      }
      if (forecastRes.ok) setSelectedForecast(await readJson(forecastRes, 'Could not load forecast.'))
    } catch {
      setSelectedHistory([])
    }
  }

  const openSymbolSearch = (value) => {
    const clean = String(value || '').trim().toUpperCase()
    if (!clean) return
    setQuery(clean)
    setFilter('all')

    const stripped = clean.replace(/XD$|NC$/g, '')
    const match = market.find(stock => {
      const symbol = stock.symbol.toUpperCase()
      const base = symbol.replace(/XD$|NC$/g, '')
      return symbol === clean || base === stripped || symbol.startsWith(clean) || base.startsWith(stripped)
    })

    if (match) openStock(match)
  }

  useEffect(() => {
    if (searchRequest?.text) openSymbolSearch(searchRequest.text)
  }, [searchRequest?.id])

  const addCompare = (symbol) => {
    if (!symbol || compare.includes(symbol)) return
    setCompare([...compare.slice(-3), symbol])
  }

  const addAlert = () => {
    const first = filtered[0]
    if (!first) return
    setAlerts([...alerts, { symbol: first.symbol, type: 'above', price: Number((first.current * 1.02).toFixed(2)) }])
  }

  const addPortfolioRow = () => {
    const first = filtered[0]
    if (!first) return
    setPortfolio([...portfolio, { symbol: first.symbol, qty: 10, avg: first.current }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <MarketPulseEngine
        market={market}
        topGainers={topGainers}
        topLosers={topLosers}
        volumeLeaders={volumeLeaders}
        mood={mood}
        breadth={breadth}
        totalVolume={totalVolume}
        turnover={turnover}
        staleCount={staleCount}
        lastUpdate={lastUpdate}
        loading={loading}
        onRefresh={fetchMarket}
        onSelect={openStock}
      />

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.65fr)', gap: 18 }}>
        <Card style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(212,175,55,0.13), transparent 40%, rgba(0,208,132,0.08))' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}>PSX Intelligence Center</div>
              <h1 style={{ fontSize: 32, marginTop: 10, letterSpacing: 0 }}>Market Dashboard</h1>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
                {market.length} symbols tracked | refreshed {lastUpdate.toLocaleTimeString()}{staleCount ? ` | ${staleCount} using previous close` : ''}
              </div>
            </div>
            <button onClick={fetchMarket} style={{ height: 38, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 9, border: '1px solid rgba(212,175,55,0.32)', background: 'rgba(212,175,55,0.10)', color: 'var(--gold)', padding: '0 14px', cursor: 'pointer', fontWeight: 800 }}>
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Bot size={20} color="var(--gold)" />
            <h2 style={{ fontSize: 16 }}>AI Market Brief</h2>
          </div>
          <p style={{ color: 'var(--muted)', lineHeight: 1.55, fontSize: 13 }}>{brief?.summary || 'Loading market brief from live movers, breadth, and volume leaders.'}</p>
          <div style={{ marginTop: 14, color: mood === 'Bullish' ? 'var(--rise)' : mood === 'Bearish' ? 'var(--fall)' : 'var(--gold)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
            Mood: {brief?.mood || mood}
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14 }}>
        <Stat icon={<Gauge size={18} />} label="Sentiment" value={mood} sub={`${breadth.toFixed(1)} breadth`} tone={breadth >= 0 ? 'rise' : 'fall'} />
        <Stat icon={<Activity size={18} />} label="Active" value={active.length.toLocaleString()} sub="Traded symbols" />
        <Stat icon={<Wallet size={18} />} label="Volume" value={formatVolume(totalVolume)} sub="Shares traded" />
        <Stat icon={<Flame size={18} />} label="Turnover" value={`${formatVolume(turnover)} PKR`} sub="Estimated value" />
        <Stat icon={<Briefcase size={18} />} label="Portfolio P/L" value={`${portfolioPnl >= 0 ? '+' : ''}${formatPrice(portfolioPnl)}`} sub={`Value ${formatPrice(portfolioValue)}`} tone={portfolioPnl >= 0 ? 'rise' : 'fall'} />
      </section>

      <Card style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={18} color="var(--gold)" fill="var(--gold)" />
            <h2 style={{ fontSize: 17 }}>My Watchlist</h2>
          </div>
          <span className="ui-badge gold">{watchlistRows.length} tracked</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          {watchlistRows.map(stock => {
            const positive = stock.pchange >= 0
            return (
              <button key={stock.symbol} onClick={() => openStock(stock)} style={{ minHeight: 82, display: 'grid', gap: 8, alignContent: 'center', textAlign: 'left', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface-soft)', color: 'var(--text)', padding: 12, cursor: 'pointer' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{stock.symbol}</strong>
                  <span className={`ui-badge ${positive ? 'rise' : 'fall'}`}>{positive ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>PKR {formatPrice(stock.current)} | {formatVolume(stock.volume)}</span>
              </button>
            )
          })}
          {!watchlistRows.length && (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Open any stock and tap the star to add it here.</div>
          )}
        </div>
      </Card>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 17 }}>Market Watch</h2>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Click any symbol for details</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <form onSubmit={event => {
                event.preventDefault()
                openSymbolSearch(query)
              }} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, minWidth: 220, border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, padding: '0 10px', background: 'rgba(255,255,255,0.025)' }}>
                <button type="submit" aria-label="Open symbol search" style={{ display: 'grid', placeItems: 'center', border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>
                  <Search size={15} />
                </button>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search symbol or sector" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--text)' }} />
              </form>
              <select value={sortBy} onChange={event => setSortBy(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--input-bg)', color: 'var(--text)', padding: '0 10px' }}>
                <option value="volume">Volume</option><option value="pchange">% Change</option><option value="current">Price</option><option value="symbol">Symbol</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {['all', 'gainers', 'losers'].map(option => (
              <button key={option} onClick={() => setFilter(option)} style={{ height: 32, borderRadius: 8, padding: '0 12px', border: filter === option ? '1px solid rgba(212,175,55,0.55)' : '1px solid var(--line)', color: filter === option ? 'var(--gold)' : 'var(--muted)', background: filter === option ? 'rgba(212,175,55,0.10)' : 'var(--surface-soft)', cursor: 'pointer', fontWeight: 800, textTransform: 'capitalize' }}>{option}</button>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 850 }}>
              <div className="sticky-table-head" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.8fr 0.8fr 1fr 0.9fr 1fr', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-soft)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800 }}>
                <span>Symbol</span><span>Price</span><span>Change</span><span>%</span><span>Volume</span><span>Candle</span><span>Sector</span>
              </div>
              {loading && Array.from({ length: 4 }).map((_, index) => (
                <div key={`sk-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.8fr 0.8fr 1fr 0.9fr 1fr', gap: 12, alignItems: 'center', padding: '14px 12px' }}>
                  {Array.from({ length: 7 }).map((__, cell) => <span key={cell} className="skeleton" style={{ height: cell === 5 ? 54 : 18 }} />)}
                </div>
              ))}
              {filtered.map(stock => {
                const positive = stock.change >= 0
                return (
                  <button className="market-row" key={stock.symbol} onClick={() => openStock(stock)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.8fr 0.8fr 1fr 0.9fr 1fr', gap: 12, alignItems: 'center', padding: '11px 12px', border: 0, borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', color: positive ? 'var(--rise)' : 'var(--fall)', background: positive ? 'rgba(0,208,132,0.10)' : 'rgba(255,71,87,0.10)' }}>{positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}</span>
                      <span>
                        <strong>{stock.symbol}</strong>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 3 }}>
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>LDCP {formatPrice(stock.ldcp)}</span>
                          {watchlist.includes(stock.symbol.replace(/XD$|NC$/g, '')) && <Star size={11} color="var(--gold)" fill="var(--gold)" />}
                        </div>
                      </span>
                    </span>
                    <span>
                      <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>PKR {formatPrice(stock.current)}</span>
                      {stock.is_live === false && <span className="ui-badge gold">Prev close</span>}
                    </span>
                    <span style={{ color: positive ? 'var(--rise)' : 'var(--fall)', fontFamily: 'var(--font-mono)' }}>{positive ? '+' : ''}{stock.change.toFixed(2)}</span>
                    <span style={{ color: positive ? 'var(--rise)' : 'var(--fall)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{positive ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
                    <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{formatVolume(stock.volume)}</span>
                    <CandleStrip stock={stock} />
                    <span style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {stock.sector}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <RankList title="Top Gainers" icon={<TrendingUp size={16} />} stocks={topGainers} tone="rise" onSelect={openStock} />
          <RankList title="Top Losers" icon={<TrendingDown size={16} />} stocks={topLosers} tone="fall" onSelect={openStock} />
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 370px', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><BarChart3 size={18} color="var(--gold)" /><h2 style={{ fontSize: 17 }}>Volume Leaders</h2></div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="symbol" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipBox />} />
                <Bar dataKey="volume" name="Volume (M)" radius={[6, 6, 0, 0]}>{chartData.map(item => <Cell key={item.symbol} fill={item.change >= 0 ? '#00d084' : '#ff4757'} fillOpacity={0.72} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><SlidersHorizontal size={18} color="var(--gold)" /><h2 style={{ fontSize: 17 }}>Compare Stocks</h2></div>
            <select onChange={event => addCompare(event.target.value)} value="" style={{ maxWidth: 120, height: 32, borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--line)' }}>
              <option value="">Add</option>{market.slice(0, 80).map(stock => <option key={stock.symbol} value={stock.symbol}>{stock.symbol}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {compareRows.map(stock => (
              <div key={stock.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
                <strong>{stock.symbol}</strong>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{formatVolume(stock.volume)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: stock.pchange >= 0 ? 'var(--rise)' : 'var(--fall)', fontWeight: 800 }}>{stock.pchange >= 0 ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.58fr) minmax(0, 0.42fr)', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Layers3 size={18} color="var(--gold)" /><h2 style={{ fontSize: 17 }}>Sector Performance</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {sectorHeat.map(item => {
              const positive = item.avgChange >= 0
              const intensity = Math.min(Math.abs(item.avgChange) / 6, 1)
              return (
                <div key={item.sector} style={{ minHeight: 78, borderRadius: 10, padding: 12, background: positive ? `rgba(0,208,132,${0.08 + intensity * 0.18})` : `rgba(255,71,87,${0.08 + intensity * 0.18})`, border: positive ? '1px solid rgba(0,208,132,0.16)' : '1px solid rgba(255,71,87,0.16)' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sector}</div>
                  <div style={{ color: positive ? 'var(--rise)' : 'var(--fall)', fontFamily: 'var(--font-mono)', fontWeight: 800, marginTop: 8 }}>{item.avgChange >= 0 ? '+' : ''}{item.avgChange.toFixed(2)}%</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>{item.count} symbols | {formatVolume(item.volume)}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <h2 style={{ fontSize: 17, marginBottom: 16 }}>Price Pulse</h2>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="symbol" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<TooltipBox />} />
                <Line type="monotone" dataKey="price" name="Price" stroke="#d4af37" strokeWidth={2} dot={{ r: 3, fill: '#d4af37' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.48fr) minmax(0, 0.52fr)', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} color="var(--gold)" /><h2 style={{ fontSize: 17 }}>Smart Alerts</h2></div>
            <button onClick={addAlert} style={{ height: 30, borderRadius: 8, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {alertRows.map((alert, index) => (
              <div key={`${alert.symbol}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: 10, borderRadius: 9, background: alert.triggered ? 'rgba(0,208,132,0.08)' : 'rgba(255,255,255,0.025)', border: alert.triggered ? '1px solid rgba(0,208,132,0.18)' : '1px solid rgba(255,255,255,0.06)' }}>
                <span><strong>{alert.symbol}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>Price {alert.type} PKR {formatPrice(alert.price)}</div></span>
                <span style={{ color: alert.triggered ? 'var(--rise)' : 'var(--muted)', fontWeight: 800 }}>{alert.triggered ? 'Triggered' : 'Watching'}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Briefcase size={18} color="var(--gold)" /><h2 style={{ fontSize: 17 }}>Portfolio Tracker</h2></div>
            <button onClick={addPortfolioRow} style={{ height: 30, borderRadius: 8, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)', color: 'var(--gold)', cursor: 'pointer' }}>Add</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {portfolioRows.map((row, index) => (
              <div key={`${row.symbol}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
                <span><strong>{row.symbol}</strong><div style={{ color: 'var(--muted)', fontSize: 12 }}>{row.qty} shares @ {formatPrice(row.avg)}</div></span>
                <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>PKR {formatPrice(row.value)}</span>
                <span style={{ color: row.pnl >= 0 ? 'var(--rise)' : 'var(--fall)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{row.pnl >= 0 ? '+' : ''}{formatPrice(row.pnl)}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <StockModal
        stock={selected}
        forecast={selectedForecast}
        history={selectedHistory}
        onClose={() => setSelected(null)}
        isWatched={selected ? watchlist.includes(selected.symbol.replace(/XD$|NC$/g, '')) : false}
        onToggleWatch={() => selected && toggleWatch(selected.symbol)}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1120px) { section { grid-template-columns: 1fr !important; } }
        @media (max-width: 760px) {
          h1 { font-size: 24px !important; }
          section { gap: 12px !important; }
        }
      `}</style>
    </div>
  )
}
