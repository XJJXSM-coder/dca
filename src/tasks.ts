// src/tasks.ts —— 月度任务定义。
//
// 三类任务：
//   ① 常驻任务：每月都做
//   ② 条件任务：只有"真的需要做"时才出现（visibleWhen）
//   ③ 一次性任务：做完就永久消失（once，靠 everDone 判断）

import type { MonthRecord, TaskContext, TaskDef } from './types'

/** 某个 key 是否在任意历史月份里被勾选过 */
function everDone(key: string, months: MonthRecord[]): boolean {
  return months.some((m) => (m.tasksDone || []).includes(key))
}

/**
 * 「清空月利宝」是否还需要提醒。
 *
 * 判定顺序：
 * 1. 本月录了现金且月利宝 > 0  → 必须提醒
 * 2. 本月录了现金且月利宝 = 0  → 不提醒（已清空）
 * 3. 本月没录现金 → 看历史：
 *    a. 有过任何一个月月利宝 = 0 的记录 → 认为已清空过，不再提醒
 *    b. 从没出现过月利宝 = 0 → 提醒（可能还没清）
 */
function ylbHasMoney(ctx: TaskContext): boolean {
  const rec = ctx.record
  const hasCash = rec ? (rec.cashA || 0) + (rec.cashB || 0) + (rec.cashC || 0) > 0 : false
  if (hasCash) return (rec!.cashC || 0) > 0

  // 本月没录现金：看历史上是否出现过月利宝 = 0
  const everZero = ctx.months.some(
    (m) => (m.cashA || 0) + (m.cashB || 0) + (m.cashC || 0) > 0 && (m.cashC || 0) === 0,
  )
  if (everZero) return false
  return !everDone('clearYlb', ctx.months)
}

export const TASK_DEFS: TaskDef[] = [
  // ── 投资与现金 ──────────────────────────────
  {
    key: 'invest',
    title: '划 500 元买 VGT',
    day: 22,
    hint: '发薪后第 2 天，先买 USDC 再买 VGT',
  },
  {
    key: 'transfer',
    title: '结余转余利宝',
    day: 22,
    hint: '留够当月开支，剩下的全部转入',
  },
  {
    key: 'clearYlb',
    title: '清空月利宝',
    day: 23,
    hint: '月利宝每月只有 23 号能取，离职期不能用',
    visibleWhen: ylbHasMoney,
  },

  // ── 保险 ────────────────────────────────────
  {
    key: 'insurance',
    title: '核对保险扣款',
    day: 21,
    hint: '确认储蓄险 300 元已扣；医疗险买好后这条会更新金额',
    // 只买了一份储蓄险（300/月），医疗险还没买 → 金额未定，先只核对储蓄险
  },

  // ── 记账与对账 ──────────────────────────────
  {
    key: 'recordRate',
    title: '记录当月汇率',
    day: 25,
    hint: '填进持仓页的"现价"，顺手记下成交汇率',
  },
  {
    key: 'reconcile',
    title: '月末对账',
    day: 30,
    hint: '核对三处余额，导出一次 JSON 备份',
  },

  // ── 一次性任务：做完永久消失 ─────────────────
  {
    key: 'once_policy',
    title: '买商业医疗险（本人 + 父母）',
    day: 5,
    hint: '金额待定。本人百万医疗 + 意外 + 定期重疾；父母百万医疗',
    visibleWhen: (ctx) => !everDone('once_policy', ctx.months),
  },
  {
    key: 'once_huimin',
    title: '买惠闽宝（奶奶 + 全家）',
    day: 10,
    hint:
      '福建惠闽宝每年 7 月 8 日开售，8 月 31 日截止，9 月 1 日生效。' +
      '2025 年普惠版 129 元 / 升级版 179 元。' +
      '奶奶 78 岁只能买这个（百万医疗超龄买不了）。' +
      '今年（2026 年度）已错过，等 2027 年 7 月。',
    // 2027 年 7 月 1 日起出现，勾了就永久消失
    visibleWhen: (ctx) => ctx.ym >= '2027-07' && !everDone('once_huimin', ctx.months),
  },
  {
    key: 'once_medicare',
    title: '办居民医保',
    day: 5,
    hint: '离职后职工医保断缴，30 天内必须接上，约 400–800 元/年',
    visibleWhen: (ctx) => !everDone('once_medicare', ctx.months) && ctx.ym >= '2027-03',
  },
  {
    key: 'once_fund',
    title: '查清公积金提取条件',
    day: 5,
    hint: '可提 5,280–15,840 元，离职后的备用弹药',
    visibleWhen: (ctx) => !everDone('once_fund', ctx.months) && ctx.ym >= '2027-03',
  },

  // ── 特殊月份 ────────────────────────────────
  {
    key: 'special',
    title: '特殊事项（过年 / 离职准备）',
    day: 1,
    hint: '本月有额外安排，详见计划文档',
    visibleWhen: (ctx) => ctx.ym === '2027-02' || ctx.ym === '2027-03',
  },
]

/** 某月要展示的任务（会考虑记录状态，条件任务可能不出现） */
export function tasksForMonth(ctx: TaskContext): TaskDef[] {
  return TASK_DEFS.filter((t) => (t.visibleWhen ? t.visibleWhen(ctx) : true))
}

/** 只要 ym 就能拿到的任务（不知道记录状态时的保守结果） */
export function tasksForYm(ym: string): TaskDef[] {
  return TASK_DEFS.filter((t) => {
    if (t.key === 'special') return ym === '2027-02' || ym === '2027-03'
    if (t.key === 'clearYlb') return true
    if (t.key === 'once_medicare' || t.key === 'once_fund') return ym >= '2027-03'
    if (t.key === 'once_huimin') return ym >= '2027-07'
    return true
  })
}

/** 某月的应做任务条数 */
export function taskCountFor(ym: string): number {
  return tasksForYm(ym).length
}

/** 某月是否全部完成：只统计"当月确实要求做"的任务 */
export function isComplete(m: MonthRecord, months: MonthRecord[] = []): boolean {
  const required = tasksForMonth({ ym: m.ym, record: m, months }).map((t) => t.key)
  const done = m.tasksDone || []
  if (required.length === 0) return false
  return required.every((k) => done.includes(k))
}

/** ym 的上一个月："2026-01" → "2025-12" */
export function prevYm(ym: string): string {
  const [y, mo] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, (mo || 1) - 2, 1))
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
}

/**
 * 连续完成月数。
 * 从 currentYm 起逐月往前数：当月已完成则 +1；当月未完成（或没有记录）不计入，
 * 但也不判定断，继续看上月；更早的月份一旦缺失或未完成即停止。
 */
export function streak(months: MonthRecord[], currentYm: string): number {
  const map = new Map<string, MonthRecord>()
  for (const m of months) map.set(m.ym, m)

  let count = 0
  let cursor = currentYm
  let isCurrent = true
  for (let i = 0; i < 1200; i++) {
    const m = map.get(cursor)
    const done = m ? isComplete(m, months) : false
    if (done) count++
    else if (!isCurrent) break
    isCurrent = false
    cursor = prevYm(cursor)
  }
  return count
}
