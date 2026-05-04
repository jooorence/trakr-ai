# TRAKR React Migration — PRD

## 1. Problem

`index.html` is a 3,482-line single-file vanilla-JS app with **319 direct DOM-manipulation calls** (`getElementById`, `innerHTML`, `appendChild`). The same data lives in many places — UI inputs, in-memory variables, Supabase rows — and is kept in sync manually.

This produces three recurring pain points:

1. **State sync bugs.** Fix one path (e.g., load Oura from DB) and another path (e.g., date-nav re-render) silently breaks because they each update the DOM independently.
2. **Chat reliability.** Three near-duplicate chat surfaces (`coach-messages`, `cs-messages`, `brief-chat-messages`) each have their own append/scroll/restore logic. Bug fixes don't transfer.
3. **Design ceiling.** Inline styles like `style="background:#1a1a1a;border-radius:8px;padding:8px;"` are repeated hundreds of times. Visual changes require sweeping edits, so the design plateaus.

## 2. Goal

Rebuild TRAKR as a Vite + React + TypeScript + Tailwind app, with **single-source-of-truth state** and **reusable components**, while preserving every existing feature and the live deployment at trakros.com.

The migration follows **Option C — structural parity with new design primitives from day one**: same screens, same sections, same flows, same dark color palette as today, but using Tailwind tokens and shadcn/ui primitives (rather than inline styles and raw HTML inputs) since we're rewriting every line anyway. Layout/UX redesign is explicitly out of scope for the migration itself — that lives in Phase 9 as deliberate design work.

## 3. Success Criteria

The migration is done when **all** of the following are true:

- [ ] trakros.com serves the React build.
- [ ] Every feature listed in §6 works at parity with the legacy app.
- [ ] All existing Supabase data (daily_logs, user_settings, chat_history) loads correctly — no data loss, no schema changes.
- [ ] Apple Health webhook (`apple-sync.js`), Oura OAuth (`oura.js`), and Claude proxy (`claude.js`) all continue to function unchanged.
- [ ] No `getElementById` / `innerHTML` / `appendChild` outside of the React entry point.
- [ ] Every Oura field, Apple Fitness ring, and macro target has exactly **one** definition (not six copies).
- [ ] All three chat surfaces share a single `<ChatSurface />` component.
- [ ] Local dev runs with `npm run dev` and supports HMR (instant updates without reload).
- [ ] TypeScript compiles with no `any` in feature code.
- [ ] The legacy `index.html` is archived (kept in repo at `legacy/index.html` for reference, not served).

## 4. Non-Goals (explicitly out of scope for this migration)

- **No new features.** Behavior parity first; new features come after migration.
- **No layout or UX redesign during migration.** Same sections, same nav structure, same flows. Reimagining navigation/layout/typography is Phase 9 work, done with intention.
- **No backend changes.** Supabase schema and Netlify Functions stay exactly as-is.
- **No multi-user / auth provider changes.** Still single-user, still Google OAuth via Supabase.
- **No mobile-native app.** Still a web app, just better.
- **No analytics, telemetry, or A/B framework.** Personal tool.

**What IS in scope (and free, since we're rewriting every line):**
- Inline `style="..."` → Tailwind classes referencing the legacy palette as design tokens
- Raw `<input>` / `<button>` → shadcn/ui primitives (accessible, consistent, tokenized)
- Repeated card/pill markup → reusable `<Card>` / `<Pill>` components

## 5. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** | Fast HMR, zero-config, Netlify auto-detects |
| Framework | **React 18** | Industry standard, vast ecosystem |
| Language | **TypeScript** | Catches "renamed a field, forgot one place" bugs at compile time |
| Styling | **Tailwind CSS** | Design tokens out of the box; no more inline-style sprawl |
| Components | **shadcn/ui** | Accessible, beautiful primitives — copy-paste, not a dependency |
| State | **React Query** (server state) + **Zustand** (UI state, if needed) | Query handles Supabase fetching/caching; Zustand for cross-feature UI state. Avoid Redux. |
| Routing | **React Router v6** | If multi-page; otherwise tab-based state suffices |
| Animation | **Framer Motion** (later, optional) | Tasteful transitions in polish phase |
| Backend | **Supabase + Netlify Functions** (unchanged) | Already working, no reason to touch |

## 6. Feature Inventory (must all exist post-migration)

### Auth
- Google OAuth sign-in via Supabase
- Auth-gate that hides app until signed in

### Top-level navigation
- Sidebar with section links
- Floating coach bubble (bottom-right, always visible)

### Dashboard sections
- **Dashboard overview** — weight, goal, daily macro rings, exercise ring
- **Macro dashboard** (shown on meal tabs)
- **Meal plans** — training-day and rest-day plans with hard-coded items
- **Food log** — date nav, calendar widget, training-day/rest-day selector, item list
- **Rules / Four Principles**
- **Training split** — 5 expandable day sections (Pull 1, Push 1, Legs, Pull 2, Push 2)
- **Routines** — morning/nightly tabs with checklists
- **Longevity protocol**
- **Insights**
- **Covenant**
- **AI Daily Brief** — greeting, numbers, split preview, embedded chat

### Health data inputs
- **Oura section** — 12 fields (score, total, eff, deep, rem, light, bed, wake, hrv, readiness, steps, calexp), with summary display
- **Apple Fitness rings** — move, exercise, stand (with current 750/45 goals)
- **Apple Health sync** — already runs via webhook → Supabase; UI must read latest values

### CoachGPT (chat)
- **Main coach panel** (`coach-messages`) — full-page chat
- **Coach side panel** (`cs-messages`) — sliding side sheet with day selector, history, quick actions, readonly banner for past days
- **Brief chat** (`brief-chat-messages`) — embedded in Daily Brief
- All three persist messages to `chat_history` table, scoped by `surface`
- Streaming responses from Claude
- Quick-action buttons (LOGSLEEP, etc. — pattern-matched outputs that update inputs)

### Persistence
- **Supabase tables:** `daily_logs`, `user_settings`, `chat_history`
- **Debounced auto-save** — current code uses `setTimeout` per field; React version uses React Query mutations with debounce
- **Cross-device sync** — chat history loads from DB on app start

### Integrations
- **Apple Health** → `/.netlify/functions/apple-sync` webhook
- **Oura** → `/.netlify/functions/oura` (OAuth + data fetch)
- **Claude** → `/.netlify/functions/claude` (chat proxy with streaming)

## 7. Constraints

- **trakros.com must keep working every day.** JR uses the app daily. The migration must not break the live site for more than the duration of a single deploy.
- **Build the new version in parallel** on a branch, deploy it to a preview URL (Netlify auto-creates these per branch), and only swap the production domain once the React version reaches parity.
- **Mobile (iPhone Safari) must work.** Current app is responsive; the new one must be at least as good.
- **No JR-data migration.** All persistent state already lives in Supabase and is keyed by user — the React app reads the same rows as the HTML app.

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hidden behavior in the 3,482-line file gets dropped during port | High | Medium | Port section-by-section with a parity checklist (§6); compare side-by-side in two browser tabs (legacy at trakros.com, new at preview URL) |
| Streaming chat regresses (it's stateful and tricky) | Medium | High | Port chat last, after foundational components are stable; write a minimal manual test script (send msg, verify stream, verify persistence, verify reload-from-history) |
| Supabase queries change behavior subtly | Low | High | Reuse exact query strings from legacy code; share a `lib/supabase.ts` typed client and wrap each query in a hook |
| Tailwind colors don't match current dark theme exactly | Low | Low | Extract current hex colors (`#1a1a1a`, `#8899ff`, etc.) into Tailwind theme config up front |
| Quick-action buttons (LOGSLEEP regex parsers) regress | Medium | Medium | Port the regex table verbatim; add unit tests for each pattern |
| Time investment exceeds appetite | Medium | Medium | Phased plan with shippable milestones — can pause between phases |

## 9. Locked Decisions

All decisions confirmed 2026-05-04. These are the rules of the road for the migration.

1. **Visual approach: Option C — structural parity with new design primitives from day one.** Same screens, sections, flows, and palette as legacy. But Tailwind classes (not inline styles) and shadcn/ui primitives (not raw HTML inputs) from line one. Layout/UX redesign deferred to Phase 9.
2. **Routing: URL routes per section.** `/dashboard`, `/food-log`, `/training`, `/routines`, `/longevity`, `/insights`, `/covenant`, `/coach`. Browser back button, bookmarks, share links all work.
3. **Cutover: instant swap.** Parallel build on `react-migration` branch with Netlify preview deploys. When parity is reached, merge → trakros.com flips to React in one move. No two-version overlap.
4. **Legacy archive: `legacy/index.html`** in same repo. Kept for reference during Phase 9 polish; not served.
5. **TypeScript: `strict: true` from day one.** No `any` in feature code.
