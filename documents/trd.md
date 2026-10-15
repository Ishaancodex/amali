# TRD — Amali Residences Amenities Operations Prototype

|                  |                                                                             |
| ---------------- | --------------------------------------------------------------------------- |
| **Companion to** | `prd.md` v1.0 (product requirements). This document says **how** it's built |
| **Audience**     | Claude Code (primary builder) and Ishaan (reviewer)                         |
| **Version**      | v1.0 — 14 Oct 2026                                                          |
| **Runtime**      | Static, client-only web app. No backend                                     |

Section references like **PRD §8.1** point to `prd.md`.

---

## 1. Technical goals and constraints

| #   | Goal                     | What it means in practice                                                                                                                                   |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | **Live across surfaces** | One state store feeds up to two device frames at once, plus optional extra browser tabs. An action anywhere is visible everywhere in under 100ms            |
| T2  | **Deterministic**        | The same seed and clock always produce the same data, the same delivery timings and the same report numbers. Rehearsals match the live demo                 |
| T3  | **Time-travel safe**     | The demo clock can jump hours or days. Every timed effect runs exactly once, in order                                                                       |
| T4  | **Rules are data**       | Every business number lives in one typed config, which is validated at boot                                                                                 |
| T5  | **Smooth**               | 60fps on the role switch, sheets, lists and the urgent-closure flow, on a 2020 MacBook Air at 1440p                                                         |
| T6  | **Offline-capable demo** | After the first load, it runs without a network connection, so a venue Wi-Fi failure doesn't stop the demo. All assets are local, and fonts are self-hosted |
| T7  | **Vibe-codable**         | Small files, clear seams and strict types. Claude Code can build each phase without needing the whole codebase in context                                   |

**Constraints:**

- No server, database or third-party APIs at runtime.
- Static hosting. The build must work with `next build` and `output: 'export'`.
- English by default. Arabic switches per device, with the structure RTL-ready from day one.

---

## 2. Tech stack

### 2.1 Core

| Concern           | Package                        | Version                        | Why                                                                                                                                                                     |
| ----------------- | ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime           | Node.js                        | 22 LTS                         | Long-term support; works with all the tools below                                                                                                                       |
| Package manager   | pnpm                           | 9.x                            | Fast and strict about dependencies                                                                                                                                      |
| Framework         | `next`                         | 15.x (App Router)              | Matches the PRD; static export; good DX with Claude Code                                                                                                                |
| UI                | `react`, `react-dom`           | 19.x                           | Required by Next 15                                                                                                                                                     |
| Language          | `typescript`                   | 5.x, `strict: true`            | Domain safety                                                                                                                                                           |
| Styling           | `tailwindcss`                  | 4.x (+ `@tailwindcss/postcss`) | Token-driven utility classes; logical properties for RTL                                                                                                                |
| Class helpers     | `clsx`, `tailwind-merge`       | latest                         | `cn()` helper                                                                                                                                                           |
| Motion            | `motion`                       | 12.x (`motion/react`)          | Framer Motion; springs, layout animations, gestures                                                                                                                     |
| State             | `zustand`                      | 5.x                            | Small API; slices, `persist` and `subscribeWithSelector`                                                                                                                |
| Immutable updates | `immer`                        | 10.x                           | Through zustand's `immer` middleware                                                                                                                                    |
| Dates             | `date-fns`                     | 4.x                            | Formatting and arithmetic                                                                                                                                               |
| Time zones        | `@date-fns/tz`                 | 1.x                            | `TZDate` for `Asia/Dubai` (the official date-fns v4 companion)                                                                                                          |
| Recurrence        | `rrule`                        | 2.8.x                          | RRULE expansion for recurring activities                                                                                                                                |
| Validation        | `zod`                          | 3.x                            | Config, form and seed validation                                                                                                                                        |
| IDs               | `nanoid`                       | 5.x                            | Readable IDs with a prefix (`bk_`, `wo_`)                                                                                                                               |
| Seeded randomness | `seedrandom`                   | 3.x                            | Deterministic seed data and simulations                                                                                                                                 |
| Icons             | `lucide-react`                 | latest                         | Stroke-1.5 line icons tinted bronze                                                                                                                                     |
| Charts            | `recharts`                     | 2.15.x or 3.x                  | Styled with the design tokens                                                                                                                                           |
| QR                | `qrcode.react`                 | 4.x                            | Tickets, guardian passes                                                                                                                                                |
| i18n              | `i18next`, `react-i18next`     | 24.x / 15.x                    | Keyed strings; `ar` later                                                                                                                                               |
| Excel export      | `exceljs`                      | 4.x                            | **Deviation from PRD §16.1.** The free SheetJS edition can't style cells, and PRD §8.10 needs bold headers, frozen panes and AED number formats. ExcelJS does all three |
| File save         | `file-saver`                   | 2.x                            | Triggers the `.xlsx` download                                                                                                                                           |
| Toasts            | Custom component (§9.6)        | —                              | Must use the dynamic-island motion (PRD M13), so no library                                                                                                             |
| Bottom sheets     | Custom, built on `motion` drag | —                              | Needs PRD M6 physics                                                                                                                                                    |

### 2.2 Dev and quality

| Concern         | Package                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| Lint            | `eslint` 9 (flat config), `eslint-config-next`, `eslint-plugin-react-hooks` |
| Format          | `prettier` 3 + `prettier-plugin-tailwindcss`                                |
| Unit tests      | `vitest` 3, `@vitest/coverage-v8`                                           |
| Component tests | `@testing-library/react`, `jsdom`                                           |
| E2E tests       | `@playwright/test` (Chromium)                                               |
| Accessibility   | `@axe-core/playwright`                                                      |
| Git hooks       | `lefthook` (format, lint and typecheck on pre-commit)                       |

### 2.3 Fonts (self-hosted through `next/font`)

| Font                             | Source                                                                               | Use                           |
| -------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| Manrope 400/500/700              | `next/font/google`                                                                   | App UI                        |
| Jost 400/500                     | `next/font/google`                                                                   | Shell notes panel             |
| IBM Plex Sans Arabic 400/500/700 | `next/font/google`                                                                   | Arabic UI                     |
| PP Neue Montreal Book            | `next/font/local` from `src/assets/fonts/` **if the license and files are provided** | Tags, shell labels            |
| Inter Tight 400                  | `next/font/google`                                                                   | Fallback for PP Neue Montreal |

`next/font` self-hosts the files at build time, which meets T6.

### 2.4 Not used, and why

| Rejected                           | Reason                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Redux / RTK                        | Too much ceremony for a client-only demo                                                                                                      |
| React Query / SWR                  | There's no server to fetch from. Simulated latency lives in a small helper (§9.5)                                                             |
| Next.js routing for in-app screens | Two devices can show different screens at the same time, so URL routes can't represent both. Each device has its own in-memory navigator (§6) |
| Supabase or a realtime backend     | Out of scope for v1. A stretch-goal adapter seam is noted in §8.4                                                                             |
| UI kits (shadcn, MUI)              | The Figma components are bespoke. Primitives are built once in `src/ui/`                                                                      |

---

## 3. Architecture overview

```
┌───────────────────────────────── Browser tab ─────────────────────────────────┐
│ Shell (RolePill · NotesPanel · PresenterMenu · DemoClock · PersonaPicker)     │
│   ├─ DeviceSlot A ──► DeviceFrame ──► Surface (resident | whatsapp | guard |  │
│   └─ DeviceSlot B ──► DeviceFrame ──►          creche | fnb | console)       │
│                          │ each has its own Navigator stack + locale + persona │
│                          ▼                                                     │
│   UI components ──read──► selectors ◄──── zustand store (single source)       │
│        │                                     ▲         │                       │
│        └──call──► domain commands ───writes──┘         ├─► persist (localStorage)
│                     │  validate (rules engine)         └─► BroadcastChannel ⇄ other tabs
│                     │  emit domain events ──► event bus ──► notifications, ticker,
│                     │                                       delivery simulator
│                     └─ schedule jobs ──► scheduler (driven by demo clock)      │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Layering rules**, enforced with ESLint `no-restricted-imports`:

| Layer               | May import                           | Must not import                                              |
| ------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `domain/*`          | `config`, `lib`, `types`             | `react`, `store`, `ui`, `surfaces`                           |
| `store/*`           | `domain`, `config`, `lib`, `types`   | `ui`, `surfaces`, `shell`                                    |
| `ui/*` (primitives) | `design`, `lib`                      | `store`, `domain`                                            |
| `surfaces/*`        | everything except other surfaces     | `surfaces/<other>` (shared pieces go to `features/`)         |
| `shell/*`           | `store`, `ui`, `design`, `scenarios` | `surfaces/*` internals (only each surface's entry component) |

The domain layer is **pure TypeScript**: functions that take state and input and return a new state, events and jobs. This keeps the rules engine unit-testable without React.

---

## 4. Folder structure

```
amali-amenities-prototype/
├── CLAUDE.md                         # agent rules (copy of §12)
├── prd.md  trd.md
├── package.json  pnpm-lock.yaml
├── next.config.ts                    # output:'export', images.unoptimized:true, trailingSlash:true
├── tsconfig.json                     # strict, paths: @/* → src/*
├── eslint.config.mjs  .prettierrc  lefthook.yml
├── playwright.config.ts  vitest.config.ts
├── public/
│   ├── amenities/                    # padel.jpg screening.jpg music.jpg creche.jpg dining.jpg pool.jpg gym.jpg
│   ├── brand/                        # hero.jpg amali-logo-white.svg amali-logo-dark.svg
│   ├── events/                       # posters (generated placeholders ok)
│   └── avatars/                      # persona & staff photos (generated / placeholder)
├── scripts/
│   ├── map-amenity-images.ts         # lists public/amenities, maps to keys, renames, reports mismatches
│   └── check-tokens.ts               # fails CI if hex colours appear outside design/tokens
├── src/
│   ├── app/
│   │   ├── layout.tsx                # fonts, <html lang>, providers
│   │   ├── page.tsx                  # Shell (reads ?scenario=&step=&role=)
│   │   ├── present/page.tsx          # single-device page for 2nd screen: ?role=guard&persona=
│   │   ├── tokens/page.tsx           # token & component preview (dev only)
│   │   └── globals.css               # @import tailwind; CSS variables from tokens; @theme mapping
│   │
│   ├── design/
│   │   ├── tokens.ts                 # colours, type, radii, spacing, shadows (typed source of truth)
│   │   ├── motion.ts                 # durations, easings, springs, variants (PRD §13)
│   │   └── fonts.ts                  # next/font declarations
│   │
│   ├── config/
│   │   ├── rules.ts                  # every business number (PRD §8) — zod-validated
│   │   ├── rules.schema.ts
│   │   ├── features.ts               # flags: forcePhoneFrame, simulatedLatency, ticker, etc.
│   │   └── rbac.ts                   # permission matrix (PRD §8.11)
│   │
│   ├── types/                        # shared domain types (§5)
│   │   ├── common.ts  community.ts  amenity.ts  booking.ts  event.ts
│   │   ├── creche.ts  dining.ts  wallet.ts  ops.ts  comms.ts  report.ts  demo.ts
│   │   └── index.ts
│   │
│   ├── lib/
│   │   ├── time.ts                   # TZ helpers: toDubai, fmtTime, fmtDate, overlaps, ranges
│   │   ├── money.ts                  # AED formatting (Intl), minor units
│   │   ├── ids.ts                    # prefixed nanoid
│   │   ├── random.ts                 # seeded RNG streams (seed + namespace)
│   │   ├── latency.ts                # simulated latency wrapper
│   │   ├── cn.ts
│   │   └── assert.ts
│   │
│   ├── domain/                       # PURE logic — no React, no store
│   │   ├── rules/
│   │   │   ├── validateBooking.ts    # the ordered 11-check pipeline (PRD §7)
│   │   │   ├── checks/               # eligibility.ts status.ts hours.ts window.ts leadTime.ts
│   │   │   │                         # duration.ts capacity.ts quota.ts age.ts guests.ts wallet.ts
│   │   │   ├── alternatives.ts       # nearest valid options
│   │   │   └── errors.ts             # RuleCode enum + i18n keys
│   │   ├── booking/                  # stateMachine.ts holds.ts waitlist.ts penalties.ts noShow.ts
│   │   ├── availability/             # slots.ts (derive slot grid), hours.ts (hours + exceptions + blackouts)
│   │   ├── programme/                # recurrence.ts (rrule) conflicts.ts seasons.ts impact.ts
│   │   ├── events/                   # showtimes.ts seats.ts rsvp.ts attendance.ts
│   │   ├── creche/                   # ratio.ts capacity.ts checkin.ts pickup.ts
│   │   ├── dining/                   # tables.ts allocation.ts deposits.ts noShow.ts settle.ts
│   │   ├── wallet/                   # ledger.ts holds.ts
│   │   ├── ops/                      # status.ts checklist.ts water.ts roster.ts incidents.ts workOrders.ts sla.ts
│   │   ├── comms/                    # audience.ts templates.ts delivery.ts quietHours.ts fallback.ts
│   │   ├── reports/                  # kpis.ts heatmap.ts revenue.ts buildWorkbook.ts
│   │   └── rbac/can.ts
│   │
│   ├── store/
│   │   ├── index.ts                  # create store: immer + subscribeWithSelector + persist
│   │   ├── slices/                   # one per domain: community, amenities, bookings, events, creche,
│   │   │                             # dining, wallet, ops, comms, notifications, audit, demo, devices
│   │   ├── commands/                 # domain commands (the ONLY way to mutate) — §7
│   │   ├── selectors/                # memoised reads per domain
│   │   ├── eventBus.ts               # typed pub/sub for DomainEvents
│   │   ├── sync.ts                   # BroadcastChannel sync + leader election (§8)
│   │   ├── migrate.ts                # persist version migrations
│   │   └── snapshots.ts              # named snapshots for rehearsal
│   │
│   ├── scheduler/
│   │   ├── clock.ts                  # demo clock engine (live mode, speed, jumps)
│   │   ├── queue.ts                  # job queue (ordered by runAt, idempotent by jobId)
│   │   ├── jobs/                     # one file per JobType (§7.4)
│   │   └── useDemoClock.ts
│   │
│   ├── seed/
│   │   ├── index.ts                  # buildSeed(seed='amali-2026', now) → full state
│   │   ├── community.ts  personas.ts  staff.ts  vendors.ts
│   │   ├── amenities.ts  venues.ts  programme.ts
│   │   ├── history.ts                # 90-day deterministic history (PRD §8.10)
│   │   └── scenarioFixtures.ts       # per-scenario adjustments (e.g. James 2 peak bookings)
│   │
│   ├── scenarios/
│   │   ├── index.ts                  # S1–S8 definitions as data (§10)
│   │   ├── types.ts
│   │   └── s1-padel.ts … s8-management.ts
│   │
│   ├── i18n/
│   │   ├── index.ts                  # i18next instance per device locale
│   │   ├── en.json
│   │   └── ar.json
│   │
│   ├── ui/                           # brand primitives (no store access)
│   │   ├── Button.tsx  IconButton.tsx  Tag.tsx  Card.tsx  Input.tsx  Stepper.tsx
│   │   ├── Sheet.tsx  Toast.tsx  IslandNotification.tsx  Banner.tsx
│   │   ├── Odometer.tsx  RingGauge.tsx  CountdownRing.tsx  CheckDraw.tsx
│   │   ├── Skeleton.tsx  EmptyState.tsx  ErrorState.tsx  NoPermission.tsx  OfflineBar.tsx
│   │   ├── DateStrip.tsx  SlotGrid.tsx  SeatMap.tsx  Calendar/ (Month, Year, Week)
│   │   ├── charts/ (Line, Bar, StackedBar, Heatmap, Funnel)
│   │   └── icons.ts                  # lucide re-exports with bronze defaults
│   │
│   ├── features/                     # cross-surface composites that DO read the store
│   │   ├── booking/  (BookingConfirmSheet, RuleRejection, Alternatives, Ticket)
│   │   ├── status/   (AmenityStatusTag, OccupancyRing, HoursTable)
│   │   ├── comms/    (AnnouncementCard, MessagePreview)
│   │   └── wallet/   (BalanceChip, TopUpSheet, Ledger)
│   │
│   ├── surfaces/
│   │   ├── resident/
│   │   │   ├── ResidentApp.tsx       # entry; registers routes with Navigator
│   │   │   ├── routes.ts
│   │   │   └── screens/  home/ amenities/ padel/ events/ creche/ dining/ pool-gym/
│   │   │                 whats-on/ activity/ my-unit/ wallet/ profile/ search/
│   │   ├── whatsapp/     WhatsAppApp.tsx  screens/ (Chats, Thread, Channel)
│   │   ├── guard/        GuardApp.tsx     screens/ (Today, Scan, Arrivals, Attendance, Occupancy, Incident, Alerts)
│   │   ├── creche/       CrecheApp.tsx    screens/ (RoomBoard, CheckIn, Sessions, Incidents, Children)
│   │   ├── fnb/          FnbApp.tsx       screens/ (Timeline, Floor, Arrivals, Covers, Settle, Approvals)
│   │   └── console/      ConsoleApp.tsx   layout/ (Sidebar, Header with role switch)
│   │                     pages/ (Overview, Amenities, Programme, Communications, Operations,
│   │                             Residents, Reports, Settings)
│   │
│   ├── navigation/
│   │   ├── Navigator.tsx             # per-device stack navigator with motion transitions
│   │   ├── useNav.ts                 # push / pop / replace / reset / deepLink
│   │   └── deepLinks.ts              # 'amali://padel/booking/bk_123' → route + params
│   │
│   └── shell/
│       ├── Shell.tsx
│       ├── TopBar/ (RolePill, ResetButton, MenuButton)
│       ├── DeviceSlot.tsx  DeviceFrame/ (Phone, Tablet, Browser, StatusBar, DynamicIsland)
│       ├── NotesPanel.tsx  ScenarioIndex.tsx
│       ├── PresenterMenu/ (ClockControls, DualView, Language, MotionSpeed, Offline, Snapshots, QrPicker)
│       ├── PersonaPicker.tsx  DemoClockBadge.tsx  EventTicker.tsx
│       └── shortcuts.ts
│
└── tests/
    ├── unit/                         # domain/* (vitest)
    ├── scenarios/                    # headless scenario runs against commands (vitest)
    └── e2e/                          # playwright: one spec per scenario + a11y + perf smoke
```

**File size rule:** keep files under about 250 lines. Split a screen into `Screen.tsx` and colocated `parts/` when it grows.

---

## 5. Data model

All times are stored as **ISO 8601 UTC strings**. They are converted to `Asia/Dubai` only for display (`lib/time.ts`). Money is stored as **integer fils** (AED × 100), so arithmetic never has floating-point errors. Every entity has `id`, `createdAt` and `updatedAt`.

### 5.1 Community and people

```ts
type Tower = 'east' | 'west';
type Cluster = 'north' | 'south';

interface Unit {
  id: string; // 'E-1804', 'PV-05', 'PH-02'
  kind: 'apartment' | 'duplex' | 'penthouse' | 'villa';
  tower?: Tower;
  floor?: number;
  cluster?: Cluster;
  amenityRightsHolderId: string; // resident id (owner or tenant)
  leaseEnd?: string;
  accessSuspended?: { reason: 'dues' | 'admin'; since: string };
}

interface Resident {
  id: string;
  name: string;
  avatar: string;
  unitId: string;
  type: 'owner' | 'tenant' | 'household';
  phone: string;
  email: string;
  channels: { appPush: boolean; whatsapp: boolean; whatsappOptIn: boolean; appInstalled: boolean };
  locale: 'en' | 'ar';
  walletRole: 'primary' | 'spender' | 'none';
}

interface Staff {
  id: string;
  name: string;
  avatar: string;
  role:
    | 'guard'
    | 'creche_lead'
    | 'creche_carer'
    | 'fnb_manager'
    | 'host'
    | 'chef'
    | 'community_manager'
    | 'amenity_supervisor'
    | 'call_centre'
    | 'lifeguard'
    | 'gym_attendant'
    | 'technician'
    | 'housekeeping';
  assignedAmenities?: AmenityKey[];
  post?: string;
}

interface Vendor {
  id: string;
  name: string;
  services: string[];
  contact: { name: string; phone: string };
  contract: { start: string; end: string };
  sla: Record<Priority, { respondMins: number; resolveMins: number }>;
  rateCard: { item: string; fils: number }[];
}
```

### 5.2 Amenities, hours and availability

```ts
type AmenityKey = 'padel' | 'screening' | 'music' | 'creche' | 'dining' | 'pool' | 'gym';
type AmenityStatus = 'open' | 'limited' | 'closed' | 'maintenance' | 'emergency';

interface Amenity {
  key: AmenityKey;
  name: string;
  image: string;
  location: string;
  bookingModel: 'slot' | 'event' | 'session' | 'reservation' | 'none';
  capacity: number;
  ageMin?: number;
}

interface StatusEntry {
  // history kept for audit and reports
  amenity: AmenityKey;
  status: AmenityStatus;
  reason?: string;
  from: string;
  to?: string;
  workOrderId?: string;
  setBy: string;
}

interface WeeklyHours {
  amenity: AmenityKey;
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  open: string /*'06:00'*/;
  close: string;
}
interface HoursException {
  id: string;
  amenity: AmenityKey;
  date: string;
  open?: string;
  close?: string;
  closed?: boolean;
  label: string;
  seasonId?: string;
}

interface Blackout {
  id: string;
  amenity: AmenityKey;
  start: string;
  end: string;
  reason: string;
  recurrence?: string /*RRULE*/;
  source: 'maintenance' | 'programme';
  handling: 'cancel_priority_rebook' | 'auto_move';
  workOrderId?: string;
  createdBy: string;
}
```

**Slots are derived, not stored.** `availability/slots.ts` computes the slot grid from:

```
weekly hours → exceptions → blackouts → bookings + holds
```

The result is memoised per `(amenity, date, durationMins)`.

### 5.3 Bookings, holds, waitlists, penalties

```ts
type BookingState =
  | 'held'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'late_cancelled'
  | 'no_show'
  | 'cancelled_by_ops';

interface Booking {
  id: string;
  amenity: 'padel';
  unitId: string;
  bookerId: string;
  start: string;
  end: string;
  players: { residentId?: string; guestName?: string; guestPhone?: string }[];
  charges: { label: string; fils: number }[];
  state: BookingState;
  history: { state: BookingState; at: string; by: string; note?: string }[];
  source: 'resident' | 'agent' | 'waitlist' | 'priority_rebook';
  countsTowardQuota: boolean;
}

interface Hold {
  id: string;
  resourceKey: string /*'padel:2026-10-15T13:00Z'*/;
  byResidentId: string;
  expiresAt: string;
}

interface WaitlistEntry {
  id: string;
  resourceKey: string;
  residentId: string;
  partySize: number;
  position: number;
  state: 'waiting' | 'offered' | 'accepted' | 'expired' | 'withdrawn' | 'skipped';
  offer?: { sentAt: string; expiresAt: string; mode: 'sequential' | 'open_release' };
}

interface Strike {
  id: string;
  residentId: string;
  unitId: string;
  amenity: AmenityKey;
  kind: 'no_show' | 'late_cancel';
  at: string;
  bookingId: string;
}
interface Suspension {
  id: string;
  residentId: string;
  amenity: AmenityKey;
  from: string;
  to: string;
  liftedBy?: string;
}
```

### 5.4 Events and attendance

```ts
interface ProgrammeEvent {
  id: string;
  title: string;
  venue: 'screening' | 'music' | 'pool' | 'padel';
  type: 'movie' | 'live_music' | 'workshop' | 'class' | 'clinic';
  poster: string;
  description: string;
  ageRating: 'G' | 'PG' | 'PG-13' | '18+';
  durationMins: number;
  pricing: Record<AttendeeCategory, number /*fils*/>;
  recurrence?: string;
  seasonId?: string;
  lifecycle: 'draft' | 'scheduled' | 'published' | 'cancelled' | 'completed';
  publishAt?: string;
}
type AttendeeCategory = 'resident' | 'household' | 'guest_adult' | 'guest_child';

interface Showtime {
  id: string;
  eventId: string;
  start: string;
  end: string;
  capacityMode: 'seats' | 'headcount';
  capacity: number;
  blockedSeats: string[];
  regOpens: string;
  regCloses: string;
  state: 'open' | 'full' | 'closed' | 'in_progress' | 'completed' | 'cancelled';
}

interface Rsvp {
  id: string;
  showtimeId: string;
  unitId: string;
  bookerId: string;
  attendees: {
    id: string;
    name: string;
    category: AttendeeCategory;
    seat?: string;
    attendance?: 'attended' | 'no_show';
    markedAt?: string;
    markedBy?: string;
    mode?: 'live' | 'post';
  }[];
  charges: { label: string; fils: number }[];
  state: 'confirmed' | 'cancelled' | 'late_cancelled';
}

interface Season {
  id: string;
  name: string;
  start: string;
  end: string;
  banner: string;
  hoursOverrides: HoursException[];
}
```

### 5.5 Creche

```ts
type AgeBand = 'toddlers' | 'kids' | 'juniors';

interface Child {
  id: string;
  unitId: string;
  name: string;
  dob: string;
  photo: string;
  allergies?: { text: string; severe: boolean };
  dietary?: string;
  photoConsent: boolean;
  guardianIds: string[];
  emergencyContact: { name: string; phone: string };
}

interface Guardian {
  id: string;
  childIds: string[];
  name: string;
  relation: string;
  phone: string;
  photo: string;
  idLast4: string;
  residentId?: string;
  validUntil?: string;
  approval: 'approved' | 'pending' | 'rejected';
}

interface CrecheSession {
  id: string;
  date: string;
  start: string;
  end: string;
  kind: 'morning' | 'afternoon' | 'dropin';
}

interface CrecheBooking {
  id: string;
  sessionId: string;
  childId: string;
  bookedBy: string;
  state: 'confirmed' | 'waitlisted' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  checkIn?: { at: string; by: string; guardianId: string; allergyAck?: boolean };
  checkOut?: { at: string; by: string; guardianId?: string; oneTimeApproval?: ApprovalRequest };
  activity?: { label: string; at: string }[];
  lateFeeFils?: number;
}

interface BandAssignment {
  date: string;
  band: AgeBand;
  staffIds: string[];
} // drives capacity
interface ApprovalRequest {
  id: string;
  collectorName: string;
  collectorPhoto: string;
  requestedAt: string;
  state: 'pending' | 'approved' | 'denied';
  decidedAt?: string;
  decidedBy?: string;
}
```

### 5.6 Dining and wallet

```ts
type VenueKey = 'restaurant' | 'pdr' | 'teppanyaki';
type ServicePeriod = 'breakfast' | 'lunch' | 'dinner' | 'iftar';

interface Table {
  id: string;
  venue: VenueKey;
  seats: number;
  zone: 'indoor' | 'terrace' | 'canal' | 'private' | 'counter';
  x: number;
  y: number;
  combinableWith: string[];
}

interface Reservation {
  id: string;
  venue: VenueKey;
  residentId: string;
  unitId: string;
  start: string;
  end: string;
  period: ServicePeriod;
  partySize: number;
  seatingPref?: Table['zone'];
  occasion?: string;
  dietary: string[];
  requests?: string;
  highChair?: boolean;
  tableIds: string[];
  mode: 'instant' | 'request';
  depositHoldId?: string;
  state:
    | 'requested'
    | 'confirmed'
    | 'seated'
    | 'completed'
    | 'no_show'
    | 'cancelled'
    | 'late_cancelled'
    | 'declined';
  bill?: { totalFils: number; settledAt: string; method: 'wallet' | 'unit_account' };
}

interface Wallet {
  unitId: string;
  balanceFils: number;
} // available = balance − active holds
interface LedgerEntry {
  id: string;
  unitId: string;
  at: string;
  kind: 'topup' | 'charge' | 'hold' | 'hold_release' | 'refund' | 'fee' | 'forfeit';
  fils: number;
  label: string;
  ref?: { type: string; id: string };
  byResidentId?: string;
}
```

### 5.7 Operations

```ts
type Priority = 'P1' | 'P2' | 'P3';

interface ChecklistTemplate {
  id: string;
  amenity: AmenityKey;
  kind: 'opening' | 'midday' | 'closing';
  dueTime: string;
  items: { id: string; label: string }[];
}
interface ChecklistRun {
  id: string;
  templateId: string;
  date: string;
  by: string;
  completedAt?: string;
  items: {
    itemId: string;
    result: 'pass' | 'fail';
    note?: string;
    photo?: string;
    incidentId?: string;
  }[];
}
interface CleaningLog {
  id: string;
  zone: string;
  at: string;
  by: string;
  nextDue: string;
}
interface WaterReading {
  id: string;
  at: string;
  by: string;
  ph: number;
  freeChlorine: number;
  tempC: number;
  clarity: 'pass' | 'fail';
  outOfRange: string[];
}

interface Shift {
  id: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  amenity?: AmenityKey;
  band?: AgeBand;
  state: 'scheduled' | 'sick' | 'swapped';
}

interface Incident {
  id: string;
  amenity: AmenityKey | 'creche';
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  photo?: string;
  raisedBy: string;
  raisedVia: 'guard' | 'console' | 'resident' | 'checklist' | 'creche';
  at: string;
  childId?: string;
  parentAck?: { at: string; by: string };
  workOrderId?: string;
  mergedInto?: string;
}

interface WorkOrder {
  id: string;
  incidentId?: string;
  amenity: AmenityKey;
  title: string;
  priority: Priority;
  assignee: { kind: 'staff' | 'vendor'; id: string };
  state: 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'resolved' | 'closed';
  sla: {
    respondBy: string;
    resolveBy: string;
    pausedMs: number;
    pausedSince?: string;
    respondedAt?: string;
  };
  timeline: { at: string; by: string; type: string; text?: string }[];
  resolution?: { note: string; afterPhoto?: string; costFils?: number };
}

interface AuditEntry {
  id: string;
  at: string;
  actor: { kind: 'staff' | 'resident' | 'system'; id: string; role?: string };
  action: string;
  target: { type: string; id: string };
  before?: unknown;
  after?: unknown;
  reason?: string;
}
```

### 5.8 Communications

```ts
type Channel =
  'app_push' | 'app_banner' | 'app_inbox' | 'wa_direct' | 'wa_channel' | 'sms_fallback';

interface AudienceRule {
  include: AudienceClause[];
  exclude: AudienceClause[];
}
type AudienceClause =
  | { kind: 'all' }
  | { kind: 'tower'; tower: Tower }
  | { kind: 'floors'; tower: Tower; from: number; to: number }
  | { kind: 'cluster'; cluster: Cluster }
  | { kind: 'units'; unitIds: string[] }
  | { kind: 'bookers'; amenity: AmenityKey; date: string }
  | { kind: 'parents' }
  | { kind: 'optedIn'; topic: AmenityKey };

interface Announcement {
  id: string;
  type: 'daily' | 'event' | 'closure' | 'urgent' | 'general';
  title: string;
  body: string;
  amenityTags: AmenityKey[];
  audience: AudienceRule;
  channels: Channel[];
  banner?: { style: 'info' | 'warning' | 'urgent' | 'success'; cta?: string; expiresAt: string };
  schedule: { mode: 'now' } | { mode: 'at'; at: string } | { mode: 'daily'; time: string };
  state: 'draft' | 'scheduled' | 'sending' | 'sent' | 'recalled';
  sentAt?: string;
  resolvedRecipientIds?: string[];
  editedAt?: string;
  createdBy: string;
}

interface Delivery {
  // one per (announcement or system message) × recipient × channel
  id: string;
  messageRef: { type: 'announcement' | 'system'; id: string };
  recipientId: string;
  channel: Channel;
  state:
    'queued' | 'held_quiet_hours' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped_opt_out';
  times: Partial<Record<'queued' | 'sent' | 'delivered' | 'read' | 'failed', string>>;
}

interface WaMessage {
  // simulated WhatsApp
  id: string;
  threadResidentId: string;
  dir: 'in' | 'out';
  at: string;
  kind: 'text' | 'template' | 'quick_reply_answer';
  text: string;
  buttons?: { id: string; label: string; action: CommandRef }[];
  ticks?: 'sent' | 'delivered' | 'read';
}
interface ChannelPost {
  id: string;
  announcementId: string;
  at: string;
  views: number;
  reactions: Record<string, number>;
}

interface Notification {
  id: string;
  recipientId: string;
  at: string;
  title: string;
  body: string;
  deepLink: string;
  priority: 'normal' | 'high';
  read: boolean;
}
```

`CommandRef = { name: CommandName; args: unknown }` means a WhatsApp quick-reply button calls a real domain command (for example `waitlist.acceptOffer`).

### 5.9 Demo and devices

```ts
type Role = 'resident' | 'whatsapp' | 'guard' | 'creche' | 'fnb' | 'console';
type ConsoleRole = 'community_manager' | 'amenity_supervisor' | 'call_centre';

interface DeviceSession {
  slot: 'A' | 'B';
  role: Role;
  actorId: string; // resident id or staff id
  consoleRole?: ConsoleRole;
  locale: 'en' | 'ar';
  nav: { stack: { route: string; params: Record<string, string> }[] };
  offline: boolean;
}

interface DemoState {
  clock: { now: string; mode: 'live' | 'paused'; speed: 1 | 2 | 5 | 10 };
  motionSpeed: 0 | 0.5 | 1;
  dualView: boolean;
  devices: { A: DeviceSession; B?: DeviceSession };
  scenario?: { id: string; step: number };
  tickerOn: boolean;
  simulatedLatencyMs: [number, number];
  seed: string;
  version: number;
}
```

---

## 6. Per-device navigation

Next.js routes can't represent two devices showing different screens at once, so each `DeviceSession` has its own **stack navigator**:

- **`routes.ts`** in each surface maps a route name to its component and a transition (`push`, `modal`, `sheet`, `tab`).
- **`useNav()`** returns `push`, `pop`, `replace`, `resetTo` and `openDeepLink`. Each changes `devices[slot].nav`, so navigation state is part of the store. This is what lets scenarios "Take me there" (§10) and survive a reload.
- **`<Navigator>`** renders the top 2 screens of the stack so that PRD M3 (push with parallax and edge-swipe back) can animate. Screens below stay mounted in a hidden layer (max depth 4) to keep scroll position.
- **Tabs** (bottom nav) hold one stack per tab; switching tabs uses M4.
- **Deep links** look like `amali://<surface>/<route>?<params>`. Notifications, WhatsApp buttons and scenario steps all use the same parser, `navigation/deepLinks.ts`.
- **The console** uses the same navigator, with a sidebar layout; "push" there is a page change animated with a cross-fade instead of a slide.

---

## 7. Domain commands, events and the scheduler

### 7.1 Command pattern

Every mutation goes through a command, so that validation, audit, events and jobs never get skipped.

```ts
// store/commands/defineCommand.ts
export function defineCommand<I, O>(name: CommandName, run: (ctx: CommandCtx, input: I) => CommandResult<O>) { … }

interface CommandCtx {
  state: Draft<AppState>;      // immer draft
  now: string;                 // demo clock
  actor: Actor;                // who is acting (resident, staff + console role, system)
  rng: Rng;                    // seeded, namespaced by command + entity id
}
type CommandResult<O> =
  | { ok: true; value: O; events: DomainEvent[]; jobs: JobSpec[]; audit?: AuditInput }
  | { ok: false; error: RuleError };
```

`dispatch(command, input)`:

1. **RBAC check:** `can(actor, command, target)`. A failure returns `NO_PERMISSION`.
2. Run the command inside `set(produce(…))`.
3. If it succeeds, append to the audit log, publish events to the event bus, and enqueue jobs.
4. Return the result to the UI. On a failure, the UI shows `RuleRejection` (PRD M10).

**Command catalogue (non-exhaustive, one file each):**

| Domain | Commands                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Padel  | `slot.hold`, `slot.releaseHold`, `booking.create`, `booking.cancel`, `booking.checkIn`, `booking.markNoShow`, `waitlist.join`, `waitlist.withdraw`, `waitlist.acceptOffer`, `waitlist.declineOffer`, `penalty.liftSuspension`                                                                                                                                                                                       |
| Ops    | `blackout.preview`, `blackout.create`, `blackout.update`, `blackout.delete`, `amenity.setStatus`, `amenity.setHours`, `amenity.addException`, `checklist.submit`, `cleaning.log`, `water.log`, `occupancy.adjust`, `incident.raise`, `incident.merge`, `incident.convertToWorkOrder`, `workOrder.assign`, `workOrder.transition`, `workOrder.comment`, `roster.upsertShift`, `roster.markSick`, `roster.assignBand` |
| Events | `event.create`, `event.update`, `event.publish`, `event.cancel`, `showtime.add`, `showtime.changeTime`, `showtime.reduceCapacity`, `rsvp.create`, `rsvp.cancel`, `rsvp.removeAttendees`, `attendance.mark`, `attendance.syncOffline`                                                                                                                                                                                |
| Creche | `child.register`, `guardian.add`, `guardian.approve`, `creche.book`, `creche.cancel`, `creche.checkIn`, `creche.checkOut`, `creche.requestPickupApproval`, `creche.decidePickupApproval`, `creche.setActivity`, `incident.ackByParent`                                                                                                                                                                              |
| Dining | `reservation.create`, `reservation.cancel`, `reservation.approve`, `reservation.decline`, `reservation.seat`, `reservation.markNoShow`, `reservation.moveTables`, `reservation.runningLate`, `bill.settle`                                                                                                                                                                                                          |
| Wallet | `wallet.topUp`, `wallet.hold`, `wallet.releaseHold`, `wallet.refund`                                                                                                                                                                                                                                                                                                                                                |
| Comms  | `announcement.saveDraft`, `announcement.schedule`, `announcement.send`, `announcement.edit`, `announcement.recall`, `wa.reply`                                                                                                                                                                                                                                                                                      |
| Demo   | `demo.setRole`, `demo.setPersona`, `demo.setConsoleRole`, `demo.jumpClock`, `demo.reset`, `demo.snapshot`, `demo.restore`, `demo.setLocale`, `demo.setOffline`                                                                                                                                                                                                                                                      |

### 7.2 Rules engine contract (PRD §7)

```ts
export function validateBooking(
  state: AppState,
  req: BookingRequest,
  now: string,
  cfg: Rules,
): RuleOutcome;
type RuleOutcome =
  | { ok: true; charges: Charge[] }
  | {
      ok: false;
      code: RuleCode;
      params: Record<string, string | number>;
      alternatives: Alternative[];
    };
```

- The checks are an **ordered array** of `(ctx) => RuleOutcome | null`, and the first non-null result wins. Adding a check means adding one file and one entry in the array.
- The `code` maps to an i18n key: `rules.${code}.title` and `rules.${code}.body`, with interpolated `params`.
- `alternatives.ts` searches forward from the requested start, first the same day and then the next 7 days. It stops at 3 valid results, and gives up after 400 candidates (a performance guard).
- Padel, events (seat or headcount), creche (ratio) and dining (table fit) each provide their own `capacity` check. All other checks are shared.

### 7.3 Event bus

`eventBus.ts` is a typed pub/sub. `DomainEvent` is a discriminated union, for example `BookingConfirmed`, `WaitlistOfferSent`, `AmenityStatusChanged`, `AnnouncementSent`, `ChildCheckedIn` and `WorkOrderSlaAtRisk`.

Subscribers are side-effect modules registered once at boot:

| Subscriber          | Reacts by                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `notifications`     | Creating `Notification` records + WhatsApp messages, using the PRD §10 matrix as a lookup table in `domain/comms/matrix.ts` |
| `islandQueue`       | Pushing a device-level island notification for the persona currently on screen                                              |
| `ticker`            | Appending to the presenter ticker                                                                                           |
| `deliverySimulator` | Creating `Delivery` rows and scheduling tick jobs                                                                           |

### 7.4 Scheduler

```ts
interface Job {
  id: string /*deterministic*/;
  type: JobType;
  runAt: string;
  payload: unknown;
  done?: boolean;
}
type JobType =
  | 'hold.expire'
  | 'waitlist.offerExpire'
  | 'booking.reminder'
  | 'booking.noShowSweep'
  | 'event.reminder'
  | 'event.regClose'
  | 'showtime.complete'
  | 'dining.reminder'
  | 'dining.noShowFlag'
  | 'creche.pickupReminder'
  | 'creche.latePickup'
  | 'creche.endOfDaySweep'
  | 'announcement.send'
  | 'delivery.tick'
  | 'quietHours.release'
  | 'sla.check'
  | 'water.dueCheck'
  | 'checklist.dueCheck'
  | 'banner.expire'
  | 'event.publish';
```

- **Job IDs are deterministic**, e.g. `booking.noShowSweep:bk_123`. Enqueuing an ID that already exists does nothing, which makes jobs idempotent.
- `clock.ts` runs a `requestAnimationFrame` loop in live mode. Each tick advances `now` by `elapsed × speed` and calls `runDue(now)`.
- **`runDue(now)`:**
  1. Pop all jobs with `runAt ≤ now`, sorted by `(runAt, id)`.
  2. Set each job's **local `now` to its `runAt`**, so timestamps are true to the timeline even when the clock jumps.
  3. Dispatch the job's command as the `system` actor.
  4. Mark it done.

  Jobs can create new jobs. The loop runs until nothing is due, with a guard of 5,000 jobs per jump.

- **Jumps** (`+15m`, `+1h`, `Next day`, picker) call `runDue` once. The ticker groups the results ("Ran 46 jobs: 3 reminders, 1 no-show sweep, 40 delivery ticks…").
- **Leader only:** only the leader tab runs the clock and jobs (§8.2).

### 7.5 Delivery simulator (PRD §8.7)

- On `AnnouncementSent`:
  1. Resolve the audience (`domain/comms/audience.ts`).
  2. For each recipient, choose channels using the opt-in, app-push and quiet-hours rules (`fallback.ts`).
  3. Create a `Delivery` row in the `queued` state, or `held_quiet_hours`.
- **Timings are pre-computed at send time** from `rng('delivery', announcementId, recipientId, channel)`:
  - `sent`: +0.2–1s
  - `delivered`: +1–8s (1% fail)
  - `read`: a log-normal distribution. The median is 6 min for normal messages and 90s for urgent ones; about 15% never read.
- Batched `delivery.tick` jobs every 1s of demo time apply the state changes. A batch covers all deliveries whose next timestamp is ≤ now, which keeps the number of store writes low.
- **WhatsApp Channel posts** don't create per-recipient read rows. Instead, they increment `ChannelPost.views` from the same curve.
- **Urgent SMS fallback:** a job at send + 2 min checks each WhatsApp delivery that isn't yet delivered, and creates `sms_fallback` deliveries for them.
- The analytics view computes metrics from `Delivery` rows with selectors (median time to deliver, time to 50% and 90% read).

---

## 8. State, persistence and sync

### 8.1 Store composition

```ts
export const useStore = create<AppState>()(
  devtools(
    // dev only
    persist(
      subscribeWithSelector(
        immer((...a) => ({
          ...communitySlice(...a),
          ...amenitiesSlice(...a),
          ...bookingsSlice(...a),
          ...eventsSlice(...a),
          ...crecheSlice(...a),
          ...diningSlice(...a),
          ...walletSlice(...a),
          ...opsSlice(...a),
          ...commsSlice(...a),
          ...notificationsSlice(...a),
          ...auditSlice(...a),
          ...schedulerSlice(...a),
          ...demoSlice(...a),
        })),
      ),
      {
        name: 'amali-demo:v1',
        version: 1,
        migrate,
        partialize: excludeEphemeral,
        storage: debouncedStorage(300),
      },
    ),
  ),
);
```

- **Selectors:** colocated in `store/selectors/*`. Use `useStore(selector, shallow)` for object results. Expensive derivations (slot grid, KPIs, heatmap) are memoised with a small key-based cache that is invalidated by the slices they depend on.
- **Ephemeral state** is not persisted: open sheets, drag state, island queue and form drafts. These live in component state, or in `useUiStore` (a separate, non-persisted store).
- **Size budget:** the persisted state must stay under 3 MB. The 90-day history is **not persisted**. It is rebuilt from the seed at boot (deterministic), and only live-session changes are persisted.

### 8.2 Multi-tab sync (`store/sync.ts`)

- **Channel:** `BroadcastChannel('amali-demo')`. Each tab has a `tabId`.
- **Leader election:**
  1. A tab claims leadership through a `localStorage` lease (`amali-demo:leader = {tabId, expires}`), renewed every 2s.
  2. When the leader's lease expires, the next tab takes over.
  3. **Only the leader advances the clock and runs jobs.** Followers show the leader's clock.
- **Replication:**
  - After each successful command or job batch, the leader broadcasts `{type:'patch', version, patches}`, using immer patches (`enablePatches()`).
  - Followers apply the patches with `applyPatches` under a `remote` flag, which prevents a rebroadcast loop.
  - A follower that receives a version gap requests `{type:'snapshot'}`, and the leader replies with the full persisted state.
- **Commands from follower tabs** (e.g. the Guard app on a second screen) are sent to the leader as `{type:'command', name, input, actor}`. The leader runs the command and broadcasts the patch. This keeps one writer and avoids conflicts.
- **Same tab** (dual view) needs no sync: both frames read the same store.

### 8.3 Reset, snapshots and versioning

- `demo.reset(scenarioId?)` rebuilds the state from `buildSeed(seed, scenario.startAt)`, applies `scenarioFixtures`, clears jobs and re-enqueues seeded jobs (e.g. reminders for seeded bookings).
- Snapshots are named, JSON-serialised states in `localStorage` under `amali-demo:snap:<name>`, with a limit of 10. Restore = replace state + rebroadcast snapshot.
- Raising `version` in `persist` triggers `migrate`. In v1, migrate means re-seeding.

### 8.4 Stretch: real cross-device sync

`sync.ts` exposes a `Transport` interface (`send`, `onMessage`). `BroadcastTransport` is the v1 implementation. A future `SupabaseRealtimeTransport` can be added behind `features.remoteSync` without touching domain code. **Not in v1.**

---

## 9. UI implementation

### 9.1 Tokens → CSS → Tailwind

1. `design/tokens.ts` is the typed source.
2. A tiny build step, `scripts/tokens-to-css.ts` (run in `predev` and `prebuild`), writes `src/app/tokens.css` with CSS variables: `:root` for the app's light theme, `.staff` for the dark staff theme, `.shell` for the stage.
3. `globals.css` maps the variables into the Tailwind v4 `@theme` block, so classes like `bg-surface`, `text-brand`, `border-card`, `rounded-card` and `shadow-bar` exist.
4. `scripts/check-tokens.ts` fails lint if a raw hex value or `rgb(` appears outside `design/` and `tokens.css`.

Themes are scoped by a class on each device root, so a Guard frame (`.staff`) and a Resident frame (light) can sit side by side.

### 9.2 Device frames

- `DeviceFrame` takes `kind: 'phone' | 'tablet' | 'browser'`. It renders the bezel and status bar (demo time, signal icons). The phone frame includes the dynamic-island slot, which is where `IslandNotification` mounts.
- **Scaling:** content renders at its logical size (390 × 844, 1180 × 820 or 1440 × 900) inside a wrapper using `transform: scale(k)`, where `k` fits the available height. Use `transform-origin: top center`, and set `will-change: transform` only while resizing.
- Each frame is a scroll container. Lock body scroll so that the page never scrolls behind the frame.
- `dir` and `lang` attributes plus the theme class go on the frame's content root.
- **Below 600px** (an actual phone): the shell hides, the frame becomes full screen and the scale is 1.

### 9.3 Motion system (PRD §13)

- `design/motion.ts` exports the `dur`, `ease`, `spring` and `stagger` tokens. It also exports named **variants**: `pushScreen`, `popScreen`, `sheet`, `fadeUp`, `islandExpand`, `bubbleIn`, `shake`, `strike` and `listStagger`.
- **`<MotionConfig>`** at the root applies:
  - `transition` duration × `demo.motionSpeed` (wrap durations through `t(d)`)
  - `reducedMotion="user"`
- **Components only use the variants**, never inline numbers. Code review rule: a `grep` for `duration:` outside `design/` must return nothing.
- **Shared layout:** use `LayoutGroup` per device (not globally), so `layoutId`s don't collide between two frames. Prefix each ID with the device slot: `${slot}:ticket:${id}`.
- **Odometer:** each digit is a column of 0–9 translated on Y with `spring.snappy`. Tabular numbers. Respects reduced motion by swapping instantly.
- **Charts:** Recharts `isAnimationActive` and durations come from the tokens. The heatmap is custom SVG, which allows the diagonal stagger.

### 9.4 Forms

Forms are controlled with `zod` schemas and a small `useForm` hook in `lib/form.ts` (no form library). Validation messages are i18n keys. For a booking, the rules engine runs **live as inputs change**, debounced at 150ms, so that rule hints (quota, guests) appear before the user submits.

### 9.5 Simulated latency and states

- `withLatency(fn)` waits a random `simulatedLatencyMs` (default 300–600ms, and 0 in tests) before resolving.
- Every screen's initial data read goes through `useSimulatedQuery(key, selector)`. It returns `{status:'loading'|'ready'|'error', data}`; the first mount per key shows a skeleton.
- Presenter tools can force an error (`features.forceErrorKey`) or turn on offline for any device, so the error and offline states can be shown.

### 9.6 Notifications on device

- `IslandNotification` subscribes to `notifications` for the device's `actorId`.
- New items enter a per-device queue: show for 4s, stack up to 3, and deep link on tap.
- **WhatsApp role:** incoming `WaMessage`s show a separate WhatsApp-style banner instead.

### 9.7 Accessibility

- Every interactive element is a `button`, `a` or `input`, has a visible focus ring in `--brand`, and has a hit area of at least 44px (56px on staff surfaces).
- Status always combines an icon and text. Charts have a table toggle.
- The seat map is a grid with arrow-key navigation, `aria-pressed` and `aria-label="Row B, seat 3, available"`.
- Sheets trap focus and close on Esc.
- The live regions are the island notifications (`aria-live="polite"`, or `assertive` for urgent) and the reach meter.
- The `axe` Playwright check runs on each scenario's key screens. Zero serious or critical issues are allowed.

---

## 10. Scenarios as data

Scenarios drive three things from one definition: the **notes panel**, **"Take me there"**, and the **headless tests**.

```ts
interface Scenario {
  id: 'S1' | … | 'S8'; title: string; capability: ('C1'|'C2'|'C3'|'C4'|'C5'|'C6')[];
  startAt: string;                                  // demo clock at reset
  fixtures?: (draft: AppState) => void;             // e.g. James's two peak bookings
  steps: ScenarioStep[];
}
interface ScenarioStep {
  title: string; body: string;                      // notes panel copy (i18n keys)
  setup?: {
    clock?: string | { jump: string /*'+15m'*/ };
    dualView?: boolean;
    devices: Partial<Record<'A'|'B', { role: Role; actorId: string; consoleRole?: ConsoleRole; deepLink?: string }>>;
  };
  // test-only: the commands a presenter would perform, and what must be true after
  script?: { command: CommandName; input: unknown; actor: Actor }[];
  expect?: (s: AppState) => void;                   // vitest assertions
}
```

- **"Take me there"** applies the step's `setup`, but doesn't run the `script`. The presenter performs the actions live.
- **`tests/scenarios/*.test.ts`** runs every step's `setup` and `script`, then its `expect` checks, headless, against the real store. This proves each scenario works before the demo.
- **Playwright e2e** clicks through each scenario's critical path in the UI and checks the visible outcomes (e.g. a banner is visible on Layla and not on Sofia).

---

## 11. Seed data

- `buildSeed(seed, now)` is a pure function. Every random choice uses `rng(namespace)` from `lib/random.ts`, which combines the seed and namespace in `seedrandom`. Changing one part of the seed doesn't shift the rest.
- **Volumes:** about 240 units, 420 residents, 6 complete personas, 22 staff and 5 vendors. Plus the 7 amenities, 3 dining venues with tables, programme items covering 12 months, 1 season per type, 6 checklist templates, and 2 weeks of rosters.
- **History (90 days):** generated from hourly demand curves per amenity × weekday, multiplied by noise. Then outcomes are applied: no-show rates, cancellations, revenue, water readings and work orders (including a 3-day pool maintenance dip). History is rebuilt at boot and not persisted (§8.1).
- `scripts/map-amenity-images.ts`:
  1. Reads `public/amenities/`.
  2. Matches files to amenity keys by keyword (`padel`, `screen|cinema`, `music`, `creche|kid|play`, `dining|restaurant|teppan`, `pool`, `gym`).
  3. Renames matched files to `<key>.<ext>`.
  4. Prints a table of matches and gaps.

  Gaps fall back to the placeholder gradient (PRD §5.8).

- **Avatars and posters:** use neutral generated placeholders (initials on brand tint, poster gradients with a title). **No real people's photos**, and no film posters, studio artwork or film titles from real films. Invent the film titles for the screening events.

---

## 12. `CLAUDE.md` (place at the repo root)

```md
# Amali amenities prototype — rules for Claude Code

Read prd.md (what) and trd.md (how) before any phase. Build one phase at a time (trd.md §13).

## Non-negotiables

- No raw colours/sizes/durations in components. Use design/tokens.ts, design/motion.ts, Tailwind theme classes.
- No business numbers in code. Use config/rules.ts.
- Never call new Date()/Date.now() outside scheduler/clock.ts. Use useDemoClock() / ctx.now.
- Never mutate the store from components. Call dispatch(command, input).
- domain/* is pure TS: no React, no store imports.
- Every screen: loading, empty, error, no-permission, offline states.
- Every user-facing string is an i18n key in i18n/en.json (add the same key to ar.json with "TODO-REVIEW").
- Use logical CSS properties (ms/me/ps/pe/start/end). Never left/right.
- Money in fils (integers). Times stored as UTC ISO; display in Asia/Dubai.
- Files < ~250 lines. Split into parts/.
- Use layoutIds prefixed with the device slot.

## Workflow per phase

1. Re-read the PRD sections for the phase.
2. Write/extend types and domain functions first, with vitest tests.
3. Add commands + selectors. 4. Build UI. 5. Wire scenario steps.
4. Run: pnpm typecheck && pnpm lint && pnpm test && pnpm e2e --grep <scenario>.
5. Update trd.md "Build log" (§16) with what was done and any deviations. Commit.

## Commands

pnpm dev | pnpm build | pnpm typecheck | pnpm lint | pnpm test | pnpm e2e | pnpm images:map
```

---

## 13. Implementation plan

Each phase lists its **deliverables**, its **key files**, a **prompt** to give Claude Code, and its **exit criteria**. Don't start a phase until the previous one's exit criteria pass.

### P0 — Project foundations

**Deliverables:**

- Repo with Next 15, TypeScript strict, Tailwind v4, ESLint, Prettier, Vitest, Playwright and lefthook.
- Tokens → CSS pipeline; the fonts; the `/tokens` preview page.
- `config/rules.ts` with its zod schema, holding every PRD §8 value.
- `lib/time.ts`, `money.ts`, `random.ts`, `ids.ts`.
- All types (§5).
- The store skeleton with every slice (empty), persist, `dispatch` and the event bus.
- Clock, queue and `runDue`.
- `buildSeed` for community, personas, staff, vendors and amenities. The image-mapping script.

**Prompt:**

> Set up the project per trd.md §2, §4 and §12. Implement design tokens (prd.md §5) and the token preview page, rules config, all types from trd.md §5, the store skeleton with dispatch/event bus (trd.md §7.1, §7.3, §8.1), the demo clock and scheduler (§7.4), and the seed for community, people and amenities (§11). Write unit tests for time helpers, the scheduler (idempotency and ordered jump execution) and seed determinism.

**Exit criteria:**

- `pnpm build` produces a static `out/`.
- `/tokens` shows every token and the type ramp.
- Scheduler tests: a 3-day jump runs each job exactly once, in order.
- The same seed produces byte-identical state.
- `check-tokens` passes.

### P1 — Shell and device frames

**Deliverables:**

- RolePill (M1), Reset (M28), Menu, the notes panel (M2), the scenario index (empty steps for now), the persona picker, the demo clock badge and controls.
- Dual view; device frames for phone, tablet and browser, with scaling.
- The per-device Navigator and `useNav`; keyboard shortcuts.
- `/present?role=` single-device page.
- BroadcastChannel sync with leader election (§8.2).

**Prompt:**

> Build the demo shell per prd.md §4 and trd.md §6, §8.2, §9.2. Match the reference layout and the shell tokens. Each role renders a placeholder surface with its frame. Implement the Navigator with push/pop transitions (prd.md M3) and a test screen stack.

**Exit criteria:**

- The role switch animates at 60fps.
- Reset restores the seed.
- Dual view shows two independent frames.
- Opening `/present?role=guard` in a second tab mirrors state changes both ways.
- A clock jump on the leader updates the follower.

### P2 — Resident core and shared UI

**Deliverables:**

- UI primitives (§4 `ui/`), with the Figma components exactly matched.
- Home (PRD §9), Amenities list and detail (Pool and Gym read-only status here), What's On list, month and year view (empty data OK).
- Activity, My Unit, Wallet (ledger, top-up), Profile (language switch stub), Search.
- The island notifications and the five screen states.

**Exit criteria:**

- The screens match the Figma (Home, Amenities, Announcement card) when compared side by side.
- Every screen has its 5 states, viewable via presenter tools.
- The wallet top-up writes ledger entries.

### P3 — Padel (rules engine end to end)

**Deliverables:**

- The 11 checks plus alternatives; slot derivation; holds (M8); booking create, cancel and late cancel.
- Quota per unit; strikes and suspensions; waitlist with sequential and open-release offers; no-show sweep; guard scan and arrivals; check-in.
- Blackout with impact preview (M20), and the two handling modes; priority rebook.
- Reminders and confirmations through the notification matrix (basic WhatsApp messages, enough to show offers; the full WhatsApp UI comes in P5).
- Fixtures and steps for S1 and S2.

**Exit criteria:**

- `validateBooking` has tests for every code, and for check order.
- Headless S1 and S2 pass.
- E2E: in dual view, the double-confirm race gives exactly one booking.
- E2E: the waitlist offer reaches Ahmed after Layla's offer expires.

### P4 — Events (Screening and Music)

**Deliverables:**

- The event builder (console) with multi-day showtimes and pricing by category.
- Publishing and lifecycle jobs; the seat map with holds; the headcount mode.
- The RSVP form with guest allowance and age rules; partial cancellation; waitlist by party size.
- Reminders at T−24h and T−2h; capacity reduction flow; time-change flow.
- Guard attendance, live and post-remote, plus the offline queue and sync.
- What's On fully populated. S3.

**Exit criteria:**

- Headless S3 passes.
- Seat-race e2e passes.
- The year view renders 12 months in under 50ms (measured).

### P5 — Communications and the WhatsApp phone

**Deliverables:**

- The audience resolver (all clause kinds, include and exclude) with a live count.
- The composer, with all fields from PRD §8.7 and a preview for each channel; the daily-update template built from live statuses.
- Scheduling, the daily recurrence and quiet hours.
- The delivery simulator (§7.5) and the analytics view (funnel M21, recipient table, time to reach, Channel vs 1:1).
- Banners (targeted, with expiry) (M14); recall and edit; the urgent flow plus SMS fallback.
- The WhatsApp surface: Chats, Thread, Channel; quick replies run commands; tick animation (M16).
- S7.

**Exit criteria:**

- Headless S7 passes, including the targeting checks (Layla ✓, Priya ✓ app-only, Sofia ✗).
- The urgent closure reaches more than 95% delivered within 10s of demo time at speed 1.
- WhatsApp "Reply 1" confirms a padel booking.

### P6 — Pool & Gym operations, work orders, rosters, vendors

**Deliverables:**

- The status model, hours editor and exceptions; the occupancy counter (guard) and ring (resident) (M17).
- Checklists (M18); the cleaning log; water readings with range validation (M19) and the trend chart.
- Rosters: the week grid, coverage rules and gap detection.
- Incidents → work orders with the SLA engine (pause, at risk, breach); vendors and their SLA performance; the audit log viewer.
- The emergency closure → guard "Clear pool" acknowledgement. S6.

**Exit criteria:**

- Headless S6 passes.
- SLA unit tests cover pause and resume and the 75% and breach thresholds.
- A lifeguard gap triggers the alert.

### P7 — Creche

**Deliverables:**

- Child and guardian registration with approval; sessions; ratio capacity driven by `BandAssignment` and the roster.
- The staff room board (M25); check-in with blocks and the allergy acknowledgement; check-out with the unauthorised-collector approval through app and WhatsApp.
- Parent live status and the activity timeline; late pickup timer and fee.
- Incidents with parent acknowledgement; the end-of-day sweep. S4.

**Exit criteria:**

- Headless S4 passes, including the sick-carer ratio drop and its recovery.
- The ratio unit tests cover every band and the room cap.

### P8 — Dining and wallet integration

**Deliverables:**

- Venues and tables; the reservation flow with preferences and requests.
- Request mode for large parties; deposits as wallet holds; the insufficient-balance flow with an inline top-up.
- The F&B tablet: timeline with drag (M24), floor plan, arrivals, covers and forecast, settlement with the deposit applied and the minimum-spend line.
- The no-show policy (auto-flag, forfeit, deposit requirement after repeats). Ramadan Iftar period. S5.

**Exit criteria:**

- Headless S5 passes.
- The wallet invariant holds: `available = balance − Σ active holds ≥ 0` (property test).

### P9 — Programme calendar (recurring and seasonal)

**Deliverables:**

- RRULE builder UI; expansion inside the horizon; edit scopes (this / following / all).
- Conflict detection against blackouts, other activities and bookings, using the shared impact preview.
- Seasons with hours overrides and the year-view bands.
- Seeded programme: Aqua Aerobics, Padel Clinic, Kids' Music Class, Winter Movie Season, Summer Camp and Ramadan.

**Exit criteria:**

- The Padel Clinic removes Saturday 08:00–10:00 slots.
- The Ramadan season changes pool hours and flags the Aqua Aerobics conflict.
- The edit-scope tests pass.

### P10 — Reporting, export and RBAC

**Deliverables:**

- The 90-day history generator.
- KPI calculators with the exact PRD formulas, plus unit tests on small hand-made datasets.
- Overview dashboard (live); Reports "generate on request" (M23); charts (M22) and the heatmap.
- The ExcelJS workbook builder (sheets, bold headers, frozen panes, AED and date formats), filtered per role.
- The RBAC matrix in `config/rbac.ts` with `can()`. The console role switch; navigation and action gating; PII masking with a logged reveal; the agent's "book on behalf" with a required reason.
- S8.

**Exit criteria:**

- Headless S8 passes.
- The exported workbook opens in Excel and Numbers with the correct sheets for each role (snapshot test of sheet names and headers).
- Every RBAC cell in PRD §8.11 has a test.

### P11 — Arabic, polish, quality

**Deliverables:**

- `ar.json` with all keys present; a per-device locale switch (M29); the RTL audit (logical properties, mirrored icons, `<bdi>`); Arabic font.
- A motion audit against the PRD §13 table (every M-number implemented and listed in `motion-audit.md`); reduced-motion pass.
- Performance pass (§14); the axe pass; Playwright e2e for S1–S8.
- Production build deployed.

**Exit criteria:**

- All 8 scenarios pass e2e.
- axe reports zero serious issues.
- Lighthouse performance ≥ 90 on `/`.
- 60fps traces for the role switch and the urgent closure.
- A full rehearsal from reset through S1–S8 with no console errors.

### Phase dependency graph

```
P0 → P1 → P2 → P3 ─┬→ P4 ─┐
                   ├→ P5 ─┼→ P9 → P10 → P11
                   ├→ P6 ─┤
                   ├→ P7 ─┤   (P7 needs P6 rosters)
                   └→ P8 ─┘
```

P4, P5, P6 and P8 can run in parallel sessions or git worktrees once P3 is done. P7 needs P6 for rosters.

---

## 14. Performance budgets

| Metric                                     | Budget                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| JS (first load, gzipped)                   | ≤ 350 KB. Lazy-load the console, F&B, charts and ExcelJS with `next/dynamic`                     |
| Time to interactive (laptop)               | ≤ 2.0s on the first load; ≤ 0.8s after cache                                                     |
| Store update → frame paint                 | ≤ 16ms for any single command on screens visible in dual view                                    |
| Slot grid derivation                       | ≤ 2ms per (amenity, date) (memoised)                                                             |
| Report generation (90 days, all amenities) | ≤ 400ms of compute (the skeleton animation covers the rest)                                      |
| Excel export                               | ≤ 1.5s                                                                                           |
| Clock jump of 7 days                       | ≤ 300ms to run all jobs                                                                          |
| Images                                     | `public/amenities/*` resized to at most 1200px wide, WebP with a JPG fallback, under 250 KB each |

**Techniques:**

- Narrow selectors with `shallow` comparison.
- Virtualise lists over 50 rows (console tables) with a small custom windowing hook.
- Use `content-visibility: auto` on long console pages.
- Batch delivery ticks.
- Debounce persistence by 300ms.

---

## 15. Testing strategy

| Layer               | Tool                   | What                                                                                                                                                                                                 |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain unit         | Vitest                 | Rules checks and order; quotas; penalties; waitlist logic; ratio; deposits; wallet invariant; SLA timers; audience resolver; delivery timing determinism; KPI formulas; RRULE expansion; edit scopes |
| Scheduler           | Vitest                 | Idempotency, ordering, jump batches, local `now` per job                                                                                                                                             |
| Scenario (headless) | Vitest                 | S1–S8 `script` + `expect` against the real store                                                                                                                                                     |
| Component           | Testing Library        | Primitives' states, seat-map keyboard navigation, form validation messages                                                                                                                           |
| E2E                 | Playwright             | One spec per scenario; the dual-view race; the multi-tab sync; RTL smoke                                                                                                                             |
| Accessibility       | axe + Playwright       | Key screens per surface                                                                                                                                                                              |
| Visual              | Playwright screenshots | Home, Amenities, Padel detail, console overview, in EN and AR (manual review, not CI-blocking)                                                                                                       |

**CI** (GitHub Actions, optional): `typecheck → lint → test → build → e2e`.

---

## 16. Build log and deviations

Claude Code adds a dated entry here at the end of each phase.

| Date       | Phase | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Deviations from PRD/TRD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14 | —     | TRD created                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Excel export uses ExcelJS instead of SheetJS (cell styling)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-14 | P0    | Project foundations: Next 15 + TS strict + Tailwind v4 + ESLint (layering rule) + Prettier + Vitest + Playwright + lefthook scaffolded. Tokens → CSS pipeline (`scripts/tokens-to-css.ts`) and `/tokens` preview page. `config/rules.ts`/`rules.schema.ts` with every PRD §8 business number, zod-validated at import. All `src/types/*` per TRD §5. Store skeleton: 13 slices (community/amenities/bookings/events/creche/dining/wallet/ops/comms/notifications/audit/scheduler/demo), immer + persist + subscribeWithSelector, a generic `dispatch()` with an extensible `CommandRegistry` (phases register commands via declaration merging rather than editing a shared file), and a typed event bus. Scheduler: `JobQueue` (idempotent by job id) + `SchedulerEngine.runDue` (ordered by `(runAt, id)`, each job sees its own `runAt` as local `now`, 5,000-job safety guard), plus pure clock-jump math and a `useDemoClock` hook. `buildSeed(seed, now)` for community (~230 units / ~420 residents, deterministic via namespaced `seedrandom` streams), the 6 personas + related records (Khalid, Rashid's tenant, Omar/Noor), 17 named staff, 5 vendors and the 7 amenities. `scripts/map-amenity-images.ts` run — all 7 amenity images mapped (no gradient placeholders needed; 5 extra non-matching images left as-is). 51 unit tests (time, random, rules, rbac, scheduler, seed determinism) pass; `pnpm typecheck`/`lint`/`build` (static `out/`) all clean.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `next-env.d.ts` excluded from ESLint (auto-generated). RBAC's `config/rbac.ts` + `domain/rbac/can.ts` built in P0 (ahead of its TRD §13 phase placement) since `dispatch()`'s RBAC check needed _something_ to call — kept intentionally minimal (grant scope only, no PII-masking logic yet). Demo/presenter commands (`demo.setRole` etc., listed in the TRD §7.1 catalogue) are implemented as direct slice actions on `store/slices/demo.ts` rather than routed through `dispatch()` — they're presenter-tool mechanics, not domain mutations needing RBAC/audit/events, and P1 (shell) is where they get a UI. Fixed a latent bug in `TZDate#toISOString()` (zone-offset suffix instead of UTC `Z`) that would have silently broken ISO-string ordering — `lib/time.ts#toIso` normalizes via `new Date(x.getTime())` wherever a TZDate-derived value becomes a stored ISO string.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-15 | P1    | Demo shell end to end: RolePill (shared-`layoutId` indicator slide, keys 1-6), ResetButton (confirm + 360° spin + `hydrateFromSeed`), MenuButton → PresenterMenu (scenario index, clock controls, dual view, motion speed, language, offline, a `/rules` config viewer link). PersonaPicker (6 personas on Resident/WhatsApp; role-scoped staff list elsewhere). DemoClockBadge (+15m/+1h/Next day + free datetime picker). NotesPanel + ScenarioIndex with a proper empty state (`scenarios/` is typed and wired but empty until P3+). DeviceFrame (Phone/Tablet/Browser + StatusBar + DynamicIsland) with a width-and-height-aware scaling hook. DeviceSlot maps role → frame kind/theme and animates the PRD M1 swap. Navigator: push/pop stack navigation (PRD M3) with edge-swipe-to-pop, up to 4 mounted screens, used by a shared placeholder surface per role (real surfaces land in P2+). `navigation/useNav` + `navigation/deepLinks` (`amali://surface/route?params`). `store/sync.ts`: BroadcastChannel + localStorage-lease leader election; only the leader runs the live clock tick and due jobs (`useDemoClock` gates on `useIsLeader()`). `/present?role=&persona=` single-device second-screen page. Keyboard shortcuts (1-6, T, D, arrows). 17 new unit tests (deep links, nav actions) — 68 total passing; `typecheck`/`lint`/`build` clean. Manually verified in-browser: push/pop transitions, all 3 frame kinds, staff dark theme, dual view (Resident+Guard), and — the critical one — live bidirectional sync between the main tab and a `/present` tab (clock jump leader→follower, nav push follower→leader), with no page reload.                                                                                                                                                                                                                                                                                                                                                                                                              | Found and fixed 3 real bugs during manual testing, each with broader implications: (1) fresh device sessions started with an empty `nav.stack`, racing `hydrateFromSeed`'s full-state replace against the surface's own seeding effect — fixed by never creating a device session with an empty stack (the seeding effect became unnecessary and was removed); (2) Navigator's stacked screens had no background colour, so the screen underneath visibly bled through during transitions — added `bg-bg-page`; (3) **Tailwind v4's `@theme` resolution constant-folds a `var(--theme-token: var(--raw-token))` indirection to `--raw-token`'s `:root` value at build time**, which silently broke every theme-switchable utility (`bg-bg-page`, `text-text-body`, etc.) under the `.staff` dark-theme scope — the 9 affected utilities are now hand-written `@utility` rules in `globals.css` instead of `@theme` mappings (documented there for future tokens). Also: a classic flexbox `min-width:auto` bug let the two dual-view device frames' fixed-pixel content (e.g. a 1440px browser frame) overflow their flex row — fixed with `min-w-0` on the flex items. Deferred: the PRD §4.1 sub-600px responsive mode (full-screen chrome-hidden, long-press role switcher) — not exercised by any P1 exit criterion; revisit only if a real-phone demo becomes a requirement. Reset's confirm dialog uses native `window.confirm()` (not a themed modal) — simplest correct choice for an internal presenter action.                                                                                                                                                                                                                                      |
| 2026-10-15 | P2    | Resident core + shared UI primitives end to end: `Button`/`Tag`/`Card`/`Input`/`Stepper`/`IconButton`/`Sheet` (drag-to-dismiss)/`Toast`+`ToastHost`/`Banner`/`Odometer` (per-digit rolling animation)/`RingGauge`/`Skeleton`/`EmptyState`/`ErrorState`/`NoPermission`/`OfflineBar` (freezes "last updated" the instant offline flips)/`TopBar`/`BottomNav`/`QuickActionTile`/`AmenityCard`/`InfoCard`/`Calendar` (Month + Year grids). `useSimulatedQuery` (PRD §9.5 latency, skeleton shown once per key per session). Wallet domain + command: `domain/wallet/ledger.ts#applyTopUp` (pure, decline-aware) wired through `store/commands/wallet.ts`'s `wallet.topUp` (writes wallet balance + a ledger entry + audit log via `dispatch`). Resident screens: Home (hero, today strip, 3×2 quick actions), Amenities list + Detail (occupancy ring + hours for pool/gym; rules summary + stubbed "Book" for padel/screening/music/creche/dining; PRD §11 leased-unit access-blocked banner), What's On (list/month/year), Activity (notifications/bookings tabs), My Unit (household/children/wallet/guests-stub/amenity-rights), Wallet (balance, top-up sheet with AED 500/1000/2000 presets + simulated card decline, ledger), Profile (language, notification channels, help stub), Search. Occupancy placeholder (`domain/ops/occupancyEstimate.ts`, deterministic two-peak curve) stands in until P6's real guard counter. 6 new design tokens (skeleton shimmer, gradient-placeholder end, hero fallback gradient, SOS gradient) piped through `tokens-to-css.ts`. 6 new unit tests (wallet top-up: pure function + full dispatch integration, including the decline-no-charge path) — 74 total passing; `typecheck`/`lint`/`build` clean (5 static routes). Manually verified in-browser: full wallet top-up flow (balance 2450→4450→4950, ledger entries correct), card-decline path (inline error, balance unchanged, retry works), Rashid's leased-unit banner matches PRD §11 text exactly and disables booking, staff dark theme unaffected by the new tokens. | Found and fixed 2 real bugs during manual testing: (1) **a Zustand infinite-render loop** — 7 screens called `useStore((s) => Object.values(s.record).filter(...))`, and because the selector returned a freshly-allocated array every render, Zustand's `useSyncExternalStore` subscription saw a "changed" snapshot every single render, causing "Maximum update depth exceeded" and a blank page; fixed everywhere by selecting the raw stable `Record` from the store and deriving `.filter()`/`.map()` outside the selector, in the component body — flagged in `CLAUDE.md` as a pattern to avoid going forward; (2) `AmenityCard`'s "Book" button was a `<button>` nested inside the card's own `<button onClick={onOpen}>`, which is invalid HTML and threw a hydration error — fixed by making them sibling buttons, absolutely positioned within a shared `relative` container so Book still visually overlaps the image. Also carried forward and applied the P1 Tailwind `@theme` constant-folding finding to every new theme-switchable token added this phase (none needed per-scope overrides, but checked each one). Scope simplifications, all deferred to their stated phases per TRD §13: "Book" on padel/screening/music/creche/dining shows a stub toast ("Booking opens in a later phase") rather than a real flow (P3 Padel is the first real booking engine); Guests section on My Unit is a placeholder string; What's On's Month/Year calendars render with no events yet (P4+); occupancy numbers are a deterministic curve, not derived from any guard-counter state (P6). Figma was not reachable this session (no auth configured); screens were built to the PRD's written component/token/copy specs instead of a visual diff. |

---

## 17. Delivery

| Item                     | Detail                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Hosting                  | Vercel (static, from `out/`) or Netlify. No environment variables needed                      |
| Presenter laptop         | Chrome, latest. Open `/` once online before the demo so that fonts and images are cached (T6) |
| Second screen (optional) | Open `/present?role=guard` in a second Chrome window on the same profile                      |
| Rehearsal                | Reset → snapshot "Clean" → run S1–S8 → restore "Clean"                                        |
| Hand-off                 | Repo with README (setup, scripts, scenario list), `prd.md`, `trd.md`, `CLAUDE.md`             |
