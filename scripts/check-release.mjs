// Built-in-only release checks; does not open any DSH home, account or session.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, join, relative } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.name, '@dsh-community/dsh-req-workbench')
assert.equal(pkg.private, true, 'prevent accidental npm publication')
assert.equal(pkg.engines.dsh, '0.2.1-rc.5')
for (const key of ['prepare', 'prepack', 'install', 'postinstall']) assert.equal(pkg.scripts?.[key], undefined, 'release installs must use prebuilt files')
for (const path of ['lib/index.js', 'lib/client.js', 'lib/typert.remote-client.js', 'src/index.ts', 'src/client.tsx', 'src/typert.remote-client.ts', 'LICENSE', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md', '发布和安装指南.md']) {
  assert.ok(lstatSync(join(root, path)).isFile(), 'missing: ' + path)
}
assert.equal(pkg.exports['./client'].default, './lib/client.js')
const browser = readFileSync(join(root, 'lib/client.js'), 'utf8')
assert.ok(browser.includes('window.__ModuleLoader__.load('))
assert.ok(browser.includes(pkg.name))
assert.ok(readFileSync(join(root, 'cordis.patch.yml'), 'utf8').includes("name: '" + pkg.name + "'"))
assert.ok(!/^lib\/?$/m.test(readFileSync(join(root, '.gitignore'), 'utf8')), 'lib must be tracked for GitHub install')
assert.match(readFileSync(join(root, 'LICENSE'), 'utf8'), /Copyright \(c\) 2026 liangsongran/)
assert.match(readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /Copyright \(c\) 2025 Colin McDonnell/)
const skipped = new Set(['node_modules', '.git', 'artifacts', 'verification'])
let count = 0
function inspect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue
    const path = join(dir, entry.name)
    const name = relative(root, path).replaceAll('\\', '/')
    assert.ok(!lstatSync(path).isSymbolicLink(), 'do not distribute links: ' + name)
    assert.ok(!/^\.env(?:\.|$)|credentials|session\.json|verification-live|\.dsh-meow/i.test(entry.name), 'private/local file: ' + name)
    if (entry.isDirectory()) { inspect(path); continue }
    if (/\.(?:tgz|zip)$/.test(name)) continue // output files are checked separately
    const text = readFileSync(path, 'utf8')
    assert.ok(!/[A-Za-z]:[\\/](?:Users[\\/]Administrator|鱼)[\\/]/i.test(text), 'machine-specific path: ' + name)
    assert.ok(!text.includes(['BEGIN', 'OPENSSH', 'PRIVATE', 'KEY'].join(' ')) && !text.includes(['BEGIN', 'RSA', 'PRIVATE', 'KEY'].join(' ')), 'private key: ' + name)
    count += 1
  }
}
inspect(resolve(root))
console.log(`PASS: ${count} portable release files; prebuilt host/client, matching DSH metadata, MIT/upstream/Zod notices, no local links or machine paths`)
