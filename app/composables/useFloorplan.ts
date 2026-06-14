import type { Ref } from 'vue'
import type { Fixture, FixtureKind, Geometry, Notch, Opening, OpeningKind, Room, WallSide } from '~/models'
import {
  clampFixtureToRoom,
  clampToWorld,
  edgeSnapTargets,
  footprintRect,
  MIN_ROOM_SIZE,
  moveFixtureTo,
  moveTo,
  nudge,
  openingHitTest,
  rectFromCorners,
  rotate90,
  rotateFixture90,
  sameRect,
  snapTo,
  type SnapTargets,
  snapScalar,
} from '~/utils/geometry'
import { FIXTURE_CATALOG } from '~/config/fixtures'

export type FloorplanTool = 'select' | 'draw' | 'notch' | 'opening' | 'fixture'
export type HandleId = 'nw' | 'ne' | 'sw' | 'se'

const DEFAULT_DOOR_WIDTH = 32
const DEFAULT_WINDOW_WIDTH = 36
const DEFAULT_SILL = 36
const DEFAULT_WINDOW_HEIGHT = 48

interface Point { x: number, y: number }

type Mode
  = | { kind: 'idle' }
    | { kind: 'drawing', anchor: Point }
    | { kind: 'notching', anchor: Point, roomId: string }
    | { kind: 'moving', id: string, start: Point, orig: Geometry }
    | { kind: 'resizing', id: string, anchor: Point, orig: Geometry }
    | { kind: 'movingFixture', roomId: string, fixtureId: string, start: Point, orig: Fixture }

export interface UseFloorplanOptions {
  svgEl: Ref<SVGSVGElement | null>
  rooms: Ref<Room[]>
  tool: Ref<FloorplanTool>
  gridStep: Ref<number>
  selectedId: Ref<string | null>
  selectedFixtureId: Ref<string | null>
  openingKind: Ref<OpeningKind>
  fixtureKind: Ref<FixtureKind>
  onCreate: (geo: Geometry) => void
  onCommit: (id: string, geo: Geometry) => void
  onDeleteRequest: (id: string) => void
  onAddNotch: (roomId: string, notch: Omit<Notch, 'id'>) => void
  onBringToFront: (id: string) => void
  onAddOpening: (roomId: string, opening: Omit<Opening, 'id'>) => void
  onAddFixture: (roomId: string, fixture: Omit<Fixture, 'id'>) => void
  onCommitFixture: (roomId: string, fixture: Fixture) => void
  onDeleteFixture: (roomId: string, fixtureId: string) => void
}

function sameFixture(a: Fixture, b: Fixture): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.rotation === b.rotation
}

function pointInRect(pt: Point, r: { x: number, y: number, w: number, h: number }): boolean {
  return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h
}

// Pointer/keyboard state machine for the floorplan canvas: draw, drag, resize,
// nudge, rotate, notch rooms; place doors/windows; place, drag and rotate
// fixtures. Persistence stays outside (callbacks); while a gesture is in flight
// the live geometry/fixture is a local overlay — exactly one write on end.
export function useFloorplan(opts: UseFloorplanOptions) {
  const mode = ref<Mode>({ kind: 'idle' })
  const draftRect = ref<Geometry | null>(null)
  const notchDraft = ref<Geometry | null>(null)
  const overlay = ref<{ id: string, geo: Geometry } | null>(null)
  const fixtureOverlay = ref<{ roomId: string, fixtureId: string, fixture: Fixture } | null>(null)
  // The edge lines the in-flight gesture is currently magnetized to (rendered
  // as guides). Cleared when the gesture ends.
  const snapGuides = ref<{ x: number | null, y: number | null }>({ x: null, y: null })

  const selectedRoom = computed(
    () => opts.rooms.value.find(r => r.id === opts.selectedId.value) ?? null,
  )

  // The selected fixture resolved to its owning room + live geometry.
  const selectedFixture = computed(() => {
    const fid = opts.selectedFixtureId.value
    if (!fid) return null
    for (const room of opts.rooms.value) {
      const f = (room.geometry.fixtures ?? []).find(x => x.id === fid)
      if (f) return { room, fixture: liveFixtureOf(room, f) }
    }
    return null
  })

  watch(opts.rooms, (rooms) => {
    if (overlay.value) {
      const room = rooms.find(r => r.id === overlay.value!.id)
      if (!room || sameRect(room.geometry, overlay.value.geo)) overlay.value = null
    }
    if (fixtureOverlay.value) {
      const room = rooms.find(r => r.id === fixtureOverlay.value!.roomId)
      const f = room?.geometry.fixtures?.find(x => x.id === fixtureOverlay.value!.fixtureId)
      if (!f || sameFixture(f, fixtureOverlay.value.fixture)) fixtureOverlay.value = null
    }
  }, { deep: true })

  function liveFixtureOf(room: Room, f: Fixture): Fixture {
    const o = fixtureOverlay.value
    return o && o.roomId === room.id && o.fixtureId === f.id ? o.fixture : f
  }

  // Room geometry for rendering: the move/resize overlay if active, with any
  // in-flight fixture drag substituted in so the fixture tracks the pointer.
  function liveGeometry(room: Room): Geometry {
    let geo = overlay.value?.id === room.id ? overlay.value.geo : room.geometry
    const o = fixtureOverlay.value
    if (o && o.roomId === room.id) {
      geo = { ...geo, fixtures: (geo.fixtures ?? []).map(f => f.id === o.fixtureId ? o.fixture : f) }
    }
    return geo
  }

  function toWorld(e: PointerEvent): Point {
    const svg = opts.svgEl.value
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function capturePointer(e: PointerEvent): void {
    try { opts.svgEl.value?.setPointerCapture(e.pointerId) }
    catch { /* gesture proceeds uncaptured */ }
  }
  function releasePointer(e: PointerEvent): void {
    try { opts.svgEl.value?.releasePointerCapture(e.pointerId) }
    catch { /* already released */ }
  }

  // Topmost room (highest z, ties → later in the array) whose footprint covers a
  // world point — used to drop a fixture into the room under the pointer.
  function roomAt(pt: Point): Room | null {
    let best: Room | null = null
    let bestZ = -Infinity
    opts.rooms.value.forEach((r, i) => {
      if (!pointInRect(pt, footprintRect(liveGeometry(r)))) return
      const z = (r.z ?? 0) + i / 1e6
      if (z >= bestZ) { bestZ = z; best = r }
    })
    return best
  }

  // Magnetize a free point (draw/resize/notch corner) to nearby edge lines.
  function snapPoint(pt: Point, targets: SnapTargets): Point {
    const sx = snapScalar(pt.x, targets.xs)
    const sy = snapScalar(pt.y, targets.ys)
    snapGuides.value = { x: sx.snapped, y: sy.snapped }
    return { x: sx.value, y: sy.value }
  }

  // Magnetize a translated room: snap whichever of its left/right (top/bottom)
  // edges is closest to a target line, shifting the whole room so it tucks flush
  // against another room — including into a notch corner.
  function applyMoveSnap(geo: Geometry, excludeId: string): Geometry {
    const t = edgeSnapTargets(opts.rooms.value, excludeId)
    const left = snapScalar(geo.x, t.xs)
    const right = snapScalar(geo.x + geo.w, t.xs)
    const ld = left.snapped !== null ? Math.abs(left.value - geo.x) : Infinity
    const rd = right.snapped !== null ? Math.abs(right.value - (geo.x + geo.w)) : Infinity
    let dx = 0
    let gx: number | null = null
    if (left.snapped !== null && ld <= rd) { dx = left.value - geo.x; gx = left.snapped }
    else if (right.snapped !== null) { dx = right.value - (geo.x + geo.w); gx = right.snapped }

    const top = snapScalar(geo.y, t.ys)
    const bottom = snapScalar(geo.y + geo.h, t.ys)
    const td = top.snapped !== null ? Math.abs(top.value - geo.y) : Infinity
    const bd = bottom.snapped !== null ? Math.abs(bottom.value - (geo.y + geo.h)) : Infinity
    let dy = 0
    let gy: number | null = null
    if (top.snapped !== null && td <= bd) { dy = top.value - geo.y; gy = top.snapped }
    else if (bottom.snapped !== null) { dy = bottom.value - (geo.y + geo.h); gy = bottom.snapped }

    snapGuides.value = { x: gx, y: gy }
    return clampToWorld({ ...geo, x: geo.x + dx, y: geo.y + dy })
  }

  function commitOverlay(orig: Geometry): void {
    const o = overlay.value
    if (o && !sameRect(o.geo, orig)) opts.onCommit(o.id, o.geo)
    else overlay.value = null
  }

  let pendingNudge: { id: string, geo: Geometry, base: Geometry } | null = null

  function commitPendingNudge(): void {
    const p = pendingNudge
    pendingNudge = null
    if (p && !sameRect(p.geo, p.base)) opts.onCommit(p.id, p.geo)
  }
  const scheduleNudgeCommit = useDebounceFn(commitPendingNudge, 400)

  let pendingFixtureNudge: { roomId: string, fixture: Fixture } | null = null
  function commitPendingFixtureNudge(): void {
    const p = pendingFixtureNudge
    pendingFixtureNudge = null
    if (p) opts.onCommitFixture(p.roomId, p.fixture)
  }
  const scheduleFixtureNudgeCommit = useDebounceFn(commitPendingFixtureNudge, 400)

  function anchorFor(handle: HandleId, g: Geometry): Point {
    return {
      x: handle === 'nw' || handle === 'sw' ? g.x + g.w : g.x,
      y: handle === 'nw' || handle === 'ne' ? g.y + g.h : g.y,
    }
  }

  // ---- opening / fixture placement ----

  function placeOpening(pt: Point): void {
    const step = opts.gridStep.value
    const width = opts.openingKind.value === 'window' ? DEFAULT_WINDOW_WIDTH : DEFAULT_DOOR_WIDTH
    // Pick the topmost room whose wall the click lands on (z, then array order),
    // consistent with the rest of the stacking model.
    const hits = opts.rooms.value
      .map((room, i) => {
        const hit = openingHitTest(room.geometry, pt, width, step)
        return hit ? { room, wall: hit.wall, offset: hit.offset, rank: (room.z ?? 0) + i / 1e6 } : null
      })
      .filter((h): h is { room: Room, wall: WallSide, offset: number, rank: number } => h !== null)
    if (hits.length === 0) return
    const best = hits.reduce((a, b) => (b.rank >= a.rank ? b : a))
    opts.selectedId.value = best.room.id
    opts.selectedFixtureId.value = null
    opts.onAddOpening(best.room.id, opts.openingKind.value === 'window'
      ? { kind: 'window', wall: best.wall, offset: best.offset, width, sill: DEFAULT_SILL, height: DEFAULT_WINDOW_HEIGHT }
      : { kind: 'door', wall: best.wall, offset: best.offset, width, doorType: 'single', hinge: 'left', swing: 'in' })
  }

  function placeFixture(pt: Point): void {
    const room = roomAt(pt)
    if (!room) return
    // Select the host room so the summary panel opens to tweak the new fixture.
    opts.selectedId.value = room.id
    const step = opts.gridStep.value
    const spec = FIXTURE_CATALOG[opts.fixtureKind.value]
    const draft: Fixture = {
      id: 'draft',
      kind: opts.fixtureKind.value,
      x: snapTo(pt.x - room.geometry.x - spec.w / 2, step),
      y: snapTo(pt.y - room.geometry.y - spec.h / 2, step),
      w: spec.w,
      h: spec.h,
      rotation: 0,
    }
    const placed = { ...draft, ...clampFixtureToRoom(room.geometry, draft) }
    opts.onAddFixture(room.id, {
      kind: placed.kind,
      x: placed.x,
      y: placed.y,
      w: placed.w,
      h: placed.h,
      rotation: 0,
    })
    opts.tool.value = 'select'
  }

  let activePointerId: number | null = null

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || activePointerId !== null) return
    activePointerId = e.pointerId
    commitPendingNudge()
    commitPendingFixtureNudge()
    const pt = toWorld(e)
    const target = e.target as Element

    if (opts.tool.value === 'draw') {
      mode.value = { kind: 'drawing', anchor: pt }
    }
    else if (opts.tool.value === 'notch' && opts.selectedId.value) {
      mode.value = { kind: 'notching', anchor: pt, roomId: opts.selectedId.value }
    }
    else if (opts.tool.value === 'opening') {
      placeOpening(pt)
    }
    else if (opts.tool.value === 'fixture') {
      placeFixture(pt)
    }
    else {
      const handle = target.closest('[data-handle]')?.getAttribute('data-handle') as HandleId | null
      const fixtureId = target.closest('[data-fixture-id]')?.getAttribute('data-fixture-id') ?? null
      const roomEl = target.closest('[data-room-id]')
      const roomId = roomEl?.getAttribute('data-room-id') ?? null

      if (handle && selectedRoom.value) {
        opts.selectedFixtureId.value = null
        const orig = liveGeometry(selectedRoom.value)
        mode.value = { kind: 'resizing', id: selectedRoom.value.id, anchor: anchorFor(handle, orig), orig }
      }
      else if (fixtureId && roomId) {
        // Select + drag a fixture (its room is selected too so the panel shows).
        opts.selectedId.value = roomId
        opts.selectedFixtureId.value = fixtureId
        const room = opts.rooms.value.find(r => r.id === roomId)
        const fixture = room?.geometry.fixtures?.find(f => f.id === fixtureId)
        if (room && fixture) mode.value = { kind: 'movingFixture', roomId, fixtureId, start: pt, orig: fixture }
      }
      else if (roomId) {
        opts.selectedId.value = roomId
        opts.selectedFixtureId.value = null
        // Grabbing a room brings it to the front so it bites overlaps, not the
        // reverse (the page no-ops if it is already on top).
        opts.onBringToFront(roomId)
        const room = opts.rooms.value.find(r => r.id === roomId)
        if (room) mode.value = { kind: 'moving', id: roomId, start: pt, orig: liveGeometry(room) }
      }
      else {
        opts.selectedId.value = null
        opts.selectedFixtureId.value = null
      }
    }
    capturePointer(e)
  }

  function onPointerMove(e: PointerEvent): void {
    const m = mode.value
    if (m.kind === 'idle' || e.pointerId !== activePointerId) return
    const pt = toWorld(e)
    const step = opts.gridStep.value

    if (m.kind === 'drawing') {
      const dragged = Math.max(Math.abs(pt.x - m.anchor.x), Math.abs(pt.y - m.anchor.y)) >= step
      if (dragged) {
        const sp = snapPoint(pt, edgeSnapTargets(opts.rooms.value, null))
        draftRect.value = rectFromCorners(m.anchor, sp, step)
      }
      else {
        draftRect.value = null
        snapGuides.value = { x: null, y: null }
      }
    }
    else if (m.kind === 'notching') {
      const dragged = Math.max(Math.abs(pt.x - m.anchor.x), Math.abs(pt.y - m.anchor.y)) >= step
      const room = opts.rooms.value.find(r => r.id === m.roomId)
      if (dragged && room) {
        const g = liveGeometry(room)
        const sp = snapPoint(pt, { xs: [g.x, g.x + g.w], ys: [g.y, g.y + g.h] })
        notchDraft.value = rectFromCorners(m.anchor, sp, step)
      }
      else {
        notchDraft.value = null
        snapGuides.value = { x: null, y: null }
      }
    }
    else if (m.kind === 'moving') {
      const moved = moveTo(m.orig, m.orig.x + (pt.x - m.start.x), m.orig.y + (pt.y - m.start.y), step)
      overlay.value = { id: m.id, geo: applyMoveSnap(moved, m.id) }
    }
    else if (m.kind === 'resizing') {
      const sp = snapPoint(pt, edgeSnapTargets(opts.rooms.value, m.id))
      const r = rectFromCorners(m.anchor, sp, step, m.orig.rotation)
      // Only the rectangle changes — keep walls/notches/openings/fixtures/basis
      // (rectFromCorners returns a bare emptyGeometry that would strip them).
      overlay.value = { id: m.id, geo: { ...m.orig, x: r.x, y: r.y, w: r.w, h: r.h } }
    }
    else if (m.kind === 'movingFixture') {
      const room = opts.rooms.value.find(r => r.id === m.roomId)
      if (room) {
        const moved = moveFixtureTo(room.geometry, m.orig, m.orig.x + (pt.x - m.start.x), m.orig.y + (pt.y - m.start.y), step)
        fixtureOverlay.value = { roomId: m.roomId, fixtureId: m.fixtureId, fixture: moved }
      }
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.pointerId !== activePointerId) return
    activePointerId = null
    const m = mode.value
    releasePointer(e)

    if (m.kind === 'drawing') {
      const draft = draftRect.value
      draftRect.value = null
      if (draft && draft.w >= MIN_ROOM_SIZE && draft.h >= MIN_ROOM_SIZE) opts.onCreate(draft)
    }
    else if (m.kind === 'notching') {
      const draft = notchDraft.value
      notchDraft.value = null
      const room = opts.rooms.value.find(r => r.id === m.roomId)
      if (draft && room && draft.w >= MIN_ROOM_SIZE && draft.h >= MIN_ROOM_SIZE) {
        const geo = liveGeometry(room)
        opts.onAddNotch(m.roomId, { x: draft.x - geo.x, y: draft.y - geo.y, w: draft.w, h: draft.h })
      }
      // Stay in notch mode so the user can draw multiple notches in sequence
    }
    else if (m.kind === 'moving' || m.kind === 'resizing') {
      commitOverlay(m.orig)
    }
    else if (m.kind === 'movingFixture') {
      const o = fixtureOverlay.value
      if (o && !sameFixture(o.fixture, m.orig)) opts.onCommitFixture(o.roomId, o.fixture)
      else fixtureOverlay.value = null
    }
    mode.value = { kind: 'idle' }
    snapGuides.value = { x: null, y: null }
  }

  function rotateSelected(): void {
    const room = selectedRoom.value
    if (!room) return
    const next = rotate90(liveGeometry(room), opts.gridStep.value)
    pendingNudge = null
    if (sameRect(next, room.geometry)) return
    overlay.value = { id: room.id, geo: next }
    opts.onCommit(room.id, next)
  }

  function rotateSelectedFixture(): void {
    const sel = selectedFixture.value
    if (!sel) return
    const rotated0 = rotateFixture90(sel.fixture)
    const rotated = { ...rotated0, ...clampFixtureToRoom(sel.room.geometry, rotated0) }
    fixtureOverlay.value = { roomId: sel.room.id, fixtureId: rotated.id, fixture: rotated }
    opts.onCommitFixture(sel.room.id, rotated)
  }

  // Rotate the active selection: a selected fixture takes priority over its room.
  function rotateActive(): void {
    if (opts.selectedFixtureId.value) rotateSelectedFixture()
    else rotateSelected()
  }

  function nudgeSelected(dx: number, dy: number): void {
    const room = selectedRoom.value
    if (!room) return
    const geo = nudge(liveGeometry(room), dx, dy, opts.gridStep.value)
    overlay.value = { id: room.id, geo }
    pendingNudge = {
      id: room.id,
      geo,
      base: pendingNudge?.id === room.id ? pendingNudge.base : room.geometry,
    }
    scheduleNudgeCommit()
  }

  function nudgeSelectedFixture(dx: number, dy: number): void {
    const sel = selectedFixture.value
    if (!sel) return
    const step = opts.gridStep.value
    const f = moveFixtureTo(sel.room.geometry, sel.fixture, sel.fixture.x + dx * step, sel.fixture.y + dy * step, step)
    fixtureOverlay.value = { roomId: sel.room.id, fixtureId: f.id, fixture: f }
    pendingFixtureNudge = { roomId: sel.room.id, fixture: f }
    scheduleFixtureNudgeCommit()
  }

  // Arrow keys nudge the active selection: a selected fixture over its room.
  function nudgeActive(dx: number, dy: number): void {
    if (opts.selectedFixtureId.value) nudgeSelectedFixture(dx, dy)
    else nudgeSelected(dx, dy)
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t instanceof Element
      && t.closest('input, textarea, select, button, [role="tab"], [contenteditable]')) return
    if (document.querySelector('.v-overlay--active')) return

    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); nudgeActive(-1, 0); break
      case 'ArrowRight': e.preventDefault(); nudgeActive(1, 0); break
      case 'ArrowUp': e.preventDefault(); nudgeActive(0, -1); break
      case 'ArrowDown': e.preventDefault(); nudgeActive(0, 1); break
      case 'r':
      case 'R': rotateActive(); break
      case 'Delete':
      case 'Backspace':
        if (opts.selectedFixtureId.value) {
          const sel = selectedFixture.value
          if (sel) opts.onDeleteFixture(sel.room.id, sel.fixture.id)
          opts.selectedFixtureId.value = null
        }
        else if (opts.selectedId.value) {
          opts.onDeleteRequest(opts.selectedId.value)
        }
        break
      case 'Escape':
        if (['drawing', 'notching'].includes(mode.value.kind)) {
          draftRect.value = null
          notchDraft.value = null
          mode.value = { kind: 'idle' }
          if (opts.tool.value !== 'select') opts.tool.value = 'select'
        }
        else if (opts.tool.value === 'opening' || opts.tool.value === 'fixture') {
          opts.tool.value = 'select'
        }
        else if (opts.selectedFixtureId.value) {
          opts.selectedFixtureId.value = null
        }
        else {
          opts.selectedId.value = null
        }
        break
    }
  }

  function sanitize(geo: Geometry): Geometry {
    return clampToWorld(geo)
  }

  return {
    draftRect,
    notchDraft,
    overlay,
    fixtureOverlay,
    snapGuides,
    selectedRoom,
    selectedFixture,
    liveGeometry,
    rotateSelected,
    rotateActive,
    sanitize,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeydown,
  }
}
