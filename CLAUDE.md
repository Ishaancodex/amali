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
