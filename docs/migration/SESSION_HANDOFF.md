# TRAKR Migration — Session Handoff

> Snapshot: end of session **2026-05-05** · Phases 0–1 done · Phase 2 not started yet

This document is for picking up the migration in a fresh Claude Code session without any context loss. Read it end-to-end at the start of next session.

---

## TL;DR

- **Phases 0 (foundation) and 1 (layout shell) are complete** and committed in the worktree.
- **trakros.com is unaffected** — still serving the legacy `index.html` from `main`.
- **Next session picks up at Phase 2** (shadcn setup + Oura section). This is the most important milestone — it's where the "fix-once-fixes-everywhere" pattern gets proven for real.

---

## Where everything lives

| Where | What | Notes |
|---|---|---|
| `/Users/jrsm5pro/Desktop/trakr-ai` | Main repo | Has Phase 0 code (web/, docs/) but **no netlify.toml**. Trakros.com builds from root `index.html` here. |
| `/Users/jrsm5pro/Desktop/trakr-ai/.claude/worktrees/romantic-dhawan-9a22e4` | **Active worktree** for migration work | Branch: `claude/romantic-dhawan-9a22e4`. Has Phase 0+1 + `netlify.toml`. |
| `web/` | The new React app | Vite + React 18 + TS + Tailwind v4 + Supabase + React Query + React Router |
| `web/.env.local` | Local Supabase creds | Gitignored. URL + publishable key already populated. |
| `index.html` (root) | Legacy app | 3,482 lines, single-file. Still the live trakros.com app. **Don't touch from migration branch.** |
| `netlify/functions/` | Existing Netlify Functions | Unchanged. `claude.js`, `oura.js`, `apple-sync.js`. Kept as-is. |
| `supabase/` | DB SQL | Unchanged. |
| `docs/migration/PRD.md` | Product requirements | Locked decisions, success criteria |
| `docs/migration/PLAN.md` | Phased execution plan | Updated with Phase 1 ✅, Phase 2 starting tasks |

---

## Git state

| Branch | Where | Has | Visible to user |
|---|---|---|---|
| `main` (local + GitHub) | Phase 0 code, no netlify.toml, root `index.html` legacy | Trakros.com via Netlify auto-detect |
| `claude/romantic-dhawan-9a22e4` (local + GitHub) | Phase 0 ✓ | Pushed to GitHub once. Netlify preview URL exists. |
| `claude/romantic-dhawan-9a22e4` (local only, **not yet pushed**) | Phase 0 ✓ + Phase 1 ✓ | Phase 1 commits exist locally only as of session end. |

**Current commit on worktree:** see `git log --oneline -3` from the worktree path. Should be the "Phase 1: layout shell + nav routing" commit at HEAD.

---

## What's done

### ✅ Phase 0 — Foundation (committed, on main)
- Vite + React 18 + TypeScript (strict) + Tailwind v4 in `web/`
- Supabase client (`web/src/lib/supabase.ts`) with graceful `SetupRequired` fallback when env vars are missing
- `<AuthGate>` with Google OAuth, 1:1 visual parity with legacy auth screen (T-mark logo, TRAKR/HEALTH OS, white Google button)
- `<QueryClientProvider>` + `<BrowserRouter>` in `main.tsx`
- TRAKR dark palette as Tailwind theme tokens
- `netlify.toml` (branch-scoped — only on migration branch, not main)
- End-to-end Google OAuth verified locally; `http://localhost:5173/**` added to Supabase Redirect URLs

### ✅ Phase 1 — Layout shell (committed, worktree only)
- `<AppShell>`: hero (top, full-width) + 1100px-centered app-body (sidebar + main outlet) + floating coach bubble
- `<Hero>`: TRAKR / HEALTH OS, exact legacy values (20px / 800 weight / 0.16em letter-spacing for TRAKR; 9px / #444 / 0.26em for HEALTH OS)
- `<Sidebar>`: 6 groups, 10 nav items, color-coded active states using inline style (per-item `defaultColor` / `activeColor` / `activeBg` from `routes/nav.ts`)
- `<CoachBubble>`: pulsing teal floating button at `right: max(24px, calc((100vw - 1100px) / 2 + 24px))`, no click handler yet
- `<SectionPlaceholder>`: stub for routes not yet ported
- React Router routes for all 10 sections: `/dashboard`, `/food-log`, `/meal-plans`, `/training`, `/routines`, `/rules`, `/longevity`, `/creed`, `/insights`, `/coach`. `/` redirects to `/dashboard`. Catch-all also redirects to `/dashboard`.
- Sidebar visual parity verified by user against trakros.com — matches.

---

## Next session — Phase 2

**Goal:** First real feature port. Oura section, end-to-end, in React. This is the proof-point of the entire migration.

### Step 1 — Verify everything still works (~2 min)

```bash
cd /Users/jrsm5pro/Desktop/trakr-ai/.claude/worktrees/romantic-dhawan-9a22e4
git status                          # should be clean, on claude/romantic-dhawan-9a22e4
git log --oneline -5                # should show Phase 1 + Phase 0 commits
ls web/.env.local                    # should exist (don't print contents)
npm --prefix web run build           # should succeed
```

If `web/.env.local` is missing for some reason, copy from `.env.local.example` and add:
- `VITE_SUPABASE_URL=https://ztqpxwaeaknylgpvipuu.supabase.co`
- `VITE_SUPABASE_ANON_KEY=sb_publishable_sKRmZBiHO0quGaBo8XqS2w_fCRm9yya`

### Step 2 — shadcn/ui setup

From `web/`:

```bash
npx shadcn@latest init
```

Settings to choose:
- Style: **New York**
- Base color: **Zinc** (closest match for legacy `#1a1a1a` / `#0f0f0f` greys)
- CSS variables: **Yes**
- Components dir: `src/components/ui` (default)

Then add the components Phase 2 will consume:

```bash
npx shadcn@latest add button input card
```

shadcn writes a `lib/utils.ts` with the `cn()` helper. Verify it compiles.

**Watch out:** shadcn init may want to override `index.css`. After init, re-add the TRAKR `@theme` block (color tokens) AND the `line-height: 1.2` override on html/body/#root — without that override the sidebar will get loose again (Tailwind v4 preflight defaults `html` to `line-height: 1.5`).

### Step 3 — Generate Supabase types

```bash
npx supabase gen types typescript --project-id ztqpxwaeaknylgpvipuu > web/src/lib/database.types.ts
```

(Requires Supabase CLI; if not installed, JR can do it from his Supabase dashboard via Settings → API → "Generate Types" and paste the file in.)

### Step 4 — TRAKR primitives

Create `web/src/components/ui/` (or wherever shadcn put things):

- `<NumberInput label min max step value onChange />` — wraps shadcn `<Input type="number">` with a small label above it. Used everywhere there's a numeric form field (Oura's 12 fields, Apple Fitness rings, macros).
- `<Pill>` — small rounded label with a color tone (used in legacy for tags like "Pull", "Push", "Legs")
- `<SectionLabel>` — small uppercase tracking-wide text (replaces the inline-styled `<div class="macro-section-label">` in legacy)

### Step 5 — `useDailyLog` hook

Lives at `web/src/hooks/useDailyLog.ts`. Shape:

```ts
function useDailyLog(date: string) {
  // React Query: fetch daily_logs row WHERE date = $date
  // returns { data, update(field, value), isLoading, error }
  // update() does optimistic update + debounced Supabase upsert
}
```

This is the **single source of truth** that replaces the 6-different-places-update pattern from legacy.

### Step 6 — `<OuraSection date={date} />`

The flagship Phase 2 component. Reference points in legacy `index.html`:

- **Lines 544-555:** Input HTML (12 fields) — extract `FIELDS` array from this
- **Lines 1456-1467:** Load from DB — replaced by `useDailyLog`
- **Line 1821:** Clear form — replaced by config-driven loop
- **Lines 1976-1977:** Read for save — replaced by reactive state
- **Line 2109:** Per-field listeners — replaced by single `onChange`
- **Lines 2677-2690:** Compute display — consumed by `<OuraSummary>`

The `FIELDS` config (single source of truth):

```ts
const FIELDS = [
  { key: 'score',     label: 'Sleep score',       min: 0, max: 100 },
  { key: 'total',     label: 'Total sleep (hrs)', min: 0, max: 12, step: 0.1 },
  { key: 'eff',       label: 'Efficiency (%)',    min: 0, max: 100 },
  { key: 'deep',      label: 'Deep (hrs)',        min: 0, max: 5,  step: 0.1 },
  { key: 'rem',       label: 'REM (hrs)',         min: 0, max: 5,  step: 0.1 },
  { key: 'light',     label: 'Light (hrs)',       min: 0, max: 8,  step: 0.1 },
  { key: 'bed',       label: 'Bedtime',           type: 'time' },
  { key: 'wake',      label: 'Wake time',         type: 'time' },
  { key: 'hrv',       label: 'HRV',               min: 0, max: 200 },
  { key: 'readiness', label: 'Readiness (0-100)', min: 0, max: 100 },
  { key: 'steps',     label: 'Steps',             min: 0, max: 50000 },
  { key: 'calexp',    label: 'Cal expended',      min: 0, max: 5000 },
] as const
```

Verify the exact key names against legacy line 1456-1467 — Supabase column names must match.

### Step 7 — `<OuraSummary data={...} />`

The summary tiles at top of the section (sleep score, deep/REM/light, readiness). Reads from the same `data` object. Reference: legacy lines 503-535.

### Step 8 — Side-by-side parity test

1. Open trakros.com (legacy) and localhost:5173 (React) in two tabs, both signed in
2. In legacy, enter Oura values for today
3. Refresh React, navigate to `/dashboard` (or wherever Oura is rendered) → values should appear
4. In React, modify a value
5. Refresh legacy → modified value should appear
6. **If passes:** Phase 2 done. Commit. Celebrate. The migration is now de-risked.

### Phase 2 exit criteria

- [ ] shadcn primitives installed, `cn()` helper working
- [ ] TRAKR primitives (`<NumberInput>`, `<Pill>`, `<SectionLabel>`) built
- [ ] `useDailyLog` hook reads/writes daily_logs correctly
- [ ] `<OuraSection>` renders all 12 fields from a single `FIELDS` config
- [ ] `<OuraSummary>` displays computed totals (auto-updates when fields change)
- [ ] Side-by-side test passes both directions (legacy → React, React → legacy)
- [ ] Visual parity with legacy Oura section
- [ ] No console errors, build clean

---

## Critical workflow rules — read before doing anything

### 1. NEVER merge migration phases to main

`main` serves trakros.com via auto-detected static HTML. The migration branch has a `netlify.toml` that, if merged to main, would flip trakros.com to the React build. **Past mistake:** Phase 0 was merged to main with `netlify.toml`, almost flipped trakros.com to the (incomplete) Phase 0 shell. Caught and reverted in 30 seconds. **Don't do it again.**

- Migration phases stay on `claude/romantic-dhawan-9a22e4` (this worktree branch) until Phase 8 cutover
- The Phase 8 commit IS the cutover — that's when we intentionally merge `netlify.toml` + the entire migration into main

### 2. JR's standard worktree workflow does NOT apply during migration

Normally for TRAKR, the workflow is: edit in worktree → merge to main → push. **For the migration:** edit in worktree → commit in worktree → push the migration branch directly to GitHub for Netlify preview deploys (`git push -u origin claude/romantic-dhawan-9a22e4`). Never merge to main.

### 3. Wait for explicit "push it" before pushing

JR likes to preview locally first. The hook fires a workflow reminder on every edit; respect it. Even pushing the migration branch (not main) needs his explicit consent.

### 4. Bug fixes to legacy keep happening on main

JR uses trakros.com daily and may push bug fixes to `index.html` while migration is in progress. When that happens:
- Bug fix lands on main directly (he edits `index.html`, commits, pushes — same as he always has)
- The migration branch will lag behind main by those commits
- Periodically, **rebase or merge `main` into `claude/romantic-dhawan-9a22e4`** to absorb fixes
- If the fixed section is already ported to React, mirror the fix in the React code
- If not yet ported, the React port will pick up the latest legacy code automatically when we get to it

---

## Technical gotchas — discovered during this session

### Tailwind v4 preflight overrides line-height

Tailwind v4's preflight CSS sets `html { line-height: 1.5 }`. Legacy uses browser default (~1.2). This made the Phase 1 sidebar look excessively loose vertically (~30+px extra over legacy). Fix is in `web/src/index.css`:

```css
html, body, #root {
  ...
  line-height: 1.2;
  ...
}
```

**Do not remove this override.** If shadcn init or any future change rewrites `index.css`, re-add it.

### App-body centering needed an explicit flex-row wrapper

Direct `mx-auto max-w-[1100px]` on a flex-col child with default `align-items: stretch` did not center reliably. Fix in `AppShell.tsx`:

```tsx
<div className="flex flex-1 overflow-hidden">       {/* explicit flex-row wrapper */}
  <div className="mx-auto flex w-full max-w-[1100px]">  {/* this centers cleanly */}
    <Sidebar />
    <main>...</main>
  </div>
</div>
```

### Vite env vars need `VITE_` prefix

Supabase URL/key in `.env.local` are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The Netlify Functions in `netlify/functions/` use the non-prefixed `SUPABASE_URL` / `SUPABASE_ANON_KEY` — both coexist in JR's Netlify env vars dashboard (he added the VITE-prefixed ones during this session).

### Supabase Redirect URLs allowlist

JR added `http://localhost:5173/**` to Supabase Auth → URL Configuration → Redirect URLs (in his Supabase project `ztqpxwaeaknylgpvipuu`). When the migration branch's Netlify preview URL is needed, he'll need to add that too.

### Auth gate has a `SetupRequired` fallback

`AuthGate.tsx` renders a "SETUP REQUIRED" screen if env vars are missing instead of throwing. This is intentional — useful for fresh clones / forgotten env files. Do not remove.

---

## Locked design decisions (recap from PRD §9)

1. **Option C — structural parity, new primitives from day one.** Same screens/flows/palette as legacy, but Tailwind classes + shadcn primitives instead of inline styles + raw HTML inputs.
2. **URL routes per section** (not tab-based nav). All 10 routes live, browser back button works, bookmarkable.
3. **Instant cutover at Phase 8.** No two-version overlap. Single merge to main flips trakros.com.
4. **Legacy archive: `legacy/index.html`.** Move (don't delete) at cutover for reference during Phase 9 polish.
5. **TypeScript strict from day one.** No `any` in feature code. Already enabled in `tsconfig.app.json`.

---

## Things I'm unsure about — call these out next session

- Whether Supabase has an exposed CLI command to generate types directly (Step 3) or whether JR needs to do it manually via dashboard
- Whether `.env.local` should also include any Apple/Oura keys for the dev build (likely no — those are server-side in functions)
- Whether the Netlify preview URL (from when JR pushes the migration branch) is in Supabase's Redirect URLs yet
