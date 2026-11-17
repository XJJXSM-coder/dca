// src/db/repo.ts —— 数据访问层。UI 只通过这里读写，不直接碰 db。

import { db } from './schema'
import type { KV } from './schema'
import type { Config, MonthRecord, Trade } from '../types'
import { DEFAULT_CONFIG } from '../types'

const CONFIG_KEY = 'config'

/** 新增一笔定投记录，返回自增 id */
export async function addTrade(t: Omit<Trade, 'id'>): Promise<number> {
  return await db.trades.add(t as Trade)
}

/** 全部记录，按 date 升序（同日保持插入顺序） */
export async function listTrades(): Promise<Trade[]> {
  const all = await db.trades.toArray()
  return all.sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '')
    if (d !== 0) return d
    return (a.id ?? 0) - (b.id ?? 0)
  })
}

/** 改某笔交易的额度归属月；传 undefined 表示恢复按成交月份 */
export async function updateTradeQuota(id: number, quotaYm?: string): Promise<void> {
  const cur = await db.trades.get(id)
  if (!cur) return
  const next: Trade = { ...cur }
  if (quotaYm) next.quotaYm = quotaYm
  else delete next.quotaYm
  await db.trades.put(next)
}

/** 按 id 删除一笔记录 */
export async function deleteTrade(id: number): Promise<void> {
  await db.trades.delete(id)
}

/** 取某月记录 */
export async function getMonth(ym: string): Promise<MonthRecord | undefined> {
  return await db.months.get(ym)
}

/** 写入/覆盖某月记录 */
export async function upsertMonth(m: MonthRecord): Promise<void> {
  await db.months.put(m)
}

/** 全部月份记录，按 ym 升序 */
export async function listMonths(): Promise<MonthRecord[]> {
  const all = await db.months.toArray()
  return all.sort((a, b) => (a.ym || '').localeCompare(b.ym || ''))
}

/** 读配置；没有则返回默认值 */
export async function getConfig(): Promise<Config> {
  const row = await db.kv.get(CONFIG_KEY)
  if (!row || !row.value) return { ...DEFAULT_CONFIG }
  return { ...DEFAULT_CONFIG, ...(row.value as Partial<Config>) }
}

/** 写配置 */
export async function setConfig(c: Config): Promise<void> {
  const row: KV = { key: CONFIG_KEY, value: c }
  await db.kv.put(row)
}

/** 全量导出为 JSON 字符串 */
export async function exportAll(): Promise<string> {
  const [trades, months, cfg] = await Promise.all([
    listTrades(),
    listMonths(),
    getConfig(),
  ])
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), trades, months, config: cfg },
    null,
    2,
  )
}

/** 清空后整体导入；JSON 解析失败直接 throw */
export async function importAll(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    trades?: Trade[]
    months?: MonthRecord[]
    config?: Partial<Config>
  }
  if (!data || typeof data !== 'object') {
    throw new Error('导入失败：JSON 结构不是对象')
  }
  const trades = Array.isArray(data.trades) ? data.trades : []
  const months = Array.isArray(data.months) ? data.months : []
  const cfg: Config = { ...DEFAULT_CONFIG, ...(data.config || {}) }

  await db.transaction('rw', db.trades, db.months, db.kv, async () => {
    await db.trades.clear()
    await db.months.clear()
    await db.kv.clear()
    if (trades.length) {
      // 保留原 id（若无 id 则自增）
      const rows = trades.map((t) => {
        const copy: Trade = { ...t }
        if (copy.id === undefined) delete copy.id
        return copy
      })
      await db.trades.bulkAdd(rows)
    }
    if (months.length) await db.months.bulkPut(months)
    await db.kv.put({ key: CONFIG_KEY, value: cfg })
  })
}

/** 申请持久化存储；不支持时返回 false */
export async function ensurePersist(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    const already = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : false
    if (already) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
