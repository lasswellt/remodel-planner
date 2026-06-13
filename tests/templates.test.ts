import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOM_TEMPLATES } from '../app/config/templates'
import { RoomType, TASK_PHASE_ORDER } from '../app/models/enums'
import { parsePsychology } from '../app/utils/research-parse'

const corpusSlugs = new Set(
  parsePsychology(
    readFileSync(resolve(__dirname, '../content/research/design-psychology.md'), 'utf8'),
  ).map(e => e.slug),
)

const templates = Object.values(ROOM_TEMPLATES)

describe('ROOM_TEMPLATES catalog', () => {
  it('covers every room type', () => {
    expect(Object.keys(ROOM_TEMPLATES).sort()).toEqual([...RoomType.options].sort())
    for (const t of templates) {
      expect(t.checklist.length, t.type).toBeGreaterThanOrEqual(4)
      expect(t.tasks.length, t.type).toBeGreaterThanOrEqual(5)
    }
  })

  it('every psychologyTag resolves to a real research entry (no dead anchors)', () => {
    for (const t of templates) {
      for (const item of t.checklist) {
        if (item.psychologyTag) {
          expect(corpusSlugs.has(item.psychologyTag), `${t.type}: ${item.label} → ${item.psychologyTag}`).toBe(true)
        }
      }
    }
  })

  it('every research principle is reachable from at least one template popover', () => {
    const used = new Set(
      templates.flatMap(t => t.checklist.map(i => i.psychologyTag)).filter(Boolean),
    )
    for (const slug of corpusSlugs) {
      expect(used.has(slug), `corpus entry never referenced: ${slug}`).toBe(true)
    }
  })

  it('task keys are unique and dependsOn references resolve within the template', () => {
    for (const t of templates) {
      const keys = t.tasks.map(task => task.key)
      expect(new Set(keys).size, t.type).toBe(keys.length)
      for (const task of t.tasks) {
        for (const dep of task.dependsOn ?? []) {
          expect(keys.includes(dep), `${t.type}: ${task.key} depends on missing ${dep}`).toBe(true)
          expect(dep, `${t.type}: ${task.key} depends on itself`).not.toBe(task.key)
        }
      }
    }
  })

  it('dependencies never point to a later remodel phase (sequencing stays sane)', () => {
    for (const t of templates) {
      const phaseByKey = new Map(t.tasks.map(task => [task.key, task.phase]))
      for (const task of t.tasks) {
        for (const dep of task.dependsOn ?? []) {
          const depRank = TASK_PHASE_ORDER.indexOf(phaseByKey.get(dep)!)
          const taskRank = TASK_PHASE_ORDER.indexOf(task.phase)
          expect(depRank, `${t.type}: ${task.key} (${task.phase}) depends on later-phase ${dep}`).toBeLessThanOrEqual(taskRank)
        }
      }
    }
  })

  it('checklist labels are unique per template', () => {
    for (const t of templates) {
      const labels = t.checklist.map(i => i.label)
      expect(new Set(labels).size, t.type).toBe(labels.length)
    }
  })
})
