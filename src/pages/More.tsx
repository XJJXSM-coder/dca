import { useMemo } from 'react'
import { avgRate, costPrice, totalCash } from '../calc'
import { isComplete } from '../tasks'
import type { AppData } from '../App'
import { fmt } from '../components/MoneyInput'

export interface MoreProps {
  data: AppData
}

/** 某月的交易：按成交月份归集 */
function tradesOf(trades: AppData['trades'], ym: string) {
  return trades.filter((t) => (t.date || '').slice(0, 7) === ym)
}

export default function More({ data }: MoreProps) {
  const { months, trades, cfg } = data

  const sorted = useMemo(() => [...months].sort((x, y) => (x.ym < y.ym ? 1 : -1)), [months])

  return (
    <>
      <div className="topbar">
        <div className="kick">HISTORY</div>
        <h1>更多</h1>
        <div className="sub">按月归档的记录</div>
      </div>

      <div className="sec">
        <div className="card">
          <h2>月度时间轴</h2>
          {sorted.length === 0 ? (
            <div className="empty">还没有月份记录</div>
          ) : (
            sorted.map((m) => {
              const ts = tradesOf(trades, m.ym)
              const paid = ts.reduce((s, t) => s + (t.cny || 0), 0)
              const cash = totalCash(m)
              const cov = cfg.rigid ? cash / cfg.rigid : 0
              const cp = costPrice(ts)
              const rate = avgRate(ts)
              const done = isComplete(m)
              return (
                <div className="row" key={m.ym} style={{ alignItems: 'flex-start' }}>
                  <span className="k">
                    <div className="num" style={{ fontWeight: 700 }}>
                      {m.ym}
                    </div>
                    <div className="lbl num">
                      {cp > 0 ? '汇率 ' + fmt(rate, 4) + ' · 成本价 ' + fmt(cp) + ' · ' : ''}
                      现金 {fmt(cash)}
                    </div>
                    <div className="lbl num">覆盖率 {fmt(cov)} 个月</div>
                  </span>
                  <span className="v">
                    <div className="num">{fmt(paid)}</div>
                    <span className={done ? 'badge ok' : 'badge warn'}>
                      {done ? '已完成' : '未完成'}
                    </span>
                  </span>
                </div>
              )
            })
          )}
        </div>

        <div className="note">
          <b>关于这个 App</b>
          <div>
            它只做两件事：记录你每月的定投数据，以及提醒你别超出限额。
            不提供任何买卖建议，不做行情推送，不做涨跌提醒，数据只存在这台设备的本地。
          </div>
        </div>
      </div>
    </>
  )
}
