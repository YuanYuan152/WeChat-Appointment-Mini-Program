// node scripts/test-date-time.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/utils/dateTime.ts'), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const originalTZ = process.env.TZ
try {
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/New_York']) {
    process.env.TZ = timezone
    // 模拟安卓缺少 Intl 的环境；禁止回退到依赖宿主 locale 的格式化。
    const context = vm.createContext({ exports: {}, Intl: undefined })
    vm.runInContext(`Date.prototype.toLocaleString = Date.prototype.toLocaleDateString = Date.prototype.toLocaleTimeString = function () { throw new Error('locale formatting forbidden') }`, context)
    vm.runInContext(code, context)
    const { formatChinaDateTime: format, formatChinaClock: clock } = context.exports
    for (const [input, expected] of [
      ['2026-09-20T06:05:09Z', '2026-09-20 14:05'],
      ['2026-09-20T14:05:09+08:00', '2026-09-20 14:05'],
      ['2026-09-20T01:05:09-05:00', '2026-09-20 14:05'],
      ['2026-09-20T14:05:09', '2026-09-20 14:05'],
      ['2026-09-20 14:05:09', '2026-09-20 14:05'],
      ['2026-12-31T16:00:00Z', '2027-01-01 00:00'],
      ['2024-02-28T16:00:00Z', '2024-02-29 00:00'],
      ['2026-09-20T06:05:09.123Z', '2026-09-20 14:05'],
      ['', ''], [null, ''], [undefined, ''], ['invalid', 'invalid'],
    ]) assert.equal(format(input), expected, `${timezone}: ${input}`)
    assert.equal(clock('2026-12-31T16:00:00Z'), '00:00')
    assert.equal(clock(null), '')
    console.log(`PASS: Intl absent, timezone=${timezone}`)
  }
} finally {
  if (originalTZ === undefined) delete process.env.TZ
  else process.env.TZ = originalTZ
}
