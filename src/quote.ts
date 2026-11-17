// src/quote.ts —— 行情获取。用东方财富公开接口（带 CORS 头，浏览器可直连）。
//
// 为什么不用 Yahoo：已被墙/403。为什么不用 Stooq：连不上。
// 东财接口实测返回 Access-Control-Allow-Origin: *，可直接 fetch。

export interface Quote {
  symbol: string;
  name: string;
  price: number;      // 最新价
  prevClose: number;  // 昨收
  change: number;     // 涨跌额
  changePct: number;  // 涨跌百分比
  high: number;
  low: number;
  /** 数据时间（本地时间字符串），取不到就是空 */
  at: string;
}

/** 东财 secid 市场前缀：105 = 纳斯达克，106 = 纽交所，107 = 美交所 */
const MARKET_BY_SYMBOL: Record<string, string> = {
  QQQM: '105', // 纳斯达克
  VGT: '107',  // 美交所（NYSE Arca）
}

/** 默认市场（未知标的归纳斯达克，历史行为） */
const MARKET_DEFAULT = '105'

/** symbol → secid 前缀，按标的自动选市场 */
function marketOf(symbol: string): string {
  return MARKET_BY_SYMBOL[symbol.toUpperCase()] || MARKET_DEFAULT
}

const FIELDS = 'f43,f44,f45,f57,f58,f60,f169,f170'

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 拉取一只美股的最新行情。
 * @param symbol 例如 'QQQM' 或 'VGT'
 * @param timeoutMs 超时，默认 8 秒
 */
export async function fetchQuote(symbol: string, timeoutMs = 8000): Promise<Quote> {
  const secid = marketOf(symbol) + '.' + symbol.toUpperCase()
  const url =
    'https://push2.eastmoney.com/api/qt/stock/get?secid=' +
    encodeURIComponent(secid) +
    '&fields=' + FIELDS

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, { signal: ctl.signal })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw new Error('行情接口返回 ' + res.status)
  const json = await res.json()
  const d = json && json.data
  if (!d) throw new Error('没拿到 ' + symbol + ' 的行情，代码可能写错了')

  return {
    symbol: String(d.f57 || symbol),
    name: String(d.f58 || ''),
    price: toNum(d.f43) / 1000,
    prevClose: toNum(d.f60) / 1000,
    change: toNum(d.f169) / 1000,
    changePct: toNum(d.f170) / 100,
    high: toNum(d.f44) / 1000,
    low: toNum(d.f45) / 1000,
    at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  }
}
