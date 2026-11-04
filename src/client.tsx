// Session-local Requirements View. The conversation owner supplies the tab and page.
import type { Context } from '@deepseek-ai/cordis'
import type { TypertClientRemote, TypertRemoteNamespace } from '@deepseek-ai/dsh-typert-protocol'
import * as React from 'react'
import { TYPERT_REMOTE } from './typert.remote-client'

export type RequirementStatus = 'proposed' | 'confirmed' | 'in_progress' | 'done' | 'cancelled'
export interface Task {
  id: string
  content: string
  done: boolean
  due?: number | null
}
export interface Requirement {
  id: string
  title: string
  description: string
  source: string
  status: RequirementStatus
  createdAt: number
  updatedAt: number
  tasks: Task[]
}
export interface Snapshot {
  revision: number
  requirements: Requirement[]
}
export interface Change {
  id?: string
  title?: string
  description?: string
  source?: string
  status?: RequirementStatus
  tasks?: { id?: string; content: string; done?: boolean; due?: number | null }[]
}
export type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: unknown }
export interface RequirementsRemote {
  snapshot(args: { sessionId: string }): Promise<RemoteResult<Snapshot>>
  applyChanges(args: { sessionId: string; expectedRevision: number; changes: Change[] }): Promise<RemoteResult<Snapshot>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteMap {
    'requirements/snapshot': RequirementsRemote['snapshot']
    'requirements/applyChanges': RequirementsRemote['applyChanges']
  }
  interface TypertRemoteNamespaceMap {
    requirements: TypertRemoteNamespace<'requirements'>
  }
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    remote: TypertClientRemote
  }
}

const h = React.createElement
const STATUSES: readonly RequirementStatus[] = ['proposed', 'confirmed', 'in_progress', 'done', 'cancelled']
const LABELS: Record<RequirementStatus, string> = {
  proposed: '待你确认', confirmed: '已确认要做', in_progress: '正在做', done: '已完成', cancelled: '已取消',
}
type Filter = 'all' | RequirementStatus
interface DraftTask {
  key: number
  id?: string
  content: string
  done: boolean
  due: string
}
interface Draft {
  id?: string
  revision: number
  title: string
  description: string
  source: string
  status: RequirementStatus
  tasks: DraftTask[]
}
let nextTaskKey = 0

function localDate(ms?: number | null): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return ''
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function dateLabel(ms?: number | null): string {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : ''
}
function errorLabel(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const detail = error as { message?: unknown; code?: unknown }
    return typeof detail.message === 'string' ? detail.message : String(detail.code ?? '服务端拒绝操作')
  }
  return '服务端拒绝操作'
}
function makeDraft(revision: number, item?: Requirement): Draft {
  return {
    revision, id: item?.id, title: item?.title ?? '', description: item?.description ?? '',
    source: item?.source ?? '', status: item?.status ?? 'proposed',
    tasks: (item?.tasks ?? []).map((task) => ({
      key: ++nextTaskKey, id: task.id, content: task.content, done: task.done, due: localDate(task.due),
    })),
  }
}
function toChange(draft: Draft): Change {
  const tasks = draft.tasks.map((task) => {
    const content = task.content.trim()
    if (!content) throw new Error('请填写子任务内容，或移除空白子任务。')
    const due = task.due ? new Date(task.due).getTime() : null
    if (due !== null && !Number.isFinite(due)) throw new Error('子任务截止时间无效。')
    return { ...(task.id ? { id: task.id } : {}), content, done: task.done, due }
  })
  const title = draft.title.trim()
  if (!title) throw new Error('请填写需求标题。')
  return {
    ...(draft.id ? { id: draft.id } : {}), title, description: draft.description.trim(),
    source: draft.source.trim(), status: draft.status, tasks,
  }
}

function RequirementEditor({ draft, setDraft, snapshot, busy, onSave, onCancel }: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>
  snapshot: Snapshot
  busy: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const stale = draft.revision !== snapshot.revision
  const patch = (fields: Partial<Draft>) => setDraft((current) => current ? { ...current, ...fields } : current)
  const patchTask = (key: number, fields: Partial<DraftTask>) => setDraft((current) => current ? {
    ...current, tasks: current.tasks.map((task) => task.key === key ? { ...task, ...fields } : task),
  } : current)
  const reloadDraft = () => {
    const item = draft.id ? snapshot.requirements.find((value) => value.id === draft.id) : undefined
    setDraft(makeDraft(snapshot.revision, item))
  }
  return h('form', { className: 'reqwb-editor', onSubmit: (event: React.FormEvent) => { event.preventDefault(); onSave() } },
    h('div', { className: 'reqwb-row' }, h('h3', null, draft.id ? '编辑功能' : '添加功能'), h('span', { className: 'reqwb-muted' }, '写清楚要做什么、用起来有什么效果；未确认的想法请选择“待你确认”')),
    stale ? h('div', { className: 'reqwb-notice', role: 'status' },
      h('p', null, '需求列表已有更新。你的草稿已保留，请先核对最新列表；不会自动覆盖他人的修改。'),
      h('div', { className: 'reqwb-row' },
        h('button', { type: 'button', disabled: busy, onClick: reloadDraft }, '重新载入此项'),
        h('button', { type: 'button', disabled: busy, onClick: () => patch({ revision: snapshot.revision }) }, '已核对，保留草稿'),
      ),
    ) : null,
    h('fieldset', { disabled: busy },
      h('label', null, '功能名称', h('input', { value: draft.title, maxLength: 300, required: true, onChange: (e: React.ChangeEvent<HTMLInputElement>) => patch({ title: e.target.value }), placeholder: '一句话描述需求' })),
      h('label', null, '功能说明', h('textarea', { value: draft.description, rows: 4, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => patch({ description: e.target.value }), placeholder: '第一行简短说明使用效果；更多要求和完成标准可另起一行' })),
      h('div', { className: 'reqwb-editor-columns' },
        h('label', null, '状态', h('select', { value: draft.status, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => patch({ status: e.target.value as RequirementStatus }) }, STATUSES.map((status) => h('option', { key: status, value: status }, LABELS[status])))),
        h('label', null, '原话 / 来源', h('textarea', { value: draft.source, rows: 2, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => patch({ source: e.target.value }), placeholder: '保留用户原话或对话来源；手动添加也可留空' })),
      ),
      h('div', { className: 'reqwb-row' }, h('strong', null, '子任务'), h('button', { type: 'button', onClick: () => patch({ tasks: [...draft.tasks, { key: ++nextTaskKey, content: '', done: false, due: '' }] }) }, '＋ 添加子任务')),
      draft.tasks.map((task, index) => h('div', { className: 'reqwb-draft-task', key: task.key },
        h('input', { type: 'checkbox', checked: task.done, 'aria-label': `子任务 ${index + 1} 已完成`, onChange: (e: React.ChangeEvent<HTMLInputElement>) => patchTask(task.key, { done: e.target.checked }) }),
        h('input', { value: task.content, required: true, 'aria-label': `子任务 ${index + 1} 内容`, placeholder: '可执行的子任务', onChange: (e: React.ChangeEvent<HTMLInputElement>) => patchTask(task.key, { content: e.target.value }) }),
        h('input', { type: 'datetime-local', value: task.due, 'aria-label': `子任务 ${index + 1} 截止时间`, onChange: (e: React.ChangeEvent<HTMLInputElement>) => patchTask(task.key, { due: e.target.value }) }),
        h('button', { type: 'button', onClick: () => patch({ tasks: draft.tasks.filter((entry) => entry.key !== task.key) }), 'aria-label': `移除子任务 ${index + 1}` }, '移除'),
      )),
      h('div', { className: 'reqwb-row reqwb-editor-actions' },
        h('button', { type: 'submit', className: 'reqwb-primary', disabled: stale }, busy ? '保存中…' : '保存'),
        h('button', { type: 'button', onClick: onCancel }, '取消'),
      ),
    ),
  )
}

// Keep the stored description intact; only shorten its default presentation.
function descriptionPreview(description: string): string {
  const text = description.trim()
  return text.length > 240 ? `${text.slice(0, 240)}…` : text
}

function RequirementCard({ item, busy, onEdit, onChange }: {
  item: Requirement
  busy: boolean
  onEdit: () => void
  onChange: (change: Change) => void
}) {
  const done = item.tasks.filter((task) => task.done).length
  const preview = descriptionPreview(item.description)
  return h('article', { className: 'reqwb-card' },
    h('header', { className: 'reqwb-row' },
      h('span', { className: 'reqwb-check', 'aria-hidden': true }, item.status === 'done' ? '☑' : '☐'),
      h('h3', null, item.title),
      h('span', { className: `reqwb-badge reqwb-status-${item.status}` }, LABELS[item.status]),
      h('button', { type: 'button', disabled: busy, onClick: onEdit, 'aria-label': `编辑：${item.title}` }, '编辑'),
      item.status === 'proposed' ? h('button', { type: 'button', disabled: busy, className: 'reqwb-primary', onClick: () => onChange({ id: item.id, status: 'confirmed' }) }, '确认要做') : null,
    ),
    h('p', { className: 'reqwb-description' }, preview || '还没有补充功能说明，可点击编辑填写。'),
    preview !== item.description.trim() ? h('details', { className: 'reqwb-detail' },
      h('summary', null, '查看完整说明'),
      h('p', { className: 'reqwb-description' }, item.description),
    ) : null,
    item.tasks.length ? h('details', { className: 'reqwb-detail reqwb-tasks' },
      h('summary', null, `查看具体步骤与进度（已完成 ${done} / ${item.tasks.length}）`),
      h('progress', { value: done, max: item.tasks.length, 'aria-label': `任务进度 ${done} / ${item.tasks.length}` }),
      item.tasks.map((task) => h('label', { className: `reqwb-task${task.done ? ' reqwb-task-done' : ''}`, key: task.id },
        h('input', { type: 'checkbox', checked: task.done, disabled: busy, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({
          id: item.id, tasks: item.tasks.map((entry) => ({ ...entry, done: entry.id === task.id ? event.target.checked : entry.done })),
        }) }),
        h('span', { className: 'reqwb-task-content' }, task.content),
        typeof task.due === 'number' ? h('time', { className: !task.done && task.due < Date.now() ? 'reqwb-overdue' : 'reqwb-muted' }, `${!task.done && task.due < Date.now() ? '已超时 · ' : '截止 '}${dateLabel(task.due)}`) : null,
      )),
    ) : null,
    h('details', { className: 'reqwb-detail reqwb-source' },
      h('summary', null, '查看原话与来源'),
      h('blockquote', null, item.source || '未记录来源'),
      h('footer', { className: 'reqwb-muted' }, `更新于 ${dateLabel(item.updatedAt)}`),
    ),
  )
}

function RequirementsPage({ sessionId, req }: { sessionId: string; req: RequirementsRemote }) {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const snapshotRef = React.useRef<Snapshot | null>(null)
  const [filter, setFilter] = React.useState<Filter>('all')
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const saving = React.useRef(false)
  const reading = React.useRef(false)
  const generation = React.useRef(0)
  const adopt = React.useCallback((value: Snapshot) => {
    if (snapshotRef.current && value.revision < snapshotRef.current.revision) return
    snapshotRef.current = value
    setSnapshot(value)
  }, [])
  const refresh = React.useCallback(async (manual = false, allowSaving = false) => {
    // A conflict reload must reach the server even if an earlier poll is pending.
    // `adopt` rejects older revisions when those requests finish out of order.
    if (!allowSaving && (reading.current || saving.current)) return
    const activeGeneration = generation.current
    reading.current = true
    if (manual) setLoading(true)
    try {
      const result = await req.snapshot({ sessionId })
      if (generation.current !== activeGeneration) return
      if (!result.ok) throw new Error(errorLabel(result.error))
      adopt(result.value)
      if (manual) setError(null)
    } catch (failure) {
      if (generation.current === activeGeneration) setError(`读取失败：${errorLabel(failure)}`)
    } finally {
      if (generation.current === activeGeneration) {
        reading.current = false
        if (manual) setLoading(false)
      }
    }
  }, [sessionId, req, adopt])
  React.useEffect(() => {
    generation.current += 1
    reading.current = false
    void refresh(true)
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => {
      generation.current += 1
      window.clearInterval(timer)
    }
  }, [refresh])

  const applyChanges = async (changes: Change[], revision: number): Promise<boolean> => {
    if (saving.current) return false
    const activeGeneration = generation.current
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await req.applyChanges({ sessionId, expectedRevision: revision, changes })
      if (generation.current !== activeGeneration) return false
      if (!result.ok) {
        await refresh(false, true)
        if (generation.current === activeGeneration) setError(`保存失败：${errorLabel(result.error)}。已尝试重新读取最新列表；草稿保留，请核对后再保存。`)
        return false
      }
      adopt(result.value)
      return true
    } catch (failure) {
      if (generation.current !== activeGeneration) return false
      await refresh(false, true)
      if (generation.current === activeGeneration) setError(`保存失败：${errorLabel(failure)}。已尝试重新读取最新列表，请核对后重试。`)
      return false
    } finally {
      if (generation.current === activeGeneration) {
        saving.current = false
        setBusy(false)
      }
    }
  }
  const saveDraft = async () => {
    if (!draft) return
    try {
      const change = toChange(draft)
      if (await applyChanges([change], draft.revision)) setDraft(null)
    } catch (failure) {
      setError(errorLabel(failure))
    }
  }
  const requirements = snapshot?.requirements ?? []
  const counts = (status: RequirementStatus) => requirements.filter((item) => item.status === status).length
  const visible = requirements.filter((item) => filter === 'all' || item.status === filter)
  const mainItems = visible.filter((item) => item.status !== 'proposed' && item.status !== 'cancelled')
  const proposedItems = visible.filter((item) => item.status === 'proposed')
  const cancelledItems = visible.filter((item) => item.status === 'cancelled')
  const renderList = (items: Requirement[]) => h('ol', { className: 'reqwb-checklist' },
    items.map((item) => h('li', { key: item.id }, h(RequirementCard, {
      item, busy: busy || draft !== null,
      onEdit: () => snapshot && setDraft(makeDraft(snapshot.revision, item)),
      onChange: (change: Change) => { if (snapshot) void applyChanges([change], snapshot.revision) },
    }))),
  )

  return h('section', { className: 'reqwb-page', 'aria-label': '当前会话需求工作台' },
    h('style', null, CSS),
    h('div', { className: 'reqwb-page-head' },
      h('div', null, h('h2', null, '功能需求清单'), h('p', { className: 'reqwb-muted' }, '根据你提出的需求和 AI 对需求的准确理解整理，只总结要做什么、用起来有什么效果。仅显示当前会话的需求。')),
      h('div', { className: 'reqwb-row' },
        h('button', { type: 'button', disabled: loading || busy, onClick: () => { void refresh(true) } }, loading ? '刷新中…' : '刷新'),
        h('button', { type: 'button', className: 'reqwb-primary', disabled: !snapshot || busy || draft !== null, onClick: () => snapshot && setDraft(makeDraft(snapshot.revision)) }, '＋ 新建需求'),
      ),
    ),
    h('nav', { className: 'reqwb-filters', 'aria-label': '按需求状态筛选' },
      (['all', ...STATUSES] as Filter[]).map((status) => h('button', {
        type: 'button', key: status, 'aria-pressed': filter === status, onClick: () => setFilter(status),
      }, `${status === 'all' ? '功能总览' : LABELS[status]} ${status === 'all' ? requirements.length : counts(status)}`)),
    ),
    error ? h('div', { className: 'reqwb-error', role: 'alert' }, error) : null,
    draft && snapshot ? h(RequirementEditor, { draft, setDraft, snapshot, busy, onSave: () => { void saveDraft() }, onCancel: () => setDraft(null) }) : null,
    !snapshot ? h('div', { className: 'reqwb-empty' }, loading ? '正在读取当前会话的需求…' : '暂时无法读取需求，请点击刷新。') : null,
    snapshot && !visible.length ? h('div', { className: 'reqwb-empty' }, requirements.length ? '暂时没有这类功能。' : '当前会话还没有功能需求。说说你想做什么，AI 会整理成清单；你也可以手动添加。') : null,
    mainItems.length ? h('section', { className: 'reqwb-group', 'aria-label': '已确认的功能清单' },
      h('h3', { className: 'reqwb-group-title' }, `功能清单 · ${mainItems.length} 项`),
      renderList(mainItems),
    ) : snapshot && filter === 'all' && visible.length ? h('p', { className: 'reqwb-muted' }, '还没有已确认要做的功能。待确认的想法和已取消的内容收在下方，不算作已确认需求。') : null,
    proposedItems.length ? h('details', { key: `proposed-${filter}`, className: 'reqwb-group reqwb-fold', open: filter === 'proposed' },
      h('summary', null, `还需要你确认（${proposedItems.length} 项）`),
      h('p', { className: 'reqwb-muted' }, '这些只是待确认的想法，尚未列入要做的功能。核对后可点击“确认要做”。'),
      renderList(proposedItems),
    ) : null,
    cancelledItems.length ? h('details', { key: `cancelled-${filter}`, className: 'reqwb-group reqwb-fold', open: filter === 'cancelled' },
      h('summary', null, `已取消的内容（${cancelledItems.length} 项）`),
      renderList(cancelledItems),
    ) : null,
    snapshot ? h('div', { className: 'reqwb-sync reqwb-muted' },
      h('p', null, '清单会自动更新；正在编辑的内容会保留。'),
      h('details', { className: 'reqwb-detail' },
        h('summary', null, '同步信息'),
        h('p', null, `数据版本 ${snapshot.revision} · 页面打开期间每 5 秒同步。`),
      ),
    ) : null,
  )
}

// Styles live with the View and affect only its descendants; no global sidebar overrides.
const CSS = `
.reqwb-page{box-sizing:border-box;width:100%;min-height:100%;padding:24px clamp(16px,4vw,48px) 40px;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:1.6}
.reqwb-page *{box-sizing:border-box}.reqwb-page h2,.reqwb-page h3,.reqwb-page p{margin:0}.reqwb-page h2{font-size:21px;font-weight:650}.reqwb-page h3{font-size:15px;font-weight:600}.reqwb-page button,.reqwb-page input,.reqwb-page select,.reqwb-page textarea{font:inherit;color:inherit}
.reqwb-page button{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px 12px;background:transparent;cursor:pointer;white-space:nowrap}.reqwb-page button:hover{background:var(--dsw-alias-interactive-bg-hover)}.reqwb-page button:disabled{opacity:.45;cursor:default}.reqwb-page button:focus-visible,.reqwb-page input:focus-visible,.reqwb-page textarea:focus-visible,.reqwb-page select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#568ade);outline-offset:2px}
.reqwb-page button.reqwb-primary{background:var(--dsw-alias-brand-primary,#426cd5);color:#fff;border-color:transparent}.reqwb-page-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:20px}.reqwb-page-head p{margin-top:6px}.reqwb-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.reqwb-row h3{flex:1;min-width:120px;overflow-wrap:anywhere}.reqwb-muted{color:var(--dsw-alias-label-tertiary,#888);font-size:12px}
.reqwb-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}.reqwb-filters button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-brand-primary,#568ade)}.reqwb-error,.reqwb-notice{padding:12px 14px;margin-bottom:16px;border:1px solid var(--dsw-alias-state-warn-primary,#ad8340);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.reqwb-error{color:var(--dsw-alias-state-error-primary,#d95d5d)}.reqwb-notice .reqwb-row{margin-top:8px}
.reqwb-group{margin-top:22px}.reqwb-group-title{margin-bottom:10px!important;color:var(--dsw-alias-label-secondary)}.reqwb-checklist{margin:0;padding-left:28px;list-style:decimal}.reqwb-checklist>li{padding-left:4px;margin-top:10px}.reqwb-checklist>li::marker{font-weight:600;color:var(--dsw-alias-label-secondary)}.reqwb-check{font-size:20px;line-height:1;color:var(--dsw-alias-label-secondary)}.reqwb-detail{margin-top:10px;font-size:12px;color:var(--dsw-alias-label-secondary)}.reqwb-page summary{cursor:pointer;overflow-wrap:anywhere}.reqwb-page summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#568ade);outline-offset:3px}.reqwb-detail>summary{width:fit-content}.reqwb-detail[open]>summary{margin-bottom:8px}.reqwb-fold{border-top:1px solid var(--dsw-alias-border-l1);padding-top:14px}.reqwb-fold>summary{font-weight:600}.reqwb-fold>p{margin-top:8px}.reqwb-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;background:var(--dsw-alias-bg-layer-1)}.reqwb-badge{font-size:12px;padding:1px 8px;border-radius:20px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);white-space:nowrap}.reqwb-status-proposed{color:var(--dsw-alias-state-warn-primary,#b28a50)}.reqwb-status-done{color:var(--dsw-alias-state-success-primary,#66a87b)}.reqwb-status-cancelled{opacity:.65}.reqwb-description{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px!important}.reqwb-source{margin-top:12px}.reqwb-source blockquote{margin:3px 0 0;border-left:2px solid var(--dsw-alias-border-l1);padding-left:12px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);font-size:13px}.reqwb-card footer{margin-top:14px}.reqwb-tasks{margin-top:14px}.reqwb-progress-label{font-size:12px;color:var(--dsw-alias-label-secondary)}.reqwb-page progress{width:100%;height:6px;accent-color:var(--dsw-alias-brand-primary,#568ade)}.reqwb-task{display:flex;align-items:flex-start;gap:8px;padding:6px 0}.reqwb-task input{margin-top:6px;accent-color:var(--dsw-alias-brand-primary,#568ade)}.reqwb-task-content{flex:1;min-width:0;overflow-wrap:anywhere}.reqwb-task-done .reqwb-task-content{text-decoration:line-through;opacity:.6}.reqwb-task time{font-size:11px;max-width:200px}.reqwb-overdue{color:var(--dsw-alias-state-warn-primary,#b28a50)}
.reqwb-editor{border:1px solid var(--dsw-alias-brand-primary,#568ade);border-radius:12px;margin:16px 0;padding:18px 20px;background:var(--dsw-alias-bg-layer-1)}.reqwb-editor>.reqwb-row{margin-bottom:14px}.reqwb-editor fieldset{margin:0;padding:0;border:0;min-width:0}.reqwb-editor label{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:12px;color:var(--dsw-alias-label-secondary)}.reqwb-editor input:not([type=checkbox]),.reqwb-editor textarea,.reqwb-editor select{width:100%;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:7px 10px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary)}.reqwb-editor textarea{resize:vertical}.reqwb-editor-columns{display:grid;grid-template-columns:160px 1fr;gap:16px}.reqwb-draft-task{display:grid;grid-template-columns:20px minmax(100px,1fr) minmax(150px,220px) auto;gap:8px;align-items:center;margin-top:8px}.reqwb-editor-actions{margin-top:18px}.reqwb-empty{padding:40px 16px;text-align:center;color:var(--dsw-alias-label-tertiary)}.reqwb-sync{margin-top:24px!important}
@media(max-width:650px){.reqwb-page{padding:18px 12px 32px}.reqwb-card,.reqwb-editor{padding:14px}.reqwb-editor-columns{grid-template-columns:1fr;gap:0}.reqwb-draft-task{grid-template-columns:20px 1fr auto}.reqwb-draft-task input[type=datetime-local]{grid-column:2;grid-row:2}.reqwb-draft-task button{grid-column:3;grid-row:1}.reqwb-task{flex-wrap:wrap}.reqwb-task time{margin-left:24px}}
`

// `slots` is supplied by the DSH browser runtime. Keep its narrow public face
// structural: the installed runtime does not ship a separate ui-slots type package.
interface ViewSlotService {
  inject(name: string, callback: () => () => void): () => void
  register(options: { name: string; id: string; order?: number; label?: string }, component: React.ComponentType<{ sessionId: string }>): () => void
}
export const inject = ['remote', 'slots']
export async function apply(ctx: Context) {
  await ctx.remote.$mount(TYPERT_REMOTE)
  await ctx.inject(['remote.requirements', 'slots'] as any, (child) => {
    const req = child.get('remote.requirements') as unknown as RequirementsRemote
    const slots = child.get('slots') as unknown as ViewSlotService
    child.effect(() => slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view', id: 'requirements', order: 100, label: '需求',
    }, ({ sessionId }) => h(RequirementsPage, { key: sessionId, sessionId, req }))), 'requirements: session View')
  })
}
