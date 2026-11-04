// Build against the installed DSH APIs. Keep the host ESM and expose the client
// through DSH's ModuleLoader; do not bundle Cordis/React or other host services.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const libDir = join(root, 'lib')
const tempDir = join(root, '.build-esm')
// Deletion is limited to these two known build-output directories in this repo.
for (const dir of [libDir, tempDir]) {
  if (dirname(dir) !== root) throw new Error('Unsafe build output path')
  rmSync(dir, { recursive: true, force: true })
}
mkdirSync(libDir, { recursive: true })

const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'),
  '--project', join(root, 'tsconfig.json'), '--noEmit', 'false',
  '--noEmitOnError', 'true', '--outDir', tempDir,
], { cwd: root, stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
writeFileSync(join(libDir, 'index.js'), readFileSync(join(tempDir, 'index.js')))

const client = await build({
  entryPoints: [join(tempDir, 'client.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/*', '@deepseek-ai/*'],
  write: false,
  legalComments: 'none',
  minifyWhitespace: true, // Avoid leaking absolute developer paths in source comments.
})
writeFileSync(join(libDir, 'client.js'), `window.__ModuleLoader__.load({
  id: '@dsh-community/dsh-req-workbench',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${client.outputFiles[0].text}
    return module.exports;
  }
});
`)
// Export the same wire contracts to the host for integration tests and tooling.
const contracts = await build({
  entryPoints: [join(tempDir, 'typert.remote-client.js')],
  bundle: true, format: 'esm', platform: 'node', target: 'es2022',
  external: ['zod', '@deepseek-ai/*'], write: false,
})
writeFileSync(join(libDir, 'typert.remote-client.js'), contracts.outputFiles[0].text)
rmSync(tempDir, { recursive: true, force: true })
console.log('Build complete: type-checked ESM host + browser ModuleLoader client')
