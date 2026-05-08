# TRAKR — Session Context

**Project**: TRAKR — single-user personal health dashboard for JR, deployed at [trakros.com](https://trakros.com).
**Stack**: single-file `index.html` (~4500 lines), Supabase (Postgres + Auth) for persistence, Netlify Functions (`netlify/functions/`) as backend proxies for Oura OAuth + Claude/Anthropic API.
**Repo**: [github.com/jooorence/trakr-ai](https://github.com/jooorence/trakr-ai)

This document is the **handoff between Claude sessions**. It is overwritten at the end of each session with the latest state. Git history preserves prior versions.

---

## How to use this doc

If you're a Claude reading this at the start of a new session: read carefully, then **summarize back to JR** what you understand (current state, key rules, open items). Wait for him to confirm before doing any work.

JR's start-of-session prompt looks like this:

> *I'm continuing work on TRAKR. Repo at github.com/jooorence/trakr-ai. Read `docs/CONTEXT.md` (https://raw.githubusercontent.com/jooorence/trakr-ai/main/docs/CONTEXT.md) before doing anything else. After reading, summarize back to me what you understood so I can confirm we're aligned. Then I'll tell you which open item we're tackling.*

---

## Workflow rules (non-negotiable)

1. **Worktree → main with `--no-ff` merge, then push.** JR works in a git worktree. Every change is committed there, then merged into `main` with `git merge --no-ff`. Only after that gets pushed to `origin/main`.
2. **Push only on explicit "push it"** (or equivalent: "go ahead and push", "ship it"). Never push without an explicit instruction. Show `git diff` before pushing for any non-trivial change.
3. **Mobile changes are scoped inside `@media (max-width: 600px)`.** The desktop layout is **sacred** and must not be modified. Mobile rules either live inside that media block, or are CSS classes that default to `display: none` and only get flipped on inside the block. Always.
4. **Personal app, single user (JR himself).** Decisions favor JR's specific workflow. Hard-code his preferences, don't add multi-user features or settings UIs for things only he configures.
5. **No mockup-pushing.** Mockups live in `/tmp/trakr_preview/` and never get committed. The actual app is `index.html`.

---

## Current state — what's shipped (as of this session)

### Sidebar (desktop)
```
OVERVIEW    → Dashboard
TRAK        → Food Log
PLANS       → Training Split, Meal Plans
WELLNESS    → Routines
TRAKR AI    → CoachGPT
```
Width: **220px**, dark scrollbars, content area max-width **880px** centered with black gutters.

### Mobile dashboard (≤600px viewport)
- **Sidebar hidden**, replaced by bottom dock + hamburger top-left
- **Bottom dock** — translucent rounded pill (liquid-glass style: rgba(40,40,40,0.55) + 40px backdrop blur + saturate(1.6) + white-tinted border), 64px tall, fixed at `bottom: calc(20px + env(safe-area-inset-bottom))`. Four line-icon nav items: **Home / Food / Train / Meals**.
- **CoachGPT bubble** — separate floating circle, 64px, teal `rgba(64,204,187,0.65)` with matching glass treatment. Pinned bottom-right at the same offset as the dock so they align horizontally.
- **Hamburger** — top-left of the TRAKR header bar. Opens a slide-out drawer with the full sidebar nav.
- **iOS auto-zoom fix** — `.cs-input` font-size = 16px on mobile (Safari's threshold below which it auto-zooms on focus).

### Mobile typography spec (settled — see "Font journey" below for context)
| Element | Size |
|---|---|
| Tile hero numbers (e.g. "70", "8063") | **22px** |
| Pull Day title | **22px** (matches tile heroes) |
| Body text (lift names, macro labels, expenditure rows, longevity rows) | **14px** |
| Top-set reps + macro values | **13px** |
| Tile labels (WATER OZ, SLEEP SCORE) | **11px** |
| Section labels (TODAY'S LIFTS, EXPENDITURE, MACRO PROGRESS) | **11px** small caps |

### Dashboard structure
- **Top tiles** (3×2 grid on desktop, 2×3 on mobile): Cal Logged, Steps, Net Cal Burned, **Weight (lbs)**, Water (oz), Sleep Score
- **Push Day / Training card** (left half on desktop, full-width on mobile): training name + focus, "Today's Lifts" with `top sets` column, **Expenditure** section (Steps, Cal Burned, Net Cal Burned), **Longevity** section (Readiness, HRV, VO₂ max)
- **Macro Progress** strip (right half on desktop, below tiles on mobile): color-coded bars per macro with `current / target · %`, plus status hint that lists per-macro deltas (e.g. "541 cal to reach today's target · 40g protein to go · 127g carbs to go · *5g over fat*")

### Apple Fitness section (mobile)
- Manual input fields (Move/Exercise/Stand cal/min/hrs) **hidden** — log via CoachGPT instead
- Ring labels + percentages bumped to readable sizes
- True percentage shown (uncapped) — Exercise can show 216% if over goal; bar width still clamps at 100%

### Oura Ring section (mobile)
- **Top quadrant**: Total Sleep / Steps / Cal Burned / VO₂ max (replaces desktop's Total/Eff/Bedtime/Wake)
- **Middle row** (kept): Deep / REM / Light / Awake
- **Bottom row**: HRV / Readiness / **Bedtime** (Steps got promoted to top quadrant)
- All input fields **hidden** on mobile (CoachGPT logs the data)

### Food Log
- **Allows duplicates** — same meal logged twice = two rows (was previously deduping by name)
- **Servings stepper** per row (`−  1x  +`, capped 1–10), macros multiply by servings on read
- **Edit modal** with pencil icon — change name, per-serving macros, servings count
- CoachGPT `LOGFOOD:{...,"servings":2}` creates one row at 2x for "I had 2 morning coffees"

### CoachGPT
- Floating bubble (desktop bottom-right, mobile bottom-right beside dock)
- Chat sheet on mobile = nearly full-screen
- Supports these LOG actions: `LOGFOOD`, `LOGWATER`, `LOGSTEPS`, `LOGCALBURN`, `LOGMOVE`, `LOGEXERCISE`, `LOGSTAND`, `LOGSLEEP`, `LOGSPLIT`, **`LOGWEIGHT`**, `CLEARDAY`
- Knows JR's full plan (training split, meal plan, exercise list, macros, etc.) via system prompt

### Sync + persistence
- **Supabase** — `daily_logs` (date-keyed: oura blob, apple_fitness blob, food_log array, water, routines, split, day_type), `user_settings` (id=1: weight, goal_weight, oura_token), `chat_history` (per-surface chat log)
- **Oura sync** — Netlify proxy at `netlify/functions/oura.js` calls `/v2/usercollection/{daily_sleep,sleep,daily_activity,daily_readiness}` for the **client's local date** (not UTC — fixed earlier), merges sleep durations from session-level endpoint into daily_sleep score
- **localStorage** mirrors most state (jr_oura, jr_apple, jr_water_v2, jr_vo2_max, jr_split_override_*, jr_brief_date, etc.)

---

## Architecture decisions worth knowing

### Activity field chokepoints (`setSteps`, `setCalExp`, `setMove`, `setExercise`, `setStand`)
All writes to steps/calExp/move/exercise/stand go through these five setters. They enforce:
- **Date guard**: writes for a non-today date are silently dropped (kills the recurring "Oura wrote yesterday's data after midnight" bug structurally)
- **Source priority**: `user (3) / logaction (3) > oura (2) > apple (1)`. Once a higher-priority source has written, lower sources can't overwrite. Originally was `apple > oura` then JR clarified Apple Fitness is just manual ring entry, Oura is the actual cumulative data source.
- **Numeric 0 is a write, not a clear** — only null/undefined/empty-string trigger a clear (so Oura returning 0 cal early in the morning doesn't wipe user data)
- **Monotonic guard** — Oura source can't overwrite a higher cumulative value with a lower one for steps/calexp (sync glitches don't undo progress)
- **`_activitySources` map** tracks which source last wrote each field

### `initNewDay()` (clean-slate function)
- Single source of truth for "what does a fresh day look like"
- Called on page load AND every 60s by a `setInterval` watcher that detects midnight rollover (compares `getTodayKey()` to `_sessionDate`)
- Resets `_activitySources`, prunes stale localStorage blobs, clears all daily input fields, zeroes water state, re-renders

### `getTodaySplit()` helper
- Resolves today's training split with precedence: localStorage override (LOGSPLIT) → `flDateStore[today].split` (DB-loaded) → `flAutoSplit()` (day-of-week default)
- Used by `coachBuildContext()`, `dashRefresh()`, and the expanded training card so LOGSPLIT overrides persist across refreshes everywhere

### Save-side guards
- `ouraUpdate()` won't save when ALL numeric fields are zero/empty (prevents `initNewDay` clearing → save zeros → wipe race)
- `dashAppleSave()` same guard for Move/Exercise/Stand/Steps
- `dbLoadAll()` restores `steps` AND `calexp` from oura blob (was previously skipping calexp, which lived only there → user-typed cal burned values wiped on every refresh; fixed)

### Mobile breakpoint = 600px
- Single source of truth for "is this mobile"
- All mobile-only HTML elements (dock, hamburger, mobile-overlay, mobile-only Oura tile groups) default to `display: none` and only get flipped on inside the @media block
- All mobile-only CSS rules live inside the @media block

---

## Open items / parked features

Ranked roughly by impact:

1. **Voice input for CoachGPT** — Web Speech API (built into Safari/Chrome, free, no API key). Add 🎤 button to chat input, long-press to record, transcribe, fill textarea. Wispr Flow is NOT embeddable in browser — it's a macOS-level keyboard interceptor. Web Speech API is the right path.

2. **Date swipe navigation on dashboard** — Oura-style horizontal carousel where swiping left/right shows yesterday/tomorrow. Read-only for past days. Big lift because requires `dashRefresh(date)` parameterization + pulling per-date data from `flDateStore` and `daily_logs`.

3. **Camera meal logging** — mobile-only "📸 Snap meal" button. Opens camera → photo → POSTs to Claude with vision → estimated macros → confirm UI. Killer feature for mobile food tracking. Bigger build (camera + image upload + vision API call + confirm UI).

4. **Hamburger drawer cleanup** — currently shows ALL sidebar sections including duplicates with the dock (Home/Food/Train/Meals). On mobile, drawer should show only the less-used items: Routines, Insights, Settings, Sign out.

5. **PWA install + home-screen icon** — manifest + service worker so iPhone can "Add to Home Screen." Full-screen native feel, no Safari chrome. Also enables push notifications (item 6) and offline cache.

6. **Push notifications via PWA** — "Time to weigh in" 7am, "Log lunch?" 12:30, etc. Requires service worker. iOS 16.4+ supports PWA push.

7. **`vo2_max` Supabase migration** — column doesn't exist yet, so VO₂ max is localStorage-only. Add `vo2_max numeric` to `user_settings` table → flip `vo2Update()` from `localStorage.setItem('jr_vo2_max', v)` to `dbSaveSettings({vo2_max: v})` for cross-device sync.

8. **Auth-gate bypass cleanup** — earlier in this session, code was added to `initAuth()` that bypasses Google Sign-In on any non-`trakros.com` host. Practical impact for JR's setup: zero. But if he ever sets up a Netlify deploy preview or alt hostname, it'd be unauth'd by default. Decision pending.

9. **`#auth-gate` `display:flex` strip cleanup** — same session, removed the `display:flex` from inline style so the gate is hidden at HTML parse time and only shown by JS in production. If JS errors before `initAuth()` runs, gate fails OPEN (dashboard visible). Same risk as #8, similar low practical impact.

10. **Apple Watch complication** (stretch) — quick water/weight log straight from the watch.

11. **Streaks / habit tracking** — "12 days hitting protein target" badge. Mobile-app sticky factor.

---

## Recent commit history (most recent first)

| SHA | Description |
|---|---|
| `74048a2` | Tile hero numbers matched to Pull Day title size (22px) — Option A |
| `d936cd2` | Middle-ground mobile fonts (14px body uniform) |
| `ecfdbbe` | Dial back mobile fonts + iOS chat input zoom fix (16px) |
| `4ebc474` | Apple Fitness + Oura mobile simplified (no inputs, restructured tiles) |
| `bb414a5` | Mobile polish: dock+bubble alignment, glass effect, +3pt fonts, bigger chat sheet |
| `16f1cdc` | Mobile bottom dock — translucent pill nav for 4 sections |
| `dfb72fe` | Mobile view: stacked dashboard, hidden sidebar, hamburger drawer |
| `00d5d45` | Macro Progress: per-macro deltas in status hint |
| `7b6e2ea` | LOGWEIGHT action so CoachGPT can update body weight |
| `6784979` | Oura proxy: use client local date instead of UTC |
| `f5eac72` | Restore steps + calexp from oura blob on load |
| `c169fd2` | Stop Oura sync + initNewDay from wiping steps/calexp |
| `4727cf0` | LOGSPLIT persistence + Oura `/sleep` endpoint fetch |
| `5149200` | Activity field chokepoints + initNewDay + midnight rollover |

To revert any specific commit: `git revert <sha>` then `git push origin main`. Netlify auto-deploys within ~1-2 min.

---

## Things to know that might bite next session

- **`Fitness and Health Apps Unified Landscape Memo.md`** — untracked file in repo root. Personal note. Decision pending whether to commit, leave, or delete.
- **Worktree branch `claude/eager-shannon-721a95`** — local-only. Not pushed to GitHub. All commits are merged into main, so nothing's lost. Doesn't need to be on GitHub.
- **Auto-memory files** at `/Users/jrsm5pro/.claude/projects/-Users-jrsm5pro-Desktop-trakr-ai/memory/` — these persist across Claude Code sessions on this Mac but NOT to other devices/accounts. The handoff doc you're reading IS the cross-device replacement.
- **Repo is PUBLIC** — Supabase anon keys are hardcoded in `index.html` but they're publishable-tier keys protected by RLS (designed to be public-facing). Personal preference data (workout preferences, meal plan, macros, weight goals) is also visible. JR is OK with this for a personal app.
- **Two preview servers exist** at port 8080 in different worktrees during local dev — they staged HTML at `/tmp/trakr_preview/`. Not relevant for production.

---

## End-of-session ritual

When JR says "wrap up" / "let's call it" / equivalent at end of a session:

1. Confirm all code changes are pushed to `origin/main`
2. **Update this doc** (`docs/CONTEXT.md`) with whatever is now true: new shipped features, new architecture decisions, new open items, latest commit SHAs
3. Commit the doc with a message like `Update CONTEXT.md after session: [brief topic]`
4. Push

That's it. Next session anywhere on any device can pick up by reading the URL at the top.
