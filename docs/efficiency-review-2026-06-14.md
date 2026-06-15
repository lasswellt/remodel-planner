# Efficiency code review — 2026-06-14

Scope: full `app/` codebase (~12.6k LOC), Nuxt 4 SPA (`ssr: false`) on Firebase
Hosting, Vuetify 4, VueFire/Firestore. Method: 6 scope-partitioned finder
agents → per-finding adversarial verification against the real code → a
completeness critic. 33 raw findings, **17 confirmed** after verification.

## Honest framing

The adversarial pass **down-graded most "high" findings to low**. This is a
single-user residential planner: a floor realistically holds ~10–15 rooms and a
project a few hundred checklist/task/budget rows. At that scale, the per-render
re-scans and O(n²) drag-frame math are real wasted work but **microseconds**,
dwarfed by Vue's own render/diff and Firestore round-trips. They are worth
fixing for cleanliness and headroom, not because they drop frames today.

**The one finding that bites real users now is the icon webfont (bundle).**

## Severity after verification

| # | Sev | Area | File | Issue |
|---|-----|------|------|-------|
| 1 | **HIGH** | bundle | `nuxt.config.ts:45` | Ships the entire `@mdi/font` webfont (~393 KB woff2, uncompressible) + bloated icon CSS on the critical path of a no-SSR SPA, for ~102 icons actually used. **(fixed — migrated to `@mdi/js` SVG)** |
| 2 | MED | reactivity | `app/composables/useFloorplan.ts:409-471` | `onPointerMove` writes overlay refs with no rAF batching; high-Hz pointers re-run the geometry→render cascade 2–8× per painted frame. |
| 3 | MED | algorithm | `app/utils/geometry.ts:379-397` + `FloorplanCanvas.vue:88-93` | `effectiveGeometry` is O(rooms²) and the `effGeo` map rebuilds for **all** rooms on every drag frame (only the dragged room changed). |
| 4 | MED | algorithm | `app/utils/rollup.ts:38-56` | `roomProgress` full-scans all tasks+checklist per room; bound un-memoized in the floorplan room `v-for` (`FloorplanCanvas.vue:158`). **(fixed)** |
| 5 | MED | firestore/render | `app/components/inspiration/InspirationByRoom.vue:44-61` | Opens **one `purchases` onSnapshot listener per room** (N concurrent) instead of one collection-group listener; also calls `byRoom` 4×/room. |
| 6 | LOW | rendering | `app/components/tasks/TaskBoard.vue:17` | `byColumn` ran 9 full task-array filters per board render. **(fixed)** |
| 7 | LOW | algorithm | `app/composables/useBudget.ts:37-38` | `linesFor`/`byRoom` re-filter all lines per room; `overBudgetRoomIds` re-groups again. **(fixed)** |
| 8 | LOW | rendering | `app/components/photos/PhotoGallery.vue` | `byStage` re-filters the photo array ~10×/render. |
| 9 | LOW | firestore | `app/composables/usePhotos.ts:199-222` | Soft-delete sweep server-reads the whole project photo collection (no `where(deletedAt<=cutoff)`/limit) to usually delete nothing. |
| 10 | LOW | firestore | `app/utils/firestore-cascade.ts:67-81` | Project delete awaits `deleteRoomDeep` sequentially in a loop; rooms are independent → could `Promise.all`. |
| 11 | LOW | memory | `app/utils/geometry.ts:317-334` | `edgeSnapTargets` re-scans all rooms + allocates 2 Sets/2 arrays per pointer-move frame (stable for the whole gesture). |
| 12 | LOW | reactivity | `app/composables/useFloorplan.ts:119-134` | `watch(opts.rooms, …, { deep: true })` deep-traverses all room geometry though the body only reads scalars (note: naive removal risks a stale-overlay regression — needs care). |
| 13 | LOW | bundle | dialogs / `PhotoCapture` (app-wide) | Zero `defineAsyncComponent`/dynamic `import()` for UI; every dialog + section editor is in the page chunk even when closed by default. |
| 14 | LOW | network | `app/components/inspiration/InspirationCard.vue:17` | Renders raw full-res remote `imageUrl` (1–3 MB hero photos) at thumbnail size, N per gallery — no `loading="lazy"`/width hint/thumbnail. |

## Applied in this pass (zero-risk, behavior-preserving — 138/138 tests pass)

- **#4 per-room progress memoized.** New `roomProgressMap()` (`app/utils/rollup.ts`)
  folds checklist+tasks into a `Map<roomId, Progress>` in one pass; `useRollup.byRoom`
  is now an O(1) lookup on a computed (`app/composables/useRollup.ts`). The floorplan
  room loop no longer re-scans the whole project per room per drag frame.
- **#6 TaskBoard grouped once.** `byColumn` reads a memoized `grouped` computed
  instead of running 9 filter passes per render; also stabilizes child key identity.
- **#7 Budget lines grouped once.** New `linesByRoom` computed `Map`; `linesFor`,
  `byRoom`, and `overBudgetRoomIds` all read it instead of re-filtering per room.
- **#1 `@mdi/font` → `@mdi/js` SVG (biggest user-facing win).** Removed the entire
  webfont: **0 woff2 in the bundle** (was ~393 KB) and entry CSS **412 KB → 193 KB**.
  A generated `app/utils/mdi-icons.ts` (101 tree-shaken paths, regen via
  `scripts/gen-mdi-map.mjs`) feeds a custom icon set (`app/plugins/vuetify-icons.ts`)
  that resolves the existing `mdi-*` strings → SVG paths with **zero call-site changes**;
  Vuetify's internal `$`-alias icons pass through via the imported mdi-svg `aliases`.
  Also fixed a pre-existing broken icon (`mdi-sink`, absent from MDI 7.4.47 → `mdi-faucet`).
  Verified: build green, 138/138 tests pass, all rendered icons have valid paths.

## Recommended next (prioritized)

1. **#2 + #3 — rAF-batch `onPointerMove`** (coalesce overlay writes to one per frame
   via `useRafFn`) and make `effGeo` recompute only the moving room + rooms whose
   overlap with it changed. Together these cut drag-frame work from O(n²)×(input rate)
   to ~O(k)×(frame rate). Real win on high-Hz mice / larger plans; touches the most
   complex interaction code, so verify drag/resize/notch behavior after.
3. **#5 — collapse `InspirationByRoom` to one collection-group `purchases` listener**
   (mirror `useProjectSelections`/`useProjectBudget`), filter per room client-side.
   Removes N concurrent Firestore subscriptions on that view.
4. **#13 / #14 — lazy-load dialogs + thumbnail inspiration images.** `defineAsyncComponent`
   for dialogs/section editors closed by default; derive a thumbnail at add-time
   (`downscaleToBlob` already exists) or add `loading="lazy"` + width hints to
   `InspirationCard`.
5. Low-effort cleanups: **#8** group `byStage` once; **#9** add `where('deletedAt','<=',cutoff)`
   + index to the photo sweep; **#10** `Promise.all` the per-room deletes; **#11** cache
   `edgeSnapTargets` at gesture start.

Full per-finding verifier reasoning is in the workflow output (run `wf_f777f678-d84`).

## Backlog re-scope — 2026-06-15

The remaining backlog was re-verified against current HEAD (after the rAF/memoization
work shipped). Outcome:

**Implemented:**
- **#8** — `byStage` now reads a memoized per-stage `Map` in `useRoomPhotos` (was ~6
  full-array filter passes per gallery render; template unchanged).
- **#9** — the photo soft-delete sweep now queries `where('deletedAt','<=',cutoff)`
  so it reads only expired docs, not the whole project's photos on every app start
  (needs the new `photos (uid, projectId, deletedAt)` composite index).
- **#5** — added a project-wide `useProjectPurchases` collection-group listener;
  `InspirationByRoom` feeds it into each `PurchasesSection` via an `items` prop, so the
  by-room view opens **one** purchases listener instead of one per room (also removes a
  latent fixed-`ssrKey` collision). Needs a `purchases` collection-group read rule +
  `(uid, projectId)` index. Rules test added.

**Won't-fix (re-scoped):**
- **#14** — v-img already lazy-loads offscreen images (IntersectionObserver); the
  remaining full-res bytes are a remote third-party URL with no resized variant — a real
  fix needs a backend thumbnail/resize proxy (out of scope).
- **#10** — one-off project-delete path; `Promise.all` trades clean fail-fast for
  concurrent partial-failure for a few hundred ms. Not worth it.
- **#11** — moot after the rAF throttle (now runs ≤once/frame, not per native event).
- **#13** — only 2 dialogs are actually `v-if`-gated (the rest are always-rendered
  `v-model`); deferring them saves ~1–3 KB each, <1% of cold-load. Not worth the seam.
