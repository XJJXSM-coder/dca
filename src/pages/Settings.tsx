import { useEffect, useRef, useState } from 'react'
import { ensurePersist, exportAll, importAll, setConfig } from '../db/repo'
import type { Config } from '../types'
import type { AppData, Reload } from '../App'
import { fmt } from '../components/MoneyInput'

export interface SettingsProps {
  data: AppData
  reload: Reload
}

const FIELDS: { key: keyof Config; label: string; suffix: string }[] = [
  { key: 'income', label: '月收入', suffix: '元' },
  { key: 'rigid', label: '刚性支出', suffix: '元' },
  { key: 'flex', label: '弹性支出', suffix: '元' },
  { key: 'investQuota', label: '定投额度', suffix: '元' },
  { key: 'cashQuota', label: '现金留存', suffix: '元' },
  { key: 'stopLine', label: '停投线', suffix: '元' },
  { key: 'warnLine', label: '警戒线', suffix: '元' },
  { key: 'targetLine', label: '目标线', suffix: '元' },
  { key: 'cashATarget', label: '余利宝基准', suffix: '元' },
  { key: 'payday', label: '发薪日', suffix: '号' },
]

function stamp(): string {
  const d = new Date()
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  )
}

export default function Settings({ data, reload }: SettingsProps) {
  const { cfg } = data
  const [draft, setDraft] = useState<Config>(cfg)
  const [msg, setMsg] = useState<string>('')
  const [persistMsg, setPersistMsg] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(cfg)
  }, [cfg])

  const setOne = (key: keyof Config, raw: string) => {
    const n = Number(raw)
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }) as Config)
  }

  const save = async () => {
    await setConfig(draft)
    setMsg('配置已保存')
    await reload()
  }

  const doExport = async () => {
    const text = await exportAll()
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dca-backup-' + stamp() + '.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMsg('已导出 dca-backup-' + stamp() + '.json')
  }

  const doImport = async (file: File) => {
    try {
      const text = await file.text()
      await importAll(text)
      setMsg('导入成功：' + file.name)
      await reload()
    } catch (e) {
      setMsg('导入失败：' + String(e))
    }
  }

  const doPersist = async () => {
    const r = await ensurePersist()
    setPersistMsg(r ? '已开启持久化存储' : '浏览器未授予持久化存储')
  }

  return (
    <>
      <div className="topbar">
        <div className="kick">SETTINGS</div>
        <h1>设置</h1>
        <div className="sub">所有参数只影响本机</div>
      </div>

      <div className="sec">
        <div className="card">
          <h2>参数</h2>
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>
                {f.label}（{f.suffix}）
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={String(draft[f.key])}
                onChange={(e) => setOne(f.key, e.target.value)}
              />
            </div>
          ))}
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => void save()}>
              保存配置
            </button>
          </div>
          {msg ? <div className="hint ok">{msg}</div> : null}
        </div>

        <div className="card">
          <h2>数据备份</h2>
          <div className="row">
            <span className="k">导出当前全部数据为 JSON</span>
          </div>
          <div className="btn-row">
            <button className="btn ghost" type="button" onClick={() => void doExport()}>
              导出 JSON
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
            >
              导入 JSON
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0]
              if (f) void doImport(f)
              e.target.value = ''
            }}
          />
        </div>

        <div className="card">
          <h2>存储</h2>
          <div className="btn-row">
            <button className="btn ghost" type="button" onClick={() => void doPersist()}>
              开启持久化存储
            </button>
          </div>
          {persistMsg ? <div className="hint">{persistMsg}</div> : null}
        </div>

        <div className="card">
          <div className="row">
            <span className="k">版本</span>
            <span className="v num">v0.1.0</span>
          </div>
          <div className="hint">
            定投额度 {fmt(cfg.investQuota)} 元 / 月，数据全部保存在本地浏览器。
          </div>
        </div>
      </div>
    </>
  )
}
