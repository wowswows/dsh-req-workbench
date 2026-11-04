import { z } from 'zod'
import type { TypertRemoteContribution, InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
const status = z.enum(['proposed', 'confirmed', 'in_progress', 'done', 'cancelled'])
const task = z.object({ id: z.string(), content: z.string(), done: z.boolean(), due: z.number().nullable().optional() })
const requirement = z.object({ id: z.string(), title: z.string(), description: z.string(), source: z.string(), status,
  createdAt: z.number(), updatedAt: z.number(), tasks: z.array(task) })
const snapshot = z.object({ revision: z.number(), requirements: z.array(requirement) })
const changes = z.array(z.object({ id: z.string().optional(), title: z.string().optional(), description: z.string().optional(),
  source: z.string().optional(), status: status.optional(), tasks: z.array(z.object({ id: z.string().optional(), content: z.string(),
    done: z.boolean().optional(), due: z.number().nullable().optional() })).optional() }))
const descriptor = (method: string, args: z.ZodType): InvocationDescriptor => ({
  id: '@dsh-community/dsh-req-workbench#requirements/' + method,
  service: 'requirements', namespace: 'requirements', method, invocation: { kind: 'direct' },
  parameters: [{ name: 'args', wire: 'args', source: 'json', codec: { mode: 'strict', typeSymbol: 'requirements/' + method + '/args', create: () => args } }],
  result: { mode: 'strict', typeSymbol: 'requirements/Snapshot', create: () => snapshot },
})
export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@dsh-community/dsh-req-workbench', descriptors: [
    descriptor('snapshot', z.object({ sessionId: z.string() })),
    descriptor('applyChanges', z.object({ sessionId: z.string(), expectedRevision: z.number().int().nonnegative(), changes })),
  ],
}
