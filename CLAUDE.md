# Amali amenities prototype — rules for Claude Code

Read `documents/prd.md` (what) and `documents/trd.md` (how) before any phase. Build one phase at a time (trd.md §13).

## Non-negotiables

- No raw colours/sizes/durations in components. Use `design/tokens.ts`, `design/motion.ts`, Tailwind theme classes.
- No business numbers in code. Use `config/rules.ts`.
- Never call `new Date()`/`Date.now()` outside `scheduler/clock.ts`. Use `useDemoClock()` / `ctx.now`.
- Never mutate the store from components. Call `dispatch(command, input, actor)`.
- `domain/*` is pure TS: no React, no store imports.
- Every screen: loading, empty, error, no-permission, offline states.
- Every user-facing string is an i18n key in `i18n/en.json` (add the same key to `ar.json` with `"TODO-REVIEW"`).
- Use logical CSS properties (`ms`/`me`/`ps`/`pe`/`start`/`end`). Never `left`/`right`.
- Money in fils (integers). Times stored as UTC ISO; display in Asia/Dubai.
- Files < ~250 lines. Split into `parts/`.
- Use `layoutId`s prefixed with the device slot (`${slot}:ticket:${id}`).

## Extensibility patterns already in place (Phase P0)

- **Commands:** `store/commands/registry.ts#defineCommand` registers a handler against the `CommandRegistry` interface (`store/commands/types.ts`). Each phase's command module augments `CommandRegistry` via `declare module` — see `store/slices/demo.ts` / `store/commands/dispatch.ts` for the pattern with `RootActions`. This keeps `dispatch()`'s generics accurate without editing a shared file per phase.
- **Scheduler:** `scheduler/engine.ts` exports the single shared `schedulerEngine`. Register a job handler once per `JobType` with `schedulerEngine.on(type, handler)`. Add new `JobType`s to `scheduler/queue.ts`.
- **Domain events:** add new variants to the `DomainEvent` union in `store/eventBus.ts` as each phase needs them.
- **RBAC:** capabilities live in `config/rbac.ts` (the matrix) and `domain/rbac/can.ts` (the pure check). Add a `Capability` string and a grant per `ConsoleRole`, then pass `capability` (and optionally `resolveAmenity`) to `defineCommand`.

## Workflow per phase

1. Re-read the PRD sections for the phase.
2. Write/extend types and domain functions first, with vitest tests.
3. Add commands + selectors.
4. Build UI.
5. Wire scenario steps.
6. Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e --grep <scenario>`.
7. Update `documents/trd.md` "Build log" (§16) with what was done and any deviations. Commit.

## Commands

```
pnpm dev | pnpm build | pnpm typecheck | pnpm lint | pnpm test | pnpm e2e | pnpm images:map | pnpm tokens:css | pnpm check:tokens
```

## Phase P0 status (done)

Project foundations, tokens → CSS pipeline + `/tokens` preview page, `config/rules.ts` (zod-validated, every PRD §8 number), all types (`src/types/*`), the store skeleton (every slice, persist, dispatch, event bus), the scheduler (`JobQueue` + `SchedulerEngine.runDue`, tested for idempotency and ordering across multi-day jumps), and `buildSeed` for community (~230 units / ~420 residents), the 6 personas, named staff, 5 vendors and the 7 amenities — deterministic under `(seed, now)`. The amenity images are mapped (`pnpm images:map`).

Not yet built at that point (later phases, per trd.md §13): the demo shell (P1), all resident/guard/creche/F&B/console UI (P2+), the booking rules engine and every domain's commands (P3+), i18n content, motion wiring in components, and RBAC enforcement beyond the `can()` primitive.

## Phase P1 status (done)

The demo shell: RolePill, Reset, PresenterMenu (scenario index + clock/dual-view/motion-speed/language/offline controls + a `/rules` viewer), PersonaPicker, DemoClockBadge, NotesPanel/ScenarioIndex (empty until P3+ scenarios land), DeviceFrame (Phone/Tablet/Browser), DeviceSlot (role → frame/theme), Navigator (push/pop, PRD M3), `useNav`/deep links, keyboard shortcuts (1-6/T/D/arrows), `/present?role=` second-screen page, and `store/sync.ts` (BroadcastChannel + leader election — only the leader ticks the clock/runs jobs). Each role currently renders a shared placeholder surface (real surfaces are P2+).

**Read before touching theme-switchable colours:** Tailwind v4's `@theme` resolves a `var(--theme-token: var(--raw-token))` indirection to a literal value at build time, breaking any token meant to change per-scope (like `.staff`'s dark overrides). The 9 tokens that `.staff` overrides (`brand`, `bg-page`, `surface`, `border-card`, `text-title`/`body`/`muted`/`placeholder`) are hand-written `@utility` rules in `globals.css`, not `@theme` entries — see the comment there before adding a new theme-switchable token.

Not yet built: real per-role surfaces and their screens (P2+), the booking rules engine and domain commands (P3+), scenarios S1-S8, i18n content, the sub-600px responsive shell mode (deferred — see trd.md §16).

## Phase P2 status (done)

Resident core + shared UI: all P2 primitives (`ui/Button`/`Tag`/`Card`/`Input`/`Stepper`/`IconButton`/`Sheet`/`Toast`/`Banner`/`Odometer`/`RingGauge`/`Skeleton`/`EmptyState`/`ErrorState`/`NoPermission`/`OfflineBar`/`TopBar`/`BottomNav`/`QuickActionTile`/`AmenityCard`/`InfoCard`/`Calendar`), `useSimulatedQuery`, and real Resident screens: Home, Amenities list + Detail, What's On, Activity, My Unit, Wallet, Profile, Search. Wallet is the one fully real domain this phase: `domain/wallet/ledger.ts#applyTopUp` → `wallet.topUp` command (balance + ledger entry + audit, decline path included) — verified end to end in-browser. Occupancy is a deterministic placeholder curve (`domain/ops/occupancyEstimate.ts`) until P6's real guard counter. Booking buttons on non-padel amenities are stubs (toast only) until each amenity's phase lands.

**Two footguns found this phase, worth knowing before writing new screens:**

- **Never return a freshly-computed array/object from a Zustand selector** (`useStore((s) => Object.values(s.x).filter(...))`) — each render gets a new reference, which Zustand's `useSyncExternalStore` treats as a real change, causing an infinite re-render loop. Select the raw `Record` from the store, then `.filter()`/`.map()` in the component body instead.
- **A `<button>` can never contain another `<button>`** (invalid HTML, breaks hydration) — `AmenityCard`'s Book button is a sibling, absolutely positioned to visually overlap the image, not nested inside the card's own button. Watch for this pattern anywhere a card has its own secondary action.

Not yet built: real booking flows for any amenity (P3+), events/screening content, creche/F&B/console surfaces (P5+), i18n content, guest management.

## Phase P3 status (done)

The padel booking rules engine, end to end — the first fully real domain in the app. `domain/booking/` (pure): `validate.ts#validateBooking` runs all 11 PRD §7 checks in order (`domain/rules/errors.ts#RuleCode`), plus `slots.ts`/`hours.ts`/`quota.ts`/`strikes.ts`/`waitlistOffer.ts`/`blackoutImpact.ts`/`alternatives.ts`. Commands (`store/commands/`): `booking.hold`/`.confirm`/`.bookNow`/`.cancel`/`.checkIn`/`.markNoShow`/`.priorityRebook`, `waitlist.join`/`.accept`/`.withdraw`/`.expireOffer`, `blackout.create`, `suspension.lift`. Scheduler job handlers (`scheduler/jobs/booking.ts`) for `hold.expire`/`waitlist.offerExpire`/`booking.noShowSweep`. S1 and S2 (`scenarios/`) pass headless end to end via `tests/scenarios/runner.ts`. Resident UI: a real padel booking flow (`screens/amenities/padel/`) and a status card (quota, suspension, upcoming booking with cancel/check-in, waitlist). 124 tests passing.

**Two architectural fixes from this phase, relevant to any future command/job work:**

- **The scheduler's live `schedulerEngine.queue` and the persisted `state.jobs` record are two separate stores** — `dispatch()` now bridges every job a command creates into both. A job-triggered `dispatch()` call should always pass `opts.now` as the firing job's own `runAt` (not the live clock), so multi-day jumps keep each job's timestamp honest.
- **Never return a live draft reference as a command's `value`.** `const x = ctx.state.foo[id]; ...mutate x...; return { value: x }` returns a proxy that's revoked the instant the producer exits — `dispatch()` now calls immer's `current()` on it automatically, but don't rely on returning a draft from anywhere else.

Guard check-in, the console blackout screen, and a WhatsApp waitlist-offer thread are real, tested commands with no UI surface yet — Guard/Console/WhatsApp still render P1's placeholder surface; P6/P10/P5 build those for real. No visible hold-countdown UI (the two-step `booking.hold`/`.confirm` architecture exists and is tested; the screen itself calls `booking.bookNow`). No Playwright e2e specs (consistent with P0-P2) — the double-confirm race and the waitlist hand-off are covered by dispatching against the real store in `tests/unit/booking-commands.test.ts` instead.

## Phase P4 status (done)

Events end to end — Screening Room (seats) and Music Room (headcount). `domain/events/` (pure): `capacity.ts`/`seats.ts`/`pricing.ts`/`waitlist.ts` (`findNextFittingParty` — party-size-fitting, not plain FIFO)/`calendarDots.ts` (What's On's month/year dots)/`validate.ts#validateRsvp` (6 ordered checks, reusing `domain/rules/errors.ts`'s shared `RuleCode` shape). Commands: `rsvp.hold`/`.bookNow`/`.confirm`/`.cancel`/`.markAttendance`/`.releaseExpiredHold`/`.sendReminder`, `eventWaitlist.join`/`.accept`/`.withdraw`/`.expireOffer`, `event.create`/`.publish`/`.cancel`. `rsvp.hold`/`eventWaitlist.join` go straight to P3's "hold as a state on the entity itself" pattern — no Hold-entity redundancy ever built for events. Scheduler job handlers (`scheduler/jobs/events.ts`) for `rsvp.holdExpire`/`eventWaitlist.offerExpire`/`event.reminder` (own `JobType`s, distinct from padel's — `schedulerEngine.on` keeps one handler per type); the T-2h reminder writes a WhatsApp `template` message with a "Cancel" quick-reply button. S3 (`scenarios/s3-screening.ts`) passes headless end to end, matching PRD §15 exactly. Resident UI: `WhatsOnScreen`'s List/Month/Year all wired to real published showtimes (day-tap filters List), a new `EventDetailScreen` (showtime picker, attendee steppers capped at the venue's guest limit, a seat grid for Screening, live fee line, RSVP/cancel, waitlist fallback). 173 tests passing.

**One footgun found this phase, worth knowing when running `pnpm build` alongside a live `pnpm dev`:** they share `.next`, and a `next build` run while `next dev` is serving can corrupt the dev server's state badly enough that it keeps serving (200s, no console error) while actually broken — CSS 404s, module-level code silently stops running. If dev state looks wrong for no visible reason, the fix is always: stop dev, `rm -rf .next`, restart dev.

No console event-builder UI and no guard attendance-marking screen — `event.create`/`.publish`/`.cancel` and `rsvp.markAttendance` are real, tested commands with no UI surface yet (same deferral P3 made for blackout creation); Console/Guard still render P1's placeholder surface. No per-attendee name field (generic "Household 1"/"Guest 1" names). No visible RSVP hold-countdown UI (same reasoning as padel's). Announcement-on-publish (PRD §8.2) is left to P5, where the composer itself lands. No Playwright e2e specs (consistent with every phase so far).

## Phase P5 status (done)

Communications and the WhatsApp phone, end to end — Console and WhatsApp both get their first real surfaces, replacing P1's placeholder. `domain/comms/` (pure): `audience.ts` (`resolveAudience` — all 8 `AudienceClause` kinds, include-union-minus-exclude-union), `fallback.ts` (`isQuietHours`, `resolveChannelsForResident` — push-off falls back to WhatsApp, WhatsApp opt-out falls back to app inbox), `delivery.ts` (`planDeliveryTimes` precomputes a recipient's whole send/deliver/read schedule once, at send time, from a seeded rng stream; `resolveDeliveryState` just compares `now` against that plan — the `delivery.tick` sweep never re-rolls anything), `dailyTemplate.ts`, `analytics.ts` (funnel, time-to-reach, the reach meter). Commands: `announcement.create`/`.fireScheduled`/`.recall`/`.edit`, `comms.tickDeliveries`/`.releaseQuietHours`, `amenity.emergencyClose`/`.reopen`, `wa.recordReply`. `bookingHelpers.ts#notify` gained an optional `buttons` param; padel's waitlist offer now sends real "Reply 1 to book · 2 to pass" quick-reply buttons instead of plain text. S7 (`scenarios/s7-comms.ts`) passes headless end to end, matching PRD §15's targeting proof exactly. UI: a new Console shell (`surfaces/console/` — left rail + Communications list + a full composer with live audience preview + an analytics detail screen) and a new WhatsApp surface (`surfaces/whatsapp/` — Chats/Channel tabs + a Thread screen with working quick replies and live-derived tick icons). Resident `HomeScreen` renders targeted, expiry-aware banners. 208 tests passing.

**Two real bugs found and fixed this phase, worth knowing before touching RBAC-gated console UI or banner logic:**

- **A capability's grant `scope` matters, not just whether it's granted.** Gating a UI action purely on `staff.assignedAmenities` breaks for any role whose grant is `scope: 'all'` (e.g. a Community Manager has no `assignedAmenities` populated — that field is specifically how `scope: 'assigned'` roles are scoped). Check `grantFor(consoleRole, capability).scope` first: 'all' means every relevant target, 'assigned' means filter to `assignedAmenities`.
- **A same-`sentAt` tie needs `>=`, not `>`, when "newer wins."** Two console actions dispatched without the demo clock moving between them (e.g. emergency-close immediately followed by reopen) can share an identical `sentAt`. Any "pick the latest of these" dedup keyed on a timestamp must use `>=` so a later-created-but-same-timestamp row still wins over an earlier one — `Object.values()` preserves insertion order for string keys, so this is reliable.

`useConsoleActor` derives a console device's RBAC role by falling back to the picked staff member's own `staff.role` when the presenter hasn't separately set `device.consoleRole` — safe because the persona picker only ever offers console staff whose own role already is a valid `ConsoleRole`. Deliberate scope cuts: the composer's audience builder only exposes tower/floor-range/cluster/whole-community as UI chips (`exclude`/`bookers`/`parents`/`optedIn` are real and tested at the domain/command layer, no UI); editing a sent message only updates title/body (no WhatsApp "Send correction" follow-up); the "possible duplicate urgent" warning isn't implemented; Guard's "Clear the pool" alert is a real, tested `Notification` with no UI to show it — Guard is still P1's placeholder, and lifeguards aren't even selectable in the Guard persona picker yet, both P6's job. No Playwright e2e specs (consistent with every phase so far).
