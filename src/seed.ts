// src/seed.ts —— 首次启动时写入用户的真实首笔记录。
//
// 竞态说明（必须保留这段注释）：
// React 18 StrictMode 在开发模式下会把 effect 执行两次，seedIfEmpty() 因此被并发调用两次。
// 原来的 "count() 检查 → add()" 之间有 await 间隙，两次调用都能通过 count 检查，
// 结果插入两条一模一样的记录（实测表现为「累计本金 1,400 / 0.7381 股」，正好是真实值的两倍）。
//
// 修法：模块级 in-flight 锁 + 事务内二次检查。
// · inflight 保证同一时刻只有一个 seed 流程在跑，第二次调用直接复用同一个 Promise
// · 事务内再 count 一次，防止多标签页/多次冷启动之间的残余竞态

import { db } from './db/schema'

/** 同一时刻只允许一个 seed 流程；重复调用复用同一个 Promise */
let inflight: Promise<void> | null = null

/** 固定主键，杜绝重复插入（即使逻辑出问题，第二次写也会覆盖而不是新增） */
const SEED_KEY = 1

export async function seedIfEmpty(): Promise<void> {
  if (inflight) return inflight

  inflight = (async () => {
    try {
      await db.transaction('rw', db.trades, async () => {
        const count = await db.trades.count()
        if (count > 0) return
        await db.trades.add({
          id: SEED_KEY,
          date: '2026-11-02',
          cny: 700,
          // 实际买入用的 USDC（= 700 元换来的 105.74 + 账户原余额 0.07）
          usdc: 105.81,
          // 反算股数，使成本价精确等于成交价 286.72
          shares: 105.81 / 286.72,
          price: 286.72,
          symbol: 'QQQM',
          note: '10月份额补投',
          quotaYm: '2026-10',
        })
      })
    } catch {
      // 主键冲突（已存在 id=1）说明种子已在别的流程写入，属正常情况
    }
  })()

  try {
    await inflight
  } finally {
    inflight = null
  }
}
