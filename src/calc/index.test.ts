import { describe, it, expect } from 'vitest'
import {
  totalCny,
  totalUsdc,
  totalShares,
  costPrice,
  avgRate,
  pnl,
  totalCash,
  coverage,
  gapToTarget,
  level,
  monthUsed,
  monthLeft,
} from './index'
import { isComplete, streak, tasksForMonth } from '../tasks'
import { thresholdScale } from './threshold'
import type { MonthRecord, Trade } from '../types'
import { DEFAULT_CONFIG } from '../types'

/** 用户真实首笔：2026-11-02 投入 700 元（10 月份额补投） */
const REAL: Trade[] = [
  // 真实首笔：700 元换 105.74 USDC，加账户余额 0.07 共买入 105.81 USDC，成交价 286.72
  { id: 1, date: '2026-11-02', cny: 700, usdc: 105.81, shares: 105.81 / 286.72, price: 286.72, note: '10月份额补投' },
]

function month(ym: string, tasksDone: string[]): MonthRecord {
  return { ym, cashA: 0, cashB: 0, cashC: 0, tasksDone }
}

describe('汇总计算', () => {
  it('1. 真实数据 costPrice ≈ 286.72（容差 0.1）', () => {
    expect(costPrice(REAL)).toBeCloseTo(286.72, 1)
    // 同时校验成本价 = 总 usdc / 总 shares 的定义
    expect(costPrice(REAL)).toBeCloseTo(totalUsdc(REAL) / totalShares(REAL), 6)
  })

  it('2. 真实数据 avgRate ≈ 6.6156（容差 0.001）', () => {
    expect(avgRate(REAL)).toBeCloseTo(6.6156, 3)
  })

  it('空数组的除法类函数返回 0，不产生 NaN / Infinity', () => {
    expect(costPrice([])).toBe(0)
    expect(avgRate([])).toBe(0)
    expect(totalCny([])).toBe(0)
    expect(totalUsdc([])).toBe(0)
    expect(totalShares([])).toBe(0)
  })

  it('多项累加', () => {
    const trades: Trade[] = [
      ...REAL,
      { id: 2, date: '2026-12-02', cny: 500, usdc: 75.5, shares: 0.26, price: 290.4 },
    ]
    expect(totalCny(trades)).toBeCloseTo(1200, 6)
    expect(totalUsdc(trades)).toBeCloseTo(105.81 + 75.5, 6)
    expect(totalShares(trades)).toBeCloseTo(105.81 / 286.72 + 0.26, 6)
    expect(avgRate(trades)).toBeCloseTo(1200 / (105.81 + 75.5), 6)
  })
})

describe('现金与水位', () => {
  it('3. 现金 {3150,5218,0} → totalCash = 8368，coverage ≈ 2.66', () => {
    const cash = totalCash({ cashA: 3150, cashB: 5218, cashC: 0 })
    expect(cash).toBe(8368)
    expect(coverage(cash, DEFAULT_CONFIG.rigid)).toBeCloseTo(2.66, 2)
  })

  it('coverage 在 rigid 为 0 时返回 0', () => {
    expect(coverage(8368, 0)).toBe(0)
  })

  it('gapToTarget 可为负', () => {
    expect(gapToTarget(8368, DEFAULT_CONFIG.targetLine)).toBe(DEFAULT_CONFIG.targetLine - 8368)
    expect(gapToTarget(20000, DEFAULT_CONFIG.targetLine)).toBeLessThan(0)
  })

  it('4. level 三档判定：14288 → warn，10500 → stop，18900 → ok', () => {
    expect(level(14288, DEFAULT_CONFIG)).toBe('warn')
    expect(level(10500, DEFAULT_CONFIG)).toBe('stop')
    expect(level(18900, DEFAULT_CONFIG)).toBe('ok')
  })

  it('level 边界：止损线及以下为 stop，低于警戒线为 warn，等于警戒线为 ok', () => {
    expect(level(DEFAULT_CONFIG.stopLine - 1, DEFAULT_CONFIG)).toBe('stop')
    expect(level(DEFAULT_CONFIG.stopLine + 1, DEFAULT_CONFIG)).toBe('warn')
    expect(level(DEFAULT_CONFIG.warnLine - 1, DEFAULT_CONFIG)).toBe('warn')
    expect(level(DEFAULT_CONFIG.warnLine, DEFAULT_CONFIG)).toBe('ok')
  })
})

describe('月度额度', () => {
  const crossMonth: Trade[] = [
    { id: 1, date: '2026-11-02', cny: 700, usdc: 105.74, shares: 0.369, price: 286.72 },
    { id: 2, date: '2026-11-28', cny: 200, usdc: 30.1, shares: 0.104, price: 289.4 },
    { id: 3, date: '2026-12-02', cny: 500, usdc: 75.5, shares: 0.26, price: 290.4 },
    { id: 4, date: '2027-01-05', cny: 500, usdc: 73.2, shares: 0.25, price: 292.8 },
  ]

  it('5. monthUsed 只统计指定月份，跨月隔离正确', () => {
    expect(monthUsed(crossMonth, '2026-11')).toBe(900)
    expect(monthUsed(crossMonth, '2026-12')).toBe(500)
    expect(monthUsed(crossMonth, '2027-01')).toBe(500)
    expect(monthUsed(crossMonth, '2027-02')).toBe(0)
  })

  it('6. monthLeft(已投700, quota500) = -200（允许负数，仅提示不拦截）', () => {
    expect(monthUsed(REAL, '2026-11')).toBe(700)
    expect(monthLeft(REAL, '2026-11', 500)).toBe(-200)
  })

  it('monthLeft 未投时等于全额，刚好投满为 0', () => {
    expect(monthLeft(REAL, '2026-12', 500)).toBe(500)
    expect(monthLeft(REAL, '2026-11', 700)).toBe(0)
  })

})

describe('盈亏', () => {
  it('7. priceNow = 282.09 时 pnl 为负', () => {
    const r = pnl(REAL, 282.09)
    expect(r.costBasis).toBeCloseTo(105.81, 6)
    expect(r.marketValue).toBeCloseTo((105.81 / 286.72) * 282.09, 6)
    expect(r.pnl).toBeLessThan(0)
    expect(r.pnlPct).toBeLessThan(0)
    expect(r.pnl).toBeCloseTo(r.marketValue - r.costBasis, 6)
  })

  it('priceNow 高于成本价时 pnl 为正', () => {
    const r = pnl(REAL, 300)
    expect(r.pnl).toBeGreaterThan(0)
    expect(r.pnlPct).toBeGreaterThan(0)
  })

  it('空持仓时 pnl 全为 0', () => {
    const r = pnl([], 282.09)
    expect(r).toEqual({ marketValue: 0, costBasis: 0, pnl: 0, pnlPct: 0 })
  })
})

describe('任务完成度', () => {
  const BASE = ['invest', 'transfer', 'insurance', 'recordRate', 'reconcile']

  it('isComplete：常驻 5 条全勾才算完成（月利宝已清零、一次性任务已做完）', () => {
    const m = { ym: '2026-12', cashA: 3150, cashB: 5000, cashC: 0, tasksDone: BASE }
    const done = { ym: '2026-11', cashA: 3150, cashB: 4000, cashC: 0, tasksDone: ['once_policy'] }
    expect(isComplete(m, [done, m])).toBe(true)
  })

  it('月利宝为 0 时，清空月利宝这条不出现', () => {
    const m = { ym: '2026-12', cashA: 3150, cashB: 5000, cashC: 0, tasksDone: [] }
    const keys = tasksForMonth({ ym: '2026-12', record: m, months: [m] }).map((x) => x.key)
    expect(keys).not.toContain('clearYlb')
  })

  it('月利宝里有钱时，清空月利宝必须出现', () => {
    const m = { ym: '2026-12', cashA: 3150, cashB: 5000, cashC: 8716, tasksDone: [] }
    const keys = tasksForMonth({ ym: '2026-12', record: m, months: [m] }).map((x) => x.key)
    expect(keys).toContain('clearYlb')
  })

  it('月利宝历史清零过，之后没录现金也不再提醒', () => {
    const cleared = { ym: '2026-11', cashA: 3150, cashB: 5000, cashC: 0, tasksDone: [] }
    // 12 月还没录现金（全 0），但历史上 11 月已清零 → 不提醒
    const noCash = { ym: '2026-12', cashA: 0, cashB: 0, cashC: 0, tasksDone: [] }
    const keys = tasksForMonth({ ym: '2026-12', record: noCash, months: [cleared, noCash] })
      .map((x) => x.key)
    expect(keys).not.toContain('clearYlb')
  })

  it('从没录过现金时，仍提醒一次清空月利宝', () => {
    const keys = tasksForMonth({ ym: '2026-12', months: [] }).map((x) => x.key)
    expect(keys).toContain('clearYlb')
  })

  it('保险核对每月都出现', () => {
    const keys = tasksForMonth({ ym: '2026-12', months: [] }).map((x) => x.key)
    expect(keys).toContain('insurance')
  })

  it('一次性任务做完后永久消失', () => {
    const before = tasksForMonth({ ym: '2026-12', months: [] }).map((x) => x.key)
    expect(before).toContain('once_policy')
    const done = { ym: '2026-11', cashA: 0, cashB: 0, cashC: 0, tasksDone: ['once_policy'] }
    const after = tasksForMonth({ ym: '2026-12', months: [done] }).map((x) => x.key)
    expect(after).not.toContain('once_policy')
  })

  it('居民医保 / 公积金只在 2027-03 及以后出现', () => {
    const nov = tasksForMonth({ ym: '2026-11', months: [] }).map((x) => x.key)
    const mar = tasksForMonth({ ym: '2027-03', months: [] }).map((x) => x.key)
    expect(nov).not.toContain('once_medicare')
    expect(mar).toContain('once_medicare')
    expect(mar).toContain('once_fund')
  })

  it('惠闽宝只在 2027-07 及以后出现（福建每年 7/8 开售）', () => {
    const nov = tasksForMonth({ ym: '2026-11', months: [] }).map((x) => x.key)
    const jun = tasksForMonth({ ym: '2027-06', months: [] }).map((x) => x.key)
    const jul = tasksForMonth({ ym: '2027-07', months: [] }).map((x) => x.key)
    expect(nov).not.toContain('once_huimin')
    expect(jun).not.toContain('once_huimin')
    expect(jul).toContain('once_huimin')
  })

  it('惠闽宝买完后永久消失', () => {
    const done = { ym: '2027-07', cashA: 0, cashB: 0, cashC: 0, tasksDone: ['once_huimin'] }
    const aug = tasksForMonth({ ym: '2027-08', months: [done] }).map((x) => x.key)
    expect(aug).not.toContain('once_huimin')
  })

  it('2027-02/03 才出现特殊事项', () => {
    expect(tasksForMonth({ ym: '2027-02', months: [] }).map((x) => x.key)).toContain('special')
    expect(tasksForMonth({ ym: '2026-11', months: [] }).map((x) => x.key)).not.toContain('special')
  })

  // 一次性任务 once_policy 也必须勾上，否则任何月份都不算完成
  const FULL = [...BASE, 'once_policy']

  it('streak 从当月往前数连续完成月，当月未完成不判定断', () => {
    const mk = (ym: string, done: string[]) => ({ ym, cashA: 3150, cashB: 1000, cashC: 0, tasksDone: done })
    const months = [mk('2026-08', FULL), mk('2026-09', FULL), mk('2026-10', FULL), mk('2026-11', [])]
    expect(streak(months, '2026-11')).toBe(3)
    expect(streak(months, '2026-10')).toBe(3)
  })

  it('streak 遇到缺失或未完成的中间月即停止', () => {
    const mk = (ym: string) => ({ ym, cashA: 3150, cashB: 1000, cashC: 0, tasksDone: FULL })
    expect(streak([mk('2026-07'), mk('2026-09')], '2026-09')).toBe(1)
    expect(streak([], '2026-11')).toBe(0)
  })
})

describe('阈值进度条刻度', () => {
  // 回归：曾用 flex 均分把标签摊在 0/50/100，导致 12,000 显示在「15,000」右边。
  // 这里钉住不变式：刻度按真实金额比例定位，且顺序不乱。
  it('默认配置的刻度位置：stop≈55.6% / warn≈79.4% / 目标 100%', () => {
    const s = thresholdScale(0, DEFAULT_CONFIG)
    expect(s.stopPct).toBeCloseTo((10500 / 18900) * 100, 4)
    expect(s.warnPct).toBeCloseTo((15000 / 18900) * 100, 4)
    expect(s.max).toBe(18900)
  })

  it('12,000 的指针必须在 15,000 刻度的左边', () => {
    const s = thresholdScale(12000, DEFAULT_CONFIG)
    const warnOf15k = (15000 / DEFAULT_CONFIG.targetLine) * 100
    expect(s.cashPct).toBeLessThan(warnOf15k)
    // 同时必须在 10,500 右边（属黄灯区）
    expect(s.cashPct).toBeGreaterThan(s.stopPct)
  })

  it('不变式：0 ≤ stop ≤ warn ≤ 100', () => {
    const s = thresholdScale(0, DEFAULT_CONFIG)
    expect(s.stopPct).toBeGreaterThanOrEqual(0)
    expect(s.stopPct).toBeLessThanOrEqual(s.warnPct)
    expect(s.warnPct).toBeLessThanOrEqual(100)
  })

  it('现金超出目标时百分比夹在 100，不会溢出', () => {
    expect(thresholdScale(999999, DEFAULT_CONFIG).cashPct).toBe(100)
  })

  it('负数与 targetLine=0 不会产生 NaN / Infinity', () => {
    expect(thresholdScale(-500, DEFAULT_CONFIG).cashPct).toBe(0)
    const zero = thresholdScale(1000, { ...DEFAULT_CONFIG, targetLine: 0 })
    expect(Number.isFinite(zero.stopPct)).toBe(true)
    expect(Number.isFinite(zero.cashPct)).toBe(true)
  })
})
