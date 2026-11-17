import { useEffect, useMemo, useState } from 'react'
import { getMonth, upsertMonth } from '../db/repo'
import { monthLeft } from '../calc'
import { streak, tasksForMonth } from '../tasks'
import type { AppData, Reload } from '../App'
import { fmt } from '../components/MoneyInput'

export interface HomeProps {
  data: AppData
  reload: Reload
}

function ymLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return y + ' 年 ' + Number(m) + ' 月'
}

export default function Home({ data, reload }: HomeProps) {
  const { cfg, trades, months, currentYm } = data
  const record = useMemo(
    () => months.find((m) => m.ym === currentYm) || null,
    [months, currentYm],
  )

  const tasks = useMemo(
    () => tasksForMonth({ ym: currentYm, record: record || undefined, months }),
    [currentYm, record, months],
  )

  const [done, setDone] = useState<string[]>(record ? record.tasksDone || [] : [])

  useEffect(() => {
    setDone(record ? record.tasksDone || [] : [])
  }, [record])

  const doneCount = tasks.filter((t) => done.includes(t.key)).length
  const pct = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100)

  const left = monthLeft(trades, currentYm, cfg.investQuota)
  const monthsInRow = streak(months, currentYm)
  const specials = tasks.filter((t) => t.key === 'special')

  const toggle = async (key: string) => {
    const next = done.includes(key) ? done.filter((k) => k !== key) : [...done, key]
    const prev = done
    setDone(next)
    try {
      const base = (await getMonth(currentYm)) || {
        ym: currentYm,
        cashA: 0,
        cashB: 0,
        cashC: 0,
        tasksDone: [],
      }
      await upsertMonth({ ...base, ym: currentYm, tasksDone: next })

      
      await reload()
    } catch (e) {
      // 写入失败就回滚勾选状态，别让界面骗人
      setDone(prev)
      console.error('保存任务状态失败', e)
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="kick">DCA DISCIPLINE</div>
        <h1>{ymLabel(currentYm)}</h1>
        <div className="sub">
          {doneCount} / {tasks.length} 已完成
        </div>
      </div>

      <div className="sec">
        <div className="card">
          <h2>本月进度</h2>
          <div className="row">
            <span className="k">已完成任务</span>
            <span className="v num">
              {doneCount} / {tasks.length}
            </span>
          </div>
          <div className="bar">
            <div className="fill" style={{ width: pct + '%' }} />
          </div>
          <div className="row">
            <span className="k">连续完成</span>
            <span className={monthsInRow > 0 ? 'badge ok' : 'badge warn'}>
              连续 {monthsInRow} 个月
            </span>
          </div>
          <div className="row">
            <span className="k">本月剩余额度</span>
            <span className={'v num ' + (left < 0 ? 'warn' : 'ok')}>
              {left < 0 ? '超预算 ' + fmt(-left) + ' 元' : fmt(left) + ' 元'}
            </span>
          </div>
        </div>

        {specials.length > 0 && (
          <div className="note">
            <b>本月特殊安排</b>
            <div>本月含 {specials.length} 条特殊任务，请按说明逐条执行。</div>
          </div>
        )}

        <div className="card">
          <h2>执行清单</h2>
          {tasks.length === 0 ? (
            <div className="empty">本月暂无任务</div>
          ) : (
            tasks.map((t) => {
              const isDone = done.includes(t.key)
              return (
                <div
                  key={t.key}
                  className={isDone ? 'task done' : 'task'}
                  onClick={() => {
                    void toggle(t.key)
                  }}
                >
                  <div className="box" />
                  <div className="body">
                    <div className="t">{t.title}</div>
                    <div className="d">
                      {t.day} 号{t.hint ? ' · ' + t.hint : ''}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
