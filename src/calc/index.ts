// src/calc/index.ts —— 纯函数计算层。不依赖 DB / DOM，全部可单测。

import type { Config, Level, MonthRecord, Trade } from '../types'

/** 全部投入的人民币合计 */
export function totalCny(trades: Trade[]): number {
  return trades.reduce((s, t) => s + (t.cny || 0), 0)
}

/** 某笔记录的标的；历史记录没填 symbol 时按 QQQM 处理 */
export function symbolOf(t: Trade): string {
  return (t.symbol || 'QQQM').toUpperCase()
}

/** 按标的筛选记录（择时卖 QQQM + 新钱买 VGT 的双轨持仓都靠它拆） */
export function bySymbol(trades: Trade[], symbol: string): Trade[] {
  const want = symbol.toUpperCase()
  return trades.filter((t) => symbolOf(t) === want)
}

/** 记录里出现过的全部标的，按首次出现顺序去重 */
export function symbolsIn(trades: Trade[]): string[] {
  const seen: string[] = []
  for (const t of trades) {
    const s = symbolOf(t)
    if (!seen.includes(s)) seen.push(s)
  }
  return seen
}

/** 全部到账 USDC 合计 */
export function totalUsdc(trades: Trade[]): number {
  return trades.reduce((s, t) => s + (t.usdc || 0), 0)
}

/** 全部成交股数合计 */
export function totalShares(trades: Trade[]): number {
  return trades.reduce((s, t) => s + (t.shares || 0), 0)
}

/** 成本价 = 总 USDC / 总股数；空数组返回 0 */
export function costPrice(trades: Trade[]): number {
  const shares = totalShares(trades)
  if (shares === 0) return 0
  return totalUsdc(trades) / shares
}

/** 平均汇率 = 总 CNY / 总 USDC；空数组返回 0 */
export function avgRate(trades: Trade[]): number {
  const usdc = totalUsdc(trades)
  if (usdc === 0) return 0
  return totalCny(trades) / usdc
}

/** 按当前价计算市值 / 成本 / 盈亏 / 盈亏百分比 */
export function pnl(
  trades: Trade[],
  priceNow: number,
): { marketValue: number; costBasis: number; pnl: number; pnlPct: number } {
  const marketValue = totalShares(trades) * (priceNow || 0)
  const costBasis = totalUsdc(trades)
  const diff = marketValue - costBasis
  const pnlPct = costBasis === 0 ? 0 : (diff / costBasis) * 100
  return { marketValue, costBasis, pnl: diff, pnlPct }
}

/** 三处现金合计 */
export function totalCash(m: Pick<MonthRecord, 'cashA' | 'cashB' | 'cashC'>): number {
  return (m.cashA || 0) + (m.cashB || 0) + (m.cashC || 0)
}

/** 覆盖倍数 = 现金 / 刚性支出；刚性为 0 时返回 0 */
export function coverage(cash: number, rigid: number): number {
  if (!rigid) return 0
  return cash / rigid
}

/** 距目标金额的差额，可为负 */
export function gapToTarget(cash: number, target: number): number {
  return (target || 0) - (cash || 0)
}

/**
 * 现金安全水位。
 * 现金 <= stopLine → 'stop'（等于止损线也按 stop 处理，纪律上取保守侧）
 * 现金 <  warnLine → 'warn'
 * 否则              → 'ok'
 */
export function level(cash: number, cfg: Config): Level {
  if (cash <= cfg.stopLine) return 'stop'
  if (cash < cfg.warnLine) return 'warn'
  return 'ok'
}

/** 取 date（"2026-11-02"）的月份部分 —— "2026-11" */
function ymOf(date: string): string {
  return (date || '').slice(0, 7)
}

/** 这笔钱算哪个月的额度：填了 quotaYm 就用它，否则按成交月份 */
export function quotaMonthOf(t: Trade): string {
  return t.quotaYm || ymOf(t.date)
}

/** 指定月份已投入的人民币合计（按额度归属月） */
export function monthUsed(trades: Trade[], ym: string): number {
  return trades.reduce((s, t) => (quotaMonthOf(t) === ym ? s + (t.cny || 0) : s), 0)
}

/** 指定月份剩余额度 = quota - 已投；已超额时为负 */
export function monthLeft(trades: Trade[], ym: string, quota: number): number {
  return (quota || 0) - monthUsed(trades, ym)
}

export function prevYm(ym: string): string {
  const [y, mo] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, (mo || 1) - 2, 1))
  const py = d.getUTCFullYear()
  const pm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${py}-${pm}`
}
