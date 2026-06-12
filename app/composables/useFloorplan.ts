import type { Ref } from 'vue'
import type { Geometry, Room } from '~/models'
import {
  clampToWorld,
  MIN_ROOM_SIZE,
  moveTo,
  nudge,
  rectFromCorners,
  rotate90,
  sameRect,
} from '~/utils/geometry'

export type FloorplanTool = 'select' | 'draw'
export type HandleId = 'nw' | 'ne' | 'sw' | 'se'

interface Point { x: number, y: number }

type Mode
  = | { kind: 'idle' }
    | { kind: 'drawing', anchor: Point }
    | { kind: 'moving', id: string, start: Point, orig: Geometry }
    | { kind: 'resizing', id: string, anchor: Point, orig: Geometry }

export interface UseFloorplanOptions {
  svgEl: Ref<SVGSVGElement | null>
  rooms: Ref<Room[]>
  tool: Ref<FloorplanTool>
  gridStep: Ref<number>
  selectedId: Ref<string | null>
  onCreate: (geo: Geometry) => void
  onCommit: (id: string, geo: Geometry) => void
  onDeleteRequest: (id: string) => void
}

// Pointer/keyboard state machine for the floorplan canvas: draw, drag, resize,
// nudge, rotate. Persistence stays outside (onCreate/onCommit callbacks); while
// a gesture is in flight the live geometry is a local overlay, and exactly one
// write happens on gesture end — never one per pointermove.
export function useFloorplan(opts: UseFloorplanOptions) {
  const mode = ref<Mode>({ kind: 'idle' })
  const draftRect = ref<Geometry | null>(null)
  const overlay = ref<{ id: string, geo: Geometry } | null>(null)

  const selectedRoom = computed(
    () => opts.rooms.value.find(r => r.id === opts.selectedId.value) ?? null,
  )

  // Keep the overlay until the store reflects the committed geometry so the
  // rect never flashes back to its pre-gesture position.
  watch(opts.rooms, (rooms) => {
    if (!overlay.value) return
    const room = rooms.find(r => r.id === overlay.value!.id)
    if (!room || sameRect(room.geometry, overlay.value.geo)) overlay.value = null
  }, { deep: true })

  function liveGeometry(room: Room): Geometry {
    return overlay.value?.id === room.id ? overlay.value.geo : room.geometry
  }

  function toWorld(e: PointerEvent): Point {
    const svg = opts.svgEl.value
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  // Capture/release throw NotFoundError for pointers that no longer exist
  // (device removed mid-gesture, pointercancel paths) — never let that abort
  // the gesture bookkeeping around it.
  function capturePointer(e: PointerEvent): void {
    try {
      opts.svgEl.value?.setPointerCapture(e.pointerId)
    }
    catch { /* gesture proceeds uncaptured */ }
  }
  function releasePointer(e: PointerEvent): void {
    try {
      opts.svgEl.value?.releasePointerCapture(e.pointerId)
    }
    catch { /* already released */ }
  }

  function commitOverlay(orig: Geometry): void {
    const o = overlay.value
    if (o && !sameRect(o.geo, orig)) opts.onCommit(o.id, o.geo)
    else overlay.value = null
  }

  // Arrow-key nudges buffer into pendingNudge and commit once, debounced, so
  // holding a key produces one write. The pair is captured at schedule time —
  // never re-resolved through rooms — so a floor/project switch inside the
  // debounce window cannot drop the write, and any gesture or rotate flushes
  // it synchronously first.
  let pendingNudge: { id: string, geo: Geometry, base: Geometry } | null = null

  function commitPendingNudge(): void {
    const p = pendingNudge
    pendingNudge = null
    if (p && !sameRect(p.geo, p.base)) opts.onCommit(p.id, p.geo)
  }
  const scheduleNudgeCommit = useDebounceFn(commitPendingNudge, 400)

  function anchorFor(handle: HandleId, g: Geometry): Point {
    // The anchor is the corner opposite the grabbed handle.
    return {
      x: handle === 'nw' || handle === 'sw' ? g.x + g.w : g.x,
      y: handle === 'nw' || handle === 'ne' ? g.y + g.h : g.y,
    }
  }

  // Single-gesture invariant: the first pointer wins; a second concurrent
  // pointer (other finger, other button) cannot hijack an in-flight gesture.
  let activePointerId: number | null = null

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || activePointerId !== null) return
    activePointerId = e.pointerId
    commitPendingNudge()
    const pt = toWorld(e)
    const target = e.target as Element

    if (opts.tool.value === 'draw') {
      mode.value = { kind: 'drawing', anchor: pt }
    }
    else {
      const handle = target.closest('[data-handle]')?.getAttribute('data-handle') as HandleId | null
      const roomEl = target.closest('[data-room-id]')
      const roomId = roomEl?.getAttribute('data-room-id') ?? null

      if (handle && selectedRoom.value) {
        const orig = liveGeometry(selectedRoom.value)
        mode.value = {
          kind: 'resizing',
          id: selectedRoom.value.id,
          anchor: anchorFor(handle, orig),
          orig,
        }
      }
      else if (roomId) {
        opts.selectedId.value = roomId
        const room = opts.rooms.value.find(r => r.id === roomId)
        if (room) mode.value = { kind: 'moving', id: roomId, start: pt, orig: liveGeometry(room) }
      }
      else {
        opts.selectedId.value = null
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
      // Ignore sub-step jitter so a stray click can't spawn a min-size room.
      const dragged = Math.max(Math.abs(pt.x - m.anchor.x), Math.abs(pt.y - m.anchor.y)) >= step
      draftRect.value = dragged ? rectFromCorners(m.anchor, pt, step) : null
    }
    else if (m.kind === 'moving') {
      overlay.value = {
        id: m.id,
        geo: moveTo(m.orig, m.orig.x + (pt.x - m.start.x), m.orig.y + (pt.y - m.start.y), step),
      }
    }
    else if (m.kind === 'resizing') {
      overlay.value = { id: m.id, geo: rectFromCorners(m.anchor, pt, step, m.orig.rotation) }
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
    else if (m.kind === 'moving' || m.kind === 'resizing') {
      commitOverlay(m.orig)
    }
    mode.value = { kind: 'idle' }
  }

  function rotateSelected(): void {
    const room = selectedRoom.value
    if (!room) return
    // The rotation is computed from liveGeometry, which already includes any
    // pending nudge — drop the buffered nudge so it cannot overwrite this.
    const next = rotate90(liveGeometry(room), opts.gridStep.value)
    pendingNudge = null
    if (sameRect(next, room.geometry)) return
    overlay.value = { id: room.id, geo: next }
    opts.onCommit(room.id, next)
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

  function onKeydown(e: KeyboardEvent): void {
    // Browser/OS shortcuts (Ctrl+R reload, Cmd+arrows…) are not ours.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Focus on any interactive control (toolbar buttons, tabs, selects,
    // fields) keeps its native keyboard behavior. e.target can be window/
    // document for synthetic dispatches — only Elements have closest().
    const t = e.target
    if (t instanceof Element
      && t.closest('input, textarea, select, button, [role="tab"], [contenteditable]')) return
    // A Vuetify dialog/menu is open — its own keyboard handling wins.
    if (document.querySelector('.v-overlay--active')) return

    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); nudgeSelected(-1, 0); break
      case 'ArrowRight': e.preventDefault(); nudgeSelected(1, 0); break
      case 'ArrowUp': e.preventDefault(); nudgeSelected(0, -1); break
      case 'ArrowDown': e.preventDefault(); nudgeSelected(0, 1); break
      case 'r':
      case 'R': rotateSelected(); break
      case 'Delete':
      case 'Backspace':
        if (opts.selectedId.value) opts.onDeleteRequest(opts.selectedId.value)
        break
      case 'Escape':
        if (mode.value.kind === 'drawing') {
          draftRect.value = null
          mode.value = { kind: 'idle' }
        }
        else {
          opts.selectedId.value = null
        }
        break
    }
  }

  // Geometry edits from outside a gesture (summary-panel rotate) reuse the
  // same clamp; exported for the page to keep all writes snapped + in-world.
  function sanitize(geo: Geometry): Geometry {
    return clampToWorld(geo)
  }

  return {
    draftRect,
    overlay,
    selectedRoom,
    liveGeometry,
    rotateSelected,
    sanitize,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeydown,
  }
}
