import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  Gauge,
  LoaderCircle,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import { readJson } from '../api'

import { API_BASE } from '../config'

const API = API_BASE

const QUICK_ACTIONS = [
  { label: 'Market mood', prompt: 'Give me a quick PSX market mood summary with breadth, gainers, losers, and volume leaders.' },
  { label: 'Top gainers', prompt: 'Who are the top gainers right now and why do they matter?' },
  { label: 'Top losers', prompt: 'Show today\'s top losers and explain the risk.' },
  { label: 'OGDC setup', prompt: 'Analyze OGDC with current price, 5D signal, support, resistance, RSI, and risk.' },
  { label: 'Compare banks', prompt: 'Compare HBL, UBL, and MCB using live context and tell me which looks stronger technically.' },
  { label: 'Volume leaders', prompt: 'Which PSX stocks have the highest volume right now?' },
]

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

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderMarkdown(text) {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^- (.*)$/gm, '<span class="chat-bullet">• $1</span>')
    .replace(/^\*\s+(.*)$/gm, '<span class="chat-bullet">• $1</span>')
    .replace(/\n/g, '<br />')
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

function MarketChip({ icon, label, value, tone = 'gold' }) {
  const color = tone === 'rise' ? 'var(--rise)' : tone === 'fall' ? 'var(--fall)' : tone === 'blue' ? '#38bdf8' : 'var(--gold)'
  return (
    <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
        <span>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 20, marginTop: 8 }}>{value}</div>
    </div>
  )
}

function RankRows({ title, rows = [], tone = 'rise', promptPrefix, onAsk }) {
  const color = tone === 'rise' ? 'var(--rise)' : tone === 'fall' ? 'var(--fall)' : '#38bdf8'
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {tone === 'rise' ? <TrendingUp size={18} color={color} /> : tone === 'fall' ? <TrendingDown size={18} color={color} /> : <BarChart3 size={18} color={color} />}
        <h3 style={{ fontSize: 14 }}>{title}</h3>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.slice(0, 5).map(row => (
          <button key={row.symbol} onClick={() => onAsk(`${promptPrefix} ${row.symbol}`)} style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: 10,
            alignItems: 'center',
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.022)',
            color: 'var(--text)',
            cursor: 'pointer',
            textAlign: 'left',
          }}>
            <span>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{row.symbol}</strong>
              <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 3 }}>PKR {formatPrice(row.current)} | {formatVolume(row.volume)}</div>
            </span>
            <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 900 }}>{row.pchange > 0 ? '+' : ''}{formatPrice(row.pchange)}%</span>
          </button>
        ))}
        {!rows.length && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading live rows...</div>}
      </div>
    </Card>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '**PSX-AI is ready.** Ask me about live movers, a ticker setup, sector strength, or risk levels. I can use market-watch data and forecast signals when the backend is running.',
      mode: 'system',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const market = context?.market || {}
  const mood = useMemo(() => {
    const breadth = Number(market.breadth || 0)
    if (breadth > 12) return { label: 'Bullish', tone: 'rise' }
    if (breadth < -12) return { label: 'Bearish', tone: 'fall' }
    return { label: 'Mixed', tone: 'gold' }
  }, [market.breadth])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const fetchContext = async () => {
    setContextLoading(true)
    try {
      const res = await fetch(`${API}/api/chat/context`)
      if (res.ok) setContext(await readJson(res, 'Could not load chat context.'))
    } finally {
      setContextLoading(false)
    }
  }

  useEffect(() => {
    fetchContext()
  }, [])

  const send = async (text) => {
    const msg = String(text || input).trim()
    if (!msg || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const history = newMessages.slice(-8, -1).map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.content,
      }))

      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })

      const data = await readJson(res, 'Could not reach the AI backend.')
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, mode: data.mode || 'gemini' }])
      if (data.context) setContext(data.context)
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Connection issue:** ${err.message || 'Make sure the FastAPI server is running.'}`,
        mode: 'error',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: '**Fresh chat started.** Ask me for a live PSX read, ticker setup, or comparison.',
      mode: 'system',
    }])
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Card style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(212,175,55,0.13), transparent 48%, rgba(0,208,132,0.07))' }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 900 }}>PSX Analyst Bot</div>
              <h1 style={{ fontSize: 32, marginTop: 10 }}>AI Stock Assistant</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10, lineHeight: 1.55 }}>
                Live market context, ticker setups, risk levels, and concise PSX answers.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <button onClick={fetchContext} disabled={contextLoading} style={{
                height: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 9,
                border: '1px solid rgba(212,175,55,0.32)',
                background: 'rgba(212,175,55,0.10)',
                color: 'var(--gold)',
                padding: '0 12px',
                cursor: 'pointer',
                fontWeight: 900,
              }}>
                <RefreshCw size={15} style={{ animation: contextLoading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
              <button onClick={clearChat} style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.09)',
                background: 'rgba(255,255,255,0.035)',
                color: 'var(--muted)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}>
                <MessageSquarePlus size={16} />
              </button>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <MarketChip icon={<Gauge size={16} />} label="Mood" value={mood.label} tone={mood.tone} />
          <MarketChip icon={<ArrowUpRight size={16} />} label="Advancing" value={market.advancing ?? '--'} tone="rise" />
          <MarketChip icon={<ArrowDownRight size={16} />} label="Declining" value={market.declining ?? '--'} tone="fall" />
          <MarketChip icon={<Activity size={16} />} label="Breadth" value={`${Number(market.breadth || 0).toFixed(1)}`} tone={mood.tone} />
        </div>

        <Card style={{ minHeight: 520, maxHeight: 620, overflow: 'auto', padding: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <div key={`${message.role}-${index}`} style={{
                  display: 'flex',
                  gap: 12,
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    flex: '0 0 38px',
                    background: isUser ? 'linear-gradient(135deg, #d4af37, #f1c40f)' : 'linear-gradient(135deg, #1e233a, #2d3456)',
                    border: isUser ? 'none' : '1px solid rgba(212,175,55,0.30)',
                    display: 'grid',
                    placeItems: 'center',
                  }}>
                    {isUser ? <User size={16} color="#0f111a" /> : <Bot size={17} color="var(--gold)" />}
                  </div>

                  <div style={{
                    maxWidth: 'min(760px, 78%)',
                    padding: '13px 15px',
                    borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                    background: isUser ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.032)',
                    border: `1px solid ${isUser ? 'rgba(212,175,55,0.22)' : 'rgba(255,255,255,0.07)'}`,
                    color: 'var(--text)',
                    fontSize: 14,
                    lineHeight: 1.65,
                  }}>
                    {!isUser && message.mode && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: message.mode === 'local' ? '#38bdf8' : 'var(--gold)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>
                        {message.mode === 'local' ? <BrainCircuit size={13} /> : <Sparkles size={13} />}
                        {message.mode === 'local' ? 'Local market answer' : message.mode === 'error' ? 'Notice' : 'AI answer'}
                      </div>
                    )}
                    <div
                      className="chat-message"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                    />
                  </div>
                </div>
              )
            })}

            {loading && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #1e233a, #2d3456)', border: '1px solid rgba(212,175,55,0.30)', display: 'grid', placeItems: 'center' }}>
                  <Bot size={17} color="var(--gold)" />
                </div>
                <div style={{ padding: 14, borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                  <LoaderCircle size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold)' }} />
                  Reading live PSX context...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </Card>

        <Card style={{ padding: 12 }}>
          <form onSubmit={event => {
            event.preventDefault()
            send()
          }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ask about a PSX symbol, market breadth, gainers, risk, or comparison..."
              style={{
                flex: 1,
                minWidth: 0,
                height: 42,
                background: 'transparent',
                border: 0,
                outline: 0,
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
            <button type="submit" disabled={loading || !input.trim()} style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              border: 0,
              background: input.trim() ? 'linear-gradient(135deg, #d4af37, #f1c40f)' : 'rgba(255,255,255,0.05)',
              color: input.trim() ? '#0f111a' : 'var(--muted)',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'grid',
              placeItems: 'center',
            }}>
              <Send size={17} />
            </button>
          </form>
        </Card>
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} color="var(--gold)" />
            <h2 style={{ fontSize: 15 }}>Quick Prompts</h2>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {QUICK_ACTIONS.map(action => (
              <button key={action.label} onClick={() => send(action.prompt)} style={{
                minHeight: 38,
                textAlign: 'left',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.025)',
                color: 'var(--text)',
                padding: '9px 10px',
                cursor: 'pointer',
                fontWeight: 800,
              }}>
                {action.label}
              </button>
            ))}
          </div>
        </Card>

        <RankRows title="Top Gainers" rows={market.top_gainers || []} tone="rise" promptPrefix="Analyze this top gainer:" onAsk={send} />
        <RankRows title="Top Losers" rows={market.top_losers || []} tone="fall" promptPrefix="Analyze this top loser:" onAsk={send} />
        <RankRows title="Volume Leaders" rows={market.volume_leaders || []} tone="blue" promptPrefix="Analyze this volume leader:" onAsk={send} />

        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Wallet size={18} color="var(--gold)" />
            <h2 style={{ fontSize: 15 }}>Bot Skills</h2>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.65 }}>
            Live movers, ticker forecast summaries, support/resistance, RSI, volume checks, comparisons, and plain-English risk notes.
          </div>
        </Card>
      </aside>

      <style>{`
        .chat-message strong { color: var(--text); font-weight: 900; }
        .chat-message code {
          font-family: var(--font-mono);
          background: rgba(255,255,255,0.06);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
        }
        .chat-bullet {
          display: block;
          margin: 3px 0;
          color: var(--muted);
        }
        @media (max-width: 1050px) {
          main > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

