// pnpm-run.mjs —— 用绝对路径调 pnpm，避免 PATH 问题
import { spawnSync } from 'node:child_process'
const PNPM = 'C:/Users/Administrator/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs'
const NODE = process.execPath
const r = spawnSync(NODE, [PNPM, ...process.argv.slice(2)], { stdio:'inherit' })
process.exit(r.status ?? 1)
