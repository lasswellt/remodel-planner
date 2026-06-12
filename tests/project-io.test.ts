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
})
