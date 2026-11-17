import type { Config } from '../types'
import { thresholdScale } from '../calc/threshold'
import { fmt } from './MoneyInput'

export interface ThresholdBarProps {
  cash: number
  cfg: Config
}

/**
 * 三档阈值色带。
 *
 * 刻度标签必须钉在各自的真实百分比上，不能用 flex 均分。
 * 曾经的 bug：`.marks` 用 justify-content:space-between，三个标签被摊在 0% / 50% / 100%，
 * 而真实边界是 stopLine ≈ 55.6% / warnLine ≈ 79.4% / targetLine 100%。
 * 结果 12,000 的指针（≈63.5%）显示在「15,000」标签右边，看起来像 1万2 跑到了 1万5 前面。
 */
export function ThresholdBar({ cash, cfg }: ThresholdBarProps) {
  const { stopPct, warnPct, cashPct: pinPct } = thresholdScale(cash, cfg)

  // 刻度标签：首尾贴边避免溢出，中间居中
  const marks: { at: number; text: string; align: 'start' | 'center' | 'end' }[] = [
    { at: stopPct, text: fmt(cfg.stopLine, 0), align: 'start' },
    { at: warnPct, text: fmt(cfg.warnLine, 0), align: 'center' },
    { at: 100, text: fmt(cfg.targetLine, 0), align: 'end' },
  ]

  return (
    <div className="thr">
      <div className="rail" />
      <div className="zone red" style={{ left: 0, width: stopPct + '%' }} />
      <div
        className="zone amber"
        style={{ left: stopPct + '%', width: Math.max(0, warnPct - stopPct) + '%' }}
      />
      <div
        className="zone green"
        style={{ left: warnPct + '%', width: Math.max(0, 100 - warnPct) + '%' }}
      />

      {/* 指针：竖直短线，钉在当前现金的百分比位置 */}
      <div className="pin" style={{ left: 'calc(' + pinPct + '% - 1.5px)' }} />

      {/* 刻度标签：各自钉在真实位置，不再用 flex 均分 */}
      <div className="marks">
        {marks.map((m) => (
          <span
            key={m.text}
            className="num"
            style={{
              position: 'absolute',
              left: m.at + '%',
              transform:
                m.align === 'center'
                  ? 'translateX(-50%)'
                  : m.align === 'end'
                    ? 'translateX(-100%)'
                    : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {m.text}
          </span>
        ))}
      </div>
    </div>
  )
}

export default ThresholdBar
