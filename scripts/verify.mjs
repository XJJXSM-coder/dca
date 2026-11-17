// scripts/verify.mjs —— 集成验收脚本（Lead 拥有）
// 运行：node scripts/verify.mjs
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const C = { g:'\x1b[32m', r:'\x1b[31m', y:'\x1b[33m', n:'\x1b[0m', b:'\x1b[1m' }
let pass = 0, fail = 0
const ok = (n, c, e='') => { if (c) { pass++; console.log(C.g+'  ✓'+C.n+' '+n+(e?'  '+e:'')) } else { fail++; console.log(C.r+'  ✗'+C.n+' '+n+(e?'  '+e:'')) } }

console.log(C.b+'\n=== 1. 文件完整性 ==='+C.n)
const required = [
  'src/types.ts','src/theme.css','src/main.tsx','src/App.tsx',
  'src/db/schema.ts','src/db/repo.ts','src/calc/index.ts',
  'src/tasks.ts','src/seed.ts','src/calc/index.test.ts',
  'src/pages/Home.tsx','src/pages/Position.tsx','src/pages/Cash.tsx',
  'src/pages/Settings.tsx','src/pages/More.tsx',
  'src/components/ThresholdBar.tsx','src/components/MoneyInput.tsx',
]
for (const f of required) ok(f, existsSync(f))

console.log(C.b+'\n=== 2. 类型检查 ==='+C.n)
try {
  execSync('node ./pnpm-run.mjs exec tsc --noEmit', { stdio:'pipe' })
  ok('tsc --noEmit 零错误', true)
} catch (e) {
  const out = (e.stdout?.toString() || '') + (e.stderr?.toString() || '')
  ok('tsc --noEmit 零错误', false)
  console.log(out.split('\n').slice(0,20).join('\n'))
}

console.log(C.b+'\n=== 3. 单元测试 ==='+C.n)
try {
  // vitest 输出带 ANSI 颜色码，先剥离再匹配
  const strip = (x) => x.replace(/\x1b\[[0-9;]*m/g, '')
  const out = strip(execSync('node ./pnpm-run.mjs exec vitest run --reporter=basic', { stdio:'pipe' }).toString())
  const m = out.match(/Tests\s+(\d+) passed\s+\(\d+\)/)
  const failed = /Tests\s+\d+ failed/.test(out)
  ok('vitest 全部通过', !!m && !failed, m ? (m[1] + ' 个用例通过') : '未解析到用例数')
  if (!m || failed) console.log(out.slice(-1500))
} catch (e) {
  ok('vitest 全部通过', false)
  console.log(((e.stdout?.toString()||'')+(e.stderr?.toString()||'')).slice(-1500))
}

console.log(C.b+'\n=== 4. 生产构建 ==='+C.n)
try {
  execSync('node ./pnpm-run.mjs exec vite build', { stdio:'pipe' })
  ok('vite build 成功', true)
  ok('dist/index.html 存在', existsSync('dist/index.html'))
  ok('dist/manifest.webmanifest 存在', existsSync('dist/manifest.webmanifest'))
  ok('dist/sw.js 存在', existsSync('dist/sw.js'))
} catch (e) {
  ok('vite build 成功', false)
  console.log(((e.stdout?.toString()||'')+(e.stderr?.toString()||'')).slice(-1500))
}

console.log(C.b+'\n=== 5. 设计铁律（不许出现的东西） ==='+C.n)
const allSrc = required.filter(f=>f.endsWith('.ts')||f.endsWith('.tsx'))
  .map(f => existsSync(f) ? readFileSync(f,'utf8') : '').join('\n')
const banned = [
  ['推送/Notification API', /new\s+Notification|Notification\.requestPermission|pushManager/],
  ['红绿涨跌配色逻辑', /isUp\s*\?\s*['"]red|positive\s*\?\s*['"]#f00|up\s*\?\s*['"]green/],
  ['一键加仓按钮', /加仓|一键买入|立即购买/],
  ['云同步 / fetch 外部接口', /fetch\(\s*['"]https?:|axios|supabase|firebase/],
  ['登录 / 账号', /login|signIn|password|auth0/],
]
for (const [name, re] of banned) ok('无'+name, !re.test(allSrc))

console.log(C.b+'\n=== 6. 关键数字（源码里应对得上） ==='+C.n)
ok('默认投资额度 500', /investQuota\s*:\s*500/.test(readFileSync('src/types.ts','utf8')))
ok('默认刚性支出 3150', /rigid\s*:\s*3150/.test(readFileSync('src/types.ts','utf8')))
ok('停投线 10500', /stopLine\s*:\s*10500/.test(readFileSync('src/types.ts','utf8')))
ok('警示线 15000', /warnLine\s*:\s*15000/.test(readFileSync('src/types.ts','utf8')))
ok('目标线 18900', /targetLine\s*:\s*18900/.test(readFileSync('src/types.ts','utf8')))

console.log(C.b+'\n' + '='.repeat(46) + C.n)
console.log(C.b+'  通过 '+pass+'  失败 '+fail+C.n)
if (fail === 0) console.log(C.g+C.b+'  ✅ 验收通过，可交付'+C.n+'\n')
else console.log(C.r+C.b+'  ❌ 有 '+fail+' 项未通过'+C.n+'\n')
process.exit(fail === 0 ? 0 : 1)
