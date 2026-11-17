import { useEffect, useRef, useState } from 'react'

/** 千分位 + 固定两位小数。负数自动带负号。 */
export function fmt(n: number, digits = 2): string {
  const v = Number.isFinite(n) ? n : 0
  const abs = Math.abs(v).toFixed(digits)
  const parts = abs.split('.')
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const dec = parts[1]
  return (v < 0 ? '-' : '') + int + (dec ? '.' + dec : '')
}

/** 带正负号的金额，用于盈亏 */
export function fmtSigned(n: number, digits = 2): string {
  const v = Number.isFinite(n) ? n : 0
  return (v > 0 ? '+' : '') + fmt(v, digits)
}

export interface MoneyInputProps {
  label: string
  value: number
  onChange: (n: number) => void
  suffix?: string
  placeholder?: string
}

export function MoneyInput({ label, value, onChange, suffix, placeholder }: MoneyInputProps) {
  const [text, setText] = useState<string>(value ? String(value) : '')
  const last = useRef<number>(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value ? String(value) : '')
    }
  }, [value])

  const handle = (raw: string) => {
    setText(raw)
    const trimmed = raw.trim()
    if (trimmed === '') {
      last.current = 0
      onChange(0)
      return
    }
    const n = Number(trimmed)
    if (Number.isFinite(n)) {
      last.current = n
      onChange(n)
    }
  }

  /**
   * 聚焦时全选。
   * 原来是「点进去继续输入会追加到末尾」——已有 3150，再输 12000 就变成 315012000。
   * 全选后第一次敲键即覆盖，符合大多数记账场景的直觉。
   * 键盘/触摸都会聚焦到数字输入框，select() 在两者上均生效。
   */
  const selectAll = () => {
    const el = inputRef.current
    if (!el) return
    // requestAnimationFrame：等浏览器把光标放好之后再全选，否则会被重置
    requestAnimationFrame(() => {
      try {
        el.select()
      } catch {
        /* 某些浏览器对 number 类型 select 有限制，忽略即可 */
      }
    })
  }

  /** 清空：把输入框与外部状态一起归零 */
  const clear = () => {
    setText('')
    last.current = 0
    onChange(0)
    inputRef.current?.focus()
  }

  const showClear = text !== '' && Number(text) !== 0

  return (
    <div className="field">
      <label>
        {label}
        {suffix ? '（' + suffix + '）' : ''}
      </label>
      <div className="input-wrap">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          onFocus={selectAll}
          onClick={selectAll}
        />
        {showClear ? (
          <button
            className="input-clear"
            type="button"
            tabIndex={-1}
            aria-label="清空"
            onMouseDown={(e) => {
              // 阻止默认行为，避免 input 先失焦导致点击丢失
              e.preventDefault()
              clear()
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default MoneyInput
