import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { exportProject, importProject, type ProjectExport } from '../app/utils/project-io'
import { SCHEMA_VERSION } from '../app/models'
import { seededBundle } from './factories'

describe('project export/import', () => {
  it('round-trips export -> import -> deep-equal on the seeded project', () => {
    const bundle = seededBundle()
    const exported = exportProject(bundle, '2026-06-12T00:00:00.000Z')

    // Survives JSON serialization (the real export writes a .json file).
    const wire = JSON.parse(JSON.stringify(exported)) as ProjectExport
    const imported = importProject(wire)

    expect(imported).toEqual(bundle)
  })

  it('carries the current schemaVersion', () => {
    const exported = exportProject(seededBundle(), '2026-06-12T00:00:00.000Z')
    expect(exported.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('preserves Firestore Timestamps as Timestamp instances', () => {
    const bundle = seededBundle()
    const imported = importProject(JSON.parse(JSON.stringify(exportProject(bundle, 'x'))))
    expect(imported.project.createdAt).toBeInstanceOf(Timestamp)
    expect(imported.project.createdAt.seconds).toBe(bundle.project.createdAt.seconds)
  })

  it('refuses an export newer than the supported schema version', () => {
    const future: ProjectExport = {
      schemaVersion: SCHEMA_VERSION + 1,
      exportedAt: 'x',
      bundle: {},
    }
    expect(() => importProject(future)).toThrow(/newer than supported/)
  })

  it('rejects a bundle with an invalid enum (defends the import boundary)', () => {
    const exported = exportProject(seededBundle(), 'x') as ProjectExport
    // Corrupt a task status to an out-of-enum value.
    ;(exported.bundle as { tasks: { status: string }[] }).tasks[0].status = 'not-a-status'
    expect(() => importProject(JSON.parse(JSON.stringify(exported)))).toThrow()
  })

  it('migrates a v1 export (selections[] + purchases[]) into one items[]', () => {
    const TS = (s: number) => new Timestamp(s, 0)
    const base = { uid: 'owner-1', projectId: 'proj-1' }
    const { items: _items, ...rest } = seededBundle()
    // Re-split into the legacy v1 shape with pre-merge statuses.
    const v1bundle = {
      ...rest,
      selections: [
        { ...base, id: 'sel-1', roomId: 'room-kitchen', label: 'Shaker cabinets', category: 'cabinets', leadTimeDays: 42, status: 'ordered', orderedAt: TS(1_701_000_000), expectedAt: '2026-08-01', budgetLineId: 'bl-1' },
      ],
      purchases: [
        { ...base, id: 'buy-1', roomId: 'room-kitchen', title: 'Brushed gold faucet', group: 'Faucets', status: 'to-buy', rank: 4, priceCents: 28_900 },
      ],
    }
    const exported = exportProject(v1bundle as never, 'x')
    exported.schemaVersion = 1 // mark as a legacy v1 export

    const imported = importProject(JSON.parse(JSON.stringify(exported)))

    expect(imported.items.map(i => i.id).sort()).toEqual(['buy-1', 'sel-1'])
    expect(imported.items.find(i => i.id === 'sel-1')?.status).toBe('purchased') // ordered → purchased
    expect(imported.items.find(i => i.id === 'sel-1')?.label).toBe('Shaker cabinets')
    expect(imported.items.find(i => i.id === 'buy-1')?.status).toBe('to-buy')
    expect(imported.items.find(i => i.id === 'buy-1')?.label).toBe('Brushed gold faucet') // title → label
    expect(imported.items.find(i => i.id === 'buy-1')?.category).toBe('Faucets') // group → category
    expect((imported as Record<string, unknown>).selections).toBeUndefined()
    expect((imported as Record<string, unknown>).purchases).toBeUndefined()
  })

  it('dedups colliding selection/purchase ids when folding v1 → items[]', () => {
    const base = { uid: 'owner-1', projectId: 'proj-1', roomId: 'room-kitchen' }
    const { items: _items, ...rest } = seededBundle()
    const v1bundle = {
      ...rest,
      // Same id in both legacy collections — must yield ONE items entry, not two.
      selections: [{ ...base, id: 'dup', label: 'From selection', status: 'decided' }],
      purchases: [{ ...base, id: 'dup', title: 'From purchase', group: 'X', status: 'idea', rank: 0 }],
    }
    const exported = exportProject(v1bundle as never, 'x')
    exported.schemaVersion = 1
    const imported = importProject(JSON.parse(JSON.stringify(exported)))
    expect(imported.items.filter(i => i.id === 'dup')).toHaveLength(1)
  })
})
