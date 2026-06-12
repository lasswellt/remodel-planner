import { describe, expect, it } from 'vitest'
import {
  effectiveRoomStatus,
  nextOpenTask,
  phaseProgress,
  projectProgress,
  roomProgress,
} from '../app/utils/rollup'
import type { TaskLike } from '../app/utils/rollup'

const checklist = [
  { roomId: 'a', done: true },
  { roomId: 'a', done: false },
  { roomId: 'b', done: true },
]
const tasks: TaskLike[] = [
  { roomId: 'a', phase: 'demo', status: 'done' },
  { roomId: 'a', phase: 'paint', status: 'todo' },
  { roomId: 'b', phase: 'drywall', status: 'in-progress' },
]

describe('roomProgress', () => {
  it('counts checklist items and tasks together, per room', () => {
    expect(roomProgress('a', checklist, tasks)).toEqual({
      done: 2, total: 4, pct: 50, complete: false,
    })
    expect(roomProgress('b', checklist, tasks)).toEqual({
      done: 1, total: 2, pct: 50, complete: false,
    })
  })

  it('is 0% (not complete) with no items', () => {
    expect(roomProgress('empty', checklist, tasks)).toEqual({
      done: 0, total: 0, pct: 0, complete: false,
    })
  })

  it('floors pct so 100 is only shown when truly complete', () => {
    const many = Array.from({ length: 299 }, () => ({ roomId: 'x', done: true }))
    many.push({ roomId: 'x', done: false })
    const p = roomProgress('x', many, [])
    expect(p.pct).toBe(99)
    expect(p.complete).toBe(false)
  })

  it('reports complete at exactly all-done', () => {
    const p = roomProgress('a', [{ roomId: 'a', done: true }], [
      { roomId: 'a', phase: 'demo', status: 'done' },
    ])
    expect(p).toEqual({ done: 2, total: 2, pct: 100, complete: true })
  })
})

describe('projectProgress', () => {
  it('aggregates across all rooms', () => {
    expect(projectProgress(checklist, tasks)).toEqual({
      done: 3, total: 6, pct: 50, complete: false,
    })
  })

  it('handles an empty project', () => {
    expect(projectProgress([], [])).toEqual({ done: 0, total: 0, pct: 0, complete: false })
  })
})

describe('phaseProgress', () => {
  it('rolls up tasks per remodel phase', () => {
    const byPhase = phaseProgress(tasks)
    expect(byPhase.demo).toEqual({ done: 1, total: 1, pct: 100, complete: true })
    expect(byPhase.paint).toEqual({ done: 0, total: 1, pct: 0, complete: false })
    expect(byPhase['rough-in']).toEqual({ done: 0, total: 0, pct: 0, complete: false })
  })
})

describe('effectiveRoomStatus', () => {
  it('forces done at 100% regardless of stored status (UX3)', () => {
    const complete = { done: 2, total: 2, pct: 100, complete: true }
    expect(effectiveRoomStatus('planned', complete)).toBe('done')
  })

  it('keeps the stored status otherwise', () => {
    const partial = { done: 1, total: 2, pct: 50, complete: false }
    expect(effectiveRoomStatus('in-progress', partial)).toBe('in-progress')
    expect(effectiveRoomStatus('planned', { done: 0, total: 0, pct: 0, complete: false })).toBe('planned')
  })
})

describe('nextOpenTask', () => {
  it('returns the earliest open task by remodel sequencing, not array order', () => {
    const unordered: TaskLike[] = [
      { roomId: 'a', phase: 'fixtures', status: 'todo' },
      { roomId: 'a', phase: 'rough-in', status: 'blocked' },
      { roomId: 'a', phase: 'demo', status: 'done' },
    ]
    expect(nextOpenTask('a', unordered)?.phase).toBe('rough-in')
  })

  it('returns null when every task is done or the room has none', () => {
    expect(nextOpenTask('a', [{ roomId: 'a', phase: 'demo', status: 'done' }])).toBeNull()
    expect(nextOpenTask('missing', tasks)).toBeNull()
  })
})
