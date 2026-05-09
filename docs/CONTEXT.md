# TRAKR — Session Context

**Project**: TRAKR — single-user personal health dashboard for JR, deployed at [trakros.com](https://trakros.com).
**Stack**: single-file `index.html` (~4500 lines), Supabase (Postgres + Auth) for persistence, Netlify Functions (`netlify/functions/`) as backend proxies for Oura OAuth + Claude/Anthropic API.
**Repo**: [github.com/jooorence/trakr-ai](https://github.com/jooorence/trakr-ai)

This document is the **handoff between Claude sessions**. It is overwritten at the end of each session with the latest state. Git history preserves prior versions.

---

## How to use this doc

If you're a Claude reading this at the start of a new session: read carefully, then **summarize back to JR** what you understand (current state, key rules, open items). Wait for him to confirm before doing any work.

JR's start-of-session prompt looks like this:

> *I'm continuing work on TRAKR. Repo at github.com/jooorence/trakr-ai. Read `docs/CONTEXT.md` before doing anything else. After reading, summarize back to me what you understood so I can confirm we're aligned. Then I'll tell you which open item we're tackling.*

---

## Workflow rules (non-negotiable)

1. **Push only on explicit "push it"** (or equivalent: "go ahead and push", "ship it"). Never push without an explicit instruction.
2. **Mobile changes are scoped inside `@media (max-width: 600px)`.** The desktop layout must not be modified by mobile rules. Mobile rules either live inside that media block, or are CSS classes that default to `display: none` and only get flipped on inside the block.
3. **Personal app, single user (JR himself).** Decisions favor JR's specific workflow. Hard-code his preferences, don't add multi-user features.
4. **No mockup-pushing.** Mockups live in `/tmp/trakr_preview/` and never get committed.
5. **Git workflow**: commit directly on `main` (or via worktree → `--no-ff` merge → push). Always push to `origin/main`. Pull before starting any session if switching machines.

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
Desktop body has `zoom: 1.1` applied via `@media (min-width: 601px)` — everything 10% larger by default.

### Mobile dashboard (≤600px viewport)
- **Sidebar hidden**, replaced by bottom dock + hamburger top-left
- **Bottom dock** — translucent rounded pill (liquid-glass style), 64px tall, fixed bottom. Four line-icon nav items: **Home / Food / Train / Meals**.
- **CoachGPT bubble** — floating circle, teal, pinned bottom-right beside dock.
- **Hamburger** — top-left. Opens slide-out drawer.
- **iOS auto-zoom fix** — all mobile inputs forced to `font-size: 16px !important` (beats inline styles).
- **Viewport lock** — `maximum-scale=1.0, user-scalable=no` in meta tag.
- **CoachGPT dock highlight fix** — `body.cs-open` class suppresses active dock item color while CoachGPT sheet is open.
- **Portrait lock** — landscape warning overlay shows when phone is in landscape at low height.

### Dashboard tile layout
**Desktop (2 rows × 3 cols):**
- Row 1: Cal Logged | Net Cal Burned | Weight (lbs)
- Row 2: Steps | Water (oz) | Sleep Score

**Mobile (3 rows × 2 cols):**
- Row 1: Cal Logged | Steps
- Row 2: Net Cal Burned | Water (oz)
- Row 3: Weight (lbs) | Sleep Score

CSS `order` overrides inside `@media (min-width: 601px)` handle the desktop reorder; DOM order drives mobile naturally.

### Mobile typography spec (settled)
| Element | Size |
|---|---|
| Tile hero numbers | **22px** |
| Pull Day title | **22px** |
| Body text | **14px** |
| Top-set reps + macro values | **13px** |
| Tile labels | **11px** |
| Section labels | **11px** small caps |

### Dashboard structure
- **Top tiles** (see layout above)
- **Training card** (left half desktop, full-width mobile): training name + focus, Today's Lifts, Expenditure, Longevity sections
- **Macro Progress** strip: color-coded bars per macro with `current / target · %`, plus per-macro delta status hint

### Apple Fitness section (mobile)
- Manual input fields hidden — log via CoachGPT
- Ring labels + percentages at readable sizes, true uncapped percentage shown

### Oura Ring section (mobile)
- **Top quadrant**: Total Sleep / Steps / Cal Burned / VO₂ max
- **Middle row**: Deep / REM / Light / Awake (Awake is computed: total − deep − rem − light)
- **Bottom row**: HRV / Readiness / Bedtime
- All input fields hidden on mobile (CoachGPT logs data)
- VO₂ max syncs cross-device via oura blob (previously localStorage-only)

### Food Log (key changes from recent sessions)
- **Training Selector removed** from Food Log page (was pointless there)
- **Daily Status boxes**: show actual logged values (e.g. `1,696` cal, `104g` protein) with neutral dark background — no color-coded red/green backgrounds
- **Macro bars**: percentage appended after each number pair (`1,696 / 2,227 · 76%`)
- **"Trak Your Food" hero card**: green-tinted card with AI text input + emoji quick-add chip grid (☕ Coffee, 🥤 Gut Drink, 🍳 Breakfast, 🥗 Lunch, 🍱 Midday, 💪 Pre-WO, ⚡ Intra, 🥩 Post-WO)
- **Slim water strip** in Food Log (compact single-row: icon + oz + bar + buttons)
- **Allows duplicates** — same meal logged twice = two rows
- **Servings stepper** per row (`− 1x +`, capped 1–10)
- **Edit modal** with pencil icon

### CoachGPT
- Floating bubble (desktop bottom-right, mobile bottom-right beside dock)
- Supports LOG actions: `LOGFOOD`, `LOGWATER`, `LOGSTEPS`, `LOGCALBURN`, `LOGMOVE`, `LOGEXERCISE`, `LOGSTAND`, `LOGSPLIT`, `LOGWEIGHT`, `CLEARDAY`
- **`LOGOURA`** (new): logs any combination of Oura fields in one message — `score`, `total`, `deep`, `rem`, `light`, `hrv`, `readiness`, `vo2`, `bed`, `wake`, `eff`. Only fields present in the payload are written; existing values never clobbered. Example: `LOGOURA:{"score":82,"total":7.4,"hrv":55,"readiness":78}`
- `_normalizeLogActions` strips whitespace between action name and `{` (fixes Claude sometimes emitting `LOGWEIGHT: {...}` with a space)

### Sync + persistence
- **Supabase** — `daily_logs` (date-keyed), `user_settings`, `chat_history`
- **`_lastOuraBlob`** — in-memory cache of last loaded oura blob. `ouraUpdate()` merges new non-zero values onto it before saving, preventing cross-device wipe when one device has partial data.
- **Oura sync** — Netlify proxy, uses client local date (not UTC)
- **localStorage** mirrors most state

---

## Architecture decisions worth knowing

### Activity field chokepoints (`setSteps`, `setCalExp`, `setMove`, `setExercise`, `setStand`)
All writes go through these setters. They enforce:
- **Date guard**: writes for non-today date are silently dropped
- **Source priority**: `user/logaction (3) > oura (2) > apple (1)`
- **Monotonic guard**: Oura can't overwrite a higher cumulative value with a lower one
- **`_activitySources` map** tracks which source last wrote each field

### `initNewDay()` (clean-slate function)
- Called on page load AND every 60s by midnight rollover watcher
- Resets all daily state, re-renders

### `ouraUpdate()` save guard
- Won't save when ALL numeric fields are zero/empty (prevents initNewDay clearing → save zeros → wipe race)
- Merges onto `_lastOuraBlob` before saving (cross-device safety)

### Mobile breakpoint = 600px
- Single source of truth for "is this mobile"
- All mobile-only rules inside `@media (max-width: 600px)`

---

## Open items / parked features

1. **Voice input for CoachGPT** — Web Speech API (built into Safari/Chrome). Add 🎤 button, long-press to record, transcribe, fill textarea.
2. **Photo/screenshot upload in CoachGPT** — `<input type="file" accept="image/*">` → base64 → Claude vision API → extract Oura/Apple Fitness numbers → fire LOGOURA + other LOG actions automatically. `LOGOURA` action is already built; this just adds the image input UI + vision API call.
3. **Date swipe navigation on dashboard** — Oura-style horizontal carousel. Big lift (requires `dashRefresh(date)` parameterization).
4. **Hamburger drawer cleanup** — mobile drawer shows all sidebar sections; should show only less-used items (Routines, Insights, Settings, Sign out).
5. **PWA install + home-screen icon** — manifest + service worker. Full-screen native feel, enables push notifications.
6. **Push notifications via PWA** — "Time to weigh in" 7am, "Log lunch?" 12:30, etc. Requires service worker. iOS 16.4+.
7. **`vo2_max` Supabase migration** — column doesn't exist yet in `user_settings`. Currently in oura blob. Add `vo2_max numeric` column → flip `vo2Update()` to use `dbSaveSettings`.
8. **Streaks / habit tracking** — "12 days hitting protein target" badge.
9. **Camera meal logging** — mobile-only "📸 Snap meal". Opens camera → photo → Claude vision → estimated macros → confirm UI.

---

## Recent commit history (most recent first)

| SHA | Description |
|---|---|
| `dbea786` | Food Log: status boxes use standard dark background, no color coding |
| `b3c07ce` | Food Log: status box numbers white and larger (14px) |
| `894d519` | Food Log: actual values in status boxes, % on bars, close hero gap |
| `1f61395` | Merge: viewport lock + Food Log Option D redesign |
| `c8b8ecd` | Food Log redesign (Option D): hero card + slim water strip + cleanup |
| `83a8ef4` | Mobile: viewport lock + comfortable dock clearance |
| `3e03f62` | Merge: fix iOS zoom on Apple Fitness inputs |
| `ad9f488` | Mobile: fix iOS zoom on Apple Fitness inputs (`!important` override) |
| `026b657` | Merge: LOGOURA action for full Oura logging |
| `d3d83dc` | CoachGPT: add LOGOURA action for full Oura Ring data logging |
| `fbf0a1e` | Merge: desktop Steps/Weight tile swap |
| `1967680` | Merge: tile reorder + desktop 110% zoom |
| `cf42430` | Dashboard: reorder tiles for desktop and mobile layouts |

To revert any specific commit: `git revert <sha>` then `git push origin main`. Netlify auto-deploys within ~1-2 min.

---

## Things to know that might bite next session

- **Repo is PUBLIC** — Supabase anon keys hardcoded but publishable-tier, protected by RLS. JR is OK with this.
- **`Fitness and Health Apps Unified Landscape Memo.md`** — untracked file in repo root. Personal note, not committed.
- **Auto-memory files** at `/Users/jrsm5pro/.claude/projects/-Users-jrsm5pro-Desktop-trakr-ai/memory/` — persist across Claude Code sessions on this Mac only. This doc is the cross-device replacement.
- **Multi-machine workflow**: always `git pull` before starting work when switching between MacBook Air and MacBook Pro. The Air has no GitHub credentials configured (no SSH keys, no token) — push only from the Pro.
- **`LOGOURA` does not handle `steps` or `calexp`** — those go through `LOGSTEPS`/`LOGCALBURN` with their own guards. Don't add them to LOGOURA.

---

## End-of-session ritual

When JR says "wrap up" / "let's call it" / equivalent:

1. Confirm all code changes are pushed to `origin/main`
2. **Update this doc** with whatever is now true
3. Commit: `Update CONTEXT.md after session: [brief topic]`
4. Push

Next session anywhere on any device picks up by reading this file.
