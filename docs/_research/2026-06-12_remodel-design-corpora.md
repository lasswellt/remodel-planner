<!-- no-registry: remodel-planner.prompt.md is its own phase roadmap (.remodel/registry.json); not a /blitz:roadmap input -->
---
title: Remodel Planner — Phase 1 Research (design corpora)
date: 2026-06-12
type: Feature Investigation
status: complete
---

# Remodel Planner — Phase 1 Research

## Summary

Built the two research corpora that the Remodel Planner app renders and that
later build phases consume as data: `content/research/design-psychology.md`
(the *why* behind remodel features) and `content/research/inspiration-index.md`
(per-room-type design-idea sources). Method: 21 parallel research agents
(10 psychology principles + 11 room types) each self-verifying URLs, then 10
adversarial fact-check verifiers, then 10 correction agents — all via dynamic
workflows. 9/10 psychology sections required factual correction before passing.
All source URLs verified live (curl HEAD/GET; bot-walled publisher links
cross-confirmed via PubMed/Crossref). Phase `research` marked complete in
`.remodel/registry.json`; next phase is `scaffold`.

## Research Questions

1. **Does every Phase-1 psychology principle have a sourced, accurate entry?**
   Yes — 10/10 principles, each with 3-4 reputable sources (peer-reviewed
   studies + evidence-reviewed references). Each claim fact-checked against its
   source.
2. **Does every room type have ≥5 inspiration sources with working URLs?**
   Yes — 7-8 per room across all 11 types; every page URL verified live.
3. **Are the quantitative/attribution claims defensible?**
   After correction, yes. The first pass overstated several findings; see
   Findings → Fact-check.
4. **Are the corpora machine-parseable for later phases?**
   Yes — both use a fixed field contract (Slug / Rooms / Summary / Applications
   / Sources; per-source `### [title](url)` + Images) for markdown-it → typed
   JSON at build time, no `@nuxt/content`.

## Findings

### Coverage

- `design-psychology.md` — 10 principles: color-psychology, lighting-circadian,
  biophilic-design, spatial-flow-prospect-refuge, ceiling-height-volume,
  clutter-cognitive-load, acoustic-comfort, texture-material-warmth,
  entry-sequence-transitions, bathroom-as-retreat. Each carries a stable
  `Slug` for `psychologyTag` cross-links (Phase 5 popovers, Phase 11 tags).
- `inspiration-index.md` — 11 room types, 84 total sources, image URLs where the
  source exposed a stable CDN link. Importer-ready for Phase 11.

### Fact-check (adversarial verification caught real defects)

Each section's numbers, study attributions, and named effects were checked
against the cited sources. Corrections applied:

- **color-psychology** — Costa et al. (2018) measured *self-reported* mood/study
  facilitation, not objective academic performance; reworded. Cool-light
  alertness benefit in EXCLI 2021 used ~6500K, not 3500–4000K; clarified.
- **lighting-circadian** — melanopsin λmax corrected 460–480 nm → ~480–490 nm;
  comparator clarified (drawn blinds, not "blocked windows").
- **biophilic-design** — split ART (cognitive, Kaplan & Kaplan) from Ulrich's
  Stress Recovery Theory (cortisol/sympathetic) — the original conflated them.
- **spatial-flow-prospect-refuge** — removed fabricated cortisol/heart-rate
  claim; corrected Dosen & Ostwald scope to environmental (not interior-only)
  preference.
- **clutter-cognitive-load** — Saxbe & Repetti cortisol-slope finding was
  significant for wives only; scoped accordingly.
- **acoustic-comfort** — removed fabricated "psychological distress" claim from
  an outdoor-courtyard study; "99%" reflection → "95–98%"; flagged
  causal-direction and institutional-setting caveats.
- **texture-material-warmth** — Zhao et al. (2023) actually found *glass* highest
  in restorativeness; corpus now cites Ikei et al. (2017) for wood's
  physiological benefits and reports Zhao honestly.
- **entry-sequence-transitions** — McFadyen et al. (2021) *refutes* (does not
  confirm) the doorway effect except under load; rewritten.
- **bathroom-as-retreat** — removed non-ART "soft fascination" cues; dead Spa
  Executive URL (301 → agilysys.com) replaced with PMC11507196 (n=144 spa
  therapy study).
- **ceiling-height-volume** — PASS; minor precision (relational/abstract
  processing wording; "cathedral effect" noted as popular, not original, term).

### URL verification

192 first-pass URLs + 37 corrected-corpus URLs curl-checked. Live: 200/202.
A small number of publisher pages (Science.org, MDPI, Crate&Barrel,
PotteryBarn, HGTV, etc.) return 403 to non-browser agents (bot-wall) and one
429 (rate-limit) — all load in a browser; attribution cross-confirmed via
PubMed/Crossref. Dead links dropped: 2 MDPI Buildings papers and an
acousticgeometry blog the gather agent could not re-confirm, plus one dead
image URL.

## Compatibility Analysis

Stack per `remodel-planner.prompt.md`: nuxt4 + vue3 + vuetify4 + ts + firebase.
Corpora are plain markdown with a fixed field contract — parsed by `markdown-it`
14.2.0 at build time into typed JSON (Build Conventions: "do not add
@nuxt/content for two files"). No runtime dependency. `Slug` anchors and
room-type slugs match the `RoomType` enum and `psychologyTag` model fields
defined in Phase 3 / Phase 5.

## Recommendation

Proceed to **Phase 2: scaffold**. Blocking input required first (prompt forbids
guessing): **dev GCP project ID, prod GCP project ID, and Firestore region**.
These get written to `.remodel/registry.json.firebase` before `firebase init`.

## Implementation Sketch (next phase)

1. `npx nuxi init` (Nuxt 4, TS strict, `ssr: false`).
2. Add per Pinned Versions: `vuetify-nuxt-module` 0.19.5, `@pinia/nuxt` 0.11.3,
   `nuxt-vuefire` 1.1.2, `@vueuse/nuxt` 14.3.0, `zod` 4.4.3, `@vite-pwa/nuxt`
   1.1.1; dev: `firebase-tools` 15.20.0, `vitest` 4.1.8, `markdown-it` 14.2.0.
3. Collect + record dev/prod project IDs + region → registry.
4. `firebase init` (Firestore, Storage, Hosting); `.firebaserc` `dev`/`prod`
   aliases; App Check (reCAPTCHA Enterprise, dev debug token); Google-only Auth.
5. `v-app` shell: app-bar + rail drawer, 6 routes (Floorplan / Rooms / Budget /
   Tasks / Inspiration / Research) behind auth guard.
6. Build-time `markdown-it` parser turning both corpora into typed JSON.

## Risks

- **Bot-walled sources (403/429) are not dead links** but a naive in-app link
  checker could flag them. The corpus marks bot-walled inspiration sources;
  any future link-health automation must treat 403/429 from these publisher
  CDNs as live, mirroring the curl-with-browser-UA + PubMed/Crossref method
  used here.
- **Image hotlink stability** — CDN image URLs can rotate or gain hotlink
  protection over time. Phase 11 should degrade gracefully (image-load error →
  fall back to the source link card), never render a broken `<img>`.
- **Source drift** — trend/idea pages (2026 trend articles) date over time;
  the gallery is seeded, not authoritative. The Phase 11 "Add by URL" flow lets
  the user extend it.

## Open Questions

- dev/prod GCP project IDs + Firestore region (required to start scaffold).

## References

Full per-claim sources are inline in `content/research/design-psychology.md`
and `content/research/inspiration-index.md` (every entry is a verified link).
