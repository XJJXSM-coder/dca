// src/useQuote.ts —— 行情轮询 hook。
//
// 设计取舍：
// · 只在「持仓」页可见时轮询，切走就停，省流量省电
// · 默认 60 秒一次 —— 再快没有意义（美股不是 7×24）
// · 网络失败不弹错，静默重试，下次成功就恢复
// · 保留「上次成功时间」，让你知道数据新不新

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchQuote } from './quote'
import type { Quote } from './quote'

export interface UseQuoteResult {
  quote: Quote | null
  /** 是否正在请求 */
  loading: boolean
  /** 最近一次错误（成功后会清空） */
  error: string
  /** 上次成功刷新的时间戳（毫秒），从没成功过就是 0 */
  lastOk: number
  /** 手动刷新 */
  refresh: () => void
}

export function useQuote(symbol: string | null, intervalMs = 60000): UseQuoteResult {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastOk, setLastOk] = useState(0)

  // 防止组件卸载后 setState
  const alive = useRef(true)
  // 防止并发请求堆积
  const inflight = useRef(false)

  const load = useCallback(async () => {
    if (!symbol || inflight.current) return
    inflight.current = true
    setLoading(true)
    try {
      const q = await fetchQuote(symbol)
      if (!alive.current) return
      setQuote(q)
      setLastOk(Date.now())
      setError('')
    } catch (e) {
      if (!alive.current) return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      inflight.current = false
      if (alive.current) setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    alive.current = true
    if (!symbol) {
      setQuote(null)
      return
    }
    void load()
    const id = setInterval(() => void load(), intervalMs)
    return () => {
      alive.current = false
      clearInterval(id)
    }
  }, [symbol, intervalMs, load])

  // 页面重新可见时立刻刷一次（手机切回来别看到旧价）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  return { quote, loading, error, lastOk, refresh: () => void load() }
}
