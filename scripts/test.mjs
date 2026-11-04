import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { Context, Service } from '@deepseek-ai/cordis'
import { RequirementsService, snapshotSchema } from '../lib/index.js'
import { TYPERT_REMOTE } from '../lib/typert.remote-client.js'

const records = new Map([['main', { requirements: [{ id: 'legacy-data', title: '保留旧版数据' }] }]])
const tools = new Map()
let failRead = false
const ctx = new Context()
ctx.provide('tools', { register(tool) { tools.set(tool.name, tool) } })
ctx.provide('storageDomain', { async open() { return { table: () => ({
  get: key => { if (failRead) throw new Error('domain closed'); return records.get(key) }, put: async (key, value) => records.set(key, structuredClone(snapshotSchema.parse(value))),
}), async close() {} } } })
const service = new RequirementsService(ctx, {})
await service[Service.init]()
assert.equal(tools.size, 2)
assert.deepEqual(await service.snapshot({ sessionId: 'a' }), { revision: 0, requirements: [] })
let result = await service.applyChanges({ sessionId: 'a', expectedRevision: 0, changes: [{ title: '自动整理项目需求', status: 'confirmed', source: '聊天时自动整理我现在需要的功能', tasks: [{ content: '注册维护工具' }] }] })
const id = result.requirements[0].id
assert.equal(result.revision, 1)
assert.equal(result.requirements[0].status, 'confirmed')
assert.equal((await service.snapshot({ sessionId: 'b' })).requirements.length, 0)
result.requirements[0].title = '外部改动不得污染存储'
assert.equal((await service.snapshot({ sessionId: 'a' })).requirements[0].title, '自动整理项目需求')
result = await service.applyChanges({ sessionId: 'a', expectedRevision: 1, changes: [{ title: '自动整理项目需求', description: '同名去重' }] })
assert.equal(result.requirements.length, 1)
assert.equal(result.requirements[0].id, id)
const taskId = result.requirements[0].tasks[0].id
await assert.rejects(service.applyChanges({ sessionId: 'a', expectedRevision: 1, changes: [{ id, status: 'done' }] }), /revision conflict/)
let concurrent = await Promise.allSettled([
  service.applyChanges({ sessionId: 'a', expectedRevision: 2, changes: [{ id, status: 'in_progress' }] }),
  service.applyChanges({ sessionId: 'a', expectedRevision: 2, changes: [{ id, status: 'done' }] }),
])
assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1)
assert.equal(concurrent.filter(r => r.status === 'rejected').length, 1)
await assert.rejects(service.applyChanges({ sessionId: 'a', expectedRevision: 3, changes: [{ id, title: '不得部分提交' }, { id: 'missing', status: 'done' }] }))
await assert.rejects(service.applyChanges({ sessionId: 'a', expectedRevision: 3, changes: [{ id, tasks: [{ id: taskId, content: '注册维护工具' }, { id: taskId, content: '重复引用' }] }] }), /子任务重复/)
await assert.rejects(service.applyChanges({ sessionId: 'a', changes: [{ id, status: 'done' }] }), /Invalid input/ )
result = await service.snapshot({ sessionId: 'a' })
assert.equal(result.requirements[0].title, '自动整理项目需求')
result = await service.applyChanges({ sessionId: 'a', expectedRevision: 3, changes: [{ id, tasks: [{ id: taskId, content: '注册维护工具', done: true }] }] })
assert.equal(result.requirements[0].tasks[0].done, true)
await service.applyChanges({ sessionId: 'a', expectedRevision: 4, changes: [{ id, status: 'cancelled' }] })
assert.equal((await service.snapshot({ sessionId: 'a' })).requirements[0].status, 'cancelled')
assert.equal(records.get('main').requirements[0].id, 'legacy-data')
console.log('PASS: session isolation, duplicate merging, optimistic concurrency, atomic rollback, tasks, cancellation, legacy preserved')

// Exercise the actual registered Cordis pre-step middleware without an LLM.
const signal = new AbortController().signal
const payload = { agent: { session: { id: 'a', header: {} } }, step: 1, turn: 1, signal }
const enter = { kind: 'enter', messages: [{ role: 'user', content: [{ type: 'text', text: '讨论项目功能' }] }] }
const injected = await ctx.waterfall('agent/pre-step', payload, async () => enter)
assert.equal(injected.messages.length, 2)
assert.equal(injected.messages[1].source.kind, 'requirements-workbench')
assert.match(injected.messages[1].content[0].text, /requirements_update/)
for (const rule of ['小白看得懂', '不是聊天摘要', '不堆术语', '合并同义', '没有把握', '不要凭空补充']) {
  assert.ok(injected.messages[1].content[0].text.includes(rule), 'missing functional-summary guidance: ' + rule)
}
const empty = { kind: 'enter', messages: [] }
assert.equal(await ctx.waterfall('agent/pre-step', payload, async () => empty), empty)
assert.equal(await ctx.waterfall('agent/pre-step', { ...payload, step: 2 }, async () => enter), enter)
failRead = true
assert.equal(await ctx.waterfall('agent/pre-step', payload, async () => enter), enter)
failRead = false
console.log('PASS: real pre-step auto-maintenance instruction, empty-step guard, storage failure fail-open')

// Invoke registered model tools, scoped solely by the host's owning agent.
const exec = { agent: { session: { id: 'model-session' } }, signal: new AbortController().signal }
result = await tools.get('requirements_update').execute({ expectedRevision: 0, changes: [{ title: '模型建议', status: 'proposed' }] }, exec)
assert.equal(result.requirements[0].status, 'proposed')
const modelSnapshot = await tools.get('requirements_list').execute({}, exec)
assert.equal(modelSnapshot.requirements[0].title, '模型建议')
assert.equal((await service.snapshot({ sessionId: 'a' })).requirements.length, 1)
await assert.rejects(tools.get('requirements_update').execute({ changes: [{ title: 'agentless' }] }, { signal: exec.signal }))
const methods = new Map(TYPERT_REMOTE.descriptors.map(d => [d.method, d]))
assert.equal(methods.size, 2)
for (const d of methods.values()) {
  d.result.create().parse(modelSnapshot)
  assert.equal(typeof d.parameters[0].codec.create, 'function')
}
console.log('PASS: actual registered model tools, caller scoping, strict current Typert codecs')

let client
const registered = []
const react = { createElement: (type, props, ...children) => ({ type, props, children }) }
runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load(m) { client = m.factory(name => {
    assert.equal(name, 'react'); return react
  }) } } }, console,
})
const slots = { inject: (_name, fn) => fn(), register: (options, component) => {
  registered.push({ options, component }); return () => {}
} }
const child = { get: name => name === 'slots' ? slots : {}, effect: fn => fn() }
await client.apply({ remote: { $mount: async () => {} }, inject: async (_deps, fn) => fn(child) })
assert.equal(registered.length, 1)
assert.equal(registered[0].options.name, 'conversation.view')
assert.equal(registered[0].options.id, 'requirements')
assert.equal(registered[0].options.label, '需求')
const page = registered[0].component({ sessionId: 'a' })
assert.equal(page.props.sessionId, 'a')
assert.equal(page.props.key, 'a')
const source = readFileSync(new URL('../src/client.tsx', import.meta.url), 'utf8')
assert.equal(/sidebar\.footer|shell\.overlay|assistant-actions/.test(source), false)
console.log('PASS: one official session View only; no global sidebar/overlay registrations')
