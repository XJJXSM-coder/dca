import { useCallback, useEffect, useState } from 'react'
import { getConfig, listMonths, listTrades } from './db/repo'
import { seedIfEmpty } from './seed'
import { DEFAULT_CONFIG } from './types'
import type { Config, MonthRecord, Trade } from './types'
import Home from './pages/Home'
import Position from './pages/Position'
import Cash from './pages/Cash'
import More from './pages/More'
import Settings from './pages/Settings'

export interface AppData {
  trades: Trade[]
  months: MonthRecord[]
  cfg: Config
  currentYm: string
}

export type Reload = () => Promise<void>

type Tab = 'home' | 'position' | 'cash' | 'more' | 'settings'

const TABS: { key: Tab; label: string; ic: string }[] = [
  { key: 'home', label: '任务', ic: '◎' },
  { key: 'position', label: '持仓', ic: '▲' },
  { key: 'cash', label: '现金', ic: '◈' },
  { key: 'more', label: '更多', ic: '▤' },
  { key: 'settings', label: '设置', ic: '⚙' },
]

export function ymNow(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

const VALID_TABS: Tab[] = ['home', 'position', 'cash', 'more', 'settings']

function tabFromHash(): Tab {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace('#', '')
  return VALID_TABS.includes(h as Tab) ? (h as Tab) : 'home'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [data, setData] = useState<AppData | null>(null)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const reload = useCallback(async () => {
    const trades = await listTrades()
    const months = await listMonths()
    const cfg = await getConfig()
    setData({
      trades: trades || [],
      months: months || [],
      cfg: cfg || DEFAULT_CONFIG,
      currentYm: ymNow(),
    })
  }, [])

  useEffect(() => {
    let alive = true
    const boot = async () => {
      try {
        await seedIfEmpty()
        if (!alive) return
        await reload()
      } catch (e) {
        if (alive) setErr(String(e))
      }
    }
    boot()
    return () => {
      alive = false
    }
  }, [reload])

  if (err) {
    return (
      <div className="app">
        <div className="sec">
          <div className="note r">初始化失败：{err}</div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="app">
        <div className="empty">加载中…</div>
      </div>
    )
  }

  return (
    <div className="app">
      {tab === 'home' && <Home data={data} reload={reload} />}
      {tab === 'position' && <Position data={data} reload={reload} />}
      {tab === 'cash' && <Cash data={data} reload={reload} />}
      {tab === 'more' && <More data={data} />}
      {tab === 'settings' && <Settings data={data} reload={reload} />}

      <div className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'on' : ''}
            onClick={() => {
              setTab(t.key)
              try { history.replaceState(null, '', '#' + t.key) } catch {}
            }}
            type="button"
          >
            <span className="ic">{t.ic}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
