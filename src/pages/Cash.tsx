import { useEffect, useState } from 'react'
import { getMonth, upsertMonth } from '../db/repo'
import { coverage, gapToTarget, level, totalCash } from '../calc'
import type { Level } from '../types'
import type { AppData, Reload } from '../App'
import { MoneyInput, fmt } from '../components/MoneyInput'
import ThresholdBar from '../components/ThresholdBar'

export interface CashProps {
  data: AppData
  reload: Reload
}

const LEVEL_TEXT: Record<Level, string> = {
  stop: '已跌破停投线，本月禁止新增投资',
  warn: '缓冲偏低，本月不额外加投',
  ok: '缓冲达标',
}

export default function Cash({ data, reload }: CashProps) {
  const { cfg, months, currentYm } = data
  const record = months.find((m) => m.ym === currentYm) || null

  const [a, setA] = useState<number>(record ? record.cashA || 0 : 0)
  const [b, setB] = useState<number>(record ? record.cashB || 0 : 0)
  const [c, setC] = useState<number>(record ? record.cashC || 0 : 0)
  const [saved, setSaved] = useState<boolean>(false)
  const [errMsg, setErrMsg] = useState<string>('')

  useEffect(() => {
    setA(record ? record.cashA || 0 : 0)
    setB(record ? record.cashB || 0 : 0)
    setC(record ? record.cashC || 0 : 0)
  }, [record])

  const cash = totalCash({ cashA: a, cashB: b, cashC: c })
  const cov = coverage(cash, cfg.rigid)
  const lv = level(cash, cfg)
  const gap = gapToTarget(cash, cfg.targetLine)
  const aBad = a !== cfg.cashATarget
  const cBad = c !== 0

  const save = async () => {
    setErrMsg('')
    setSaved(false)
    try {
      const baseRec = (await getMonth(currentYm)) || {
        ym: currentYm,
        cashA: 0,
        cashB: 0,
        cashC: 0,
        tasksDone: [],
      }
      await upsertMonth({ ...baseRec, ym: currentYm, cashA: a, cashB: b, cashC: c })
      setSaved(true)
      await reload()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="kick">CASH BUFFER</div>
        <h1>现金池</h1>
        <div className="sub">刚性支出基准 {fmt(cfg.rigid)} 元 / 月</div>
      </div>

      <div className="sec">
        <div className="card">
          <h2>现金总览</h2>
          <div className="row">
            <span className="k">总现金</span>
            <span className="big num">{fmt(cash)}</span>
          </div>
          <div className="row">
            <span className="k">覆盖月数</span>
            <span className="mid num">{fmt(cov, 2)} 个月</span>
          </div>
          <div className="row">
            <span className="k">距目标</span>
            <span className={'v num ' + (gap > 0 ? 'warn' : 'ok')}>
              {gap > 0 ? '还差 ' + fmt(gap) : '已达标 ' + fmt(-gap)}
            </span>
          </div>
          <ThresholdBar cash={cash} cfg={cfg} />
          <div className={'note ' + (lv === 'stop' ? 'r' : lv === 'ok' ? 'g' : '')}>
            {LEVEL_TEXT[lv]}
          </div>
        </div>

        <div className="card">
          <h2>三处余额</h2>
          <MoneyInput label="余利宝" suffix="元" value={a} onChange={setA} />
          {aBad ? (
            <div className="hint warn">余利宝应为 {fmt(cfg.cashATarget)} 元，当前偏差 {fmt(a - cfg.cashATarget)}</div>
          ) : null}
          <MoneyInput label="周利宝" suffix="元" value={b} onChange={setB} />
          <MoneyInput label="月利宝" suffix="元" value={c} onChange={setC} />
          {cBad ? <div className="hint stop">月利宝应为 0，23 号前转出</div> : null}
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => void save()}>
              保存本月现金
            </button>
          </div>
          {saved ? <div className="hint ok">已保存到 {currentYm}</div> : null}
          {errMsg ? <div className="note r">保存失败：{errMsg}</div> : null}
        </div>
      </div>
    </>
  )
}
