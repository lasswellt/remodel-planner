import type { Ref } from 'vue'
import type { Geometry, Notch, Room } from '~/models'
import {
  clampToWorld,
  MIN_ROOM_SIZE,
  moveTo,
  nudge,
  rectFromCorners,
  rotate90,
  sameRect,
} from '~/utils/geometry'

export type FloorplanTool = 'select' | 'draw' | 'notch'
export type HandleId = 'nw' | 'ne' | 'sw' | 'se'

interface Point { x: number, y: number }

type Mode
  = | { kind: 'idle' }
    | { kind: 'drawing', anchor: Point }
    | { kind: 'notching', anchor: Point, roomId: string }
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
  onAddNotch: (roomId: string, notch: Omit<Notch, 'id'>) => void
}

// Pointer/keyboard state machine for the floorplan canvas: draw, drag, resize,
// nudge, rotate, notch. Persistence stays outside (callbacks); while a gesture
// is in flight the live geometry is a local overlay — exactly one write on end.
export function useFloorplan(opts: UseFloorplanOptions) {
  const mode = ref<Mode>({ kind: 'idle' })
  const draftRect = ref<Geometry | null>(null)
  const notchDraft = ref<Geometry | null>(null)
  const overlay = ref<{ id: string, geo: Geometry } | null>(null)

  const selectedRoom = computed(
    () => opts.rooms.value.find(r => r.id === opts.selectedId.value) ?? null,
  )

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

  function capturePointer(e: PointerEvent): void {
    try { opts.svgEl.value?.setPointerCapture(e.pointerId) }
    catch { /* gesture proceeds uncaptured */ }
  }
  function releasePointer(e: PointerEvent): void {
    try { opts.svgEl.value?.releasePointerCapture(e.pointerId) }
    catch { /* already released */ }
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

  function anchorFor(handle: HandleId, g: Geometry): Point {
    return {
      x: handle === 'nw' || handle === 'sw' ? g.x + g.w : g.x,
      y: handle === 'nw' || handle === 'ne' ? g.y + g.h : g.y,
    }
  }

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
    else if (opts.tool.value === 'notch' && opts.selectedId.value) {
      mode.value = { kind: 'notching', anchor: pt, roomId: opts.selectedId.value }
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
      const dragged = Math.max(Math.abs(pt.x - m.anchor.x), Math.abs(pt.y - m.anchor.y)) >= step
      draftRect.value = dragged ? rectFromCorners(m.anchor, pt, step) : null
    }
    else if (m.kind === 'notching') {
      const dragged = Math.max(Math.abs(pt.x - m.anchor.x), Math.abs(pt.y - m.anchor.y)) >= step
      notchDraft.value = dragged ? rectFromCorners(m.anchor, pt, step) : null
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
    else if (m.kind === 'notching') {
      const draft = notchDraft.value
      notchDraft.value = null
      const room = opts.rooms.value.find(r => r.id === m.roomId)
      if (draft && room && draft.w >= MIN_ROOM_SIZE && draft.h >= MIN_ROOM_SIZE) {
        // Convert world coords to coords relative to room origin
        const geo = liveGeometry(room)
        opts.onAddNotch(m.roomId, {
          x: draft.x - geo.x,
          y: draft.y - geo.y,
          w: draft.w,
          h: draft.h,
        })
      }
      // Stay in notch mode so the user can draw multiple notches in sequence
    }
    else if (m.kind === 'moving' || m.kind === 'resizing') {
      commitOverlay(m.orig)
    }
    mode.value = { kind: 'idle' }
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
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t instanceof Element
      && t.closest('input, textarea, select, button, [role="tab"], [contenteditable]')) return
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
        if (mode.value.kind === 'drawing' || mode.value.kind === 'notching') {
          draftRect.value = null
          notchDraft.value = null
          mode.value = { kind: 'idle' }
          if (opts.tool.value !== 'select') opts.tool.value = 'select'
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
