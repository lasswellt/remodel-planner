import { describe, expect, it } from 'vitest'
import type { DepLike, InspectionLike, SelLike, TaskGraphNode } from '../app/utils/task-graph'
import { isBlocked, taskBlockers } from '../app/utils/task-graph'

const node = (over: Partial<TaskGraphNode>): TaskGraphNode => ({
  phase: 'drywall',
  dependsOn: [],
  blockedBySelections: [],
  ...over,
})

describe('taskBlockers — dependencies', () => {
  it('blocks on an unfinished predecessor task', () => {
    const tasks = new Map<string, DepLike>([['t1', { label: 'Hang drywall', status: 'todo' }]])
    const b = taskBlockers(node({ phase: 'paint', dependsOn: ['t1'] }), tasks, new Map(), [])
    expect(b).toHaveLength(1)
    expect(b[0]!.type).toBe('dependency')
    expect(b[0]!.label).toContain('Hang drywall')
  })

  it('clears once the predecessor is done', () => {
    const tasks = new Map<string, DepLike>([['t1', { label: 'x', status: 'done' }]])
    expect(taskBlockers(node({ dependsOn: ['t1'] }), tasks, new Map(), [])).toHaveLength(0)
  })
})

describe('taskBlockers — selections', () => {
  it('blocks on an undelivered selection and clears once delivered/installed', () => {
    const ordered = new Map<string, SelLike>([['s1', { label: 'Cabinets', status: 'ordered' }]])
    const delivered = new Map<string, SelLike>([['s1', { label: 'Cabinets', status: 'delivered' }]])
    const installed = new Map<string, SelLike>([['s1', { label: 'Cabinets', status: 'installed' }]])
    const t = node({ blockedBySelections: ['s1'] })
    expect(taskBlockers(t, new Map(), ordered, [])).toHaveLength(1)
    expect(taskBlockers(t, new Map(), delivered, [])).toHaveLength(0)
    expect(taskBlockers(t, new Map(), installed, [])).toHaveLength(0)
  })
})

describe('taskBlockers — inspection gates', () => {
  const insp = (status: string): InspectionLike[] => [{ label: 'Rough-in', gatePhase: 'rough-in', status }]

  it('gates later-phase tasks behind an unpassed earlier-phase inspection', () => {
    // drywall is after rough-in → blocked while pending
    expect(taskBlockers(node({ phase: 'drywall' }), new Map(), new Map(), insp('pending'))).toHaveLength(1)
  })

  it('does not gate the inspection\'s own phase or earlier phases', () => {
    expect(taskBlockers(node({ phase: 'rough-in' }), new Map(), new Map(), insp('pending'))).toHaveLength(0)
    expect(taskBlockers(node({ phase: 'demo' }), new Map(), new Map(), insp('pending'))).toHaveLength(0)
  })

  it('releases later phases once the inspection passes', () => {
    expect(taskBlockers(node({ phase: 'fixtures' }), new Map(), new Map(), insp('passed'))).toHaveLength(0)
  })

  it('keeps gating on a failed inspection', () => {
    expect(taskBlockers(node({ phase: 'fixtures' }), new Map(), new Map(), insp('failed'))).toHaveLength(1)
  })
})

describe('taskBlockers — composition + edge cases', () => {
  it('accumulates dependency + selection + inspection blockers together', () => {
    const t = node({ phase: 'flooring', dependsOn: ['t1'], blockedBySelections: ['s1'] })
    const tasks = new Map<string, DepLike>([['t1', { label: 'Drywall', status: 'in-progress' }]])
    const sels = new Map<string, SelLike>([['s1', { label: 'Tile', status: 'ordered' }]])
    const insp: InspectionLike[] = [{ label: 'Rough-in', gatePhase: 'rough-in', status: 'failed' }]
    const b = taskBlockers(t, tasks, sels, insp)
    expect(b.map(x => x.type).sort()).toEqual(['dependency', 'inspection', 'selection'])
    expect(isBlocked(t, tasks, sels, insp)).toBe(true)
  })

  it('ignores dangling dependency/selection ids', () => {
    const t = node({ dependsOn: ['missing'], blockedBySelections: ['gone'] })
    expect(taskBlockers(t, new Map(), new Map(), [])).toHaveLength(0)
    expect(isBlocked(t, new Map(), new Map(), [])).toBe(false)
  })
})
