// src/types.ts —— 全应用共享类型。任何改动必须先改这里，两边同步。

export interface Trade {
  id?: number;
  date: string;        // "2026-11-02"
  cny: number;         // 投入人民币
  usdc: number;        // 到账 USDC
  shares: number;      // 成交股数
  price: number;       // 成交价 USD
  note?: string;
  /** 标的代码，'QQQM' 或 'VGT'。缺省按 QQQM（历史记录）处理 */
  symbol?: string;
  /**
   * 这笔钱算哪个月的定投额度，形如 "2026-10"。
   * 不填 = 按成交月份算。录入时不用管，事后在交易列表里改。
   */
  quotaYm?: string;
}

export interface MonthRecord {
  ym: string;          // "2026-11"
  cashA: number;       // 余利宝
  cashB: number;       // 周利宝
  cashC: number;       // 月利宝
  tasksDone: string[];
  priceEnd?: number;
  /** VGT 现价（双标的拆分后新增，历史 QQQM 价仍在 priceEnd） */
  priceEndVgt?: number;
}

export interface Config {
  income: number;
  rigid: number;       // 刚性支出 3150
  flex: number;        // 弹性支出 500
  investQuota: number; // 500
  cashQuota: number;   // 2350
  stopLine: number;    // 10500
  warnLine: number;    // 15000
  targetLine: number;  // 18900
  cashATarget: number; // 3150（余利宝保持 1 个月刚性支出）
  payday: number;      // 20 号发薪
}

export const DEFAULT_CONFIG: Config = {
  income: 6500,
  rigid: 3150,
  flex: 500,
  investQuota: 500,
  cashQuota: 2350,
  stopLine: 10500,
  warnLine: 15000,
  targetLine: 18900,
  cashATarget: 3150,
  payday: 20,
};

export type Level = 'stop' | 'warn' | 'ok';

/** 任务出现/消失的判断依据 */
export interface TaskContext {
  ym: string;
  /** 当月记录（可能还没录） */
  record?: MonthRecord;
  /** 历史所有月份（用于判断"这件事以前做过没有"） */
  months: MonthRecord[];
}

export interface TaskDef {
  key: string;
  title: string;
  /** 每月第几号做 */
  day: number;
  /** 补充说明，显示在任务下方 */
  hint?: string;
  /**
   * 是否在本月出现。不写 = 每月都出现。
   * 用它可以做"条件任务"：只有真的需要时才提醒。
   */
  visibleWhen?: (ctx: TaskContext) => boolean;
}
