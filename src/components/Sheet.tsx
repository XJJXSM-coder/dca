// src/components/Sheet.tsx —— 底部弹出面板，替代 window.prompt / confirm
// 手机原生弹窗体验差、可能被浏览器拦截，这里自己做。

import { useEffect, useState } from 'react'

export interface SheetProps {
  open: boolean
  title: string
  /** 说明文字 */
  desc?: string
  /** 输入框配置。传了就是输入模式，不传就是纯确认模式 */
  input?: {
    value: string
    placeholder?: string
    onChange: (v: string) => void
    type?: 'text' | 'month'
  }
  confirmText?: string
  cancelText?: string
  /** 危险操作（删除）用红色按钮 */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function Sheet({
  open,
  title,
  desc,
  input,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: SheetProps) {
  if (!open) return null
  return (
    <div className="sheet-mask" onClick={onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">{title}</div>
        {desc ? <div className="sheet-desc">{desc}</div> : null}
        {input ? (
          <div className="field" style={{ marginTop: 14, marginBottom: 6 }}>
            <input
              type={input.type || 'text'}
              value={input.value}
              placeholder={input.placeholder}
              onChange={(e) => input.onChange(e.target.value)}
              autoFocus
            />
          </div>
        ) : null}
        <div className="sheet-btns">
          <button className="btn ghost" type="button" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={'btn' + (danger ? ' danger' : '')}
            type="button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
