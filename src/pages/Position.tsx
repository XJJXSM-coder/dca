import { useEffect, useMemo, useState } from 'react'
import { addTrade, deleteTrade, getMonth, updateTradeQuota, upsertMonth } from '../db/repo'
import {
  avgRate,
  bySymbol,
  costPrice,
  monthLeft,
  monthUsed,
  pnl,
  quotaMonthOf,
  symbolOf,
  symbolsIn,
  totalCny,
  totalShares,
  totalUsdc,
} from '../calc'
import type { Trade } from '../types'
import type { AppData, Reload } from '../App'
import { MoneyInput, fmt, fmtSigned } from '../components/MoneyInput'
import Sheet from '../components/Sheet'
import { useQuote } from '../useQuote'

export interface PositionProps {
  data: AppData
  reload: Reload
}

/** 双轨标的顺序：旧仓 QQQM 在前（待择时卖），新钱 VGT 在后 */
const SYMBOLS = ['QQQM', 'VGT'] as const
type Sym = (typeof SYMBOLS)[number]

/** 每个标的的一句话定位，显示在分组标题旁 */
const SYMBOL_NOTE: Record<string, string> = {
  QQQM: '旧仓 · 待择时卖出',
  VGT: '新钱 · 每月定投',
}

function today(): string {
  const d = new Date()
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

export default function Position({ data, reload }: PositionProps) {
  const { cfg, trades, months, currentYm } = data

  const [date, setDate] = useState<string>(today())
  const [cny, setCny] = useState<number>(cfg.investQuota)
  const [usdc, setUsdc] = useState<number>(0)
  const [shares, setShares] = useState<number>(0)
  const [price, setPrice] = useState<number>(0)
  const [sym, setSym] = useState<Sym>('VGT')
  // 每个标的各自的现价（USD）
  const [prices, setPrices] = useState<Record<string, number>>({ QQQM: 0, VGT: 0 })
  // 哪些标的处于"跟随行情"状态（手动改过就关掉）
  const [live, setLive] = useState<Record<string, boolean>>({ QQQM: true, VGT: true })
  const [msg, setMsg] = useState<string>('')
  // 改月份弹层
  const [quotaTarget, setQuotaTarget] = useState<Trade | null>(null)
  const [quotaDraft, setQuotaDraft] = useState<string>('')
  // 删除确认弹层
  const [delTarget, setDelTarget] = useState<Trade | null>(null)

  // 两个标的各拉一路行情
  const qQqqm = useQuote('QQQM')
  const qVgt = useQuote('VGT')
  const quotes: Record<string, typeof qQqqm> = { QQQM: qQqqm, VGT: qVgt }

  // 现价初始化优先级：当月已存盘价 → 上月存盘价 → 该标的最近一笔成交价
  useEffect(() => {
    const [y, m] = currentYm.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 2, 1))
    const prev = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
    const curRec = months.find((x) => x.ym === currentYm)
    const prevRec = months.find((x) => x.ym === prev)

    const next: Record<string, number> = {}
    for (const s of SYMBOLS) {
      const stored = s === 'QQQM' ? curRec?.priceEnd : curRec?.priceEndVgt
      const storedPrev = s === 'QQQM' ? prevRec?.priceEnd : prevRec?.priceEndVgt
      const lastOfSym = [...bySymbol(trades, s)].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
      next[s] = stored || storedPrev || (lastOfSym && lastOfSym.price) || 0
    }
    setPrices((prevP) => ({ ...prevP, ...next }))
  }, [currentYm, months, trades])

  // 行情到了就同步（除非该标的被手动覆盖）
  useEffect(() => {
    for (const s of SYMBOLS) {
      const q = quotes[s].quote
      if (live[s] && q && q.price > 0) {
        setPrices((p) => (p[s] === q.price ? p : { ...p, [s]: q.price }))
      }
    }
    // quotes 每次渲染都是新对象，依赖到 quote 本身避免死循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qQqqm.quote?.price, qVgt.quote?.price, live.QQQM, live.VGT])

  const sorted = useMemo(
    () => [...trades].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id || 0) - (a.id || 0))),
    [trades],
  )

  // 每个标的的统计
  const stats = useMemo(() => {
    const out: Record<string, ReturnType<typeof pnl> & {
      principal: number
      held: number
      cost: number
      usdc: number
      rate: number
      list: Trade[]
    }> = {}
    for (const s of SYMBOLS) {
      const list = bySymbol(trades, s)
      const p = pnl(list, prices[s] || 0)
      out[s] = {
        ...p,
        principal: totalCny(list),
        held: totalShares(list),
        cost: costPrice(list),
        usdc: totalUsdc(list),
        rate: avgRate(list),
        list,
      }
    }
    return out
  }, [trades, prices])

  const heldSymbols = useMemo(() => symbolsIn(trades), [trades])

  // 保存两个标的的现价到当月记录
  const savePriceNow = async () => {
    if ((prices.QQQM || 0) <= 0 && (prices.VGT || 0) <= 0) {
      setMsg('现价要大于 0')
      return
    }
    try {
      const base = (await getMonth(currentYm)) || {
        ym: currentYm,
        cashA: 0,
        cashB: 0,
        cashC: 0,
        tasksDone: [],
      }
      await upsertMonth({
        ...base,
        ym: currentYm,
        priceEnd: prices.QQQM || 0,
        priceEndVgt: prices.VGT || 0,
      })
      setMsg('已保存现价到 ' + currentYm)
      await reload()
    } catch (e) {
      setMsg('保存失败：' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const usedThisMonth = monthUsed(trades, currentYm)
  const quotaLeft = cfg.investQuota - usedThisMonth
  const canSubmit = cny > 0 && usdc > 0 && shares > 0 && price > 0 && !!date

  const submit = async () => {
    if (!canSubmit) return
    const t: Trade = { date, cny, usdc, shares, price, symbol: sym }
    await addTrade(t)
    setMsg('已记录一笔：' + sym + ' ' + date + ' ' + fmt(cny) + ' 元')
    setUsdc(0)
    setShares(0)
    setPrice(0)
    await reload()
  }

  // 打开「改月份」弹层
  const openQuota = (t: Trade) => {
    setQuotaTarget(t)
    setQuotaDraft(quotaMonthOf(t))
  }

  // 确认改月份
  const confirmQuota = async () => {
    const t = quotaTarget
    if (!t || t.id === undefined) return
    const v = quotaDraft.trim()
    if (v !== '' && !/^\d{4}-\d{2}$/.test(v)) {
      setMsg('格式不对，应为 YYYY-MM，例如 2026-10')
      return
    }
    try {
      await updateTradeQuota(t.id, v === '' ? undefined : v)
      setMsg(v ? '已改为 ' + v + ' 的额度' : '已恢复按成交月份')
      setQuotaTarget(null)
      await reload()
    } catch (e) {
      setMsg('保存失败：' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // 打开「删除」确认
  const openDelete = (t: Trade) => setDelTarget(t)

  // 确认删除
  const confirmDelete = async () => {
    const t = delTarget
    if (!t || t.id === undefined) return
    try {
      await deleteTrade(t.id)
      setMsg('已删除 ' + t.date + ' 的记录')
      setDelTarget(null)
      await reload()
    } catch (e) {
      setMsg('删除失败：' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // 合计（两个标的加总）
  const total = useMemo(() => {
    const principal = totalCny(trades)
    const marketValue = (stats.QQQM?.marketValue || 0) + (stats.VGT?.marketValue || 0)
    const costBasis = totalUsdc(trades)
    return { principal, marketValue, costBasis, pnl: marketValue - costBasis }
  }, [trades, stats])

  return (
    <>
      <div className="topbar">
        <div className="kick">POSITION</div>
        <h1>持仓</h1>
        <div className="sub">
          双轨：QQQM 待卖 · VGT 新投 · 累计投入 {fmt(total.principal)} 元
        </div>
      </div>

      <div className="sec">
        {/* ── 合计 ── */}
        <div className="card">
          <h2>合计</h2>
          <div className="row">
            <span className="k">累计本金</span>
            <span className="mid num">{fmt(total.principal)}</span>
          </div>
          <div className="row">
            <span className="k">总市值</span>
            <span className="v num">{fmt(total.marketValue)}</span>
          </div>
          <div className="row">
            <span className="k">总浮盈亏</span>
            <span className={'v num ' + (total.pnl > 0 ? 'ok' : total.pnl < 0 ? 'stop' : '')}>
              {fmtSigned(total.pnl)}
            </span>
          </div>
          <div className="hint">
            还有 {fmt(cfg.investQuota - usedThisMonth)} 元本月额度
            {usedThisMonth > cfg.investQuota ? '（已超 ' + fmt(usedThisMonth - cfg.investQuota) + ' 元）' : ''}
          </div>
        </div>

        {/* ── 每个标的的持仓卡 ── */}
        {SYMBOLS.map((s) => {
          const st = stats[s]
          const q = quotes[s]
          const pnlCls = st.pnl > 0 ? 'ok' : st.pnl < 0 ? 'stop' : ''
          const isLive = live[s]
          return (
            <div className="card" key={s}>
              <h2>
                {s}
                <span className="lbl" style={{ marginLeft: 8, fontWeight: 400 }}>
                  {SYMBOL_NOTE[s]}
                </span>
              </h2>

              <MoneyInput
                label="现价"
                suffix="USD"
                value={prices[s] || 0}
                onChange={(v) => {
                  setLive((p) => ({ ...p, [s]: false }))
                  setPrices((p) => ({ ...p, [s]: v }))
                }}
                placeholder="0.00"
              />

              <div className="quote-bar">
                {q.error ? (
                  <span className="stop">行情失败：{q.error}</span>
                ) : q.quote ? (
                  <>
                    <span className={'quote-px ' + (q.quote.change >= 0 ? 'ok' : 'stop')}>
                      ${fmt(q.quote.price)}
                    </span>
                    <span className={'quote-chg ' + (q.quote.change >= 0 ? 'ok' : 'stop')}>
                      {q.quote.change >= 0 ? '+' : ''}
                      {fmt(q.quote.change, 2)}（{q.quote.change >= 0 ? '+' : ''}
                      {fmt(q.quote.changePct, 2)}%）
                    </span>
                    <span className="quote-meta">{isLive ? '跟随中' : '已手动覆盖'}</span>
                  </>
                ) : (
                  <span className="quote-meta">{q.loading ? '获取行情中…' : '暂无行情'}</span>
                )}
                <button className="quote-refresh" type="button" onClick={q.refresh}>
                  {q.loading ? '…' : '刷新'}
                </button>
                {!isLive ? (
                  <button
                    className="quote-refresh"
                    type="button"
                    onClick={() => setLive((p) => ({ ...p, [s]: true }))}
                  >
                    恢复跟随
                  </button>
                ) : null}
              </div>

              <div className="row">
                <span className="k">累计本金</span>
                <span className="mid num">{fmt(st.principal)}</span>
              </div>
              <div className="row">
                <span className="k">持有股数</span>
                <span className="mid num">{fmt(st.held, 4)}</span>
              </div>
              <div className="row">
                <span className="k">成本价（USD）</span>
                <span className="mid num">{fmt(st.cost, 2)}</span>
              </div>
              <div className="row">
                <span className="k">市值</span>
                <span className="v num">{fmt(st.marketValue)}</span>
              </div>
              <div className="row">
                <span className="k">浮盈亏</span>
                <span className={'v num ' + pnlCls}>{fmtSigned(st.pnl)}</span>
              </div>
              <div className="row">
                <span className="k">浮盈亏%</span>
                <span className={'v num ' + pnlCls}>{fmtSigned(st.pnlPct)}%</span>
              </div>
              <div className="lbl" style={{ marginTop: 6 }}>
                成本基准 {fmt(st.usdc)} USDC · 均价 {fmt(st.rate, 4)}
              </div>
            </div>
          )
        })}

        <div className="btn-row">
          <button className="btn ghost sm" type="button" onClick={() => void savePriceNow()}>
            保存现价到本月
          </button>
        </div>

        {/* ── 录入 ── */}
        <div className="card">
          <h2>录入交易</h2>
          <div className="field">
            <label>标的</label>
            <div className="btn-row" style={{ marginTop: 4 }}>
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  className={'btn sm ' + (sym === s ? '' : 'ghost')}
                  type="button"
                  onClick={() => setSym(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>日期</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <MoneyInput label="投入人民币" suffix="元" value={cny} onChange={setCny} placeholder="500" />
          <MoneyInput label="到账" suffix="USDC" value={usdc} onChange={setUsdc} placeholder="0.00" />
          <MoneyInput label="成交数量" suffix="股" value={shares} onChange={setShares} placeholder="0.0000" />
          <MoneyInput label="成交价" suffix="USD" value={price} onChange={setPrice} placeholder="0.00" />

          {quotaLeft > 0 ? (
            <div className="hint">本月剩余额度 {fmt(quotaLeft)} 元</div>
          ) : (
            <div className="hint warn">
              本月已投 {fmt(usedThisMonth)} 元，超出预算额度 {fmt(cfg.investQuota)} 元
            </div>
          )}

          <div className="btn-row">
            <button className="btn" type="button" disabled={!canSubmit} onClick={() => void submit()}>
              记录这笔
            </button>
          </div>
          {msg ? <div className="hint ok">{msg}</div> : null}
        </div>

        {/* ── 交易记录 ── */}
        <div className="card">
          <h2>
            交易记录
            <span className="lbl" style={{ marginLeft: 8, fontWeight: 400 }}>
              已持有 {heldSymbols.join(' + ') || '—'}
            </span>
          </h2>
          {sorted.length === 0 ? (
            <div className="empty">还没有交易记录</div>
          ) : (
            sorted.map((t) => (
              <div className="row trade-row" key={String(t.id ?? t.date + t.cny)}>
                <span className="k">
                  <span className="num">
                    <strong>{symbolOf(t)}</strong> · {t.date}
                  </span>
                  <div className="lbl num">
                    {fmt(t.cny)} 元 · {fmt(t.shares, 4)} 股 @ {fmt(t.price)}
                  </div>
                  {quotaMonthOf(t) !== (t.date || '').slice(0, 7) ? (
                    <div className="lbl warn">算作 {quotaMonthOf(t)} 的额度</div>
                  ) : null}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => openQuota(t)}
                  >
                    改月份
                  </button>
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => openDelete(t)}
                  >
                    删除
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <Sheet
        open={quotaTarget !== null}
        title="这笔钱算哪个月的额度"
        desc={
          quotaTarget
            ? '这笔 ' + fmt(quotaTarget.cny) + ' 元，成交日 ' + quotaTarget.date +
              '。留空则按成交月份（' + (quotaTarget.date || '').slice(0, 7) + '）计算。'
            : ''
        }
        input={{
          value: quotaDraft,
          type: 'month',
          placeholder: '2026-10',
          onChange: setQuotaDraft,
        }}
        confirmText="保存"
        onConfirm={() => void confirmQuota()}
        onCancel={() => setQuotaTarget(null)}
      />

      <Sheet
        open={delTarget !== null}
        title="删除这笔记录？"
        desc={
          delTarget
            ? symbolOf(delTarget) + ' · ' + delTarget.date + ' · ' + fmt(delTarget.cny) + ' 元 · ' +
              fmt(delTarget.shares, 4) + ' 股。删除后无法恢复。'
            : ''
        }
        confirmText="删除"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDelTarget(null)}
      />
    </>
  )
}
