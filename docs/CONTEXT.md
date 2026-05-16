# TRAKR — Session Context

**Project**: TRAKR — single-user personal health dashboard for JR, deployed at [trakros.com](https://trakros.com).
**Stack**: single-file `index.html` (~5000 lines), Supabase (Postgres + Auth) for persistence, Netlify Functions (`netlify/functions/`) as backend proxies for Oura OAuth + Claude/Anthropic API.
**Repo**: [github.com/jooorence/trakr-ai](https://github.com/jooorence/trakr-ai)

This document is the **handoff between Claude sessions**. It is overwritten at the end of each session with the latest state. Git history preserves prior versions.

---

## How to use this doc

If you're a Claude reading this at the start of a new session: read carefully, then **summarize back to JR** what you understand (current state, key rules, open items). Wait for him to confirm before doing any work.

JR's start-of-session prompt looks like this:

> *I'm continuing work on TRAKR. Repo at github.com/jooorence/trakr-ai. Read `docs/CONTEXT.md` before doing anything else. After reading, summarize back to me what you understood so I can confirm we're aligned. Then I'll tell you which open item we're tackling.*

---

## Workflow rules (non-negotiable)

1. **Push only on explicit "push it"** (or equivalent: "go ahead and push", "ship it"). Never push without an explicit instruction. **JR has explicitly asked: always show what we're going to push and get confirmation before pushing.**
2. **Mobile changes are scoped inside `@media (max-width: 600px)`.** The desktop layout must not be modified by mobile rules. Mobile rules either live inside that media block, or are CSS classes that default to `display: none` and only get flipped on inside the block.
3. **Personal app, single user (JR himself).** Decisions favor JR's specific workflow. Hard-code his preferences, don't add multi-user features.
4. **No mockup-pushing.** Mockups live in `/tmp/trakr_preview/` and never get committed.
5. **Git workflow**: commit on worktree branch → `--no-ff` merge into `main` → push. Always push to `origin/main`. Pull before starting any session if switching machines.
6. **Single source of truth pattern**: where the same data is referenced in multiple places (UI + system prompt + helper handlers), put it in ONE JS object and have everything read from it. See `MEAL_PLAN` for the template — same pattern coming for training/routines later.

---

## Current state — what's shipped

### Sidebar (desktop)
```
OVERVIEW    → Dashboard
TRAK        → Food Log
PLANS       → Training Split, Meal Plans
WELLNESS    → Routines
TRAKR AI    → CoachGPT
```
Width: **220px**, dark scrollbars, content area max-width **880px** centered with black gutters.
Desktop body has `zoom: 1.1` applied via `@media (min-width: 601px)` — everything 10% larger.
**Body height compensation**: `body { height: calc(100vh / 1.1) }` so zoomed body fits viewport exactly.

### Mobile dashboard (≤600px viewport)
- **Sidebar hidden**, replaced by bottom dock + hamburger top-left
- **Bottom dock** — translucent rounded pill (liquid-glass style), 64px tall, fixed bottom. Four line-icon nav items: **Home / Food / Train / Meals**. Floats over content (content visible through glass blur).
- **CoachGPT bubble** — floating circle, teal, pinned bottom-right beside dock.
- **Hamburger drawer** — top-left. Shows JR profile (→ Settings) + Routines, CoachGPT, Sign Out. Desktop sidebar items hidden via `.sb-desktop-nav` swap.
- **`.page-spacer` div** at bottom of `.main` — 80px on mobile, **60px on desktop**. Real DOM element (not padding) so the gap is reliably visible.
- **`.main { flex-direction: column; align-items: center; justify-content: flex-start }`** — on BOTH desktop and mobile now (changed from row-direction so .page-spacer stacks below active section instead of becoming a side-by-side flex item).
- **iOS auto-zoom fix** — inputs forced to `font-size: 16px !important`.
- **Viewport lock** — `maximum-scale=1.0, user-scalable=no`.

### Desktop CoachGPT bubble position
Anchored to the bottom-right of the content area:
```css
#coach-bubble { right: max(24px, calc((100vw - 1100px) / 2 - 65px)); bottom: 24px; }
```
The `-65px` offset was tuned visually. Don't change without JR's sign-off.

### Dashboard tile layout
**Desktop (2 rows × 3 cols):** Cal Logged | Net Cal Burned | Weight (lbs) ┃ Steps | Water (oz) | Sleep Score
**Mobile (3 rows × 2 cols):** Cal Logged | Steps ┃ Net Cal Burned | Water (oz) ┃ Weight (lbs) | Sleep Score

### Weight tracking — DAILY model
Weight is tracked **per-day** in `daily_logs.weight` (column added via Supabase migration `add_weight_column_to_daily_logs`). Each day starts blank until logged.

**Dashboard tile behavior:**
- Today's weight logged → shows the number (big, gold) + subscript below the label showing direction vs prior entry (↓ 0.6 lbs in green / ↑ N lbs in orange / same in gray)
- Not logged today → shows `—` with subscript `last: 203 · 2d ago` (pulled from most recent prior day's weight)
- First-ever weigh-in → shows number with no subscript (no prior to compare)

**Weight tile alignment fix (latest session):**
`#dash-bw-sub` (delta subscript) is `position: absolute; bottom: 6px` so it is out of flow. The big number and "WEIGHT (LBS)" label now center vertically exactly like all other tiles regardless of whether the subscript is visible. Tile has `position: relative; padding-bottom: 22px` to reserve room at the bottom.

**Storage split:**
- `daily_logs.weight` = per-date weigh-in (authoritative)
- `user_settings.weight` = latest known value (powers the subscript when today is unset; doesn't overwrite when current input is 0)
- `user_settings.goal_weight` = persistent target (unchanged)

`weightUpdate()` saves cur to BOTH tables. `weightLoad()` no longer pre-fills weight input from localStorage (would pretend yesterday's number was today's). `dbLoadAll()` populates input ONLY if today has a logged weight. `initNewDay()` clears `dash-weight-input` at midnight rollover.

### Macro Progress (Dashboard + Food Log)
- Bars per macro with `current / target · %`
- Status hint below with calorie delta + per-macro deltas
- **Delta numbers are color-coded by macro**: `158g protein` blue, `191g carbs` orange, `3g fat` purple. Only the number portion is colored.
- **Targets auto-sync with today's actual day type** — Wed/Sun → RD targets (2086 cal / 187P / 213C / 55F), other days → TD targets (2227 / 190 / 266 / 47). Driven by `getTodaySplit()`.

### Training Split page
- Weekly rotation: Mon=Pull1, Tue=Push1, Wed=Rest, Thu=Legs, Fri=Pull2, Sat=Push2, Sun=Rest
- Full exercise breakdown per day with notes
- **Bonus Day section**: **Arm Day** (biceps/triceps supersets) — on-demand only, swap in via LOGSPLIT
- **Auto-scroll on expand**: `toggleDay()` calls `scrollIntoView({behavior:'smooth',block:'start'})` on the parent section ~80ms after expansion so day exercises are immediately readable without manual scroll (fixes Arm Day clipping at viewport bottom)

### Apple Fitness / Oura sections (mobile)
- Manual inputs hidden — log via CoachGPT
- Apple Fitness: ring labels + true uncapped percentages
- Oura: top quadrant Total Sleep / Steps / Cal Burned / VO₂ max (22px hero), middle row Deep/REM/Light/Awake, bottom row HRV/Readiness/Bedtime. VO₂ max syncs cross-device via oura blob.

### Food Log — MAJOR REFACTOR
The food log is now MyFitnessPal-style with sections, per-ingredient logging, and a long-press move menu.

**Quick-Add chips** (prescription reference):
- TD: Coffee · Gut Drink · M1 · M2 · M3 · Pre-WO · Intra · Post-WO
- RD: Coffee · Gut Drink · M1 · M2 · M3 · M4 · M5
- Tap a chip → expands to per-ingredient entries (e.g. M1 chip → 5 rows: eggs, whites, spinach, rice, blueberries), all tagged with section + planRef
- `flAddMeal(mealId, dayType)` does the expansion + batch save/render
- `flAddExtra(extraId, dayType)` handles Coffee/Gut Drink (single entry, optional water)

**Section grouping** (Today's Log, in order):
- 🍳 Breakfast (m1) · 🥗 Lunch (m2) · 🍱 Midday (m3) · 💪 Pre-Workout (m4 on TD) · ⚡ Intra-Workout (intra, TD only) · 🥩 Post-Workout (m5 on TD) · 🍿 Snacks (always visible, even when empty)
- On RD: m4 reskins to **🥑 Afternoon**, m5 reskins to **🌙 Dinner**, intra section omitted from order
- Each section header shows its own cal/P/C/F totals
- Empty sections render `No items logged yet` (faded italic)
- Section labels resolved by `flSectionLabel(sectionId, dayType)`

**Plan-reference pill**:
- Items logged via meal chips get a small green `M1` (or M2, Pre-WO, etc.) pill **leading** the food name
- Pill is the chip's label, stored as `entry.planRef`
- Custom adds / CoachGPT-logged items / Coffee / Gut Drink have NO pill
- planRef is fixed origin metadata — moving an item between sections doesn't change the pill

**Long-press → Move to menu**:
- Touch and hold a food row for ~500ms → popup menu appears with all sections (current section marked ✓)
- Tap a section → row moves instantly, totals recompute
- Right-click on desktop opens the same menu
- Cancels on scroll / drag / outside-click / Escape
- Implementation: delegated pointer listeners on the parent list; row gets `.lp-active` class while pressed

**Section auto-classification**:
- `flClassifyByTime()` — fallback for CoachGPT/AI-input entries: 5-10am→m1, 10am-1pm→m2, 1pm-4pm→m3, 4pm-7pm→m4, 7pm-10pm→m5, else→snack
- `flClassifyByName(name)` — name-pattern fallback: "Meal 1" / "Breakfast" → m1, "Pre Workout" → m4, etc.
- `flBackfillSections()` — one-time pass over flDateStore to assign `section` to any pre-section entries (legacy data cleanup, idempotent)

**Edit modal** gains a **Section dropdown** so you can manually reassign a row without long-press.

### Intelligence Hub (the side-panel CoachGPT tab) — SHIPPED
The `CoachGPT` sidebar tab (`#coach` section, formerly the "AI Daily Brief") is now a **trend/intelligence hub**. Floating bubble = day-to-day quick logging; this tab = long-term analysis.

**Layout** — height-locked two-pane shell (`.hub-shell`):
- Desktop: `height: calc((100vh / 1.1) - 92px)` (inside `@media (min-width:601px)` — respects the body-zoom compensation). Left rail (`.hub-rail`) scrolls internally; chat column (`.hub-chat`) is full-height with the input **pinned at the bottom** (fixed the old chat-input cutoff). `.main > #coach` widened to 1180px.
- Mobile (`≤600px`): stacks, chat = `72vh`.
- All existing `brief-*` element IDs were kept so `briefRefreshAll()` still works. Title is now static "Intelligence Hub"; greeting/date moved into the subtitle line.

**Rail card order:** Coach says (top, per JR) → Projection → Weight + Projected-fat (grid2) → Nutrition + Sleep (grid2) → Training adherence → Yesterday → Today priority actions+numbers → split → Day-by-day log → Refresh.

**Net-calorie projection model** (`hubAggregate`): per logged day `net = intake − burn`; cumulative deficit / 3500 = projected lbs; projected weight vs actual weight + ahead/behind variance. "Projected fat change" sparkline is the cumulative-net curve. This is the "fat trend" JR wanted — **derived from net calories, NOT body-fat %**.

**Burn priority (`hubDayMetrics`):** real Oura cal-exp > manual backfill (`daily_logs.cal_exp_manual`) > editable maintenance estimate (`HUB_MAINT_FALLBACK`, default 2600, persisted to `user_settings.maint_cal`, editable inline on the Projection card via `hubSetMaint`). `burnSrc` = `oura|manual|est`.

**Past-day calorie-burn backfill (option A):** tap any row in the **Day-by-day log** → inline input (`hubEditBurn`/`hubSaveBurn`/`hubCancelBurn`, state in `hubEditKey`) → writes `daily_logs.cal_exp_manual` for that exact date via `dbSaveDay` (upsert, **never touches the `oura` jsonb blob**). Recomputes projection live. Solves the "trained past midnight, Oura missed the day" problem. **Conversational backfill ("set May 14 burn to 2900") is option C — PARKED, next pass, same storage.**

**Range toggle** `7 / 30 / 90 Days` (`HUB_RANGE`, `hubSetRange`) drives both the cards and the chat context.

**Trend-aware chat:** `coachSystemPrompt(ctx, withHistory)` — when `withHistory` is true it appends `historicalContextText(HUB_RANGE)` (compact one-line-per-day + aggregate + projection). **Only `briefChatSend` passes `true`** (line ~3989). Floating bubble (`csSend`) and main chat stay today-only per design. Quick chips: Weight trend / Macro trend / Fat-loss check / Compare / Yesterday.

`renderHub()` is called at the end of `briefRefreshAll()`. Sparklines are inline SVG (`hubSpark`), no library.

### CoachGPT
- Floating bubble (desktop bottom-right anchored to content, mobile bottom-right beside dock)
- Chat sheet expands when bubble tapped
- **System prompt** is dynamic — includes today's logged data + full meal plan via `mpPromptText()` + training split details + LOG action instructions + section rules
- **Side-panel chat additionally gets historical context** — see Intelligence Hub above (`coachSystemPrompt(ctx, true)`)

#### LOG actions CoachGPT can emit
- `LOGFOOD:{name,cal,p,c,f,servings,section}` — adds to food log. **`section` field is required** (Claude picks per rules: explicit slot mentioned > meal-plan match > time-of-day fallback). Shows "Ready to log" confirmation card.
- `LOGEDIT:{match,name?,cal,p,c,f}` — edits an existing entry. Routes to: not-found message (0 matches), confirm card with Before→After diff (1 match), or picker (2+ matches). All require explicit confirmation.
- `LOGWATER`, `LOGSTEPS`, `LOGCALBURN`, `LOGMOVE`, `LOGEXERCISE`, `LOGSTAND`, `LOGSLEEP`
- `LOGSPLIT` — change today's training day. Valid: `Push Day 1`, `Push Day 2`, `Pull Day 1`, `Pull Day 2`, `Legs`, `Rest`, **`Arm Day`** (bonus)
- `LOGWEIGHT`, `LOGOURA`, `CLEARDAY`
- `_normalizeLogActions` strips whitespace between action name and `{`. `stripActionTags` strips ALL log tags from text (used before pushing to chat history).

#### CoachGPT anti-spam (CRITICAL — root-cause-fixed)
- **`csHistory` / `coachHistory` / `briefChatHistory` store STRIPPED reply** — `stripActionTags(reply)` removes all LOG tags before pushing to in-memory history.
- **`dbSaveChatMsg('floating'/'main'/'brief', 'assistant', ...)` saves STRIPPED text** — never `displayText || reply` fallback (that leaked raw replies with LOG tags back to DB).
- **`restoreChatSurfaces()` sanitizes on load** — runs `sanitizeHistory()` over loaded `chat_history` rows so legacy entries (saved before the strip-on-save fix) get cleaned up automatically.
- **App-side dedup** for "Ready to log" cards — if a pending card with the same foods (matched on name+cal+p+c+f+servings) already exists, skip duplicate render.
- **System prompt explicitly forbids re-emission**: once Claude emits LOGFOOD, do NOT re-emit on subsequent turns unless user explicitly mentions that food again.

### Cross-device sync — fixed
The 600ms debounce on `dbSaveDay` / `dbSaveSettings` used to lose updates when switching apps/devices (mobile Safari pauses JS timers when tab loses focus). Fixed via:
- **`_dbPending` payload merging**: successive calls to `dbSaveDay(key, fields)` now `Object.assign` into a shared pending payload instead of overwriting. Multiple updates batch into one upsert with all fields preserved.
- **`flushPendingDbSaves()`** fires every pending payload immediately. Wired to:
  - `document.addEventListener('visibilitychange', ...)` (hidden state)
  - `window.addEventListener('pagehide', ...)`
  - `window.addEventListener('beforeunload', ...)`
- So the moment you switch apps or close the tab, queued saves flush to Supabase before the timer can pause.

### Sync + persistence
- **Supabase tables**: `daily_logs` (date-keyed; `weight numeric`, **`cal_exp_manual numeric`** = manual burn backfill), `user_settings` (+ **`maint_cal integer`** = editable maintenance estimate), `chat_history`
  - Migration `add_cal_exp_manual_and_maint_cal` applied to the live DB. Both columns nullable/additive — older app versions ignore them.
- **`_lastOuraBlob`** in-memory cache. `ouraUpdate()` merges new non-zero values onto it before saving.
- **Oura sync** — Netlify proxy, uses client local date
- **localStorage** mirrors most state. `jr_fl_v2` stores the food log + flDateStore.

---

## Architecture decisions worth knowing

### `MEAL_PLAN` — single source of truth for the meal plan
**Defined near line 1581.** One JS object with `td` and `rd` variants. Each meal has badge, title, titleNote, total macros, items[] (with name, brand, longevity flag, tag, per-item macros), and `chip` metadata (emoji, label, logName).

**Consumers:**
1. `mpRenderDay(day)` — builds Meal Plans page HTML
2. `mpPromptText()` — builds the meal-plan text for CoachGPT's system prompt
3. `flRenderChips()` — populates food log quick-add chips
4. `flAddMeal(mealId, dayType)` — expands a meal into per-ingredient food log entries

Update `MEAL_PLAN` once and everything updates. **Template for future refactors** (training, routines, rules pages).

### `SPLIT_INFO` — same pattern for training splits
Already a single source of truth. Drives dashboard training card + LOGSPLIT validation. Full per-exercise notes still live in the Training Split page HTML — future refactor target.

### Food log entry shape
```js
{
  name: "2 large eggs",
  cal: 140, p: 12, c: 0, f: 10,
  servings: 1,                      // 1-10, stepper +/- mutates
  section: "m1",                    // m1, m2, m3, m4, intra, m5, snack
  planRef: "M1",                    // optional — only present when logged via meal chip
  brand: "Kirkland"                 // optional — copied from MEAL_PLAN.items
}
```

### Day-type sync logic
- `dashRefresh()` uses `flTargets[getTodaySplit() === 'Rest' ? 'rd' : 'td']` — dashboard targets always reflect today's actual day
- `flGetDayData(d)` re-derives `split` + `dayType` from `getTodaySplit()` when `d === today` — food log targets stay correct even with stale DB rows
- `flRender()` + `dashRefresh()` triggered after LOGSPLIT so macros refresh immediately on day-type change

### Activity field chokepoints
All writes to `steps`, `calExp`, `move`, `exercise`, `stand` go through `setSteps` / `setCalExp` / `setMove` / `setExercise` / `setStand`. Enforces date guard, source priority (`user/logaction (3) > oura (2) > apple (1)`), monotonic guard for cumulative values.

### `initNewDay()` (clean-slate function)
- Called on page load AND every 60s by midnight rollover watcher
- Resets all daily state, calls render functions
- Clears `dash-weight-input` (weight is now per-day, fresh entry expected daily)

### Mobile breakpoint = 600px
- All mobile-only rules inside `@media (max-width: 600px)`

---

## Open items / parked features

> **Pick any of these to start next session.** Just tell Claude which number(s) you want to work on.

### ✅ DONE — shipped (commit `8f58a91`)

**0. CoachGPT historical/trend analysis (the "brain" tab)** — SHIPPED as the **Intelligence Hub** (see Current State). Includes: history injection (side-panel only), `7/30/90` range toggle, quick-prompt chips, weight/fat/macro/sleep sparklines, net-calorie projection, editable maintenance, and **past-day burn backfill option A** (tap a day-by-day row).

### 🔥 Top priority

**0b. Conversational past-day burn backfill (option C)**
Let CoachGPT handle "set my calorie burn for May 14 to 2900" → write `daily_logs.cal_exp_manual` for that date. Storage already exists (column + `dbSaveDay`); needs a new LOG action (e.g. `LOGCALBURNDATE:{date,cal}`) since existing `LOGCALBURN` is today-only. Small.

---

### 🟡 Medium priority

**1. Voice input for CoachGPT** — Web Speech API. 🎤 button, long-press to record, auto-fills textarea. Mobile-first but works on desktop too.

**2. Photo/screenshot upload in CoachGPT** — `<input type="file" accept="image/*">` → base64 → Claude vision API → extract Oura/Apple Fitness numbers → fire LOG actions automatically. Also useful for snapping a nutrition label.

**3. Meal completion badges** — auto-detect "M1: 5/5 ✓" by counting `planRef='M1'` entries vs `MEAL_PLAN.td.m1.items` in today's log. Green checkmark on the chip after full meal is logged.

**4. PWA install + home-screen icon** — `manifest.json` + service worker. Push notifications. iOS 16.4+ supports PWA push.

**5. Streaks / habit tracking** — "12 days hitting protein target" badge. Could live on Dashboard or Routines page.

---

### 🔵 Bigger lifts (future sessions)

**6. Date swipe navigation on dashboard** — Oura-style horizontal swipe to view past days. Big lift (requires `dashRefresh(date)` parameterization throughout).

**7. Camera meal logging** — mobile-only "📸 Snap meal" → Claude vision → estimated macros → confirm card UI.

**8. Drag-and-drop food log rows** — currently long-press → move menu. Drag would be more visceral. Mobile scroll-vs-drag conflicts need careful handling.

**9. More single-source-of-truth refactors** — same `MEAL_PLAN` pattern for:
   - Training Split page exercise details (currently hardcoded HTML, partial overlap with `SPLIT_INFO`)
   - Routines (morning + nightly tasks)
   - Rules / Longevity / Creed / Insights pages

---

## Recent commit history (most recent first)

| SHA | Description |
|---|---|
| `8f58a91` | Merge: CoachGPT Intelligence Hub — historical trends + net-calorie projection + past-day burn backfill |
| `1d3bb77` | CoachGPT → Intelligence Hub: trend analysis, projection, editable maintenance, tap-to-backfill |
| `4063ebf` | Update CONTEXT.md after session: weight tile alignment + queue cleanup |
| `6bfac85` | Merge: weight tile absolute-position delta subscript (alignment fix) |
| `2c22f53` | Weight tile: absolute-position delta subscript so number+label stay centered |
| `41bcea9` | Merge: weight delta below label |
| `a0280db` | Weight tile: move delta subscript below the WEIGHT (LBS) label |
| `9d48735` | Merge: simplify weight delta subscript |
| `c90d651` | Weight tile: simplify delta subscript to just direction + lbs |
| `3da475e` | Merge: center dash-tile-val content |
| `9f463bc` | Dashboard tiles: center .dash-tile-val content (fixes off-center weight number) |
| `545f385` | Weight tile: center the delta subscript (was left-aligned + wrapping) |
| `ca1c81f` | CoachGPT: kill re-emitting log card (sanitize history at SEND time) + X dismiss |
| `3cd472e` | Weight tile: add delta subscript (↓ X lbs from yesterday) |
| `24e8a01` | Desktop: page-spacer 100 → 60px |
| `e213b25` | Desktop: tighten page-spacer 160 → 100px |
| `2874338` | Desktop: real .page-spacer element at bottom of every page |
| `5edaab0` | Training Split: auto-scroll expanded day into view |
| `4f216be` | Food Log: always show Snacks section |
| `8056ffe` | Food Log: plan-ref pill leads the row (M1 before food name) |
| `0b61b13` | Food Log: M1/M2/M3 chip labels + emoji section headers + long-press move menu |
| `f722c49` | Food Log: MyFitnessPal-style section grouping + per-ingredient chip expansion |
| `d40f20b` | Weight: switch to daily tracking model |
| `7476ef1` | Cross-device sync: flush pending DB saves on app blur/close + merge fields |
| `6d0c07f` | CoachGPT: kill LOG re-emission for real (DB persistence path was leaking) |
| `5bea067` | CoachGPT: LOGEDIT action — edit existing food log entries via chat |
| `5faa365` | Refactor: meal plan as single source of truth (MEAL_PLAN data object) |

To revert any specific commit: `git revert <sha>` then `git push origin main`. Netlify auto-deploys within ~1-2 min.

---

## Things to know that might bite next session

- **Repo is PUBLIC** — Supabase anon keys hardcoded but publishable-tier, protected by RLS. JR is OK with this.
- **Multi-machine workflow**: always `git pull` before starting work when switching between MacBook Air and MacBook Pro. Both machines have GitHub auth set up.
- **`LOGOURA` does not handle `steps` or `calexp`** — those go through `LOGSTEPS`/`LOGCALBURN` with their own guards. Don't add them to LOGOURA.
- **`LOGEDIT` only edits TODAY's log** — uses `flGetDayData(new Date())`. If editing past dates becomes a use case, parameterize this.
- **Desktop body zoom + body height compensation is fragile** — if you ever change `body { zoom: 1.1 }`, also update `body { height: calc(100vh / 1.1) }` to match. Currently in `@media (min-width: 601px)`.
- **`.main` is flex-column on BOTH desktop and mobile now** — adding sibling elements to `.main` will stack them vertically. Don't add display:flex children that expect row direction.
- **`.page-spacer` heights differ by viewport**: desktop 60px (global), mobile 80px (override via media query).
- **MEAL_PLAN edits propagate everywhere** — but they DON'T affect already-logged data. Logging history is in `daily_logs.food_log` (separate from the plan).
- **Daily weight is on a brand-new column** — `daily_logs.weight` (numeric, nullable). Older rows have NULL there; the dashboard subscript fallback uses `user_settings.weight` (last known).
- **Long-press handler is delegated** — attached once via `flInitLongPress()`, survives re-renders. Don't attach per-row.
- **Intelligence Hub desktop height** is `calc((100vh / 1.1) - 92px)` — the `92px` is eyeballed. If the rail/chat shows a double scrollbar or clips, nudge that number (in the `@media (min-width:601px)` block of the hub CSS). Coupled to body-zoom like everything else.
- **Hub burn priority is manual > Oura > estimate** — an explicit hand-entered `cal_exp_manual` ALWAYS wins, even on a day Oura has a value (matches the app's user/logaction > oura precedence). Leaving the field blank clears the manual value and reverts to Oura. (Was Oura-first initially; changed because a manual edit not taking effect read as a bug.)
- **`cal_exp_manual` is a dedicated column, never written into the `oura` jsonb blob** — that was the whole point (avoids clobbering deep/REM/HRV for past days). Keep it that way.
- **`historicalContextText` is side-panel only** — `coachSystemPrompt(ctx, true)` is passed ONLY by `briefChatSend`. Don't add `true` to `csSend` (floating) or the main chat call without a reason; it inflates every quick-log prompt.
- **Hub reads `flDateStore`** which `dbLoadAll` populates from ALL `daily_logs` rows (incl. new `calExpManual`). For today it overrides weight/calExp/sleep from live inputs but intake comes from the store (kept in sync by `flAdd`).
- **Chat history strip-on-load is one-shot sanitization** — `sanitizeHistory()` cleans loaded entries but doesn't write back to DB. The next time the user sends a message, the new flow saves clean. So legacy DB rows stay raw forever (harmless — they're sanitized in memory on every load).

---

## End-of-session ritual

When JR says "wrap up" / "let's call it" / equivalent:

1. Confirm all code changes are pushed to `origin/main`
2. **Update this doc** with whatever is now true
3. Commit: `Update CONTEXT.md after session: [brief topic]`
4. Push

Next session anywhere on any device picks up by reading this file.
