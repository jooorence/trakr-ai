# TRAKR — Session Context

**Project**: TRAKR — single-user personal health dashboard for JR, deployed at [trakros.com](https://trakros.com).
**Stack**: single-file `index.html` (~4800 lines), Supabase (Postgres + Auth) for persistence, Netlify Functions (`netlify/functions/`) as backend proxies for Oura OAuth + Claude/Anthropic API.
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
6. **Single source of truth pattern**: where the same data is referenced in multiple places (UI + system prompt + helper handlers), put it in ONE JS object and have everything read from it. See `MEAL_PLAN` for the template.

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
**Body height compensation**: `body { height: calc(100vh / 1.1) }` so zoomed body fits viewport exactly (otherwise body renders 110vh and clips bottom content).

### Mobile dashboard (≤600px viewport)
- **Sidebar hidden**, replaced by bottom dock + hamburger top-left
- **Bottom dock** — translucent rounded pill (liquid-glass style), 64px tall, fixed bottom. Four line-icon nav items: **Home / Food / Train / Meals**. **Floats over content** (content visible through glass blur).
- **CoachGPT bubble** — floating circle, teal, pinned bottom-right beside dock.
- **Hamburger** — top-left. Opens slide-out drawer.
- **Drawer content** (mobile only, NOT dock duplicates): JR Pagdanganan profile card (tap → Settings), Routines, CoachGPT, Sign Out. Desktop sidebar nav hidden via `.sb-desktop-nav` class swap.
- **`.page-spacer` div** at bottom of `.main` — 80px empty section gives scroll clearance past the floating dock. Hidden on desktop.
- **`.main { flex-direction: column; align-items: center; justify-content: flex-start }`** on mobile — required for page-spacer to stack below content (not beside it) and for pages to load at the top (not vertically centered).
- **iOS auto-zoom fix** — all mobile inputs forced to `font-size: 16px !important`.
- **Viewport lock** — `maximum-scale=1.0, user-scalable=no`.

### Desktop CoachGPT bubble position
Anchored to the bottom-right of the content area with a calibrated formula:
```css
#coach-bubble { right: max(24px, calc((100vw - 1100px) / 2 - 65px)); bottom: 24px; }
```
The `-65px` offset was tuned visually (iterated through -40, -90, -75, -120, -200 with JR before landing on -65). Don't change this without his sign-off.

### Dashboard tile layout
**Desktop (2 rows × 3 cols):**
- Row 1: Cal Logged | Net Cal Burned | Weight (lbs)
- Row 2: Steps | Water (oz) | Sleep Score

**Mobile (3 rows × 2 cols):**
- Row 1: Cal Logged | Steps
- Row 2: Net Cal Burned | Water (oz)
- Row 3: Weight (lbs) | Sleep Score

### Macro Progress (Dashboard + Food Log)
- Bars per macro with `current / target · %`
- Status hint below shows calorie delta + per-macro deltas
- **Delta numbers are color-coded by macro**: `158g protein` blue (#5aabff), `191g carbs` orange (#f5a623), `3g fat` purple (#a07dd9). Only the number portion is colored; the macro name stays gray.
- **Targets auto-sync with today's actual day type** — Wed/Sun → RD targets (2086 cal / 187P / 213C / 55F), other days → TD targets (2227 / 190 / 266 / 47). Driven by `getTodaySplit()`.

### Training Split page
- Weekly rotation: Mon=Pull1, Tue=Push1, Wed=Rest, Thu=Legs, Fri=Pull2, Sat=Push2, Sun=Rest
- Full exercise breakdown per day with notes
- **New "Bonus Day" section** below the rotation: **Arm Day** (biceps/triceps supersets) — not in weekly rotation, swap in via LOGSPLIT only

### `SPLIT_INFO` — central registry of training splits
6 weekly splits + 1 bonus:
- `Pull Day 1`, `Push Day 1`, `Legs`, `Pull Day 2`, `Push Day 2` (focus + topLifts)
- `Rest` (focus only, no lifts)
- `Arm Day` (bonus, on-demand): focus `Arms — Bi/Tri Supersets`, 4 working supersets:
  1. Alt. DB Curls + Lying Skull Crushers — 3 × 8–10
  2. Barbell Curls + DB Skull Crushers — 3 × 8–10
  3. Preacher Curl 1-arm + Bent-Over Tri Ext — 3 × 10–12
  4. Cable Curls + Tricep Pulldowns — 3 × 12–15

### Apple Fitness section (mobile)
- Manual input fields hidden — log via CoachGPT
- Ring labels + percentages at readable sizes, true uncapped percentage shown

### Oura Ring section (mobile)
- **Top quadrant**: Total Sleep / Steps / Cal Burned / VO₂ max (22px hero numbers)
- **Middle row**: Deep / REM / Light / Awake (Awake = total − deep − rem − light)
- **Bottom row**: HRV / Readiness / Bedtime
- All input fields hidden on mobile (CoachGPT logs data)
- VO₂ max syncs cross-device via oura blob

### Food Log
- **Date navigation** — left/right arrows + calendar picker
- **Day type auto-syncs** for today: `flGetDayData()` re-derives `split` and `dayType` from `getTodaySplit()` whenever the requested date is today. Stale DB rows can't lock in wrong macros. Other dates keep stored values.
- **Daily Status row** (4 boxes): Calories | Protein | Carbs | Fat — actual logged values, neutral dark background, white numbers
- **Macro card with pie chart**: bars + pie + macro key (P/C/F dots)
- **Slim water strip**: icon + oz + bar + buttons (compact)
- **Trak Your Food hero card**: green-tinted, AI input + emoji quick-add chips
- **Allows duplicates**, **servings stepper** per row, **edit modal** with pencil icon

### Meal Plans page
- **TD / RD tabs** switch between training day and rest day plans
- **Daily macro card** at top (Protein/Carbs/Fat/Calories — pulled from `MEAL_PLAN[day].daily`)
- **Meal cards** with foods, brands, longevity tags, banana tags, per-item macros, totals
- **Rendered from `MEAL_PLAN`** (data object) via `mpRenderDay()` — no longer hardcoded HTML

### CoachGPT
- Floating bubble (desktop bottom-right beside content, mobile bottom-right beside dock)
- Chat sheet expands when bubble tapped
- **System prompt is dynamic** — includes today's logged data + full meal plan (via `mpPromptText()`) + training split details + LOG action instructions
- Knows JR's full meal plan now (every food, brand, portion, per-item macros) — can answer "what's in Meal 4?" with specifics

#### LOG actions CoachGPT can emit:
- `LOGFOOD:{name,cal,p,c,f,servings}` — adds to food log, shows "Ready to log" confirmation card
- `LOGEDIT:{match,name?,cal,p,c,f}` — **NEW**: edits an existing food log entry. Routes to: not-found message (0 matches), confirm card with Before→After diff (1 match), or picker (2+ matches). All require explicit confirmation.
- `LOGWATER`, `LOGSTEPS`, `LOGCALBURN`, `LOGMOVE`, `LOGEXERCISE`, `LOGSTAND`, `LOGSLEEP`
- `LOGSPLIT` — change today's training day. Valid: `Push Day 1`, `Push Day 2`, `Pull Day 1`, `Pull Day 2`, `Legs`, `Rest`, **`Arm Day`** (bonus on-demand)
- `LOGWEIGHT`, `LOGOURA`, `CLEARDAY`
- `_normalizeLogActions` strips whitespace between action name and `{`

#### CoachGPT anti-spam (critical)
- **`csHistory` / `coachHistory` store STRIPPED reply** — `stripActionTags(reply)` removes all LOG tags before pushing to history. Otherwise Claude sees its own past LOG actions on subsequent turns and re-emits them.
- **`stripActionTags` regex now includes `LOGEDIT`**
- **App-side dedup** for "Ready to log" cards — if a pending card with the same foods (matched on name+cal+p+c+f+servings) already exists, skip rendering a duplicate.
- **System prompt explicitly forbids re-emission**: "Once you emit LOGFOOD in a response, that action is now pending. Do NOT re-emit the same LOGFOOD in any subsequent reply unless the user explicitly mentions that food again."

### Sync + persistence
- **Supabase** — `daily_logs` (date-keyed), `user_settings`, `chat_history`
- **`_lastOuraBlob`** — in-memory cache. `ouraUpdate()` merges new non-zero values onto it before saving (cross-device safety).
- **Oura sync** — Netlify proxy, uses client local date
- **localStorage** mirrors most state

---

## Architecture decisions worth knowing

### `MEAL_PLAN` — single source of truth for the meal plan
**Defined near line 1581.** One JS object with `td` and `rd` variants. Each meal has badge, title, titleNote, total macros, items[] (with name, brand, longevity flag, tag, per-item macros), and `chip` metadata (emoji, label, logName) for food log chips.

**Three consumers read from it:**
1. `mpRenderDay(day)` — builds Meal Plans page HTML
2. `mpPromptText()` — builds the meal-plan text for CoachGPT's system prompt
3. `flRenderChips()` — populates food log quick-add chips

Update `MEAL_PLAN` once and all three update automatically. **This is the pattern to follow for future refactors** (training, routines, rules, etc.).

### `SPLIT_INFO` — same pattern for training splits
Already a single source of truth. Drives dashboard training card + LOGSPLIT validation. Full per-exercise notes still live in the Training Split page HTML — future refactor target.

### Day-type sync logic
- `dashRefresh()` uses `flTargets[getTodaySplit() === 'Rest' ? 'rd' : 'td']` — dashboard macro targets always reflect today's actual day
- `flGetDayData(d)` re-derives `split` + `dayType` from `getTodaySplit()` when `d === today` — food log targets stay correct even with stale DB rows
- `flRender()` + `dashRefresh()` triggered after LOGSPLIT so macros refresh immediately on day-type change (not just after manual UI button)

### Activity field chokepoints
All writes to `steps`, `calExp`, `move`, `exercise`, `stand` go through `setSteps`, `setCalExp`, `setMove`, `setExercise`, `setStand`. They enforce:
- **Date guard**: writes for non-today date are silently dropped
- **Source priority**: `user/logaction (3) > oura (2) > apple (1)`
- **Monotonic guard**: Oura can't overwrite a higher cumulative value with a lower one
- **`_activitySources` map** tracks which source last wrote each field

### `initNewDay()` (clean-slate function)
- Called on page load AND every 60s by midnight rollover watcher
- Resets all daily state, calls render functions
- Also calls `flRenderChips()` on init (chips need MEAL_PLAN-driven render)

### `ouraUpdate()` save guard
- Won't save when ALL numeric fields are zero/empty (prevents `initNewDay` clearing → save zeros → wipe race)
- Merges onto `_lastOuraBlob` before saving (cross-device safety)

### Mobile breakpoint = 600px
- Single source of truth for "is this mobile"
- All mobile-only rules inside `@media (max-width: 600px)`

---

## Open items / parked features

1. **Voice input for CoachGPT** — Web Speech API (built into Safari/Chrome). Add 🎤 button, long-press to record, transcribe, fill textarea.
2. **Photo/screenshot upload in CoachGPT** — `<input type="file" accept="image/*">` → base64 → Claude vision API → extract Oura/Apple Fitness numbers → fire LOGOURA + other LOG actions automatically.
3. **Date swipe navigation on dashboard** — Oura-style horizontal carousel. Big lift (requires `dashRefresh(date)` parameterization).
4. **More single-source-of-truth refactors** — same pattern as `MEAL_PLAN`:
   - Training Split page exercise details (currently hardcoded HTML, partial overlap with `SPLIT_INFO`)
   - Routines (morning + nightly tasks)
   - Rules / Longevity / Creed / Insights pages (static principle pages)
5. **PWA install + home-screen icon** — manifest + service worker. Full-screen native feel, enables push notifications.
6. **Push notifications via PWA** — iOS 16.4+ supports PWA push.
7. **`vo2_max` Supabase migration** — currently in oura blob. Add `vo2_max numeric` column → flip `vo2Update()` to use `dbSaveSettings`.
8. **Streaks / habit tracking** — "12 days hitting protein target" badge.
9. **Camera meal logging** — mobile-only "📸 Snap meal" → Claude vision → estimated macros → confirm UI.

---

## Recent commit history (most recent first)

| SHA | Description |
|---|---|
| `acb3d94` | CoachGPT: LOGEDIT action — edit existing food log entries via chat |
| `5faa365` | Refactor: meal plan as single source of truth (MEAL_PLAN data object) |
| `ec02aa4` | CoachGPT: expose full meal plan (foods, brands, portions) in system prompt |
| `693b95f` | CoachGPT: fix root cause of duplicate LOG re-emissions (strip from history) |
| `b705eb5` | Arm Day: bonus on-demand split for biceps/triceps supersets |
| `69b9c9f` | CoachGPT: prevent duplicate food confirmation cards (system prompt + dedup) |
| `8977490` | LOGSPLIT: trigger flRender + dashRefresh so macros update on day change |
| `b952b6b` | Food Log: today's split + dayType always reflect actual day |
| `bac37ef` | Dashboard: auto-pick TD vs RD macro targets from today's split |
| `458c0b6` | Mobile: spacer 120 → 80px |
| `0de32d7` | Mobile: start scroll from top + reduce spacer to 120px |
| `b6d2def` | Mobile: stack .main children vertically so spacer goes below content |
| `5b5fd4b` | Mobile: empty bottom spacer for extra scroll room past floating dock |
| `dd53b2d` | Mobile: revert to floating dock (no black strip) |
| `f8588a5` | Desktop bubble: -65 offset (final iteration) |
| `2aad549` | Desktop: fix bubble corner + bottom scroll clipping (body height compensation) |
| `e7b1a96` | Macro status: color-code each macro's delta number |
| `782a786` | Desktop: bump .main bottom padding so last items clear CoachGPT bubble |
| `bebb122` | Mobile drawer rework: profile at top, dock dupes removed, Sign Out added |

To revert any specific commit: `git revert <sha>` then `git push origin main`. Netlify auto-deploys within ~1-2 min.

---

## Things to know that might bite next session

- **Repo is PUBLIC** — Supabase anon keys hardcoded but publishable-tier, protected by RLS. JR is OK with this.
- **`Fitness and Health Apps Unified Landscape Memo.md`** — untracked file in repo root. Personal note, not committed.
- **Multi-machine workflow**: always `git pull` before starting work when switching between MacBook Air and MacBook Pro. Both machines now have GitHub auth set up (Air uses `gh` CLI via Homebrew, configured this session).
- **`LOGOURA` does not handle `steps` or `calexp`** — those go through `LOGSTEPS`/`LOGCALBURN` with their own guards. Don't add them to LOGOURA.
- **`LOGEDIT` only edits TODAY's log** — uses `flGetDayData(new Date())`. If editing past dates becomes a use case, parameterize this.
- **Desktop body zoom + body height compensation is fragile** — if you ever change `body { zoom: 1.1 }` to a different value, also update `body { height: calc(100vh / 1.1) }` to match (otherwise content gets clipped). Currently in `@media (min-width: 601px)`.
- **MEAL_PLAN edits propagate everywhere automatically** — but they DON'T affect already-logged data. Logging history is in `daily_logs` (Supabase), separate from the plan.
- **CoachGPT chat history persists** — if duplicate cards reappear, may be stale history from before the dedup fix. User refresh clears.

---

## End-of-session ritual

When JR says "wrap up" / "let's call it" / equivalent:

1. Confirm all code changes are pushed to `origin/main`
2. **Update this doc** with whatever is now true: new shipped features, new architecture decisions, new open items, latest commit SHAs
3. Commit: `Update CONTEXT.md after session: [brief topic]`
4. Push

Next session anywhere on any device picks up by reading this file.
