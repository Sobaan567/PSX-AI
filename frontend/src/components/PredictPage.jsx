import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  LineChart as ChartIcon,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { readJson } from '../api'

import { API_BASE } from '../config'

const API = API_BASE

const POPULAR = ['OGDC', 'ENGRO', 'HBL', 'PSO', 'LUCK', 'MARI', 'TRG', 'UBL', 'MCB', 'HUBC', 'MLCF', 'SYS']
const HORIZONS = [1, 3, 5, 10]

function formatPrice(value) {
  const num = Number(value || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(value) {
  const num = Number(value || 0)
  return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
}

function formatVolume(value) {
  const num = Number(value || 0)
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return num.toLocaleString()
}

function toneColor(tone) {
  if (tone === 'rise') return 'var(--rise)'
  if (tone === 'fall') return 'var(--fall)'
  if (tone === 'blue') return '#38bdf8'
  return 'var(--gold)'
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      boxShadow: '0 20px 55px rgba(0,0,0,0.22)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Metric({ label, value, sub, icon, tone = 'gold' }) {
  const color = toneColor(tone)
  return (
    <Card style={{ padding: 16, minHeight: 116 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
          <div style={{ color, fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, marginTop: 8, overflowWrap: 'anywhere' }}>{value}</div>
          {sub && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6, lineHeight: 1.35 }}>{sub}</div>}
        </div>
        <div style={{
          color,
          width: 36,
          height: 36,
          flex: '0 0 36px',
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#101522', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>
      {payload
        .filter(item => item.value != null)
        .map(item => (
          <div key={item.dataKey} style={{ color: item.color, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {item.name}: PKR {formatPrice(item.value)}
          </div>
        ))}
    </div>
  )
}

function SignalRow({ item }) {
  const score = Number(item.score || 0)
  const color = score < 0 ? 'var(--fall)' : score > 0 ? 'var(--rise)' : 'var(--gold)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{item.label}</div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{item.summary}</div>
        </div>
        <div style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{score > 0 ? '+' : ''}{score.toFixed(1)}</div>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.055)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(Math.abs(score), 100)}%`,
          height: '100%',
          borderRadius: 99,
          background: color,
        }} />
      </div>
    </div>
  )
}

export default function PredictPage() {
  const [symbol, setSymbol] = useState('OGDC')
  const [horizon, setHorizon] = useState(5)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRun, setLastRun] = useState(null)

  const chartData = useMemo(() => {
    if (!result) return []
    const history = (result.history || []).slice(-65).map(row => ({
      date: row.date,
      close: Number(row.close),
      forecast: null,
      bull: null,
      bear: null,
    }))
    const anchor = {
      date: 'Now',
      close: Number(result.current_price),
      forecast: Number(result.current_price),
      bull: Number(result.current_price),
      bear: Number(result.current_price),
    }
    const forecast = (result.forecast_path || []).map(row => ({
      date: row.date,
      close: null,
      forecast: Number(row.base),
      bull: Number(row.bull),
      bear: Number(row.bear),
    }))
    return [...history, anchor, ...forecast]
  }, [result])

  const runPredict = async (nextSymbol = symbol, nextHorizon = horizon) => {
    const clean = String(nextSymbol || '').toUpperCase().replace(/\s+/g, '').trim()
    if (!clean) return

    setSymbol(clean)
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/predict/${encodeURIComponent(clean)}?days=${nextHorizon}`)
      const data = await readJson(res, 'Could not fetch prediction.')
      setResult(data)
      setLastRun(new Date())
    } catch (err) {
      setError(err.message || 'Could not fetch prediction. Make sure the backend is running and the symbol has enough PSX history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runPredict('OGDC', 5)
    // Load a useful first view once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isUp = result?.trend === 'UP'
  const isDown = result?.trend === 'DOWN'
  const trendTone = isUp ? 'rise' : isDown ? 'fall' : 'gold'
  const trendColor = toneColor(trendTone)
  const sessionPositive = Number(result?.session_change || 0) >= 0
  const scenario = result?.scenarios || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <Card style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(212,175,55,0.13), transparent 46%, rgba(56,189,248,0.08))' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }}>PSX Signal Forecast</div>
            <h1 style={{ fontSize: 32, marginTop: 10, letterSpacing: 0 }}>Predict</h1>
            <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>
              {result ? `${result.market_symbol || result.symbol} | ${result.price_basis}` : 'Live market-watch price with EOD technical signals'}
            </div>

            <form
              onSubmit={event => {
                event.preventDefault()
                runPredict()
              }}
              style={{
                marginTop: 22,
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1fr) auto',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 46,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(15,17,26,0.62)',
                borderRadius: 10,
                padding: '0 12px',
              }}>
                <Search size={17} color="var(--muted)" />
                <input
                  value={symbol}
                  onChange={event => setSymbol(event.target.value.toUpperCase())}
                  placeholder="OGDC"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 0,
                    outline: 0,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 16,
                    fontWeight: 800,
                  }}
                />
              </label>
              <button type="submit" disabled={loading} style={{
                height: 46,
                minWidth: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: 0,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #d4af37, #f1c40f)',
                color: '#0f111a',
                cursor: loading ? 'default' : 'pointer',
                fontWeight: 900,
                opacity: loading ? 0.75 : 1,
              }}>
                {loading ? <LoaderCircle size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={17} />}
                {loading ? 'Loading' : 'Predict'}
              </button>
            </form>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {POPULAR.map(item => (
                <button key={item} onClick={() => runPredict(item)} style={{
                  height: 32,
                  minWidth: 56,
                  borderRadius: 8,
                  border: item === symbol ? '1px solid rgba(212,175,55,0.55)' : '1px solid rgba(255,255,255,0.08)',
                  background: item === symbol ? 'rgba(212,175,55,0.11)' : 'rgba(255,255,255,0.025)',
                  color: item === symbol ? 'var(--gold)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: 12,
                }}>{item}</button>
              ))}
            </div>
          </div>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Forecast Window</div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 8 }}>{horizon} trading day{horizon > 1 ? 's' : ''}</div>
            </div>
            <button onClick={() => runPredict()} disabled={loading} style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.035)',
              color: 'var(--gold)',
              cursor: loading ? 'default' : 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}>
              <RefreshCw size={17} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 18 }}>
            {HORIZONS.map(option => (
              <button key={option} onClick={() => {
                setHorizon(option)
                if (result) runPredict(symbol, option)
              }} style={{
                height: 36,
                borderRadius: 9,
                border: horizon === option ? '1px solid rgba(212,175,55,0.55)' : '1px solid rgba(255,255,255,0.08)',
                background: horizon === option ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.025)',
                color: horizon === option ? 'var(--gold)' : 'var(--muted)',
                cursor: 'pointer',
                fontWeight: 900,
              }}>{option}D</button>
            ))}
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>Source</div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 5 }}>{result?.data_source || 'Waiting'}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>Updated</div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 5 }}>{lastRun ? lastRun.toLocaleTimeString() : '--'}</div>
            </div>
          </div>
        </Card>
      </section>

      {error && (
        <Card style={{ padding: 16, border: '1px solid rgba(255,71,87,0.30)', background: 'rgba(255,71,87,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fall)', fontWeight: 800 }}>
            <AlertTriangle size={18} />
            {error}
          </div>
        </Card>
      )}

      {result && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <Card style={{ padding: 22, background: `linear-gradient(145deg, ${isUp ? 'rgba(0,208,132,0.085)' : isDown ? 'rgba(255,71,87,0.085)' : 'rgba(212,175,55,0.08)'}, rgba(255,255,255,0.018))` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{result.symbol}</div>
                  <h2 style={{ fontSize: 36, marginTop: 5 }}>{result.market_symbol || result.symbol}</h2>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 900, marginTop: 12 }}>
                    PKR {formatPrice(result.current_price)}
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    color: sessionPositive ? 'var(--rise)' : 'var(--fall)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 900,
                    marginTop: 8,
                  }}>
                    {sessionPositive ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                    {sessionPositive ? '+' : ''}{formatPrice(result.session_change)} ({formatPercent(result.session_change_pct)})
                  </div>
                </div>
                <div style={{
                  width: 70,
                  height: 70,
                  borderRadius: 16,
                  display: 'grid',
                  placeItems: 'center',
                  border: `1px solid ${trendColor}`,
                  background: `${trendColor}17`,
                  color: trendColor,
                }}>
                  {isUp ? <TrendingUp size={34} /> : isDown ? <TrendingDown size={34} /> : <Activity size={34} />}
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(15,17,26,0.42)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>Signal</div>
                  <div style={{ color: trendColor, fontWeight: 900, marginTop: 6 }}>{result.rating}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: 'rgba(15,17,26,0.42)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>Target</div>
                  <div style={{ color: trendColor, fontFamily: 'var(--font-mono)', fontWeight: 900, marginTop: 6 }}>
                    PKR {formatPrice(result.target_price)}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--muted)' }}>Confidence</span>
                  <span style={{ color: trendColor, fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{result.confidence}%</span>
                </div>
                <div style={{ height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${result.confidence}%`, height: '100%', background: trendColor, borderRadius: 999 }} />
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  LDCP <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>PKR {formatPrice(result.previous_close || result.last_close)}</strong>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                  EOD <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>PKR {formatPrice(result.latest_eod_close)}</strong>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 18, minHeight: 390 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 17 }}>Price Path</h2>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>History plus {result.forecast_days}D base, bull, and bear paths</div>
                </div>
                <ChartIcon size={22} color="var(--gold)" />
              </div>
              <div style={{ width: '100%', height: 314 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.16} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} minTickGap={26} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={56} domain={['auto', 'auto']} />
                    <Tooltip content={<ForecastTooltip />} />
                    <ReferenceLine y={result.support} stroke="rgba(0,208,132,0.28)" strokeDasharray="4 4" />
                    <ReferenceLine y={result.resistance} stroke="rgba(255,71,87,0.26)" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="bull" name="Bull path" stroke="none" fill="url(#forecastBand)" connectNulls />
                    <Area type="monotone" dataKey="bear" name="Bear path" stroke="none" fill="rgba(255,71,87,0.035)" connectNulls />
                    <Line type="monotone" dataKey="close" name="Close" stroke="#d4af37" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="forecast" name="Base forecast" stroke="#38bdf8" strokeWidth={2.2} dot={false} strokeDasharray="6 4" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            <Metric label="Expected Move" value={formatPercent(result.expected_change_pct)} sub={`${result.forecast_days}D horizon`} icon={isUp ? <TrendingUp size={18} /> : isDown ? <TrendingDown size={18} /> : <Activity size={18} />} tone={trendTone} />
            <Metric label="Previous Close" value={`PKR ${formatPrice(result.previous_close || result.last_close)}`} sub="PSX market-watch LDCP" icon={<Clock3 size={18} />} />
            <Metric label="Latest EOD" value={`PKR ${formatPrice(result.latest_eod_close)}`} sub={`${result.historical_sample_size} daily rows`} icon={<BarChart3 size={18} />} tone="blue" />
            <Metric label="Support" value={`PKR ${formatPrice(result.support)}`} sub="45-day close floor" icon={<ShieldAlert size={18} />} tone="rise" />
            <Metric label="Resistance" value={`PKR ${formatPrice(result.resistance)}`} sub="45-day close ceiling" icon={<Target size={18} />} tone="fall" />
            <Metric label="Risk / Reward" value={`${formatPrice(result.risk_reward)}x`} sub={`Risk level PKR ${formatPrice(result.risk_level)}`} icon={<Gauge size={18} />} tone={result.risk_reward >= 1 ? 'rise' : 'fall'} />
            <Metric label="RSI" value={formatPrice(result.rsi)} sub={result.rsi > 70 ? 'Overbought' : result.rsi < 30 ? 'Oversold' : 'Balanced'} icon={<Activity size={18} />} tone={result.rsi > 70 ? 'fall' : result.rsi < 30 ? 'rise' : 'gold'} />
            <Metric label="Volume" value={formatVolume(result.live_volume || result.avg_volume_20)} sub={`${formatPrice(result.signals?.volume_ratio)}x vs 20D avg`} icon={<CircleDollarSign size={18} />} tone="blue" />
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
                <Target size={19} color="var(--gold)" />
                <h2 style={{ fontSize: 17 }}>Scenarios</h2>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  { label: 'Bear', value: scenario.bear, tone: 'fall', icon: <TrendingDown size={18} /> },
                  { label: 'Base', value: scenario.base, tone: trendTone, icon: <Activity size={18} /> },
                  { label: 'Bull', value: scenario.bull, tone: 'rise', icon: <TrendingUp size={18} /> },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'grid',
                    gridTemplateColumns: '34px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: 13,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.025)',
                  }}>
                    <span style={{ color: toneColor(item.tone), width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: `${toneColor(item.tone)}14` }}>{item.icon}</span>
                    <span>
                      <strong>{item.label}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{item.label === 'Base' ? 'Weighted technical target' : `${result.forecast_days}D volatility band`}</div>
                    </span>
                    <span style={{ color: toneColor(item.tone), fontFamily: 'var(--font-mono)', fontWeight: 900 }}>PKR {formatPrice(item.value)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
                <CheckCircle2 size={19} color="var(--gold)" />
                <h2 style={{ fontSize: 17 }}>Signal Stack</h2>
              </div>
              <div style={{ display: 'grid', gap: 15 }}>
                {(result.score_components || []).map(item => <SignalRow key={item.label} item={item} />)}
              </div>
            </Card>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <ShieldAlert size={19} color="var(--gold)" />
                <h2 style={{ fontSize: 17 }}>Trade Levels</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {[
                  { label: 'Break Above', value: result.resistance, sub: 'Resistance trigger', tone: 'rise', icon: <ArrowUpRight size={16} /> },
                  { label: 'Break Below', value: result.support, sub: 'Support trigger', tone: 'fall', icon: <ArrowDownRight size={16} /> },
                ].map(item => (
                  <div key={item.label} style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.025)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                      <span style={{ color: toneColor(item.tone) }}>{item.icon}</span>
                    </div>
                    <div style={{ color: toneColor(item.tone), fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 900, marginTop: 8 }}>
                      PKR {formatPrice(item.value)}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <Gauge size={19} color="var(--gold)" />
                <h2 style={{ fontSize: 17 }}>Why This Forecast</h2>
              </div>
              <div style={{ display: 'grid', gap: 9 }}>
                {(result.explanation || []).map(item => (
                  <div key={item} style={{ display: 'flex', gap: 9, color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
                    <span style={{ color: 'var(--gold)', marginTop: 1 }}><CheckCircle2 size={14} /></span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, color: 'var(--muted)', fontSize: 11, lineHeight: 1.55 }}>
                Educational signal only. It uses live PSX market-watch data when available and official EOD history; it is not financial advice.
              </div>
            </Card>
          </section>
        </>
      )}

      {!result && loading && (
        <Card style={{ minHeight: 260, display: 'grid', placeItems: 'center', padding: 30 }}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12, color: 'var(--muted)' }}>
            <LoaderCircle size={34} style={{ animation: 'spin 1s linear infinite' }} />
            <strong>Loading forecast</strong>
          </div>
        </Card>
      )}
    </div>
  )
}

