// src/calc/threshold.ts —— 阈值进度条的百分比计算。
//
// 抽成纯函数的原因：标签错位是个静默 bug（数字没错，位置错了，肉眼很难发现），
// 必须有断言钉住「12,000 的位置必须小于 15,000 的位置」这条不变式。

import type { Config } from '../types'

export interface ThresholdScale {
  /** 目标线对应的总额（进度条右端） */
  max: number
  /** 停投线百分比 */
  stopPct: number
  /** 警戒线百分比 */
  warnPct: number
  /** 当前现金百分比 */
  cashPct: number
}

/** 金额 → 百分比，夹在 0~100 */
export function pctOf(value: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.max(0, Math.min(100, ((value || 0) / max) * 100))
}

/**
 * 计算进度条各刻度位置。
 *
 * 不变式（必须永远成立）：
 *   0 ≤ stopPct ≤ warnPct ≤ 100
 *   现金在两个阈值之间时，cashPct 也必须落在两者之间。
 * 曾经破坏了这条：标签用 flex 均分到 0/50/100，导致 12,000 显示在「15,000」右边。
 */
export function thresholdScale(cash: number, cfg: Config): ThresholdScale {
  const max = Math.max(1, cfg.targetLine || 0)
  return {
    max,
    stopPct: pctOf(cfg.stopLine, max),
    warnPct: pctOf(cfg.warnLine, max),
    cashPct: pctOf(cash, max),
  }
}
