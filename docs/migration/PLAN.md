# TRAKR React Migration — Plan

This is the execution plan for the migration described in [PRD.md](./PRD.md). Read the PRD first.

## Strategy: Parallel build, single cutover

- Keep `index.html` shipping to trakros.com untouched throughout the entire migration.
- Build the React version on a feature branch (`react-migration` or per-phase worktrees).
- Use Netlify's automatic preview deploys per branch as the staging environment.
- When all phases are complete and parity is verified, merge to main → trakros.com flips to React.
- Move `index.html` to `legacy/` in the same merge.

This means **at no point during the migration is the live app broken**.

---

## Pre-flight checklist (do these before Phase 0)

- [x] Confirm the five decisions — locked in [PRD §9](./PRD.md#9-locked-decisions) on 2026-05-04.
- [ ] Document current Supabase schema by exporting types from the live DB (`supabase gen types typescript`). Save to `web/src/lib/database.types.ts`. *(Can also be done at start of Phase 2.)*
- [ ] Take screenshots of every section of the current app (desktop + mobile widths) — saved as parity reference for side-by-side checks.
- [x] Color palette captured for Tailwind theme tokens: `#0a0a0a` (bg), `#111` (panel), `#1a1a1a` (card), `#2a2a2a` (border), `#8899ff` (accent-blue), `#4caf7d` (accent-green), `#ff7ab0` (accent-pink), `#60c8f0` (accent-cyan), `#ddd` (text), `#444`/`#555` (muted).
- [ ] Capture current Netlify environment variables (Claude API key, Oura client ID/secret, Supabase URL/anon key). They'll be reused as-is on the new build — no changes needed in Netlify dashboard since both old and new use the same env.

---

## Phase 0 — Foundation (~half day)

**Goal:** an empty React app deployed to a Netlify preview URL, signed in via Supabase, rendering "Hello TRAKR."

**Tasks:**
1. `npm create vite@latest trakr-react -- --template react-ts`
2. Install: `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, `tailwindcss`, `zustand`
3. Configure Tailwind with the legacy color palette as theme tokens.
4. Set up `src/lib/supabase.ts` (client) and `src/lib/database.types.ts` (generated types).
5. Build minimal auth flow: `<AuthGate>` wrapper that signs in via Google OAuth.
6. Set up `vite.config.ts` to proxy `/.netlify/functions/*` to local Netlify dev during local development.
7. Push branch, confirm Netlify preview deploy works, sign in successfully on the preview URL.

**Exit criteria:** preview URL renders authenticated "Hello TRAKR" with TS+Tailwind+Supabase wired up.

---

## Phase 1 — Layout shell + navigation ✅ DONE (2026-05-05)

**Goal:** the visual chrome of the app — sidebar, top bar, floating coach bubble, routing.

**Tasks completed:**
1. ✅ `<AppShell>` with hero (full-width) + 1100px-centered app-body (sidebar + main outlet).
2. ✅ React Router routes for all 10 top-level sections matching legacy nav: `/dashboard`, `/food-log`, `/meal-plans`, `/training`, `/routines`, `/rules`, `/longevity`, `/creed`, `/insights`, `/coach`. (10 routes, not 8 — legacy nav has Meal Plans + Rules as separate items.)
3. ✅ `<Sidebar>` with 6 nav groups, color-coded active states per legacy palette (10 distinct color themes).
4. ✅ `<CoachBubble>` (visual only, pulsing teal, positioned per legacy `right: max(24px, calc((100vw - 1100px) / 2 + 24px))`).
5. ⏭️ **Moved to Phase 2 start:** shadcn/ui install + TRAKR primitives. Reasoning: build primitives when first consuming them, not speculatively. Phase 2's Oura section is the first place we'll need `<NumberInput>`, `<Card>`, etc.

**Exit criteria met:** every route renders the placeholder with consistent shell; sidebar nav works; URL changes per route; floating coach bubble in place.

**Tribal knowledge captured:**
- Tailwind v4's preflight sets `html { line-height: 1.5 }`. Legacy uses browser default (~1.2). Override applied in `web/src/index.css`. **Do not remove** — sidebar/tight UI will look loose if you do.
- App-body centering uses an explicit flex-row wrapper around the `mx-auto max-w-[1100px]` container. Direct `mx-auto` on a flex-col child with `align-items: stretch` did not center reliably.

---

## Phase 2 — shadcn setup + first feature (Oura) (~1 day)

**Goal:** prove the end-to-end pattern with one self-contained feature. Oura is ideal because it's data-heavy but isolated.

**Tasks:**
1. **shadcn/ui setup (relocated from Phase 1):**
   - From `web/`: `npx shadcn@latest init` — pick New York style, dark, CSS variables, components in `src/components/ui`
   - Add components: `npx shadcn@latest add button input card`
   - Verify the `cn()` helper compiles in `lib/utils.ts`
2. Build TRAKR-specific primitives wrapping shadcn:
   - `<Pill>`, `<SectionLabel>`, `<NumberInput>` (label + number input with min/max/step)
3. Build `useDailyLog(date)` hook — fetches/caches daily_logs row via React Query, returns `{ data, update, isLoading }`.
4. Generate Supabase types: `supabase gen types typescript --project-id ztqpxwaeaknylgpvipuu > web/src/lib/database.types.ts`
5. Build `<OuraSection date={date} />` component — renders 12 fields from a `FIELDS` config array, single source of truth.
6. Build `<OuraSummary data={...} />` — the summary tiles (sleep score, deep/REM/light, readiness).
7. Wire `useDailyLog.update(field, value)` to debounced Supabase upsert.
8. Verify against legacy: enter values in legacy app, confirm React version reads same row; enter in React, confirm legacy reads it.

**Reference points in legacy `index.html`:**
- Lines 544-555: Input HTML (12 fields) — the `FIELDS` array template
- Lines 1456-1467: Load from DB — what `useDailyLog` replaces
- Line 1821: Clear form — config-driven loop
- Lines 1976-1977: Read values for save — replaced by reactive state
- Line 2109: Per-field listeners — replaced by single `onChange`
- Lines 2677-2690: Compute display — `<OuraSummary>` consumes the same state

**Exit criteria:** Oura section is fully functional in React, reads/writes the same Supabase row as legacy. Side-by-side test passes.

**This is the milestone where you'll feel whether the migration is worth continuing.** If the pattern feels right after Oura, the rest is mechanical.

---

## Phase 3 — Health data + dashboard (~1 day)

**Goal:** all numeric/health inputs and the dashboard overview.

**Tasks:**
1. `<AppleFitnessRings>` — move, exercise, stand with current 750/45 goals.
2. `<DashboardOverview>` — weight input, goal input, macro rings, exercise ring.
3. `<MacroDashboard>` — calorie/protein/carb/fat bars (shown on meal tabs).
4. Apple Health webhook compatibility test — trigger `apple-sync.js`, confirm React UI reflects new values without reload (via React Query invalidation or Supabase realtime, TBD).

**Exit criteria:** dashboard parity with legacy. Apple Health sync visibly updates UI.

---

## Phase 4 — Food log + meal plans (~1 day)

**Goal:** food log with date nav, calendar, training/rest selector. Meal plans (training day + rest day).

**Tasks:**
1. `<DateNav>` — prev/next/today, with calendar popover.
2. `<MealPlan type="training" | "rest">` — hard-coded plan items.
3. `<FoodLog date={date}>` — list of logged items, add/remove, links to meal plan.
4. Macro totals computed from food log items (single source of truth — no manual DOM updates).

**Exit criteria:** food log parity. Date navigation feels snappier than legacy (instant, no reload).

---

## Phase 5 — Static content sections (~half day)

**Goal:** the read-mostly sections — quick wins.

**Tasks:**
1. `<TrainingSplit>` — 5 day sections, expand/collapse state in component, exercise lists.
2. `<Routines>` — morning/nightly tabs with checklists, persisted to user_settings.
3. `<Longevity>`, `<Rules>`, `<Covenant>` — mostly static markup.
4. `<Insights>` — same as legacy initially (port the chart logic if any).

**Exit criteria:** all read-mostly sections done. App is now ~80% feature-complete.

---

## Phase 6 — CoachGPT (~1.5 days, the hardest phase)

**Goal:** all three chat surfaces backed by a single `<ChatSurface />` component, with streaming, persistence, and quick actions.

**Tasks:**
1. `<ChatSurface surface="main" | "side" | "brief">` — props control layout, but rendering, streaming, persistence, and scroll-to-bottom logic are shared.
2. `useChatHistory(surface)` hook — loads/persists to chat_history table, scoped by surface.
3. `useChatStream()` hook — calls `/.netlify/functions/claude`, handles streaming response, updates messages array as tokens arrive.
4. Quick-action regex table (LOGSLEEP, etc.) — port verbatim from legacy, hook into the chat surface.
5. Day-selector + readonly banner for the side panel surface (chat history for past days).
6. Floating coach bubble opens the side panel.
7. Brief chat embedded in Daily Brief surface.

**Exit criteria:** all three chat surfaces work, persist correctly, stream cleanly, share one code path. Verify "fix-once-fixed-everywhere" by intentionally introducing then fixing a streaming bug — confirm it surfaces in all three.

---

## Phase 7 — Daily Brief (~half day)

**Goal:** the AI Daily Brief section with greeting, numbers, split preview, and embedded chat.

**Tasks:**
1. `<DailyBrief>` composing `<BriefGreeting>`, `<BriefNumbers>`, `<BriefSplitPreview>`, `<ChatSurface surface="brief" />`.
2. "Generate brief" action — calls Claude with current day's data.

**Exit criteria:** Daily Brief feature parity.

---

## Phase 8 — Polish + cutover (~1 day)

**Goal:** ship.

**Tasks:**
1. Side-by-side parity audit — every screenshot from pre-flight checklist verified against React build.
2. Mobile (iPhone Safari) verification.
3. Accessibility quick pass — keyboard nav, focus states, aria labels on icon buttons.
4. Add tasteful Framer Motion transitions on tab/route changes (optional).
5. Move `index.html` → `legacy/index.html`.
6. Update `netlify.toml` to point publish dir at `dist/`.
7. Merge to main. Verify trakros.com serves React build.
8. Celebrate.

**Exit criteria:** all PRD success criteria checked off.

---

## Phase 9 — Iterative UX/layout redesign (post-migration, no fixed scope)

Phase 1 already gave us shadcn/ui primitives and Tailwind tokens, so the *visual foundation* is solid by the time Phase 8 ships. Phase 9 is where deliberate **layout and UX** changes happen — the kind that need intention, not the kind that come for free with the migration. Examples:

- Reimagined navigation (bottom-tab nav on mobile?).
- Improved typography scale and spacing rhythm.
- Smooth view transitions (Framer Motion).
- Empty/loading/error states for every async surface.
- Redesigned dashboard layouts inspired by Linear/Vercel/Apple Health.
- Information density tuning per surface.

This phase is open-ended and not part of the migration completion criteria.

---

## Total rough estimate

**~7 working days** of focused effort across all phases (excluding Phase 9). Spread out, this is realistically 2–4 weeks of evening/weekend work.

Each phase is independently shippable to the preview URL — you can always pause between phases.

---

## How to start

1. Read [PRD.md](./PRD.md) end-to-end.
2. Answer the five open decisions in PRD §9.
3. Complete the pre-flight checklist above.
4. Begin Phase 0.
