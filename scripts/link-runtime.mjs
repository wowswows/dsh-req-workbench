// Optional developer setup only. Nothing here runs during normal installation.
import { existsSync, realpathSync, mkdirSync, symlinkSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const supplied = process.argv[2]
if (!supplied) throw new Error('Usage: node scripts/link-runtime.mjs <DSH runtime directory containing node_modules>')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtime = realpathSync(resolve(supplied))
if (!existsSync(join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'))) throw new Error('Not a DSH runtime directory')
const nodes = join(root, 'node_modules')
mkdirSync(nodes, { recursive: true })
for (const name of ['@deepseek-ai', 'zod']) {
  const source = join(runtime, 'node_modules', name)
  const target = join(nodes, name)
  if (!existsSync(source)) throw new Error('Missing runtime dependency: ' + name)
  if (existsSync(target)) {
    if (realpathSync(target) !== realpathSync(source)) throw new Error('Existing dependency differs; inspect it first: ' + target)
    continue
  }
  symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
}
console.log('Linked developer APIs to the supplied DSH runtime. Do not distribute node_modules.')
