import { Timestamp } from 'firebase/firestore'
import type { ProjectBundle } from '../app/utils/project-io'

// Deterministic seed project for unit tests (money math, rollups, round-trip).
// No Date.now — fixed timestamps so assertions are stable.
const TS = (s: number) => new Timestamp(s, 0)

export function seededBundle(): ProjectBundle {
  const uid = 'owner-1'
  const projectId = 'proj-1'
  const base = { uid, projectId }
  return {
    project: {
      id: projectId,
      uid,
      name: 'Maple St Remodel',
      address: '123 Maple St, Marietta GA',
      totalBudgetCents: 5_000_000,
      contingencyPct: 15,
      createdAt: TS(1_700_000_000),
    },
    rooms: [
      {
        ...base,
        id: 'room-kitchen',
        name: 'Kitchen',
        type: 'kitchen',
        floor: 1,
        geometry: { x: 0, y: 0, w: 200, h: 150, rotation: 0, notches: [], walls: { n: 0, s: 0, e: 0, w: 0 }, basis: 'exterior', openings: [], fixtures: [] },
        status: 'in-progress',
        z: 0,
      },
    ],
    checklist: [
      { ...base, id: 'chk-1', roomId: 'room-kitchen', label: 'Cabinets', category: 'cabinets', done: true, fromTemplate: true },
      { ...base, id: 'chk-2', roomId: 'room-kitchen', label: 'Backsplash', category: 'finishes', done: false, fromTemplate: true, psychologyTag: 'texture-material-warmth' },
    ],
    budgetLines: [
      { ...base, id: 'bl-1', roomId: 'room-kitchen', label: 'Cabinets', category: 'materials', estimateCents: 1_200_000, actualCents: 1_255_000, vendor: 'KraftMaid' },
      { ...base, id: 'bl-2', roomId: 'room-kitchen', label: 'Install labor', category: 'labor', estimateCents: 400_000 },
    ],
    tasks: [
      { ...base, id: 'task-1', roomId: 'room-kitchen', label: 'Demo old cabinets', phase: 'demo', status: 'done', dependsOn: [], blockedBySelections: [] },
      { ...base, id: 'task-2', roomId: 'room-kitchen', label: 'Hang cabinets', phase: 'fixtures', status: 'blocked', dependsOn: ['task-1'], blockedBySelections: ['sel-1'], dueDate: '2026-07-15' },
    ],
    // Unified Shopping & Selections items: a long-lead selection (purchased,
    // with a derived ETA — task-2 is blocked on it) + a shopping candidate.
    items: [
      { ...base, id: 'sel-1', roomId: 'room-kitchen', label: 'Shaker cabinets', category: 'cabinets', vendor: 'KraftMaid', sku: 'KM-SH-42', priceCents: 1_255_000, leadTimeDays: 42, status: 'purchased', orderedAt: TS(1_701_000_000), expectedAt: '2026-08-01', budgetLineId: 'bl-1' },
      { ...base, id: 'buy-1', roomId: 'room-kitchen', label: 'Brushed gold pull-down faucet', category: 'Faucets', status: 'to-buy', rank: 4, vendor: 'Delta', url: 'https://example.com/faucet', imageUrl: 'https://example.com/faucet.jpg', priceCents: 28_900, notes: 'Matches cabinet hardware' },
    ],
    photos: [
      { ...base, id: 'photo-1', roomId: 'room-kitchen', storagePath: 'users/owner-1/projects/proj-1/rooms/room-kitchen/photos/photo-1/original', thumbPath: 'users/owner-1/projects/proj-1/rooms/room-kitchen/photos/photo-1/thumb', stage: 'before', caption: 'Before demo', takenAt: TS(1_700_500_000) },
    ],
    paints: [
      { ...base, id: 'paint-1', roomId: 'room-kitchen', name: 'Sea Salt', brand: 'Sherwin-Williams', code: 'SW 6204', finish: 'satin', surface: 'walls', hex: '#cbd2c4', notes: 'North-facing test patch approved' },
    ],
    permits: [
      {
        ...base,
        id: 'permit-1',
        scope: 'Electrical',
        authority: 'Cobb County',
        status: 'applied',
        feeCents: 15_000,
        appliedAt: '2026-06-01',
        inspections: [
          { id: 'insp-1', label: 'Rough-in electrical', gatePhase: 'rough-in', status: 'pending' },
        ],
      },
    ],
    inspiration: [
      { ...base, id: 'insp-item-1', roomType: 'kitchen', title: 'IKEA Kitchen Gallery', url: 'https://www.ikea.com/us/en/rooms/kitchen/gallery/', psychologyTags: ['lighting-circadian'] },
    ],
    // Spending ledger: dated actual-spend transactions (the cabinet deposit and
    // a demo-labor draw), distinct from the estimate-centric budgetLines above.
    expenses: [
      { ...base, id: 'exp-1', roomId: 'room-kitchen', label: 'Cabinet deposit', category: 'materials', amountCents: 500_000, date: '2026-06-10', vendor: 'KraftMaid' },
      { ...base, id: 'exp-2', roomId: 'room-kitchen', label: 'Demo labor', category: 'labor', amountCents: 80_000, date: '2026-06-15', note: 'Day rate' },
    ],
  }
}
