// src/db/schema.ts —— Dexie 数据库定义。只做结构与实例，不写业务逻辑。
//
// 版本历史：
//   v1 — 初始：trades / months / kv
//   v2 — 结构不变，仅用于修复「空壳数据库」：若某个库以 v1 被创建但没有表
//        （例如外部脚本直接 indexedDB.open 过），Dexie 在 v1 上不会重建表；
//        升到 v2 会触发一次 upgrade，把缺失的表补建回来。已有数据不受影响。

import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Config, MonthRecord, Trade } from '../types'

export interface KV {
  key: string
  value: any
}

export class AppDB extends Dexie {
  trades!: Table<Trade, number>
  months!: Table<MonthRecord, string>
  kv!: Table<KV, string>

  constructor(name = 'dca-tracker') {
    super(name)
    // v1：最初的结构
    this.version(1).stores({
      trades: '++id, date',
      months: 'ym',
      kv: 'key',
    })
    // v2：结构相同，仅保证表一定存在（修复空壳库）
    this.version(2).stores({
      trades: '++id, date',
      months: 'ym',
      kv: 'key',
    })
  }
}

export const db = new AppDB()
