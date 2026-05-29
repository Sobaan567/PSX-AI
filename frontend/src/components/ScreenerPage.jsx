import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Flame,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { readJson } from '../api'

const API = import.meta.env.VITE_API_URL || ''

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

const presets = [
  { id: 'all', label: 'All Stocks' },
  { id: 'breakout', label: 'Breakouts' },
  { id: 'volume', label: 'Volume Spikes' },
  { id: 'gainers', label: 'Momentum' },
  { id: 'losers', label: 'Pullbacks' },
]

function normalizeStock(stock) {
  const current = Number(stock.current || stock.ldcp || 0)
  const ldcp = Number(stock.ldcp || current || 0)
  const change = Number.isFinite(Number(stock.change)) ? Number(stock.change) : current - ldcp
  const pchange = Number.isFinite(Number(stock.pchange)) && Number(stock.pchange) !== 0 ? Number(stock.pchange) : (ldcp ? (change / ldcp) * 100 : 0)
  const isLive = stock.is_live !== false && current > 0 && (Number(stock.current || 0) > 0)
  const high = Number(stock.high || Math.max(current, ldcp))
  const low = Number(stock.low || Math.min(current, ldcp))
  const open = Number(stock.open || ldcp || current)
  const dayRange = Math.max(high - low, 0.01)
  const rangePosition = ((current - low) / dayRange) * 100
  return {
    ...stock,
    current,
    ldcp,
    open,
    high,
    low,
    change,
    pchange,
    volume: Number(stock.volume || 0),
    sector: sectorLabels[String(stock.sector)] || stock.sector || 'Market',
    is_live: isLive,
    price_basis: stock.price_basis || (isLive ? 'Live market watch' : 'Previous close'),
    rangePosition,
    breakoutScore: (rangePosition * 0.45) + (Math.max(pchange, 0) * 8) + (Number(stock.volume || 0) / 1_000_000),
  }
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

function NumberInput({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          height: 38,
          borderRadius: 9,
          border: '1px solid rgba(255,255,255,0.09)',
          background: 'var(--input-solid)',
          color: 'var(--text)',
          padding: '0 10px',
          outline: 'none',
        }}
      />
    </label>
  )
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState('all')
  const [preset, setPreset] = useState('all')
  const [sortBy, setSortBy] = useState('breakoutScore')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minVolume, setMinVolume] = useState('')
  const [minChange, setMinChange] = useState('')
  const [maxChange, setMaxChange] = useState('')

  const fetchMarket = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/market`)
      if (res.ok) {
        const data = await readJson(res, 'Could not load market data.')
        const list = Array.isArray(data) ? data : data?.data
        if (list?.length) setStocks(list.map(normalizeStock))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMarket() }, [])

  const sectors = useMemo(() => [...new Set(stocks.map(stock => stock.sector))].sort(), [stocks])

  const results = useMemo(() => {
    const text = query.trim().toUpperCase()
    return stocks
      .filter(stock => !text || stock.symbol.includes(text) || stock.sector.toUpperCase().includes(text))
      .filter(stock => sector === 'all' || stock.sector === sector)
      .filter(stock => !minPrice || stock.current >= Number(minPrice))
      .filter(stock => !maxPrice || stock.current <= Number(maxPrice))
      .filter(stock => !minVolume || stock.volume >= Number(minVolume))
      .filter(stock => !minChange || stock.pchange >= Number(minChange))
      .filter(stock => !maxChange || stock.pchange <= Number(maxChange))
      .filter(stock => {
        if (preset === 'breakout') return stock.rangePosition >= 80 && stock.pchange > 0
        if (preset === 'volume') return stock.volume >= 1_000_000
        if (preset === 'gainers') return stock.pchange >= 2
        if (preset === 'losers') return stock.pchange <= -2
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol)
        return Number(b[sortBy] || 0) - Number(a[sortBy] || 0)
      })
  }, [maxChange, maxPrice, minChange, minPrice, minVolume, preset, query, sector, sortBy, stocks])

  const breakoutCount = stocks.filter(stock => stock.rangePosition >= 80 && stock.pchange > 0).length
  const volumeCount = stocks.filter(stock => stock.volume >= 1_000_000).length
  const momentumCount = stocks.filter(stock => stock.pchange >= 2).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}>
        <Card style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(212,175,55,0.13), transparent 42%, rgba(56,189,248,0.08))' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}>Advanced Screener</div>
            <h1 style={{ fontSize: 31, marginTop: 10, letterSpacing: 0 }}>Find PSX Setups Fast</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10, maxWidth: 720 }}>
              Filter the live market by price, volume, change, sector, range position, and breakout-style momentum.
            </p>
          </div>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>Breakouts</div><strong style={{ color: 'var(--rise)', fontSize: 22 }}>{breakoutCount}</strong></div>
            <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>Volume</div><strong style={{ color: 'var(--gold)', fontSize: 22 }}>{volumeCount}</strong></div>
            <div><div style={{ color: 'var(--muted)', fontSize: 11 }}>Momentum</div><strong style={{ color: 'var(--rise)', fontSize: 22 }}>{momentumCount}</strong></div>
          </div>
          <button onClick={fetchMarket} style={{ marginTop: 14, width: '100%', height: 36, borderRadius: 9, border: '1px solid rgba(212,175,55,0.32)', background: 'rgba(212,175,55,0.10)', color: 'var(--gold)', cursor: 'pointer', fontWeight: 800 }}>
            <RefreshCw size={14} style={{ marginRight: 8, verticalAlign: -2, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </Card>
      </section>

      <Card style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(4, minmax(140px, 1fr))', gap: 12 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Search</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', padding: '0 10px' }}>
              <Search size={15} color="var(--muted)" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Symbol or sector" style={{ minWidth: 0, flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--text)' }} />
            </span>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Sector</span>
            <select value={sector} onChange={event => setSector(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px' }}>
              <option value="all">All sectors</option>
              {sectors.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Preset</span>
            <select value={preset} onChange={event => setPreset(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px' }}>
              {presets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Sort</span>
            <select value={sortBy} onChange={event => setSortBy(event.target.value)} style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'var(--input-solid)', color: 'var(--text)', padding: '0 10px' }}>
              <option value="breakoutScore">Breakout Score</option>
              <option value="pchange">% Change</option>
              <option value="volume">Volume</option>
              <option value="rangePosition">Range Position</option>
              <option value="current">Price</option>
              <option value="symbol">Symbol</option>
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button onClick={() => {
              setQuery(''); setSector('all'); setPreset('all'); setMinPrice(''); setMaxPrice(''); setMinVolume(''); setMinChange(''); setMaxChange('')
            }} style={{ width: '100%', height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', cursor: 'pointer', fontWeight: 800 }}>Reset</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))', gap: 12, marginTop: 14 }}>
          <NumberInput label="Min Price" value={minPrice} onChange={setMinPrice} placeholder="0" />
          <NumberInput label="Max Price" value={maxPrice} onChange={setMaxPrice} placeholder="Any" />
          <NumberInput label="Min Volume" value={minVolume} onChange={setMinVolume} placeholder="1000000" />
          <NumberInput label="Min % Change" value={minChange} onChange={setMinChange} placeholder="-5" />
          <NumberInput label="Max % Change" value={maxChange} onChange={setMaxChange} placeholder="10" />
        </div>
      </Card>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18 }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={18} color="var(--gold)" />
              <h2 style={{ fontSize: 17 }}>{results.length} Matches</h2>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Live data, previous close after market close</div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 0.9fr 1fr 1fr 1.2fr', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.035)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800 }}>
                <span>Symbol</span><span>Price</span><span>%</span><span>Volume</span><span>Range</span><span>Score</span><span>Sector</span>
              </div>
              {results.slice(0, 80).map(stock => {
                const positive = stock.pchange >= 0
                return (
                  <div key={stock.symbol} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 0.9fr 1fr 1fr 1.2fr', gap: 12, alignItems: 'center', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', color: positive ? 'var(--rise)' : 'var(--fall)', background: positive ? 'rgba(0,208,132,0.10)' : 'rgba(255,71,87,0.10)' }}>
                        {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      </span>
                      <strong>{stock.symbol}</strong>
                    </span>
                    <span>
                      <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>PKR {formatPrice(stock.current)}</span>
                      {stock.is_live === false && <span style={{ color: 'var(--muted)', fontSize: 10 }}>Prev close</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: positive ? 'var(--rise)' : 'var(--fall)', fontWeight: 800 }}>{positive ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
                    <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{formatVolume(stock.volume)}</span>
                    <span>
                      <span style={{ display: 'block', height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(stock.rangePosition, 100))}%`, background: stock.rangePosition >= 80 ? 'var(--rise)' : stock.rangePosition <= 20 ? 'var(--fall)' : 'var(--gold)' }} />
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{stock.rangePosition.toFixed(0)}% of day range</span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: stock.breakoutScore > 80 ? 'var(--rise)' : 'var(--gold)', fontWeight: 800 }}>{stock.breakoutScore.toFixed(1)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.sector}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Target size={18} color="var(--gold)" />
              <h3 style={{ fontSize: 15 }}>Best Setups</h3>
            </div>
            {results.slice(0, 8).map(stock => (
              <div key={stock.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
                <span><strong>{stock.symbol}</strong><div style={{ color: 'var(--muted)', fontSize: 11 }}>{stock.sector}</div></span>
                <span style={{ color: stock.pchange >= 0 ? 'var(--rise)' : 'var(--fall)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{stock.pchange >= 0 ? '+' : ''}{stock.pchange.toFixed(2)}%</span>
              </div>
            ))}
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <SlidersHorizontal size={18} color="var(--gold)" />
              <h3 style={{ fontSize: 15 }}>Preset Guide</h3>
            </div>
            <div style={{ display: 'grid', gap: 10, color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
              <span><TrendingUp size={13} color="var(--rise)" /> Breakouts: price near day high with positive change.</span>
              <span><Flame size={13} color="var(--gold)" /> Volume Spikes: symbols trading over 1M shares.</span>
              <span><Activity size={13} color="var(--rise)" /> Momentum: stocks up at least 2%.</span>
              <span><TrendingDown size={13} color="var(--fall)" /> Pullbacks: stocks down at least 2%.</span>
            </div>
          </Card>
        </div>
      </section>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1120px) {
          section, div[style*="repeat(5"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

