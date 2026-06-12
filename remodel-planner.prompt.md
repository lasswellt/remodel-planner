---
name: remodel-planner
description: >
  Build a Firebase-backed, room-by-room home remodel planning app: SVG
  floorplan builder, room-type checklist templates, design inspiration
  (researched links + image references), per-room budgets with contingency
  math, sequenced task lists, and embedded design-psychology research notes
  per feature.
version: 1.0.0
stack: nuxt4 + vue3 + vuetify4 + typescript + firebase
persistence: firestore (dev + prod project pair, offline persistence enabled) + firebase storage + firebase auth + firebase hosting + app check
state_file: .remodel/registry.json
phases: [detect, research, scaffold, data-model, floorplan, rooms, budget, tasks, selections, permits, photos, inspiration, verify, deploy]
estimated_sessions: 4-5
---

# Remodel Planner — Build Prompt

You are building **Remodel Planner**, a single-user web app for planning a
room-by-room home improvement project, deployed to Firebase (Firestore +
Auth + Hosting) on the user's GCP project. The owner is a senior developer;
produce production-grade TypeScript with no placeholder stubs, no TODO
comments, and no "implement later" shortcuts.

## Pinned Versions (verified June 2026)

Install these exact majors/minors; allow patch drift only (`~` ranges).
If npm resolves a newer major for any package, stop and confirm with the
user before adopting it.

| Package | Version | Notes |
|---|---|---|
| node | 22 LTS (≥22.12) | Nuxt 4 engine requirement |
| nuxt | 4.4.8 | Nuxt 4 line; Nuxt 3 is EOL July 2026, do not use |
| vue | bundled with Nuxt | — |
| vuetify | 4.1.1 | v4 stable (MD3 typography/elevation, CSS layers) |
| vuetify-nuxt-module | 0.19.5 | Supports vuetify ^4 and nuxt ^4 |
| nuxt-vuefire | 1.1.2 | Pulls vuefire 3.2.x |
| firebase | 12.14.0 | JS SDK (modular) |
| firebase-tools | 15.20.0 | CLI, install as devDependency |
| pinia | 3.0.4 | via @pinia/nuxt 0.11.3 |
| zod | 4.4.3 | Zod 4 API (use `z.string()` etc., import from `zod`) |
| @vueuse/nuxt | 14.3.0 | — |
| @vite-pwa/nuxt | 1.1.1 | PWA manifest + service worker |
| @playwright/test | 1.60.0 | Smoke flows only; Vitest owns unit tests |
| markdown-it | 14.2.0 | Render research corpus; do NOT add @nuxt/content for two files |
| vitest | 4.1.8 | — |
| typescript | bundled with Nuxt | strict: true |

Vuetify 4 caveats: it is a recent major (stable Feb 2026). Breaking changes
from v3 cluster in grid, typography, elevation, theme, and v-btn/v-select
defaults. Generate v4-native code from the v4 docs; never paste v3-era
snippets. If a needed component behaves unexpectedly, check the v4 release
notes before working around it.

## Applied UX Psychology (build requirements)

The app researches design psychology for rooms; its own UI must practice the
behavioral equivalents. These are requirements, not suggestions — each phase
below references them by ID.

| ID | Principle | Requirement |
|---|---|---|
| UX1 | Goal gradient + Zeigarnik | Progress is visible everywhere: per-room progress ring on floorplan rects and room cards, per-phase bars on the task board, project ring in the app bar. Progress accelerates motivation as it nears 100%; never hide it behind a click. |
| UX2 | Endowed progress | Applying a room template immediately shows the room as "started" with seeded items framed as a head start ("12 items planned"), never as an empty 0% burden. |
| UX3 | Peak-end rule | Completion moments get a payoff: room hits 100% → floorplan rect animates to its done color with a brief celebratory transition; project milestones (phase complete across all rooms) get a one-time toast. Subtle, no confetti spam, dismissible permanently in settings. |
| UX4 | Recognition over recall + spatial memory | The floorplan is the home screen and primary nav. Humans index spaces spatially; clicking a room on the plan is the canonical way into its checklist/budget/tasks. Drawer nav is secondary. |
| UX5 | Cognitive load (Hick's law, chunking) | Progressive disclosure: room detail opens with a summary (progress, budget variance, next task), expanding into full lists. Checklists grouped by category, tasks by phase, never one flat list. Max one primary action per view. |
| UX6 | Von Restorff (isolation effect) | Blocked tasks and over-budget rooms are the visually distinct items in any list — warning color + icon. Nothing else competes at that salience level. |
| UX7 | Loss aversion framing | Budget displays lead with "remaining" (budget − committed) rather than "spent". Variance is signed and colored (over = error, under = success). Contingency line is framed as protection, with a one-line planning-fallacy note in its tooltip. |
| UX8 | Forgiveness (undo over confirm) | Low-stakes destructive actions (checklist item, budget line, task) execute immediately with a 6-second undo snackbar. Confirm dialogs reserved for room and project deletion only. |
| UX9 | System status (Nielsen) | Firestore writes are optimistic with a subtle sync indicator; offline state shows a persistent pill ("Offline — changes will sync"). Never a blocking spinner for a write. |
| UX10 | Empty states as onboarding | Every empty view teaches: empty floorplan shows a ghost room + "Draw your first room"; empty inspiration suggests starting from the researched index; empty budget offers typical cost ranges for the room type. No blank screens. |
| UX11 | Picture superiority | Inspiration items render image-first cards; research entries pair each principle with one representative image where the Phase 1 corpus captured a stable URL. |
| UX12 | Anchoring | Budget line entry shows the room type's typical cost range (from a static seed table) as placeholder text, anchoring estimates realistically rather than at zero. |

## Non-Goals (do not build, do not propose)

Single user, single household. The following are explicitly out of scope for
v1; if a phase seems to want one of them, record it in `decisions` as
deferred and move on:

- Multi-user accounts, sharing, roles, or collaboration of any kind
- Cloud Functions — everything runs client-side
- Insurance claim mode (estimate reconciliation, supplements, RCV/depreciation)
- Gantt/timeline view
- Walls/doors/openings or polygon rooms in the floorplan
- Notifications, email, or any engagement mechanics (streaks, reminders)
- i18n, multi-currency
- Contractor portal or vendor logins

## Build Conventions

- **Dates**: scheduling fields (`dueDate`, `expectedAt`, `scheduledAt`) are
  date-only `YYYY-MM-DD` strings — no timezone math on dates a human picked
  from a calendar. Event timestamps (`createdAt`, `takenAt`, `orderedAt`)
  are Firestore `Timestamp`s.
- **Denormalize `uid` and `projectId` onto every document.** Project-wide
  dashboard queries (all blocked tasks, overdue selections) use collection
  group queries; rules for those use
  `match /{path=**}/tasks/{id} { allow read: if resource.data.uid == request.auth.uid; }`.
  Keep `firestore.indexes.json` in the repo and deploy it alongside rules;
  when a query fails needing a composite index, add it to the file rather
  than clicking the console link.
- **One rollup source.** All progress math (room %, phase %, project ring)
  comes from a single `useRollup` composable. The floorplan ring, app bar
  ring, and task board must be incapable of disagreeing.
- **Color is never the only status channel.** Every status color pairs with
  an icon or pattern (floorplan rect status, variance, blocked tasks) for
  color-vision deficiency.
- **Export schema is versioned.** JSON export carries `schemaVersion`;
  import refuses newer versions and migrates older ones.
- **Soft-delete sweep**: a client-side sweep on app start purges photo
  soft-deletes older than 24h (no Cloud Functions, so the client owns
  cleanup).
- **Research rendering**: parse `content/research/*.md` with markdown-it at
  build time into typed JSON consumed by the research page and popovers. Do
  not add @nuxt/content for two files.
- **Project switcher**: the data model is multi-project; the app bar gets a
  minimal project menu (switch, create, rename, delete-with-confirm).
- **Testing split**: Vitest owns unit tests (money math, rollups, gates,
  `expectedAt`); Playwright owns the end-to-end smoke flows referenced in
  verify. No component snapshot tests.
- **Performance**: routes lazy-loaded, photo grids lazy-load with
  thumb-first images, initial JS budget ≤ 350KB gzip — check with
  `nuxi analyze` during verify.
- **Demo seed**: `scripts/seed-demo.ts` creates the canonical seed project
  (refuses to run unless the target equals the registry's dev project ID).
  Every "seeded demo project" reference in completion criteria means this
  script's output.

## Phase Detection (run first, every session)

1. Check for `.remodel/registry.json` in the project root.
   - **Missing** → this is a fresh start. Create it (schema below) and begin
     at `phase: research`.
   - **Present** → read it, announce the current phase and completed phases,
     and resume from the first incomplete phase. Never redo a phase marked
     `complete: true` unless the user explicitly asks.
2. Before marking any phase complete, verify its completion criteria by
   reading actual file contents and running actual commands. Never infer
   completion from file existence, file size, or grep hits.

### Registry schema

```json
{
  "project": "remodel-planner",
  "version": "1.0.0",
  "currentPhase": "research",
  "phases": {
    "research":   { "complete": false, "artifacts": [] },
    "scaffold":   { "complete": false, "artifacts": [] },
    "data-model": { "complete": false, "artifacts": [] },
    "floorplan":  { "complete": false, "artifacts": [] },
    "rooms":      { "complete": false, "artifacts": [] },
    "budget":     { "complete": false, "artifacts": [] },
    "tasks":      { "complete": false, "artifacts": [] },
    "selections": { "complete": false, "artifacts": [] },
    "permits":    { "complete": false, "artifacts": [] },
    "photos":     { "complete": false, "artifacts": [] },
    "inspiration":{ "complete": false, "artifacts": [] },
    "verify":     { "complete": false, "artifacts": [] },
    "deploy":     { "complete": false, "artifacts": [] }
  },
  "firebase": {
    "devProjectId": null,
    "prodProjectId": null,
    "hostingSite": null,
    "region": null
  },
  "decisions": [],
  "sessionLog": []
}
```

Append a one-line entry to `sessionLog` at the start and end of every session.
Record any architectural decision (with rationale) in `decisions`.

Suggested session groupings (adjust by remaining context, never split a
phase mid-way): **S1** research + scaffold; **S2** data-model + floorplan;
**S3** rooms + budget + tasks; **S4** selections + permits + photos;
**S5** inspiration + verify + deploy.

---

## Phase 1: research

Use WebSearch to gather two research corpora. Write both as structured
markdown into `content/research/` so the app can render them and so later
phases can consume them as data sources.

### 1a. Design psychology (`content/research/design-psychology.md`)

Research and document the *why* behind common remodel features. For each
principle: a 2-4 sentence summary, the rooms it applies to, concrete
applications, and source links. Cover at minimum:

| Principle | What to research |
|---|---|
| Color psychology | Warm vs. cool by room function; blue/green for rest (bedrooms), warm neutrals for gathering spaces, color effects on perceived room size |
| Lighting & circadian rhythm | Layered lighting (ambient/task/accent), color temperature by room and time of day, daylight access and mood |
| Biophilic design | Natural materials, plants, views, indoor-outdoor connection; stress-reduction evidence (Ulrich, attention restoration theory) |
| Spatial flow & prospect-refuge | Sightlines, open vs. defined zones, why kitchen islands and breakfast nooks work |
| Ceiling height & perceived volume | Cathedral effect on creative vs. focused thinking |
| Clutter & cognitive load | Storage design, closed vs. open storage, visual noise |
| Acoustic comfort | Soft surfaces, sound zoning, why hard-surface remodels feel "echoey" |
| Texture & material warmth | Wood/stone vs. synthetic; tactile cues and perceived quality |
| Entry sequence & transitions | Drop zones, mudrooms, threshold psychology |
| Bathroom-as-retreat | Spa cues: symmetry, low contrast, water sound, warm floors |

### 1b. Design inspiration index (`content/research/inspiration-index.md`)

Per room type (list in Phase 5), gather 5-8 current design-idea sources:
reputable galleries, manufacturer idea pages, and trend articles. Capture
title, URL, one-line description, and 2-3 representative image URLs where the
source provides stable direct links. Do not hotlink anything paywalled or
unstable; prefer manufacturer and publisher CDNs.

**Completion criteria:** both files exist, every principle in the table above
has a sourced entry, and every room type has ≥5 inspiration sources with
working URLs (spot-check with curl HEAD requests).

---

## Phase 2: scaffold

- `npx nuxi init` (Nuxt 4, TypeScript strict), add packages per the Pinned
  Versions table: `vuetify-nuxt-module`, `@pinia/nuxt`, `nuxt-vuefire`,
  `@vueuse/nuxt`, `zod`, dev deps `firebase-tools`, `vitest`.
- Vuetify via `vuetify-nuxt-module`: MD3 defaults, tree-shaken components,
  `@mdi/font` icons, light/dark theme toggle persisted to user prefs.
- PWA via `@vite-pwa/nuxt`: installable manifest, icons, offline shell
  caching. Mobile-first layouts for room detail, tasks, and photo capture —
  this app gets used standing in the room with a phone.
- SPA mode (`ssr: false`) — Firebase Hosting serves static assets; no SSR
  function needed for a planning tool.
- Firebase setup:
  - If `firebase.devProjectId` or `firebase.prodProjectId` in the registry is
    null, ask the user for both GCP project IDs and the Firestore region,
    then write them to the registry. Never guess a project ID.
  - No emulators. Dev runs against the **dev Firebase project**; prod is
    touched only in the deploy phase.
  - `firebase init` for Firestore, Storage, and Hosting; configure project
    aliases in `.firebaserc` (`dev` and `prod`). All CLI commands during
    development use `--project dev` explicitly.
  - App Check with reCAPTCHA Enterprise on both projects, wired through
    nuxt-vuefire's appCheck config. Dev runs with a debug token
    (env-injected, never committed); enforcement is enabled on prod
    Firestore/Storage during the deploy phase only, after verifying dev
    works end to end.
  - Web config per environment via runtimeConfig: `.env.development` carries
    the dev project's web config, `.env.production` the prod project's.
    `pnpm dev` always binds to dev; there is no code path that lets a dev
    session write to prod.
  - Firebase Auth with Google provider only (enable in both projects); route
    guard redirects unauthenticated users to a sign-in page.
- Layout: `v-app` + `v-app-bar` + `v-navigation-drawer` (rail-capable) nav:
  **Floorplan / Rooms / Budget / Tasks / Inspiration / Research**.
- ESLint flat config + typecheck script. CI not required.

**Completion criteria:** `pnpm dev` boots clean against the dev project,
`pnpm typecheck` passes, Google sign-in works against dev Auth, all six
routes render placeholder pages behind the auth guard, and `.firebaserc`
aliases resolve correctly (`firebase use dev` / `firebase use prod`).

## Phase 3: data-model

Define Zod schemas + inferred types in `app/models/`, typed Firestore
converters (`withConverter`) per entity, and a Pinia store per domain backed
by VueFire reactive bindings. Enable Firestore offline persistence
(`persistentLocalCache` with multi-tab support) so the app works through
connectivity drops. Writes are optimistic with a subtle app-bar sync
indicator and a persistent offline pill when disconnected; no blocking
spinners on writes (UX9).

Firestore layout — scope everything under the authenticated user:

```
users/{uid}/projects/{projectId}
users/{uid}/projects/{projectId}/rooms/{roomId}
users/{uid}/projects/{projectId}/rooms/{roomId}/checklist/{itemId}
users/{uid}/projects/{projectId}/rooms/{roomId}/budgetLines/{lineId}
users/{uid}/projects/{projectId}/rooms/{roomId}/tasks/{taskId}
users/{uid}/projects/{projectId}/rooms/{roomId}/selections/{selectionId}
users/{uid}/projects/{projectId}/rooms/{roomId}/photos/{photoId}
users/{uid}/projects/{projectId}/permits/{permitId}
users/{uid}/projects/{projectId}/inspiration/{itemId}
```

Storage layout mirrors it:
`users/{uid}/projects/{projectId}/rooms/{roomId}/photos/{photoId}/{original|thumb}`.
Storage rules: owner-only read/write, content-type restricted to images,
10MB max per object.

**All money fields are integer cents** (`estimateCents`, `actualCents`,
`priceCents`, `feeCents`). Formatting to dollars happens only at render via
a shared `formatMoney` util; no floating-point arithmetic on currency
anywhere. Enforce with Zod (`z.number().int().nonnegative()`).

Security rules: `request.auth.uid == uid` on the user subtree, deny all else.
Validate writes against shape basics in rules (required fields, enum values
for status/phase/category). Deploy rules to the dev project
(`firebase deploy --only firestore:rules --project dev`) and verify them
with a small authenticated test script against dev Firestore: owner CRUD
succeeds, a second test account is denied, invalid enum write is rejected.

Also implement full-project JSON export/import (client-side, walks the
subcollections) as the portability path. For real backups, add
`scripts/setup-backups.sh`: creates a GCS bucket and a weekly scheduled
Firestore export via `gcloud firestore export` + Cloud Scheduler on the
prod project (run during deploy phase, documented in README).

Core entities:

```
Project { id, name, address?, totalBudgetCents, contingencyPct (default 15), createdAt }
Room { id, projectId, name, type: RoomType, floor, geometry: {x,y,w,h, rotation}, status }
ChecklistItem { id, roomId, label, category, done, fromTemplate: boolean, notes? }
BudgetLine { id, roomId, label, category: 'materials'|'labor'|'permits'|'fixtures'|'other', estimateCents, actualCents?, vendor?, link? }
Task { id, roomId, label, phase: TaskPhase, status: 'todo'|'in-progress'|'blocked'|'done', dependsOn: TaskId[], blockedBySelections: SelectionId[], dueDate?, notes? }
Selection { id, roomId, label, category, vendor?, sku?, url?, priceCents?, leadTimeDays?, status: 'considering'|'decided'|'ordered'|'delivered'|'installed', orderedAt?, expectedAt?, budgetLineId? }
Permit { id, projectId, scope, authority (default 'Cobb County'), permitNumber?, status: 'needed'|'applied'|'issued'|'closed', feeCents?, appliedAt?, issuedAt?, inspections: Inspection[] }
Inspection { id, label, gatePhase: TaskPhase, status: 'pending'|'scheduled'|'passed'|'failed', scheduledAt?, resultNotes? }
Photo { id, roomId, storagePath, thumbPath, stage: 'before'|'during'|'after', caption?, takenAt, taskId?, selectionId? }
InspirationItem { id, roomId?, roomType?, title, url, imageUrl?, notes?, psychologyTags: string[] }
```

`TaskPhase` enforces real remodel sequencing:
`demo → rough-in (plumbing/electrical/HVAC) → insulation → drywall → paint → flooring → trim → fixtures → punch-list`.

**Completion criteria:** typecheck passes; rules verified against dev
Firestore (owner can CRUD, second account denied, invalid enum rejected); a
Vitest suite round-trips export → import → deep-equal on a seeded project.

## Phase 4: floorplan

SVG-based floorplan builder. No heavy canvas dependency; plain SVG +
pointer events is sufficient and keeps the bundle small. The floorplan is
the app's home route (UX4).

- Grid-snapped (6" default, configurable) draw/drag/resize of rectangular
  rooms; rotation in 90° steps; multi-floor tabs.
- Room rect fill color encodes status (planned / in-progress / done) and
  carries a per-room progress ring (UX1); reaching 100% triggers the done
  transition (UX3). Label shows name + sq ft (computed from geometry ×
  scale).
- Click room → summary panel (progress, budget remaining, next task) with
  expansion into checklist, budget, tasks (UX5).
- Keyboard: arrows nudge, Del removes (confirm — room deletion is
  high-stakes per UX8), Esc deselects.
- Empty floorplan renders a ghost room with a draw prompt (UX10).
- Export floorplan as standalone SVG and PNG.
- **Out of scope, do not build:** walls, doors, windows, openings, curved or
  polygon rooms, snapping between rooms, measurement dimensioning. Rects
  with labels are the entire feature. Resist gold-plating.

**Completion criteria:** create a 5-room demo floorplan via the UI in a
browser smoke test (Playwright or manual instructions executed), geometry
persists to dev Firestore (verify in the Firebase console) and survives
reload, SVG export opens correctly.

## Phase 5: rooms (types + checklist templates)

Room types and seeded "common items" templates. Applying a template adds
checklist items flagged `fromTemplate: true`; users can add/remove freely.

| Room type | Template must cover |
|---|---|
| Kitchen | Cabinets, counters, backsplash, sink/faucet, appliances, lighting layers, ventilation, flooring, paint, GFCI/outlet count |
| Bathroom | Vanity, toilet, tub/shower, waterproofing, exhaust fan, tile, heated floor option, lighting, GFCI, water shutoffs |
| Bedroom | Paint, flooring, closet system, lighting/dimmers, window treatments, outlets/USB, ceiling fan |
| Living room | Paint, flooring, lighting layers, built-ins, media/cable management, fireplace surround |
| Dining room | Paint, lighting (chandelier height/sizing), flooring, wainscoting/trim |
| Home office | Paint, lighting (task + ambient), acoustic treatment, network drops, outlet plan, built-in desk/shelving |
| Laundry/utility | Hookups, drain pan, venting, storage, counter, flooring (water-resistant), leak sensor placement |
| Mudroom/entry | Drop zone, bench/hooks, durable flooring, lighting |
| Hallway/stairs | Paint, treads/risers, handrail code check, lighting, smoke/CO placement |
| Garage | Epoxy floor, storage systems, outlets/EV circuit, insulation, lighting |
| Exterior | Paint/siding, gutters, lighting, landscaping, pressure wash |

Each template item carries a `psychologyTag` where applicable (e.g.,
"lighting layers" → links to the circadian/layered-lighting research entry),
rendered as an info popover sourced from Phase 1 content.

Template application frames the result as a head start, not a burden:
confirmation reads "Kitchen planned — 12 items, 9 tasks seeded" and the room
immediately shows non-zero planning progress (UX2). Checklist renders
grouped by category with collapse state remembered (UX5); item deletion is
undo-snackbar, not confirm (UX8).

**Completion criteria:** every room type seeds its full template through the
UI; psychology popovers resolve to real research entries (no dead anchors).

## Phase 6: budget

- Per-room budget lines with category breakdown; room subtotal, project
  total, contingency auto-line (`contingencyPct` of subtotal), and
  estimate-vs-actual variance.
- Displays lead with **remaining budget**, variance signed and colored,
  contingency tooltip carries the planning-fallacy note (UX7). Over-budget
  rooms get the isolated warning treatment in lists and on the floorplan
  (UX6).
- New line entry shows typical cost-range placeholders per room type from a
  static seed table (UX12). Line deletion is undo-snackbar (UX8).
- Project dashboard: stacked bar by room, donut by category. Hand-rolled
  SVG or Vuetify's built-in sparkline/heatmap primitives where they fit; do
  not pull in a 300KB chart dependency for two charts.
- CSV export of all budget lines.

**Completion criteria:** seeded demo project shows correct math (verify
contingency, remaining, and variance calculations with unit tests), CSV
opens in Excel with correct headers.

## Phase 7: tasks

- Per-room task board grouped by `TaskPhase`, drag between statuses, with
  per-phase progress bars and the project ring in the app bar fed from the
  same rollup math (UX1).
- Dependency enforcement: a task with incomplete `dependsOn`, an undelivered
  selection in `blockedBySelections`, or an unpassed inspection gating its
  phase cannot move to `in-progress` (warn with the specific blocker named,
  allow override with confirm). Blocked tasks are the single most salient
  items on the board: warning color + lock icon (UX6).
- Applying a room template also seeds phase-ordered default tasks with
  sensible dependencies (paint depends on drywall, flooring depends on paint
  for baseboard-off scenarios — make the dependency editable).
- Project-level rollup view: % complete by room and by phase. A room or
  phase reaching 100% fires its one-time completion moment (UX3). Task
  deletion is undo-snackbar (UX8).

**Completion criteria:** dependency, selection-block, and inspection-gate
rules each verified by unit test; rollup percentages match hand-computed
values for the seed project.

## Phase 8: selections

Material and fixture selections tracker — lead times are the top remodel
schedule killer, so this feeds task blocking directly.

- Per-room selection list: label, category, vendor, SKU, URL, price (cents),
  lead time days, status pipeline `considering → decided → ordered →
  delivered → installed`. `orderedAt` + `leadTimeDays` computes `expectedAt`.
- Link a selection to a budget line (`budgetLineId`): marking `ordered`
  offers to set the line's `actualCents` from `priceCents`.
- Tasks can declare `blockedBySelections`; an undelivered selection blocks
  the task (enforced in Phase 7).
- Overdue selections (`expectedAt` past, not delivered) get the UX6 warning
  treatment and surface on the room summary panel.
- Selection deletion is undo-snackbar (UX8); empty state suggests common
  long-lead items for the room type (UX10).

**Completion criteria:** `expectedAt` math unit-tested; ordering a linked
selection updates the budget line; an undelivered selection demonstrably
blocks its task in the UI.

## Phase 9: permits

- Project-level permit list: scope, authority (default Cobb County), permit
  number, status `needed → applied → issued → closed`, fee (cents, flows to
  a project-level budget line under the permits category).
- Each permit carries inspections with a `gatePhase`: an unpassed inspection
  blocks tasks in later phases for affected rooms (e.g., rough-in inspection
  must pass before drywall tasks unblock) — enforced in Phase 7.
- Failed inspections get UX6 salience plus a re-inspection entry flow.
- Seed common Cobb County residential permit scopes (plumbing, electrical,
  mechanical, building/structural) as quick-add chips; do not hardcode fees.

**Completion criteria:** inspection gate blocks and then releases tasks when
marked passed (unit + UI verification); permit fee appears in budget rollup.

## Phase 10: photos

Photo documentation per room, mobile-first capture (pairs with the PWA).

- Capture/upload flow: `<input type="file" accept="image/*" capture>` on
  mobile, drag-drop on desktop. Client-side downscale to ~2000px max edge
  and generate a thumbnail before upload (browser canvas; no Cloud
  Function) — upload both to the Storage layout from Phase 3.
- Each photo: stage tag `before | during | after`, caption, optional link
  to a task or selection. Room gallery groups by stage; before/after pairs
  render side-by-side (UX11).
- Uploads are optimistic with per-item progress; failures retry with
  exponential backoff and never lose the local file silently (UX9).
- Photo deletion removes both Storage objects and the Firestore doc, with
  undo grace via soft-delete flag cleaned up after 24h (UX8).

**Completion criteria:** capture → downscale → upload → thumbnail renders in
gallery on dev project; Storage rules verified (second account denied,
non-image rejected, >10MB rejected); soft-delete restore works.

## Phase 11: inspiration

- Inspiration gallery per room and per room type, fed initially from the
  Phase 1 inspiration index (importer script: parse
  `content/research/inspiration-index.md` → `InspirationItem[]` seed).
- Card grid, image-first (UX11), with title, source link, notes field, and
  psychology tags that cross-link into the research page.
- "Add by URL" flow: paste a URL, app fetches OpenGraph title/image
  client-side where CORS allows, falls back to manual entry.
- Empty gallery offers one-click import from the researched index per room
  type (UX10).

**Completion criteria:** seed import populates the gallery; cards link out
correctly; at least one psychology tag round-trips to its research section.

## Phase 12: verify

- `pnpm typecheck`, `pnpm lint`, full Vitest run — all green.
- Smoke test against the dev project: sign in → new project → draw floorplan
  → add kitchen + bathroom from templates → set budgets → add a long-lead
  selection blocking a task → add a permit with a rough-in inspection gate →
  upload a before photo from a phone (or emulated viewport) → complete a
  demo task chain through the inspection gate → export JSON → delete project
  → import → confirm identical state.
- UX psychology audit: walk the UX1–UX12 table and verify each requirement
  is observable in the running app (progress ring on floorplan, undo
  snackbar fires and restores, offline pill appears when network is cut,
  empty states render, blocked-task salience, remaining-first budget
  framing). Record pass/fail per ID in the registry.
- PWA: Lighthouse installability check passes; app installs on a phone.
- `nuxi analyze`: initial JS ≤ 350KB gzip per Build Conventions; if over,
  trim before proceeding.
- Write `README.md`: purpose, stack, dev/prod project setup, env file
  layout, deploy commands, backup schedule, data model diagram (Mermaid),
  security rules summary, export/import notes.

## Phase 13: deploy

- `pnpm generate` with production env → `firebase deploy
  --only hosting,firestore:rules,firestore:indexes,storage --project prod`.
- Run `scripts/setup-backups.sh` against prod: GCS bucket + weekly scheduled
  Firestore export via Cloud Scheduler. Verify the first export manually.
- Enable App Check enforcement on prod Firestore and Storage; confirm the
  deployed app still functions, then confirm a tokenless REST request is
  rejected.
- Confirm the deployed app: load the Hosting URL, sign in with the real
  Google account, create a throwaway project doc and photo, verify both land
  in prod Firestore/Storage, delete them.
- Verify prod Firestore rules block an unauthenticated read (curl the REST
  endpoint, expect 403).
- Record Hosting URL, backup bucket, and deploy timestamp in the registry;
  mark all phases complete with artifact paths.

---

## Standing Rules

1. **Registry is the source of truth.** Update it after every phase
   transition, in the same commit as the work.
2. **No completion promises tied to counts.** Completion criteria are
   behavioral checks listed per phase; verify them by reading file contents
   and running commands, never by inference.
3. **Dev project for dev, prod only in deploy.** Every Firebase CLI command
   uses an explicit `--project` flag; never rely on the active alias. Seed
   and test scripts hard-fail if pointed at the prod project ID.
4. **Secrets hygiene.** Firebase web config via runtimeConfig with
   `.env.development` / `.env.production`; `.env*` gitignored; no
   service-account keys in the repo at all.
5. **Money is integer cents everywhere.** No float currency math; render
   formatting only via the shared util.
6. **Small focused files.** Components under ~250 lines; extract composables
   (`useFloorplan`, `useBudgetMath`, `useTaskGraph`, `useSelectionGate`,
   `usePhotoUpload`).
7. **Commit per phase**, conventional commits, registry update included.
8. If a phase reveals a flaw in an earlier phase's data model, fix the model,
   add a Firestore migration script (run against dev first, verify, then
   prod during deploy), record the decision in `decisions`, and only then
   continue.
