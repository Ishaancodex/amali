# PRD — Amali Residences Amenities Operations Prototype

| | |
|---|---|
| **Product** | Amali App — Amenities Operations (standalone functional prototype) |
| **Client** | Amali Properties — Amali Residences, Dubai Canal |
| **Author** | Ishaan (Senior Product Designer) |
| **Build mode** | Vibe-coded with Claude Code |
| **Data** | Fully mocked, seeded, client-side |
| **Version** | v1.0 — 14 Oct 2026 |
| **Status** | Ready for build |

---

## 0. How Claude Code should use this document

This PRD is the single source of truth for the build. Before writing code, read sections 1–7 in full. Then build in the phase order in §17. Keep the following rules for the whole build:

1. **Tokens only.** Never hardcode a colour, radius, font size, duration or easing. Take them from `src/design/tokens.ts` / CSS variables (§5, §13).
2. **Rules live in config.** Every business number in this document (slot length, quota, ratio, fees, grace periods) lives in `src/config/rules.ts`. A presenter must be able to change a rule there and see the whole app follow it.
3. **One store, many surfaces.** All six surfaces read from and write to one shared store (§16). An action on one device must show up on every other device that cares, with an animation, within one render frame.
4. **Every screen has states.** Each screen has a default, empty, loading (skeleton), error and no-permission state (§12).
5. **The demo clock is the only clock.** Nothing calls `new Date()` directly; use `useDemoClock()` (§16.4). All times are shown in `Asia/Dubai`.
6. **Every rule rejection explains itself.** If the system blocks an action, show which rule was hit, in plain words, and suggest the nearest valid alternative (§7).
7. **Strings are keyed.** All copy goes through i18n keys (`en.json`) so that Arabic can be added later (§14).
8. **Motion follows the spec.** Every interaction listed in §13 uses the named motion preset. Animate only `transform` and `opacity` unless the spec says otherwise.

---

## 1. Purpose and objective

**Objective:** This is a **use-case-based demo**, not a feature run-through. It must show Amali's operations and management teams that the platform can **run the amenities day to day**: capacity, operations, scheduling, live updates and communication.

The demo succeeds if, by the end, the audience has seen each of these work end to end, across roles, with live effects:

| # | Capability area | The audience must see… |
|---|---|---|
| C1 | Capacity and booking control | Slots, quotas, conflicts, waitlists, cancellations and no-shows enforced automatically |
| C2 | Scheduling and programming | Recurring activities, one-off events, showtimes and seasonal programmes on one calendar |
| C3 | Daily operational updates | Status per amenity, opening hours, closures, checklists and incidents |
| C4 | Resident communication | One update composed once, targeted, and delivered to the Amali App and WhatsApp, with delivery and read visibility |
| C5 | Operations management | Staff rosters, work orders, vendors and SLA tracking |
| C6 | Reporting and control | Utilisation, no-show rates, revenue from chargeable amenities, Excel export and role-based access |

---

## 2. Scope

### 2.1 In scope — surfaces

| Surface | Device frame | Primary users |
|---|---|---|
| **Resident app** (Amali App) | Phone | Residents (owners, tenants, household members) |
| **WhatsApp (simulated)** | Phone | Residents receiving channel posts and 1:1 business messages |
| **Guard app** | Phone | Security guards at the lobby and amenity deck |
| **Creche staff view** | Phone | Creche lead and carers |
| **F&B ops view** | Tablet (landscape) | Restaurant manager, host, Teppanyaki chef |
| **Management web console** | Browser window | Community manager, amenity supervisor, call-centre agent |

### 2.2 In scope — amenities (the seven)

| Key | Amenity | Booking model |
|---|---|---|
| `padel` | Padel Tennis Court | Slot-based, hard capacity of 1 court |
| `screening` | Screening Room | Ticketed events with showtimes and a seat map |
| `music` | Music Room | Ticketed events (headcount cap) and recurring classes |
| `creche` | Creche and Kids' Playroom | Supervised sessions; capacity from staff-to-child ratio |
| `dining` | Restaurant, Private Dining and Teppanyaki | Table and room reservations; wallet-settled |
| `pool` | Adult Pool | No booking; status, live occupancy and operations |
| `gym` | Sky Gym | No booking; status, live occupancy and operations |

### 2.3 Out of scope

- Real backend, auth, payments or WhatsApp Business API. All of these are simulated.
- Visitor management, bills, marketplace and helpdesk flows beyond what the scenarios need. Their entry points may appear in the UI as "Coming soon" tiles.
- Native app builds. This is a responsive web app shown inside device frames.
- Arabic content in v1. The structure must be RTL-ready, and the Settings switch is in scope (§14).

---

## 3. Users, roles and personas

### 3.1 Roles

| Role | Surface | Summary |
|---|---|---|
| Resident — owner | Resident app, WhatsApp | Has amenity rights unless the unit is leased out |
| Resident — tenant | Resident app, WhatsApp | Has amenity rights for the lease term |
| Household member | Resident app | Shares the unit's quota; cannot top up the wallet |
| Guard | Guard app | QR check-in, attendance, occupancy counter, raises incidents |
| Creche lead / carer | Creche staff view | Check-in and check-out, ratio, incidents |
| F&B manager / host | F&B ops view | Reservations, floor, covers, no-shows, bill settlement |
| Community manager | Console | Everything, including revenue, RBAC and export |
| Amenity supervisor | Console | Operations for assigned amenities: status, blackouts, checklists, work orders, rosters |
| Call-centre agent | Console | Finds residents, books and cancels on their behalf, reads statuses. No revenue, export or config |

### 3.2 Seed personas

All names, units and numbers below are **generated placeholders** for the demo.

| Persona | Unit | Type | Why they exist in the demo |
|---|---|---|---|
| **Layla Al Mansoori** (primary) | East Tower · 1804 | Owner | Two children (Omar, 4 and Noor, 2). Wallet AED 2,450. App and WhatsApp on. Drives most scenarios |
| **James Whitfield** | West Tower · 2203 | Tenant | Padel regular. Has used 2 of 3 weekly bookings and has 2 no-shows in 30 days, so one more triggers a suspension |
| **Ahmed Khalil** | East Tower · 0712 | Owner | First on the padel waitlist. App push off, WhatsApp on, which shows the channel fallback |
| **Priya Raman** | Podium Villas · PV-05 (North cluster) | Owner | Opted out of WhatsApp. Used to prove villa-cluster targeting |
| **Sofia Marin** | West Tower · PH-02 | Tenant | Frequent diner. Wallet AED 120, used for the insufficient-balance edge case |
| **Rashid Al Suwaidi** | West Tower · 1107 | Owner (unit leased out) | Amenity rights moved to the tenant, used for the blocked state |

**Staff:**

- **Guards:** Imran (Main Lobby), Joseph (Amenity Deck, Level 6)
- **Creche:** Maria (Lead), Grace (Carer), Aisha (Carer)
- **F&B:** Marco (Restaurant Manager), Ken (Teppanyaki Chef), Elena (Host)
- **Management:** Hana (Community Manager), Victor (Amenity Supervisor for Pool, Gym and Padel), Dina (Call-centre Agent)
- **Ops:** Sam and Rahul (Lifeguards), Leo (Gym Attendant), Ravi (Technician), Joy and Mark (Housekeeping)

**Vendors (fictional):**

- AquaPure Pools LLC: pool maintenance and chemicals
- CourtPro Sports: padel surface and lighting
- FitServe Equipment: gym equipment
- CoolAir HVAC
- Lumen AV: screening room AV

### 3.3 Community structure (generated)

```
Amali Residences — Dubai Canal
├── East Tower      floors 1–32   units E-0101 … E-3204 (+ duplexes 30–32)
├── West Tower      floors 1–28   units W-0101 … W-2806, Penthouses PH-01 … PH-04
├── Podium Villas
│   ├── North cluster   PV-01 … PV-06
│   └── South cluster   PV-07 … PV-12
└── Amenity Deck (Level 6): Adult Pool, Sky Gym (Level 33, West), Padel (Podium roof),
    Screening Room, Music Room, Creche & Kids' Playroom (Level 2), Restaurant / Private Dining / Teppanyaki (Ground, canal side)
```

Seed about **240 units** and **~420 residents** in total, so that targeting counts and delivery funnels look real. Only the six personas need to be complete records. The rest can be generated deterministically from a fixed seed.

---

## 4. Demo shell (presentation layer)

The shell copies the layout of the reference screenshot: a dark stage, a role pill at the top centre, a device in the middle, and a notes panel on the right.

### 4.1 Layout (1440 × 900 and up, laptop on a projector)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│        [ RESIDENT | WHATSAPP | GUARD | CRECHE | F&B | MANAGEMENT ]  (↻)  (≡)  │  top bar
│                                                                              │
│   (persona chip)            ┌───────────────┐            SCENARIO NOTES      │
│   (demo clock)              │               │            03                  │
│                             │    DEVICE     │            Padel blackout      │
│                             │    FRAME      │            ──────              │
│                             │               │            Body copy…          │
│                             │               │            ○ step 1 ● step 2   │
│                             └───────────────┘            ‹ Prev   Next ›     │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| **Role pill** | A segmented control with six roles. The active segment uses an inverted fill (cream on dark), and the indicator slides between segments (§13, `pill-slide`). Keys `1`–`6` switch roles |
| **Reset (↻)** | Asks for confirmation, then restores the seed state and sets the demo clock back to the scenario start time. The icon spins 360° |
| **Menu (≡)** | Opens the scenario index (§15) and presenter tools: demo clock controls, dual view, language, motion speed and a link to the rules config |
| **Device frame** | Phone: 390 × 844 logical, rounded bezel, dynamic island, live status bar (demo time). Tablet: 1180 × 820 landscape. Browser: 1440 × 900 window chrome. Frames scale to fit the viewport height minus 160px, centred |
| **Persona chip** | Top-left on the Resident and WhatsApp roles. Avatar, name and unit; opens a list for switching persona. On other roles, it shows the staff member and their role |
| **Demo clock** | Top-left, under the persona chip. Shows `Wed 14 Oct · 18:42 GST`, with `+15m`, `+1h` and `Next day` controls and a free date-time picker. The `T` key moves forward 15 minutes |
| **Scenario notes panel** | Right column. Typographic layout copied from the reference: an uppercase tracked label, a large step number, a title, a short rule and body copy. Steps can be clicked; each step can deep-link (switch role, persona, screen and clock). Use `←`/`→` to step |
| **Dual view** | Shows two device frames side by side (e.g. Guard + Resident, Resident + WhatsApp, Console + Resident). In dual view, the notes panel becomes a drawer. Toggle with `D` |
| **Live event ticker** | Optional and off by default. A thin feed in the bottom-left listing system events as they happen ("Waitlist offer sent to Ahmed Khalil · WhatsApp · 18:43"). It helps prove that things are live |

**Responsive fallback:** below 1200px wide, the notes panel collapses into a bottom drawer. Below 600px (when the demo runs on an actual phone), the shell chrome hides, the app renders full-screen, and the role switcher moves to a long-press on the status bar.

### 4.2 Device frame per role

| Role | Frame | Notes |
|---|---|---|
| Resident | Phone | Amali App |
| WhatsApp | Phone | Simulated WhatsApp, logged in as the current persona |
| Guard | Phone | Dark-mode staff UI so it looks different from the resident app |
| Creche | Phone | Staff UI |
| F&B | Tablet, landscape | Floor and timeline views need the width |
| Management | Browser window | Desktop console. A role sub-switch inside the console header changes between Community Manager, Amenity Supervisor and Call-centre Agent |

> Config flag `shell.forcePhoneFrame` renders F&B and Management inside the phone frame too, in their mobile layouts. Both layouts must work, but the default is the larger frames.

---

## 5. Design system

### 5.1 Sources

- **App UI (inside devices):** Figma `Amali-Properties`, page "✅ app-flow" (`vr9pAhXUcw8GKd2QjyAZGe`, node `2:144`). The values below were pulled from Figma variables and the generated design context.
- **Shell (stage around devices):** colours sampled from the reference screenshot of the presentation layout.
- **Imagery and tone:** amaliproperties.com, which uses architectural CGI renders, warm stone, water and dusk light, and short, calm copy ("Where water mirrors the sky").

### 5.2 App colour tokens (light, from Figma)

| Token | Hex | Source / usage |
|---|---|---|
| `--brand` | `#B29368` | Figma. Bronze accent: active nav, icons, secondary-button border and text, links |
| `--brand-tint` | `#FFFBF4` | Figma. Secondary-button fill and tag/chip background |
| `--on-brand` | `#FFFFFF` | Figma variable `on-brand`. Text on brand fills |
| `--text-title` | `#51575E` | Figma. Card titles and section headers |
| `--text-body` | `#31383C` | Figma variable `secondary`. Body text |
| `--text-muted` | `#6F7A80` | Figma variable `tertiary`. Inactive nav and meta text |
| `--text-placeholder` | `#868686` | Figma. Input placeholders |
| `--border-card` | `#E2DDDB` | Figma variable `card`. Card border at 0.5px |
| `--surface` | `#FFFFFF` | Cards, nav bar, sheets |
| `--bg-page` | `#F7F4F0` | Warm off-white page background. **Sampled visually, not a Figma variable — confirm in Figma** |
| `--success` | `#19B27A` | Figma variable `success`. "Present", "Open", "Checked in" |
| `--warning` | `#C98A2E` | *Proposed.* Limited, nearly full, SLA at risk |
| `--danger` | `#D2493A` | *Proposed.* Closed, failed, SLA breached, urgent. The SOS button uses a gradient from `#E8572B` to `#D2382A` (matched to the Figma home screen) |
| `--info` | `#4F7A94` | *Proposed.* Informational, scheduled |
| `--maintenance` | `#8A7F72` | *Proposed.* Status "Under maintenance" |

**Shadows (from Figma):**

- `--shadow-bar`: the 6-layer warm shadow from Figma (`rgba(49,42,29, .05/.05/.04/.03/.01/0)`, offsets 0/-1/-4/-9/-17/-26) for the bottom nav and sticky bars.
- `--shadow-card-hover`: `4px 4px 10px rgba(174,105,85,.16)` for raised and selected cards.

**Status colours always come with an icon and a label.** Colour is never the only signal.

### 5.3 Staff surfaces (Guard, Creche)

These use a dark theme built from the same brand:

- Background `#14130F`, surface `#1F1E1A`, border `#2F2D2A`
- Text `#F5F1E8` (primary) and `#A3A09A` (muted)
- Accent `--brand` `#B29368`

Large touch targets (min 56px), high contrast, readable at arm's length.

### 5.4 Shell colour tokens (sampled from the reference)

| Token | Hex | Usage |
|---|---|---|
| `--stage` | `#0E0D0B` | Page background |
| `--stage-raised` | `#1C1B18` | Pill track, icon buttons |
| `--stage-border` | `#3C3C39` | Icon button border |
| `--stage-rule` | `#2F2D2A` | Notes panel divider |
| `--stage-active` | `#F5F1E8` | Active pill fill and headings |
| `--stage-active-text` | `#14130F` | Active pill label |
| `--stage-text` | `#A3A09A` | Inactive pill labels |
| `--notes-label` | `#948C7E` | "SCENARIO NOTES" label |
| `--notes-number` | `#737B80` | Step number |
| `--notes-body` | `#B2AA9A` | Notes body copy |

### 5.5 Typography

| Style | Font | Size / line | Weight | Usage |
|---|---|---|---|---|
| `title-l` | Manrope | 20 / 24 | 500 | Screen titles in the top bar (Figma "Font Size/4") |
| `label-1` | Manrope | 16 / 20 | 500 | Card titles |
| `label-2` | Manrope | 14 / 18 | 500 | List titles, emphasised body |
| `label-3` | Manrope | 12 / 16 | 500 | Active nav, small labels |
| `body-2` | Manrope | 14 / 20 | 400 | Body |
| `body-3` | Manrope | 12 / 16 | 400 | Meta text and timestamps |
| `button` | Manrope | 16 / 20 | 700 | Buttons, title case |
| `tag` | PP Neue Montreal Book | 12 / 16, tracking 2% | 400 | Status tags and chips (Figma `secondary-typeface/body-s`) |
| `display` | Manrope | 28 / 34 | 500 | Hero greetings and big numbers (KPI tiles, occupancy) |
| Shell label | PP Neue Montreal, uppercase | 13 / 16, tracking 0.24em | 400 | Role pill and "SCENARIO NOTES" |
| Shell heading | Jost | 40 / 48 | 400 | Notes title (matched to the reference) |
| Shell number | Jost | 44 / 48 | 500 | Notes step number |
| Shell body | Jost | 20 / 34 | 400 | Notes body |

PP Neue Montreal is a commercial font. If the license or files aren't available, fall back to `Inter Tight` for tags and shell labels, using the same tracking. Load Manrope and Jost from Google Fonts. Use tabular numbers (`font-variant-numeric: tabular-nums`) for every counter, time and price.

### 5.6 Shape, spacing and layout

| Token | Value |
|---|---|
| Page padding | 16 |
| Card padding | 12 |
| Gap between cards | 16 |
| Radius: card | 12 |
| Radius: card image | 8 |
| Radius: input | 8 |
| Radius: button | 4 (Figma Book button) |
| Radius: tag | 16 (pill) |
| Radius: bottom sheet | 20 (top corners) |
| Card border | 0.5px `--border-card` |
| Spacing scale | 2, 4, 8, 12, 16, 20, 24, 32, 40, 48 |
| Min touch target | 44 (resident), 56 (staff) |

### 5.7 Core components

These come from Figma; build them once and reuse them everywhere.

- **Top bar:** back chevron, title (`title-l`) and an optional right icon (history, filter, QR).
- **Home hero:** a 320px full-bleed render with a community switcher ("AMALI ▾"), a glass icon button and the SOS pill.
- **Quick action tile:** white card with a 28px bronze line icon and a `body-2` label. 3-column grid.
- **Amenity card:** 132px image, title, hours line, price line, and a secondary "Book" button overlapping the bottom right of the image (as in Figma).
- **Info card:** used for announcements and tickets. 36px avatar or icon, title row with a status tag, meta row with a dot separator, body truncated with "Show More", a divider, and a footer row.
- **Status tag:** pill, `--brand-tint` fill, `tag` text style. Variants: brand, success, warning, danger, info, maintenance.
- **Buttons:**
  - Primary: `--brand` fill, white text
  - Secondary: `--brand-tint` fill with a 1px `--brand` border and bronze text
  - Tertiary: text only
  - Destructive: danger outline

  All buttons need loading (spinner replaces the label, width locked) and disabled states.
- **Bottom nav:** Home · My Unit · Search · Activity · Profile. The active item is bronze; inactive items use `--text-muted`.
- **Bottom sheet:** has a grabber and can be dragged to dismiss. Used for booking confirmation, filters and pickers.
- **Slot grid / time chips:** states are available, selected, held, booked, mine, waitlist-open, blackout and past.
- **Toast and in-app notification banner:** drops in from the dynamic island (§13).
- **Empty state:** a line illustration in bronze, one sentence and one action.
- **Skeletons:** warm grey `#EFEAE4` with a shimmer.

**Iconography:** Lucide at 1.5px stroke, coloured `--brand`, to match the thin line icons in Figma. Directional icons mirror in RTL.

### 5.8 Amenity imagery

You have seven amenity images locally in a folder called `amenities`. Copy that folder to `public/amenities/`.

**Claude Code task:** list `public/amenities/`, then map each file to an amenity key using this table. Rename files to the key (`padel.jpg`, etc.). If a file doesn't match any key, or a key has no file, print a warning in the console and use the Amali gradient placeholder (`--brand-tint` → `#E9E1D6`) with the amenity's line icon.

| Key | Expected subject |
|---|---|
| `padel` | Padel court |
| `screening` | Screening room / cinema |
| `music` | Music room |
| `creche` | Creche / kids' playroom |
| `dining` | Restaurant, private dining or Teppanyaki |
| `pool` | Adult pool |
| `gym` | Sky gym |

**Home hero:** use an Amali Residences render (canal tower at dusk) at `public/brand/hero.jpg`. Place the Amali logo (white) at `public/brand/amali-logo-white.svg`. The logo, wordmark and renders come from Amali's own assets, so get them from the team rather than recreating them.

---

## 6. Information architecture

### 6.1 Resident app

```
Home
 ├─ Today at Amali strip (live status of every amenity)
 ├─ Announcement banner (targeted; urgent banners pin to the top)
 ├─ Quick actions: Amenities · My Bookings · What's On · Kids' Club · Dining · Wallet
 ├─ My next booking (countdown, QR)
 └─ What's on this week (carousel)
Amenities (list → detail)
 ├─ Padel → slot picker → confirm sheet → ticket
 ├─ Screening / Music → event programme → event → RSVP form → ticket
 ├─ Creche → sessions → book child → live status
 ├─ Dining → venue → reservation form → confirmation
 └─ Pool / Gym → status, hours, live occupancy, programme (no booking)
What's On → List view (this week) | Calendar view (month / year)
My Unit → Household · Children & guardians · Wallet · Guests · Amenity rights
Search → amenities, events, announcements
Activity → notifications + booking history (upcoming / past / cancelled)
Profile → settings (language, notifications per channel, WhatsApp opt-in), help
```

### 6.2 Guard app

```
Today (shift header: name, post, demo time)
 ├─ Scan (QR camera simulation → result card)
 ├─ Arrivals (expected padel / event / dining check-ins in the next 2h)
 ├─ Event attendance (choose showtime → list with tick boxes → submit; works after the event, "post-remote")
 ├─ Occupancy counter (Pool / Gym: + / − with capacity ring)
 ├─ Raise incident (amenity, category, photo, severity)
 └─ Alerts (urgent closures, no-show sweeps, creche escalations)
```

### 6.3 Creche staff view

```
Room board (live: children in room by age band, staff on duty, ratio gauges)
Check-in / Check-out (scan guardian QR or search child)
Today's sessions (bookings, expected arrivals, waitlist)
Incidents (log, list, parent acknowledgement status)
Children directory (profile, allergies & notes, authorised guardians)
```

### 6.4 F&B ops view (tablet)

```
Service selector: Breakfast · Lunch · Dinner  ×  Venue: Restaurant · Private Dining · Teppanyaki
 ├─ Timeline (tables × 15-min columns, reservation blocks)
 ├─ Floor plan (tables with live state)
 ├─ Arrivals list (seat, no-show, edit, notes)
 ├─ Covers by service period (chart + counters)
 └─ Settle bill (charge to wallet)
```

### 6.5 Management console

```
Overview (today: statuses, alerts, SLAs at risk, occupancy now)
Amenities → per amenity: status & hours, rules, blackouts, bookings, waitlist
Programme → calendar of recurring classes, events, showtimes, seasonal programmes
Communications → composer, scheduled, sent (delivery & read analytics), templates
Operations → Checklists & logs · Incidents & Work orders · Rosters · Vendors · SLAs
Residents → search, profile, bookings, penalties, book on behalf
Reports → generate on request (utilisation, peaks, no-shows, trends, revenue) → Excel
Settings → Roles & access (RBAC matrix), rules config viewer
```

---

## 7. Booking rules engine (shared by every bookable amenity)

Every booking attempt, whether from a resident, an agent on their behalf, or a waitlist promotion, goes through one function: `validateBooking(request) → { ok } | { ok:false, code, message, alternatives[] }`. Checks run **in this order**, and the first failure wins:

| # | Check | Error code | Example message to the resident |
|---|---|---|---|
| 1 | Resident is eligible: account active, unit amenity rights held (not leased out), not suspended | `NOT_ELIGIBLE` / `SUSPENDED` | "Amenity access for W-1107 is with the current tenant." |
| 2 | Amenity status is Open; no blackout overlaps the slot | `AMENITY_CLOSED` / `BLACKOUT` | "The court is closed for resurfacing 15–16 Oct." |
| 3 | Within operating hours, after date exceptions are applied | `OUTSIDE_HOURS` | "Padel opens at 06:00." |
| 4 | Inside the booking window | `WINDOW_NOT_OPEN` | "Bookings for Wed 21 Oct open tomorrow at 08:00." |
| 5 | Meets the lead time | `LEAD_TIME` | "Book at least 2 hours ahead." |
| 6 | Duration and start-time rules | `INVALID_DURATION` | "Choose 60 or 90 minutes." |
| 7 | Capacity / conflict (atomic, honours holds) | `SLOT_FULL` / `SLOT_HELD` | "Someone is completing this booking. Join the waitlist?" |
| 8 | Quota / fair use (counted per unit) | `QUOTA_EXCEEDED` | "Your unit has used 3 of 3 padel bookings this week. The next one frees on Sat." |
| 9 | Age / audience restrictions | `AGE_RESTRICTED` | "The Adult Pool is for ages 18 and over." |
| 10 | Guest allowance | `GUEST_LIMIT` | "Up to 2 guests per unit per showtime." |
| 11 | Wallet balance covers charges or deposit | `INSUFFICIENT_BALANCE` | "AED 350 needed, AED 120 available. Top up?" |

**Alternatives:** on a failure at checks 2–8, return up to 3 nearest valid options (same day first, then the next days), shown as tappable chips.

**Slot holds:**

- Opening the confirm sheet creates a **hold** on the slot for `rules.holdSeconds` (default 180s). The sheet shows a countdown ring.
- Other residents see the slot as "Held" (striped) with a tooltip.
- When the hold expires, the slot is released with a fade animation.
- **Race condition:** if two personas confirm the same slot in dual view, the first commit wins. The second gets `SLOT_FULL` with a shake animation and alternatives.

**Booking state machine:**

```
Held → Confirmed → CheckedIn → Completed
          │            
          ├→ Cancelled (by resident, on-time)         → refund per policy
          ├→ LateCancelled (inside cutoff)            → strike, fee per policy
          ├→ NoShow (not checked in by start + grace) → strike, fee per policy, slot released
          └→ CancelledByOps (blackout / closure)      → full refund, priority rebook offer
Waitlisted → Offered → (Accepted → Confirmed) | (Expired → next in queue) | Withdrawn
```

---

## 8. Scenario modules — features, rules and edge cases

All the values below are **mock defaults** in `rules.ts`, to be confirmed with Amali (§18).

### 8.1 Padel Tennis Court (C1, C3)

**Rules (mock):**

| Rule | Value |
|---|---|
| Courts | 1 (hard capacity 1 booking per time range) |
| Operating hours | 06:00–23:00 daily; exceptions by date |
| Slot grid | 30-minute starts (:00, :30) |
| Durations | 60 or 90 minutes |
| Booking window | Rolling 7 days; each new day opens at 08:00 |
| Lead time | 2 hours minimum |
| Quota (per unit) | 3 bookings per rolling 7 days; at most 1 per day; at most 2 in peak hours (18:00–22:00) per week |
| Players | Booker + up to 3 (residents tagged or guests) |
| Guests | Max 2 per booking; AED 50 per guest, charged to the wallet on confirm |
| Cancellation | Free up to 6h before. Inside 6h it is a late cancellation: a strike, and the guest fee is not refunded |
| Check-in | QR scan by a guard, or self check-in on the court tablet (simulated as a button), from start − 10 min to start + 15 min |
| No-show | Not checked in by start + 15 min → automatic NoShow, strike, slot released to the waitlist |
| Penalty | 3 strikes (no-show or late cancel) in 30 days → padel booking suspended for 7 days. The resident is told at strike 2 (warning) and strike 3 (suspension) |
| Waitlist | Per slot, FIFO, max 5 people. Each resident can be on at most 2 waitlists at once |
| Waitlist offer | When a slot frees, offer it to #1 for 15 minutes (shortened so the offer ends at least 30 min before start). If they don't accept → #2. If less than 45 min remain before start → **open release**: offer to everyone on the waitlist at once, and the first to accept gets it |

**Resident flow:**

1. On Amenities, open the Padel card. The detail screen shows the hero image, status tag, hours, rules summary ("60/90 min · 7-day window · 3 per week"), and a quota meter ("1 of 3 used this week").
2. Choose the date with a horizontal date strip: 7 days are enabled and day 8 shows "Opens tomorrow 08:00". The time grid appears, coloured by state.
3. Choose 60 or 90 minutes with a toggle. Any start that can't fit the duration greys out.
4. Add players: search residents, or add a guest (name and mobile). The fee line updates live.
5. The confirm sheet shows the hold countdown, a summary, charges, the cancellation policy and a Confirm button.
6. Success: an animated check, a ticket with a QR code, "Add to calendar", and confirmation sent by app push and WhatsApp.
7. For a full slot: "Join waitlist" shows your position (#2) with a live counter. If your position changes, the number rolls.

**Ops flow (console, supervisor): blackout for maintenance**

1. Go to Amenities → Padel → Blackouts → New. Choose a range (for example Thu 15 Oct, 06:00 – Fri 16 Oct, 12:00), a reason ("Surface resurfacing — CourtPro Sports"), and an optional linked work order.
2. **Impact preview** before saving: "4 bookings · 7 residents · 3 waitlist entries · AED 100 guest fees to refund", listed by resident.
3. Choose how to handle the affected bookings:
   - (a) **Cancel and refund, and offer priority rebooking.** The default: affected residents get a 24-hour priority hold on their choice of the 3 nearest free slots, and those slots don't count against their quota.
   - (b) **Move automatically** to the nearest free slot with the same duration, and let residents decline.
4. Choose how to notify: app push + WhatsApp + a banner on the Padel detail screen, with templated copy.
5. Confirm. Affected bookings change to CancelledByOps with an animated strikethrough. Residents get notifications. The amenity status becomes "Maintenance" during the range. The calendar shows the blackout as a hatched band.

**Edge cases to build:**

- A blackout that starts while a booking is in progress: ask whether to "End current booking now" or "Start blackout after it ends".
- A blackout over a recurring clinic (§8.6). The clinic occurrences are cancelled too, and enrolled residents are notified.
- A blackout is shortened or deleted, so slots open again. Waitlisted residents for those slots are not re-added automatically. Instead, the supervisor gets an option to "Notify affected residents the court is available".
- A booking that crosses a change in operating hours (e.g. a 90-min booking starting 22:00 when the court closes 23:00) is blocked at check 3.
- Quota counts per **unit**: if Layla's spouse booked, Layla sees "2 of 3 used (1 by Khalid)".
- Cancelling a booking gives the quota back immediately. A no-show uses up the quota and also counts as a strike.
- A suspended resident (James, after strike 3) sees a banner with the end date. The Book button is disabled with the reason, and an agent can lift the suspension in the console (an action that is logged).
- A resident's lease ends mid-window: their future bookings past the end date are flagged to the community manager.
- A waitlist offer expires while the resident is offline. The next person gets it, and the first resident gets "Offer expired".
- A resident accepts a waitlist offer but has hit their quota, so the offer can't be accepted. The UI says why, and the offer passes to the next person immediately.
- A guard scans a QR at the wrong time (more than 10 minutes early, or the wrong day): show a clear rejection with the correct time.

### 8.2 Screening Room and Music Room — events (C1, C2)

**Event model:**

- An event has a title, venue, type (Movie, Live music, Workshop, Class), a poster image, a description, an age rating (G / PG / PG-13 / 18+), a duration, and a price per attendee category.
- An event has one or more **showtimes**, which can be on several days.
- Each showtime has its own capacity, registration open/close times, and status.

| Venue | Capacity model | Mock capacity |
|---|---|---|
| Screening Room | **Seat map**: 4 rows × 5 seats (A1–D5) and 2 accessible spaces | 20 + 2 |
| Music Room | **Headcount cap** | 12 |

**Attendee categories (the guest allowance):**

| Category | Counts toward capacity | Price (mock) | Limit |
|---|---|---|---|
| Resident (the booker) | Yes | Free | 1 |
| Household member | Yes | Free | Up to household size |
| Guest — adult | Yes | AED 25 | Max 2 guests per unit per showtime (adults and children combined) |
| Guest — child (under 12) | Yes | AED 15 | Must be with an adult; blocked if the age rating is PG-13 or 18+ |

**RSVP registration form (resident):**

1. Choose a showtime (each chip shows seats left: "6 left", "Full · waitlist").
2. Set attendees with steppers per category. The guest names fields appear once guests are more than 0.
3. For the Screening Room, choose seats from the seat map. The number of seats you can pick equals the number of attendees. Seats are held during checkout and appear striped to others. Seats next to each other are suggested by default.
4. Optional fields: accessibility needs, dietary note (for workshops with food), and an agreement to the house rules.
5. Pay any guest fees from the wallet. Confirm.
6. You get a ticket with a QR code, shown per party with each attendee's name. Reminders go out at **T−24h** and **T−2h** (app + WhatsApp, with "Can't make it? Cancel" quick reply).

**Cancellation:** full or partial. Partial means removing some attendees, which frees their seats. Free up to 2h before the showtime. After that, it's a late cancellation: guest fees are kept, and the cancellation is recorded (but not a strike in v1).

**Waitlist:** per showtime, by party size. If 2 seats free up and #1 needs 4, offer them to the next party that fits, and keep #1 in the queue. Show the logic in the console waitlist view.

**Attendance capture:**

- **Live:** the guard scans the ticket QR at the door. Attendee names appear with tick boxes, and the guard can tick a subset (for example 3 of 4 arrived).
- **Post-remote:** after the showtime ends, the guard or supervisor opens the showtime and marks attendance from the list, up to 24h later. Unmarked parties default to "No-show (unconfirmed)" in reports until marked.
- Attendance states per attendee: Attended, No-show, Partially attended (at party level).
- **Offline:** if the guard's device is offline (a toggle in presenter tools), scans queue locally with a "Pending sync (3)" badge and sync when back online. The sync rule is: the latest timestamp wins, and conflicts are flagged.

**Programme publishing (C2):**

- **List view:** "This week at Amali", grouped by day, with filter chips for venue, type and audience (Adults / Kids / Family).
- **Calendar view:**
  - Month view: dots per day, coloured by venue.
  - **Year view:** 12 mini-months, with dots showing days that have events and a darker shade for seasonal programmes.
  - Tapping a day opens a day sheet.
- **Event lifecycle:**
  ```
  Draft → Scheduled (publish date) → Published (visible) → Registration open → Full / Waitlist → Registration closed → In progress → Completed
  ```
  Cancelled is possible at any point.
- Publishing an event can optionally create an announcement (§8.7) in the same flow.

**Edge cases:**

- Capacity is reduced below the number already registered (e.g. a projector fault closes 1 row): the console shows "5 attendees over capacity", and the supervisor chooses which parties to move to another showtime or cancel. Latest registrations are moved first. Affected parties are notified.
- An event is cancelled with RSVPs: everyone is refunded and notified, and the event shows "Cancelled" for 48h, then is hidden.
- A showtime's time changes: registrants get "Time changed" with a one-tap "Keep / Cancel" choice.
- One resident tries to book two showtimes of the same event: allowed, but with a warning ("You're already registered for Sat 19:00").
- Two showtimes overlap in the same venue at creation: blocked as a conflict.
- An adult guest tries to RSVP for an 18+ event with a child: blocked with an explanation.
- Seat-map race: when two personas select the same seat, the second gets a "Just taken" shake, and the seat turns booked.
- Registration closes 30 min before the showtime. After that, walk-ins can only be added by the guard, if capacity allows.

### 8.3 Creche and Kids' Playroom — new module (C1, C3, C5)

**Child registration (resident → My Unit → Children):**

- **Fields:** name, date of birth (which sets the age band), photo, allergies / medical notes (free text), dietary restrictions, and photo consent (yes or no).
- **Authorised guardians:** 1 to 4 people. Each has a name, relation, mobile, photo and Emirates ID (last 4 digits only, mock). The defaults are the parents in the unit. Adding a nanny requires a photo, and Creche Lead approval in the staff view ("Pending approval").
- **Emergency contact.**
- A child must be **registered against a unit**. Only that unit's residents can book for them.

**Age bands and staff-to-child ratio (capacity rule, mock):**

| Band | Age | Ratio (staff : children) |
|---|---|---|
| Toddlers | 2–3 | 1 : 4 |
| Kids | 4–7 | 1 : 8 |
| Juniors | 8–12 | 1 : 10 |

**Capacity rule:**

- Allowed children per band = staff assigned to that band on the roster × ratio.
- The room also has an absolute cap of 30.
- Children under 2 are not accepted.
- Over 12: the system suggests "Teen zone is not supervised".

**Sessions:**

- Morning 09:00–12:00 and afternoon 15:00–18:00, plus hourly drop-in blocks (min 1h, max 3h).
- Booking up to 7 days ahead; lead time 1h.
- **Fees (mock):** sessions free for owners; tenants pay AED 40 per hour, charged at check-out based on actual time, rounded up to 30 minutes.

**Check-in and check-out (creche staff view):**

1. The guardian shows their **guardian QR** (from the resident app → Kids' Club → "Drop-off pass"), or staff search for the child.
2. Staff see the child's card: photo, age band, allergies (highlighted in red), booking for today, and the guardian's photo for a visual match.
3. **Check-in** is blocked if:
   - there's no booking and no drop-in capacity
   - the band ratio would be exceeded ("Kids band at 8/8 — add staff or wait")
   - the child is not registered
   - the guardian is not authorised
4. Check-in happens: the timestamp is recorded, the parent's app updates live, and a push is sent ("Omar checked in at 09:04 by Maria").
5. **Check-out:** only an **authorised guardian** may collect.
   - If someone else arrives, staff choose "Unauthorised collector". The parent gets an **approval request**: approve or deny a one-time pickup, with a photo of the collector. The staff screen shows "Waiting for parent approval" and a live status.
   - The approval is logged.

**Live status for the parent (resident app):**

- A status card shows: "In the Playroom · Checked in 09:04 · 1h 12m".
- An activity line, set by staff, says what's happening now ("Story time", "Arts & crafts", "Snack").
- Live occupancy is shown: "14 children · 3 carers".
- A timeline: booked → checked in → activity updates → incident (if any) → checked out.
- Pickup reminder at T−15 min.

**Late pickup:** after the session ends + 10 minutes' grace, the parent gets a push and WhatsApp message. A late fee of AED 50 per 15 minutes starts, and the staff board shows the child in a "Late pickup" row with a running timer.

**Incident logging (staff):**

- Type: minor injury / illness / behaviour / allergy reaction / facility.
- Severity: Low / Medium / High.
- Description, photo (optional), time, staff witness, first aid given (yes/no).
- **The parent is notified immediately** for Medium and High incidents (app + WhatsApp), and at check-out for Low. The parent must **acknowledge**, and the staff list shows "Acknowledged 09:47".
- A "Facility" incident can be converted to a **work order** (§8.5). An example is a broken toy shelf.

**Edge cases:**

- **A carer goes off sick mid-session:**
  1. A roster change lowers capacity. The board shows "Kids band over ratio by 2" in red.
  2. The lead either adds cover from the roster (available staff list), or stops new check-ins.
  3. Already checked-in children stay. New bookings for that session are moved to the waitlist, and the parents are notified.
- Siblings in different bands are booked together. Each is checked against their own band.
- A child with a severe allergy is flagged at check-in. Staff must tick "Allergy plan noted" to continue.
- A guardian whose authorisation has expired (e.g. a nanny contract end date) is blocked at check-out with the reason.
- The parent forgets to check out (staff forgot to scan): an end-of-day sweep lists children still checked in, and the lead must resolve each one.
- The unit moves out or the lease ends: the child's registration is archived and future bookings are cancelled.

### 8.4 Restaurant, Private Dining and Teppanyaki (C1, C6)

**Venues (mock):**

| Venue | Capacity | Seating | Service periods | Rules |
|---|---|---|---|---|
| Restaurant | 60 covers. Tables: 6×2, 8×4, 3×6 | Indoor · Terrace · Canal view | Breakfast 07–11, Lunch 12–15:30, Dinner 18–23 | 15-min start grid; 90-min table time (120 for 5+ people); party size 1–12; 9+ is "Request" mode, which needs manager approval |
| Private Dining Room | 1 room, 6–12 guests | Private | Lunch, Dinner | 48h lead time; minimum spend AED 1,500; deposit AED 500 held from the wallet |
| Teppanyaki | 1 counter, 10 seats | Counter | Dinner seatings at 19:00 and 21:00 | Set menu AED 350 per person; deposit AED 100 per person held; party size 1–10 (counter seats can be shared) |

**Resident reservation flow:**

1. Choose the venue, then the date, party size and service period.
2. Choose a time from the available chips. "Limited" appears when less than 25% capacity is left.
3. Choose a seating preference. Preferences are honoured where possible and shown as "Requested", not guaranteed.
4. Add an occasion (birthday, anniversary, business) and special requests: dietary chips (vegetarian, vegan, gluten-free, nut allergy, halal-only kitchen note) plus free text, a high chair, and accessibility needs.
5. **Wallet:** shows the balance and any deposit held or minimum-spend notice. If the balance is too low → an inline top-up sheet (mock card, preset amounts AED 500 / 1,000 / 2,000).
6. Confirmation shows the reservation, a "Running late?" button that notifies the host, and the cancel policy.
7. Reminder T−3h with "Confirm / Cancel" quick replies on WhatsApp.

**Membership wallet (cross-amenity):**

- Balance in AED.
- A ledger with entry types: top-up, charge, hold, hold release, refund, fee.
- Holds show as "On hold" and don't count toward the available balance.
- Only the unit's primary resident can top up. Household members can spend, if allowed (a setting).
- Low-balance warning below AED 200.

**F&B ops view (tablet):**

- **Timeline:** rows are tables, columns are 15-minute steps. Reservation blocks show the name, party size and icons (occasion, allergy, VIP). Blocks can be dragged to reassign tables, and they snap with a spring.
- **Floor plan:** table states are Free / Reserved soon (in 30 min) / Seated / Bill requested / Turning. Tap a table to act on it.
- **Arrivals list:** Seat · Mark no-show · Edit party size · Add note · Walk-in (+).
- **Covers by service period:** counters for booked, seated, no-show and walk-in per period, plus a bar chart for the last 7 days. The **Covers forecast** line uses reservations plus the average walk-in rate.
- **Settle bill:** enter the amount, then "Charge to wallet". Any deposit is applied, and a receipt goes to the resident app.
- **Approvals:** large-party requests can be accepted or declined, with a message.

**No-show policy (mock):**

- Grace of 15 minutes. After that, the host can mark No-show, or the system auto-flags it at +30 min and the host confirms.
- **Restaurant:** no fee. 2 no-shows in 60 days → a deposit of AED 50 per person is required on the next 3 reservations, with an explanation to the resident.
- **Teppanyaki / Private Dining:** the deposit is forfeited.
- Cancellation within 24h (PDR, Teppanyaki) or 2h (Restaurant) counts as late.

**Edge cases:**

- The party size grows on arrival beyond the table: the system suggests combining adjacent tables, or a move.
- The party size is reduced after the deposit: refund the difference if it's more than 24h ahead.
- Teppanyaki is full but 2 of a party of 4 could seat: offer split seating, or the waitlist.
- Private Dining below its minimum spend at settlement: show the shortfall and charge "Minimum spend top-up" as a separate line.
- Wallet balance drops between booking and settlement: settlement falls back to "Charge to unit account" (an invoice). Flag it.
- Ramadan seasonal hours (§8.6): Iftar seating at sunset (time from config) replaces Lunch, and existing lunch reservations in that range are flagged.
- A resident with a high-severity allergy note: the host sees a red allergy icon on every view of the booking.

### 8.5 Adult Pool and Sky Gym — daily operations (C3, C5)

**Status model (each amenity):**

| Status | Meaning | Resident view |
|---|---|---|
| Open | Normal | Green tag; hours today; live occupancy |
| Limited | Open with restrictions (e.g. "2 lanes closed", "Cardio zone only") | Amber tag + reason |
| Closed | Outside hours or closed by ops | Grey tag + "Opens 06:00" |
| Under maintenance | Closed for work, usually with a linked work order | Maintenance tag + reason + estimated reopening |
| Emergency closure | Urgent (e.g. lightning, contamination) | Red, pinned banner across the app |

**Opening hours:**

- **Pool:** 06:00–22:00, adults 18+.
- **Gym:** 24 hours with card access; a staffed window from 06:00 to 22:00.
- **Exceptions:** by date (public holidays, Ramadan hours) or one-off. Weekly hours plus exceptions are both shown in the resident detail screen ("Hours this week").

**Live occupancy:**

- **Pool:** capacity 40, counted by the guard's +/− counter (simulated).
- **Gym:** capacity 25, from card taps (simulated: the counter drifts realistically using the seeded hourly curve).
- **Resident view:** a ring gauge plus "Quiet / Moderate / Busy" and the best time today, taken from the hourly curve.

**Daily operations checklist (supervisor / attendant, console or phone):**

- Templates: **Opening**, **Midday**, **Closing**.
- Items include:
  - Pool: deck clear, safety equipment present, lifeguard on station, signage, showers, towels
  - Gym: equipment wiped, AC check, water dispenser
- Each item has a pass/fail tick, an optional photo, and a note. A failed item asks to "Raise incident".
- The checklist shows who completed it, when, and any time it was late (due 05:45, done 06:10 shows amber).
- Every completed checklist goes into the audit log.

**Cleaning log:** time-stamped entries per zone (changing rooms, deck, gym floor), the staff member's name, and the next one due. Overdue entries are flagged.

**Water-quality logging (pool):**

- Readings every 2 hours while open.

| Parameter | Acceptable range (mock) |
|---|---|
| pH | 7.2–7.8 |
| Free chlorine | 1.0–3.0 ppm |
| Temperature | 26–29 °C |
| Clarity | Pass / Fail |

- The entry form has steppers with the range shown. A value out of range turns red as it's typed.
- An out-of-range value asks "Set pool to Limited / Closed and raise incident?"
- A trend chart shows the last 7 days with the acceptable bands shaded.

**Staff roster visibility:**

- Today's shifts per amenity, for example: "Pool: Sam (06–14), Rahul (14–22) · Gym: Leo (06–14)".
- Gaps are highlighted (e.g. "No lifeguard 13:30–14:00").
- If the pool is open with no lifeguard on shift → an alert, and a prompt to change the status to Closed.

**Incident → work order (C5):**

1. Raise an incident from the guard app, the console, the resident app helpdesk ("Report a problem with this amenity"), or a failed checklist item. Fields: amenity, category, description, photo, severity.
2. In the console, the supervisor triages the incident and chooses **Convert to work order**. The fields carry over.
3. The work order sets a priority, which drives the SLA:

   | Priority | Respond within | Resolve within |
   |---|---|---|
   | P1 | 30 min | 4h |
   | P2 | 2h | 24h |
   | P3 | 8h | 72h |

4. **Assign** the work order to internal staff (e.g. Ravi, Technician) or a **vendor** (e.g. AquaPure Pools LLC). A vendor has a contact, contract, SLA and rate card.
5. **Statuses:**
   ```
   Open → Assigned → In progress → On hold (awaiting parts / vendor) → Resolved → Closed (verified by supervisor)
   ```
6. **SLA timers:** the SLA clock pauses while On hold, with a reason. It turns amber at 75% of time used and red when breached. Breaches go to the community manager.
7. **Linked amenity status:** while a P1 work order is open, the console suggests setting the amenity to Under maintenance. Resolving the work order suggests reopening it.
8. Closing the work order needs a resolution note, an "after" photo and the cost (optional, for vendor work orders).

**Edge cases:**

- An emergency closure while the pool is occupied: the guard app gets a "Clear the pool" alert with acknowledgement, and the occupancy counter must reach 0 before the status shows "Cleared".
- A water reading is overdue by more than 30 min: a warning tile appears in the console overview.
- A work order is reassigned from a vendor to internal staff: the SLA clock keeps running, and the history shows both.
- A duplicate incident (same amenity and category within 2h) suggests "Merge with INC-0142?"
- A planned closure and an exception day overlap: the closure wins, and the conflict is shown in the hours editor.

### 8.6 Scheduling and programming (C2)

One **Programme calendar** in the console holds every type of time-based item. Residents see the published items in What's On.

| Type | Example (seed) | Effect on capacity |
|---|---|---|
| Recurring activity | Aqua Aerobics, Tue/Thu 07:00–08:00, Pool | Pool status "Limited: lanes 1–3 reserved" during the class |
| Recurring activity | Padel Clinic, Sat 08:00–10:00 | Blocks the padel court (recurring blackout) |
| Recurring activity | Kids' Music Class, Wed 16:00, Music Room | 8 spaces, booked like an event |
| One-off event | Canal-side Jazz Evening, Fri 23 Oct | Ticketed, Music Room |
| Showtimes | "Family Movie Night", Sat and Sun 17:00 and 19:30 | Screening Room seat map |
| Seasonal programme | Winter Movie Season (Nov–Feb), Summer Kids' Camp (Jul–Aug), Ramadan hours | Bundles events and changes hours |

**Recurrence:**

- Uses RRULE (daily / weekly on days / monthly by date or weekday), with an end condition (date or count) and exception dates.
- **Editing** asks "This occurrence / This and following / All".
- Deleting an occurrence that has bookings goes through the impact preview first.
- **Conflict detection on save:**
  - against blackouts
  - against other activities in the same venue
  - against existing bookings (e.g. a new Saturday clinic over 4 existing padel bookings)

  The same impact preview and options as a blackout apply.

**Seasonal programmes:** a date range with a name, a banner image, a set of linked events, and **hours overrides**. Example: Ramadan sets Pool 08:00–20:00 and adds Restaurant Iftar at sunset. In the year view, the season appears as a shaded band.

**Edge cases:**

- A recurring rule that would create items past the booking window: only create the items inside the window, plus a forward horizon of 12 months.
- A public holiday falls on a class day: show the exception with "Skip" or "Keep".
- A season's hours conflict with a recurring class (the pool opens 08:00 in Ramadan, but Aqua Aerobics is at 07:00): flag it, and suggest moving the class time.

### 8.7 Resident communication — Amali App + WhatsApp (C4)

**Composer (console → Communications → New):**

| Field | Details |
|---|---|
| Type | Daily amenity update · Event · Closure · **Urgent** · General |
| Title / body | Rich text (bold, links, bullet list). Character counter. WhatsApp limit is 1,024 characters, with a warning shown |
| Amenity tags | Multi-select (drives the icon and deep link) |
| **Audience** | Whole community · Tower (East/West) · **Floor range** (e.g. East 10–20) · **Villa cluster** (North/South) · Specific units · Smart audiences: "Residents with bookings at Padel on 15 Oct", "Parents with children registered", "Opted in to Pool updates". Audiences can be combined (union) or excluded (e.g. Tower East except floors 30–32) |
| Audience preview | Live count: "186 residents · 112 units · App 171 · WhatsApp 158 · Unreachable 3" with a list |
| Channels | App push · **App home banner** (with expiry) · App inbox · **WhatsApp 1:1** (template message) · **WhatsApp Channel** (broadcast post) |
| Schedule | Send now · Schedule (date-time) · Recurring daily at 07:30 (for the Daily update) |
| Banner | Style (Info / Warning / Urgent), CTA (deep link to the amenity), expiry (date-time) |
| Preview | Side-by-side tabs: push notification, home banner, inbox card, WhatsApp bubble and Channel post |

**"Daily amenity update" template:**

- One click pre-fills the message from live statuses: "Good morning, Amali. Today: Pool open 06:00–22:00 (Aqua Aerobics 07:00, lanes 1–3) · Sky Gym open 24h · Padel: 3 slots free after 19:00 · Screening Room: Family Movie Night 17:00 & 19:30, 6 seats left · Creche: morning session 4 spaces left · Restaurant: Teppanyaki 21:00 seating available."
- The manager edits it if needed, then publishes.

**Delivery and read visibility (simulated, deterministic):**

- After sending, each recipient moves through `Queued → Sent → Delivered → Read`. Some end as `Failed` (invalid number, 1%) or `Not sent: opted out`.
- Timings are seeded random distributions scaled by the demo-speed setting:
  - Delivered: 1–8s after send
  - Read: a long-tail curve where about 60% read within 15 minutes for normal messages. Urgent messages are push-priority, so about 80% read within 5 minutes
- **Analytics view:**
  - A funnel per channel with counters ticking up live.
  - A recipient table with filters (not delivered / not read).
  - "Time to reach" metrics: median time to delivery, and the time to reach 50% / 90% read.
  - Breakdown by tower and floor.
- **WhatsApp Channel realism:** a channel post shows aggregate **views and reactions** only, with no per-recipient read receipts. 1:1 template messages show per-recipient delivered/read ticks. The analytics view labels this difference.
- **Fallback rules:**
  - If WhatsApp is not delivered within 2 minutes for an Urgent message, send SMS (simulated, counted only).
  - Residents with app push off get WhatsApp.
  - Residents opted out of WhatsApp get app only.
  - Unreachable residents (no channel) are listed for a call-centre follow-up task.
- **Quiet hours:** 22:00–07:00. Non-urgent messages are held until 07:00, with a notice in the composer. Urgent messages override quiet hours.

**Urgent closure flow (the demo moment):**

1. The supervisor chooses Pool → "Emergency close". A template opens: "The Adult Pool is closed now due to [reason]. We'll update you by [time]."
2. Default audience: everyone with pool access plus anyone checked in. Channels: everything.
3. On send, the effects happen live, at the same time across devices:
   - The resident phone gets the dynamic-island notification, and a pinned red banner appears on the home screen.
   - The WhatsApp phone gets a new message with a ping.
   - The guard app gets a "Clear the pool" alert.
   - The amenity status changes to Emergency closure everywhere.
   - The console shows a reach meter: "**182 of 190 reached in 0:42**".
4. The supervisor sends a follow-up "Reopened". The banner then changes to a green "Reopened" banner, which disappears after 2h.

**Targeting proof:** the banner is only visible to targeted personas. For example, in the presenter persona switcher, Priya (PV-05) doesn't see a "West Tower floors 20–28: water shutoff" banner, and Sofia (PH-02, West) does.

**WhatsApp simulated phone:**

- A WhatsApp-style chat UI using neutral styling, with no WhatsApp logo or trademarked artwork. It has two tabs:
  - **Chats:** "Amali Residences ✓ (business)" 1:1 thread with templates, quick-reply buttons and list messages
  - **Channel:** "Amali Residences — Updates" broadcast feed with view counts
- **Two-way replies work.** For example:
  - Waitlist offer: "Court free Thu 19:00. Reply 1 to book · 2 to pass" → tap "1" and the booking is confirmed in the store.
  - Reminder: "Confirm / Cancel" → updates the reservation.
  - Creche pickup approval: "Approve / Deny".
- Message ticks animate: a grey single tick, then a grey double tick, then a bronze double tick (a "read" state that matches the brand rather than copying WhatsApp blue).

**Edge cases:**

- A scheduled message whose target audience changes before the send time (e.g. a resident moves out): the audience is resolved at send time, and the difference is shown in the log.
- Editing a sent message: the app inbox and banner update, and get an "Edited" label. WhatsApp can't be edited, so the composer offers a "Send correction" follow-up template.
- Recalling a banner early: it's removed immediately. Push and WhatsApp can't be recalled, and the UI says so.
- Body text over 1,024 characters with WhatsApp selected: WhatsApp gets a truncated version with "Read more in the Amali App" and a deep link.
- An empty audience (e.g. a smart audience with 0 matches): Publish is disabled, with an explanation.
- Two urgent messages within 10 min for the same amenity: warn "Possible duplicate".

### 8.8 Operations management (C5)

- **Rosters:**
  - A week grid of staff × days with shifts, coloured by role (lifeguard, gym attendant, creche carer, F&B, housekeeping, technician, guard).
  - Create or edit a shift; mark sick leave or a swap.
  - **Coverage rules** per amenity: the pool needs ≥1 lifeguard while open; the creche needs enough carers per band for its bookings; the gym needs an attendant 06–22. Gaps appear as red hatched cells.
  - Changing the roster updates creche capacity live (§8.3).
- **Work orders:** described in §8.5. Also: a list with filters (status, priority, amenity, assignee, SLA state), a Kanban view by status, a detail page with a timeline, comments, photos and cost.
- **Vendors:**
  - Each vendor has a profile: services, contacts, contract dates, SLA terms and a rate card.
  - Their work orders are listed, with **SLA performance**: % within SLA, average resolution time, and the number of breaches over 90 days.
  - "Contract expires in 30 days" warning.
- **SLA tracking:**
  - Dashboard tiles: open work orders by SLA state (on track / at risk / breached).
  - Response time vs. resolve time.
  - Breaches by vendor.
  - Respond-by and resolve-by countdowns on every work order card.
- **Audit log:** every ops action (status change, blackout, checklist, override, suspension lifted, booking made on behalf) records who, when, what, before and after.

### 8.9 Guard app (supporting C1, C3)

- **Scan:** a simulated camera viewfinder. Tap "Scan" or choose a QR from a dev picker in presenter tools. The result card says:
  - Valid: green, with an attendee list for events, or a player list for padel
  - Wrong time: amber, with the correct time
  - Not found / cancelled: red
  - Already used: amber, with the time of the first scan
- **Arrivals:** bookings starting in the next 2 hours, with a quick "Mark arrived".
- **No-show sweep:** at start + grace, a list "Not checked in: James Whitfield · Padel 19:00" with buttons "Mark no-show" and "Arrived late". The system auto-marks the no-show if the guard does nothing.
- **Occupancy counter:** big + / − buttons with a ring gauge. A 1-second debounce syncs to the store, and the value can't go below 0.
- **Attendance (post-remote):** described in §8.2.
- **Raise incident:** camera icon, amenity, category, severity.
- **Alerts inbox:** emergency closures with "Acknowledge" (the time is logged).
- **Offline mode:** described in §8.2.

### 8.10 Management view — reporting and control (C6)

**Generated on request:**

- The console has **Reports**, with a "Generate report" button.
- Choose the report type(s), date range, amenities and towers, then Generate.
- A short progress animation runs while the report builds (0.8–1.5s, with skeleton cards), then the report appears.
- The **Overview** dashboard is always live. Other reports are only built when someone requests them.
- Reports can be saved as a schedule (e.g. every Monday at 08:00 by email). The email is simulated, so it appears in a "Scheduled" list.

**KPIs (definitions, use exactly these):**

| KPI | Formula |
|---|---|
| Utilisation (bookable) | Booked minutes ÷ bookable minutes (open hours − blackouts) |
| Occupancy (non-bookable: pool, gym, creche) | Average headcount ÷ capacity, per hour |
| Peak time | The hour × weekday cells with the highest utilisation or occupancy (heatmap) |
| No-show rate | No-shows ÷ (bookings whose start has passed and that were not cancelled) |
| Late cancellation rate | Late cancels ÷ all cancels |
| Waitlist conversion | Waitlist offers accepted ÷ offers sent |
| Revenue (chargeable) | Guest fees + event tickets + F&B settled + PDR minimum-spend top-ups + Teppanyaki + creche fees + late-pickup fees − refunds |
| Covers | Seated guests per service period |
| SLA compliance | Work orders resolved within SLA ÷ work orders resolved |

**Report contents:**

- Utilisation and occupancy by amenity (bar charts plus the heatmap).
- Peak-time analysis: a weekday × hour heatmap per amenity, and the top 5 peak windows.
- No-show rate by amenity over time (line chart), and the repeat offenders list (for the CM only).
- Booking trends over 30 / 90 days (line chart), with breakdowns by tower and by day of week.
- Revenue from chargeable amenities (stacked bar by source, and a table).
- Communication reach (messages, delivery %, median time to read).
- Ops: SLA compliance, open work orders and checklist completion %.

**Export to Excel:**

- Uses SheetJS. File name: `amali-amenities-report_<from>_<to>.xlsx`.
- Sheets: `Summary`, `Utilisation`, `Peak hours`, `Bookings`, `No-shows`, `Revenue`, `Communications`, `Work orders`.
- Formatting: header row bold, frozen panes, AED currency format, and dates in Dubai time.
- Each sheet shows the data the current role is allowed to see (§8.11).

**Seed history:** generate 90 days of deterministic history from a fixed seed. Include realistic patterns:

- Padel peaks at 18:00–21:00 on weekdays and 08:00–11:00 at weekends.
- The pool peaks at weekends from 10:00 to 17:00.
- The gym peaks at 06:00–08:00 and 18:00–21:00.
- No-show rates: padel 9%, events 14%, restaurant 6%.
- A visible dip during a past 3-day pool maintenance.

### 8.11 Role-based access (C6)

The console header has a role sub-switch for the demo. Each role changes the navigation, the data and the actions. Hidden items are absent from the UI. Items that can be seen but not acted on show a lock icon with "Ask a Community Manager".

| Capability | Community Manager | Amenity Supervisor | Call-centre Agent |
|---|---|---|---|
| Overview dashboard | All amenities | Assigned amenities (Pool, Gym, Padel) | Statuses only |
| Change amenity status / hours | ✅ | ✅ (assigned) | ❌ (view) |
| Create blackouts / recurring blocks | ✅ | ✅ (assigned) | ❌ |
| Edit booking rules | ✅ | ❌ (view) | ❌ |
| View bookings and waitlists | ✅ | ✅ (assigned) | ✅ |
| Book / cancel on behalf of a resident | ✅ | ✅ | ✅ (logged with a reason) |
| Lift a suspension / waive a fee | ✅ | ✅ (assigned) | ❌ (can request) |
| Compose and send announcements | ✅ All, including urgent | ✅ Amenity-tagged for assigned amenities; urgent allowed | ❌ (view sent) |
| Checklists, logs, incidents, work orders | ✅ | ✅ | Raise incident only |
| Rosters | ✅ Edit | ✅ Edit (assigned) | ❌ |
| Vendors and SLAs | ✅ | ✅ View | ❌ |
| Revenue figures | ✅ | ❌ | ❌ |
| Reports and Excel export | ✅ All | ✅ Utilisation, no-show and ops for assigned amenities (no revenue sheet) | ❌ |
| Resident PII | Full | Name, unit, phone | Name and unit; phone masked `+971 50 ••• ••67` with a "Reveal" action that is logged |
| Roles and access settings | ✅ | ❌ | ❌ |

**Edge cases:**

- The role switches while a restricted page is open: the page redirects to Overview with a toast saying "Not available for Call-centre Agent".
- A deep link from a notification opens a page the role can't access: show the no-permission state.
- Export when the role has no allowed sheets: the button is hidden.

---

## 9. Resident home (wireframe description)

Based on the Figma "Home 4" screen and adapted for amenities:

1. **Hero (320px):** an Amali render, "AMALI ▾" community switcher, a glass icon button and SOS. The greeting overlays the bottom of the image: "Good evening, Layla".
2. **Urgent banner** (if any), pinned and full width, in red, with a dismiss option only after it's acknowledged.
3. **Today at Amali:** a horizontal strip of status pills, e.g. "Pool · Open · Busy", "Gym · Open", "Padel · 3 slots", "Screening · 19:30". Tapping a pill opens the amenity.
4. **Quick actions** (3×2): Amenities · My Bookings · What's On · Kids' Club · Dining · Wallet.
5. **Your next booking:** a card with a countdown, a QR button and a cancel option.
6. **Kids' Club live** (if a child is checked in): a status card with a pulse dot.
7. **Announcements carousel:** targeted cards (Figma announcement card).
8. **What's on this week:** an events carousel (Figma event card).
9. **Bottom nav.**

---

## 10. Notification matrix

| Trigger | Recipient | App push | In-app banner/inbox | WhatsApp 1:1 | Timing |
|---|---|---|---|---|---|
| Booking confirmed | Booker (+ tagged players) | ✅ | Inbox | ✅ template | Immediate |
| Reminder (padel) | Booker | ✅ | — | ✅ | T−2h |
| Reminder (event) | Booker | ✅ | — | ✅ with Cancel quick reply | T−24h, T−2h |
| Reminder (dining) | Booker | ✅ | — | ✅ Confirm/Cancel | T−3h |
| Waitlist offer | Next in queue | ✅ | Inbox | ✅ Reply 1/2 | Immediate, 15-min hold |
| Offer expired | Previous offeree | ✅ | Inbox | — | On expiry |
| No-show recorded | Booker | ✅ | Inbox | ✅ | Start + grace |
| Strike warning / suspension | Booker | ✅ | Banner on amenity | ✅ | On strike 2 / 3 |
| Blackout affecting a booking | Affected | ✅ | Inbox + amenity banner | ✅ | On save |
| Event changed / cancelled | Registrants | ✅ | Inbox | ✅ | On save |
| Child checked in / out | Unit guardians | ✅ | Live card | ❌ (app only, to avoid noise) | Immediate |
| Creche incident (Med/High) | Unit guardians | ✅ | Live card | ✅ | Immediate |
| Unauthorised collector | Unit guardians | ✅ | Approval sheet | ✅ Approve/Deny | Immediate |
| Late pickup | Unit guardians | ✅ | Live card | ✅ | End + 10 min |
| Announcement | Audience | per composer | per composer | per composer | Now / scheduled |
| Emergency closure | Audience + guards | ✅ (priority) | Pinned banner | ✅ | Immediate, overrides quiet hours |
| Work order assigned / SLA risk | Assignee / supervisor | Console notification | — | — | Immediate / at 75% |
| Low wallet balance | Primary resident | ✅ | Wallet banner | — | When below AED 200 |

---

## 11. Global edge cases

| Area | Case | Expected behaviour |
|---|---|---|
| Eligibility | Owner has leased out the unit (Rashid) | Amenities show "Access is with your tenant until 31 Mar 2027". Booking is disabled; browsing still works |
| Eligibility | Account suspended for outstanding dues (flag) | "Amenity booking paused: contact the community office" with a call button. Existing bookings stay, and the CM sees them flagged |
| Household | Two household members book at the same moment | Unit quota check is atomic: the second gets `QUOTA_EXCEEDED` |
| Time | A booking that crosses midnight (Gym PT 23:30–00:30) | Allowed where hours allow. Shown as a single block in both days' views |
| Time | The demo clock jumps over many scheduled jobs | Jobs run in order and are idempotent (reminders aren't sent twice, no-show sweeps run once). The ticker shows a batched summary |
| Time | Viewing past days | The slot grid is read-only. Past bookings show their outcome tag |
| Payments | Wallet top-up fails (mock "card declined" toggle) | Inline error, nothing is charged, and a retry is offered |
| Payments | Refund on a cancelled paid booking | Ledger entry is "Refund"; the balance animates up |
| Concurrency | Two devices act on the same record (e.g. guard marks a no-show while the resident is checking in) | The latest valid state-machine transition wins; an invalid transition is rejected with a toast; both views update |
| Data | Long names, long event titles, 12-person parties, 0 events this week | Truncation with tooltips; layouts don't break; empty states show |
| Network | Offline toggle (presenter tools) | Resident app shows an "You're offline. Showing last updated 18:42" bar. Actions are queued, or blocked if they need to be live (booking needs a connection) |
| Permissions | Notifications off for the app | Settings show a nudge. WhatsApp fallback is used |
| Localisation | Switch to Arabic mid-flow | The screen flips direction with a cross-fade, and form state is kept |
| Deep links | Notification for a booking that was cancelled since | Opens the booking with a "This booking was cancelled at 18:10" state |

---

## 12. Screen states (required for every screen)

| State | Pattern |
|---|---|
| Loading | Skeletons shaped like the final content, with a shimmer. Show for 300–600ms on first navigation (simulated latency, configurable). Never show a spinner over a blank screen |
| Empty | Bronze line illustration, one line of copy and a primary action ("No bookings yet. Book the padel court") |
| Error | Inline message with a retry. Data stays where possible |
| No permission | A lock illustration, "Not available for your role", and who to ask |
| Offline | A sticky top bar; stale data is labelled with a timestamp |
| Success | Toast or full confirmation screen (for bookings), with a next action |

---

## 13. Motion and interaction spec

The goal is motion that feels calm, premium and physical, matching the brand ("water mirrors the sky"). Nothing bouncy or cartoonish. Use **Framer Motion** (`motion/react`).

### 13.1 Motion tokens

| Token | Value | Use |
|---|---|---|
| `dur.instant` | 100ms | Tap feedback, toggles |
| `dur.fast` | 160ms | Small state changes, chips, ticks |
| `dur.base` | 240ms | Most transitions |
| `dur.slow` | 360ms | Sheets, page pushes |
| `dur.slower` | 560ms | Hero and role switch, chart draw |
| `ease.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `ease.enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Elements entering |
| `ease.exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Elements leaving |
| `spring.soft` | `{ type:'spring', stiffness: 260, damping: 30, mass: 1 }` | Sheets, drag release |
| `spring.snappy` | `{ type:'spring', stiffness: 420, damping: 34 }` | Pill indicator, chips, layout changes |
| `stagger.list` | 30ms per item, max 8 items staggered | Lists and grids |

The presenter tool has a "Motion speed" setting: 1× by default, plus 0.5× for slow-mo explanation and 0 for off. Respect `prefers-reduced-motion`: replace movement with opacity fades of `dur.fast` and turn off parallax, shimmer and confetti-like effects.

### 13.2 Per-interaction specification

| # | Interaction | Motion |
|---|---|---|
| M1 | **Role switch** (shell pill) | Indicator: shared `layoutId` slide with `spring.snappy`. Device: the outgoing frame scales to 0.96 and fades out (`dur.base`, `ease.exit`); the incoming frame scales from 1.04 to 1 and fades in (`dur.slower`, `ease.enter`). When the frame type changes (phone → tablet), its width and height morph with `spring.soft` before the content fades in |
| M2 | **Scenario step change** (notes panel) | Number rolls vertically (odometer, `dur.base`). Title and body cross-fade with an 8px upward slide, staggered 40ms. The rule line draws from 0 to 64px wide |
| M3 | **Screen push / pop** (in app) | iOS-style: the new screen slides in from 100% x; the old screen moves to −30% x and dims to 0.9 opacity (`dur.slow`, `ease.standard`). Swipe from the edge to go back, with interactive scrubbing. Mirrored in RTL |
| M4 | **Tab switch** (bottom nav) | Cross-fade, `dur.fast`. The icon scales 0.9 → 1, and the bronze colour fades in |
| M5 | **Tap feedback** (all buttons and cards) | `whileTap: { scale: 0.97 }`, `dur.instant`. Cards also raise their shadow to `--shadow-card-hover` on hover (in the console) |
| M6 | **Bottom sheet** | Slides up with `spring.soft` and the backdrop fades to 40% over `dur.base`. Drag to dismiss: velocity over 500 or offset over 30% → dismiss; otherwise spring back |
| M7 | **Date strip / slot select** | The selected chip fills with bronze from the centre (clip-path circle, `dur.base`). The previous chip un-fills. The slot grid for the new date cross-fades with `stagger.list` |
| M8 | **Hold countdown** | An SVG ring with strokeDashoffset, animated linearly over the hold duration. In the last 30s, the ring turns amber and pulses gently once every 2s |
| M9 | **Booking confirmed** | The button morphs into a circle (width collapses, `spring.snappy`), the spinner becomes a check path drawn with `pathLength` 0 → 1 (`dur.slow`), then the ticket card rises from below with `spring.soft`. A gentle gold sheen sweeps across the ticket once (gradient translateX, 800ms) |
| M10 | **Rule rejection** | Horizontal shake on the offending control (x: 0, −6, 6, −4, 4, 0 over 320ms). The error text slides down (height auto + opacity). Alternative chips stagger in |
| M11 | **Slot state changes from another device** | A slot that becomes booked flashes `--brand-tint` and then settles to the booked style (`dur.slower`). A slot that becomes free fades from striped to available. **Never move the layout under the user's finger** |
| M12 | **Waitlist position / counters** | Odometer number roll (each digit is a vertical strip), `spring.snappy`. Used for the waitlist position, seats left, covers, occupancy and the reach meter |
| M13 | **Incoming notification** (dynamic-island style) | The island expands horizontally (`spring.snappy`), then drops into a banner card (`spring.soft`). It auto-collapses after 4s, and tapping it deep-links. Several notifications stack, with the newer card pushing the older one back (scale 0.95, y −8) |
| M14 | **Home banner appears** (announcement) | Height grows from 0 (layout animation) and the content fades in after 80ms. Content below shifts with a layout animation, never jumping. Urgent banners get a single soft red glow pulse |
| M15 | **Status change** (Open → Maintenance) | The tag colour cross-fades and the label slides (the old one up and out, the new one up and in), `dur.base`. The amenity card image desaturates to 60% (filter transition, `dur.slower`) for closed or maintenance states |
| M16 | **WhatsApp message arrives** | The bubble scales from 0.9 (origin bottom-left) and fades in with `spring.snappy`. A typing indicator shows for 600ms before system messages. Ticks: single → double → bronze, each step cross-fading |
| M17 | **Live occupancy ring** | The arc animates between values (`spring.soft`). The label rolls (M12). When the band changes (Quiet → Busy), the colour tweens |
| M18 | **Checklist tick** | The checkbox fills with a scale pop (0.8 → 1.1 → 1, `dur.base`), the check path draws, the item text dims to the muted colour, and a progress bar fills |
| M19 | **Water reading out of range** | The input border tweens to danger. The range bar marker slides to the value, and a warning chip shakes once (M10 style, smaller) |
| M20 | **Strikethrough on cancellation** (impact preview, cancelled bookings) | A line draws across the row left to right (scaleX 0 → 1, `dur.base`), then the row fades to 50% and collapses in height |
| M21 | **Delivery funnel** | Bars grow from 0 with `spring.soft`; counters roll (M12); per-recipient rows change their tick icon with a cross-fade. The reach meter is a progress arc with an elapsed-time label |
| M22 | **Charts** (console) | Lines draw via `pathLength` (`dur.slower`). Bars grow from the baseline with a 20ms stagger. The heatmap cells fade in diagonally (stagger by row + column). Tooltips follow the pointer with spring smoothing |
| M23 | **Generate report** | The button changes to a progress state, skeleton cards shimmer, then real cards replace the skeletons in place (cross-fade, shared layout), staggered |
| M24 | **Drag reservation** (F&B timeline) | The picked block lifts (scale 1.03, shadow up). Valid drop zones highlight. On drop it snaps to the grid with `spring.snappy`. An invalid drop springs back to the origin with a small shake |
| M25 | **Creche check-in** | The child card slides into the room board column with a shared `layoutId` from the check-in screen. The ratio gauge animates, and turns red with a pulse if it goes over |
| M26 | **Wallet balance change** | The number rolls (M12). Debits flash a muted tone and credits flash success, at 10% tint, over `dur.slower` |
| M27 | **Skeleton shimmer** | A linear-gradient sweep, 1.4s loop, warm grey. Turned off under reduced motion |
| M28 | **Reset demo** | The icon spins 360° (`dur.slower`), and the device content fades through the Amali logo splash (400ms) back to the start screen |
| M29 | **Language switch (RTL)** | The device content cross-fades (`dur.base`) while the direction flips. Nothing slides, so the user isn't disoriented |
| M30 | **Pull to refresh** (resident lists) | A bronze arc fills with the pull distance, and on release spins until done (min 400ms) |

### 13.3 Performance rules

- Animate only `transform`, `opacity`, `filter` (M15 only) and `clip-path` (M7 only).
- Use `layout` animations sparingly and scoped to small regions. Never use a layout animation on a list over 30 items.
- Target 60fps on a 2020 MacBook Air at 1440p. Test with the Chrome performance panel during the role switch and the urgent closure flow.
- No animation may block input. Every interaction can be interrupted.

---

## 14. Localisation (English default, Arabic later)

- **Default** is English. **Profile → Settings → Language** offers English / العربية. Switching sets `dir="rtl"` and `lang="ar"` on the **device root only**; the shell stays English.
- Use i18next. Every string is a key. For v1, ship `en.json` complete and `ar.json` with all keys present, using machine-quality placeholders marked `TODO-REVIEW`.
- Use CSS **logical properties** everywhere (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Never use `left` or `right` in component styles.
- Directional icons (chevrons, back arrows, progress) mirror. Clock and media icons don't.
- The Arabic font is **IBM Plex Sans Arabic** (Google Fonts), paired with Manrope for Latin characters.
- Numbers use Western digits (common in the UAE), and dates and currency are formatted through `Intl` with `en-AE` / `ar-AE`. Currency format is "AED 1,250" in English and "1,250 د.إ" in Arabic.
- **Mixed-direction text:** wrap unit numbers, phone numbers and English names in `<bdi>`.

---

## 15. Demo scenarios (scenario index and scripts)

The ≡ menu lists these scenarios. Each step in the notes panel can **auto-set** the role, persona, screen and demo clock (a "Take me there" button), so the presenter never has to navigate by hand.

### S1 — Padel: fair booking, a waitlist and a no-show (C1)

**Start:** Wed 14 Oct, 17:30.

**Seed:** James's 2 bookings this week are both peak (Mon 19:00, Tue 20:00).

1. **Resident (James).** Open Padel. Point out the rules summary and the quota "2 of 3". Try Thu 21:00: blocked by the peak limit (2 of 2 peak used), with alternatives offered. Book Thu 17:00 for 90 min with 1 guest (AED 50).
2. **Resident (Layla).** Thu 17:00 shows "Booked". Tap it and join the waitlist, as #1.
3. **Dual view: Resident (Layla) + Resident (Ahmed).** Ahmed joins the same waitlist as #2.
4. **Resident (James).** Move the clock to Thu 13:00 (inside the 6h cutoff) and cancel: "Late cancellation: strike 3 of 3". A suspension banner appears, and the guest fee is not refunded.
5. **Resident (Layla) + WhatsApp.** The waitlist offer arrives in both places with a 15-minute hold. Layla lets it expire: skip the clock forward 15 min.
6. **WhatsApp (Ahmed).** The offer passes to Ahmed. Reply "1" and the booking is confirmed; the app updates live.
7. **Alternative ending.** Skip to Thu 17:16 without checking Ahmed in. **Guard:** the no-show sweep flags him, the no-show is recorded with a strike, and the rest of the slot is released.

### S2 — Padel blackout for maintenance (C1, C3, C5)

1. **Console (Supervisor).** Padel → Blackout, Thu 06:00 – Fri 12:00, linked to WO-0219 (CourtPro). Show the impact preview, choose "Cancel + priority rebook", and confirm.
2. **Resident (Ahmed).** His Thu 17:00 booking from S1 is cancelled by ops. He gets a notification, an amenity banner, and a priority-rebook sheet with 3 slots. Pick one: it doesn't count against the quota.
3. **Console.** The calendar shows the hatched blackout. The work order SLA timer is running.

### S3 — Screening Room: Family Movie Night (C1, C2)

1. **Console (CM).** Create the event: 2 days × 2 showtimes, rated PG, guest pricing. Publish, and send the announcement to families with children in the same flow.
2. **Resident (Layla).** What's On → year view → this week list → the event. RSVP: 2 residents, 2 kids, 1 guest adult. Choose seats. AED 25 is charged.
3. **Resident (Sofia).** Try adding 3 guests: blocked by the guest limit.
4. Skip the clock to T−2h. A **WhatsApp** reminder arrives with a "Cancel" quick reply.
5. **Guard.** Skip past the showtime end. Attendance → mark 4 of 5 attended (post-remote). **Console:** the attendance is reflected in the no-show report.

### S4 — Creche: a supervised session with a ratio change (C1, C3, C5)

1. **Resident (Layla).** My Unit → Children → Omar (4, Kids band). Book the morning session.
**Seed:** the Kids band is staffed by Grace and Aisha (capacity 2 × 8 = 16), with 11 children already booked.

2. **Creche.** Maria scans Layla's guardian QR → allergy flag → check in. The board shows Kids band 12/16.
3. **Resident (Layla).** The live card shows "In the Playroom", with activity updates.
4. **Console → Rosters.** Grace calls in sick. **Creche board:** Kids capacity drops to 8, so the band is "Over ratio by 4" in red, and new check-ins are blocked. Maria reassigns herself (Lead) to the Kids band from the roster. Capacity goes back to 16 and the gauge turns green.
5. **Creche.** Log a Low incident ("minor scrape, plaster applied"). **Resident:** sees it at check-out and acknowledges.
6. **Creche.** A nanny who isn't authorised arrives. An approval request goes to the **WhatsApp** phone; tap Approve, and check-out completes.

### S5 — Dining: Teppanyaki and the wallet (C1, C6)

1. **Resident (Sofia).** Teppanyaki 21:00 for 4 people: a deposit of AED 400 is needed but only AED 120 is available. Top up AED 500, then confirm.
2. **F&B.** Elena sees the booking on the timeline. Covers for the dinner period update. Drag a restaurant booking to a canal-view table.
3. Skip the clock to 21:31. **F&B:** another party gets the no-show auto-flag, and the deposit is forfeited. **Resident:** a notification with the policy.
4. **F&B.** Settle Sofia's bill at AED 1,520: the deposit is applied and the rest is charged to the wallet. The receipt appears in the app.

### S6 — Pool & Gym: one operational day (C3, C5)

1. **Console (Supervisor).** Pool opening checklist. Water reading pH 8.1 is out of range, which prompts "Set to Limited and raise incident?" Choose Yes.
2. **Console.** Convert the incident to a work order (P2), assign it to AquaPure, and show the SLA timer and roster visibility.
3. **Resident.** The pool shows "Limited: water balancing in progress". The gym is open with live occupancy.
4. **Guard.** Pool occupancy counter +/−. The resident ring updates live.
5. **Console.** AquaPure's update comes in (simulated, via a "Vendor update" action) and marks the work order Resolved; the supervisor verifies and closes it, and the pool reopens.

### S7 — Communication: the daily update and an urgent closure (C4)

1. **Console (CM).** The Daily amenity update template is filled in from live status. Target **East Tower floors 10–20 + North villas**, schedule it for 07:30 tomorrow. Then send a second update now.
2. **Dual view: Resident (Layla, East 18) + Resident (Priya, PV-05).** Both get the banner. Switch to Sofia (West PH): no banner. Priya: no WhatsApp, because she opted out.
3. **Console.** The delivery funnel fills live. Show the difference in read visibility between Channel and 1:1 messages.
4. **Console (Supervisor).** Emergency close the Pool (lightning). **Dual view: Resident + Guard.** The island notification, a pinned red banner and the guard's "Clear pool" alert appear at once. The reach meter shows "182 of 190 in 0:42".
5. Send "Reopened": the banner turns green.

### S8 — Management: reports and access (C6)

1. **Console (CM).** Reports → Generate (last 30 days, all amenities). Show utilisation, the peak heatmap, the no-show rate, booking trends and revenue. Export to Excel and open the sheets.
2. Switch to **Amenity Supervisor**: the revenue sheet and Roles settings disappear, and only Pool, Gym and Padel are shown.
3. Switch to **Call-centre Agent**: book padel on behalf of Layla (a reason is required). The phone number is masked, with a logged "Reveal". Export is hidden. Try to open a blackout: no-permission state.

---

## 16. Technical architecture (for Claude Code)

### 16.1 Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 15** (App Router), `output: 'export'` (static), all UI as client components |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, with tokens defined as CSS variables in `globals.css` and mapped in the Tailwind theme |
| Motion | `motion` (Framer Motion) |
| State | Zustand, with the `persist` middleware (localStorage) and `BroadcastChannel` sync across tabs and windows |
| Dates | `date-fns` + `date-fns-tz` (Asia/Dubai); `rrule` for recurrence |
| Charts | Recharts (custom-styled with the tokens) |
| Excel | SheetJS (`xlsx`) |
| QR | `qrcode.react` |
| i18n | `i18next` + `react-i18next` |
| Icons | `lucide-react` (stroke 1.5) |
| Validation | `zod` for forms and the rules config |
| Seed randomness | `seedrandom` (fixed seed `amali-2026`) |
| Testing | Vitest for the rules engine and scheduler; Playwright smoke test per scenario |

### 16.2 Folder structure

```
src/
  app/                    # single page: /  (shell)  + /present?scenario=S1&step=3
  shell/                  # RolePill, DeviceFrame (phone/tablet/browser), NotesPanel, PresenterMenu, DemoClock, PersonaPicker, Ticker
  surfaces/
    resident/             # screens, components
    whatsapp/
    guard/
    creche/
    fnb/
    console/
  domain/
    rules/                # validateBooking, quota, penalties, ratio
    booking/              # state machine
    events/               # showtimes, seats, attendance
    creche/
    dining/
    ops/                  # status, checklists, water, incidents, work orders, SLA
    comms/                # audience resolver, delivery simulator, templates
    reports/              # KPI calculators, xlsx builder
    rbac/                 # permission matrix, can(role, action, resource)
  store/                  # zustand slices + selectors + broadcast sync
  scheduler/              # job queue driven by demo clock
  seed/                   # community, personas, amenities, 90-day history
  config/rules.ts         # every business number
  design/tokens.ts        # colours, type, radii, motion tokens
  i18n/en.json, ar.json
public/amenities/, public/brand/
```

### 16.3 Store shape (summary)

```
community, units, residents, children, guardians, staff, vendors
amenities, amenityStatus, hours, exceptions, blackouts
slots (derived), bookings, holds, waitlists, penalties
events, showtimes, seats, rsvps, attendance
crecheSessions, crecheBookings, crecheCheckins, incidents
venues, tables, reservations, wallet{balances, ledger, holds}
checklists, cleaningLogs, waterReadings, rosters, workOrders
announcements, deliveries, whatsappThreads, channelPosts
notifications (per user), auditLog
demo{clock, speed, role, persona, consoleRole, scenario, step, offline, dualView}
```

All mutations go through **domain actions**, e.g. `bookings.create()` and `ops.setStatus()`. Each action validates input, writes to the store, appends to the audit log, emits domain events and schedules jobs. Components never write to the store directly.

### 16.4 Demo clock and scheduler

- `demo.clock` is an ISO time. In "live" mode it advances in real time × the speed setting; presenter controls can jump it.
- The **scheduler** keeps a queue of jobs, each with a `runAt` time:
  - reminders
  - hold expiry
  - waitlist offer expiry
  - no-show sweeps
  - scheduled announcements
  - delivery and read simulation ticks
  - SLA threshold checks
  - late-pickup timers
  - water-reading-due alerts
- On every clock change, the scheduler runs all due jobs **in time order**. Jobs must be idempotent (keyed by `jobId`), so skipping 3 days runs each job exactly once.
- The status bar in every device shows the demo clock (HH:mm).

### 16.5 Live sync across surfaces

- Every device frame renders from the same store, so updates are instant in the same tab.
- `BroadcastChannel('amali-demo')` mirrors state changes to other tabs. This lets the presenter put the Guard app on a second screen or an iPad (`/present?role=guard`).
- **Optional:** a QR in presenter tools opens the current role on a real phone over the same origin. Those devices sync over BroadcastChannel only on the same browser profile. Cross-device sync is a stretch goal, and needs a free realtime backend such as Supabase Realtime. It's not required for v1.

### 16.6 Persistence and reset

- localStorage key `amali-demo:v1`. A version bump re-seeds.
- **Reset** re-seeds from a deterministic seed and moves the clock to the scenario's start time.
- **Snapshot / restore:** presenter tools can save named snapshots (e.g. "Before S4"), so the presenter can rehearse and jump back.

---

## 17. Build plan (phases for Claude Code)

Build in this order. Each phase ends with its "Done when" checks passing. Commit after every phase.

| Phase | Scope | Done when |
|---|---|---|
| **P0 Foundations** | Next.js setup, tokens, fonts, i18n scaffold, store, seed (community, personas, amenities), demo clock and scheduler, rules config, amenity image mapping | The token preview page renders; `validateBooking` unit tests pass for all 11 checks; clock jumps run jobs once |
| **P1 Shell** | Role pill, device frames (phone, tablet, browser), notes panel, presenter menu, persona picker, reset, dual view, keyboard shortcuts | Switching roles animates per M1; reset restores the seed; dual view shows two live frames |
| **P2 Resident core** | Home (per §9), Amenities list and detail, What's On (list, month and year), Activity, My Unit, Wallet, notifications (M13) | All screens have the 5 states; navigation uses M3; nav per Figma |
| **P3 Padel** | Full §8.1 including holds, quota, waitlist and offers, cancel and late cancel, no-show sweep, penalties, blackout and impact preview | Scenarios S1 and S2 run end to end |
| **P4 Events** | §8.2: event builder, showtimes, seat map, RSVP form, guest categories, reminders, cancellation, waitlist by party size, guard attendance (live and post-remote), offline queue | Scenario S3 runs end to end |
| **P5 Comms + WhatsApp** | §8.7: composer, audience resolver, channels, scheduling, quiet hours, delivery simulator, analytics, banners, the WhatsApp phone with two-way replies | Scenario S7 runs end to end; targeting proof works across personas |
| **P6 Pool/Gym ops + Work orders** | §8.5 and §8.8: statuses, hours and exceptions, occupancy, checklists, cleaning, water quality, rosters, incidents → work orders, vendors, SLA, audit log | Scenario S6 runs end to end |
| **P7 Creche** | §8.3: children, guardians, sessions, ratio capacity linked to the roster, check-in/out, approvals, live status, incidents, late pickup | Scenario S4 runs end to end |
| **P8 Dining** | §8.4: venues, reservations, F&B tablet (timeline, floor, arrivals, covers), no-show policy, deposits, settlement | Scenario S5 runs end to end |
| **P9 Programme** | §8.6: recurring RRULE activities, seasonal programmes, conflict detection, edit scopes | The recurring clinic blocks padel; the Ramadan season changes hours |
| **P10 Console reporting + RBAC** | §8.10 and §8.11: 90-day history, report generation, charts, Excel export, role sub-switch, permission gating | Scenario S8 runs end to end; the exported xlsx opens with the correct sheets per role |
| **P11 Polish** | Motion audit against §13, reduced motion, Arabic switch (§14), accessibility pass, performance pass, Playwright scenario smoke tests | All 8 scenarios pass the smoke test; 60fps on the role switch and urgent closure |

---

## 18. Assumptions and items to confirm with Amali

All of the following are **mock values or assumptions** to be confirmed:

1. **Community structure:** tower names, floor counts, villa clusters and unit numbering (§3.3).
2. **Business rules:** every value in §8, especially padel quota and penalties, creche ratios and fees, guest allowances, F&B deposits and no-show policy, pool hours and water ranges.
3. **Ownership vs tenancy:** who holds amenity rights, and whether owners keep any rights after leasing out.
4. **Chargeable amenities and wallet:** whether the wallet is prepaid membership credit, a charge to the unit account, or both.
5. **WhatsApp:** whether Amali will use a WhatsApp Channel, 1:1 Business messaging, or both. In production, 1:1 template messages need Meta approval of each template.
6. **Branding:**
   - The page background `--bg-page` was sampled visually, not taken from a Figma variable.
   - The warning, danger, info and maintenance colours are proposals.
   - PP Neue Montreal licensing needs checking.
7. **Imagery:** confirm that the seven images in the `amenities` folder map to the seven amenity keys (§5.8). A hero render and the logo SVG are needed from Amali.
8. **Device frames:** F&B and the Management console default to tablet and browser frames inside the shell. If everything must be in the phone frame, set `shell.forcePhoneFrame`.
9. **Creche data:** in production, storing children's medical notes and guardian IDs needs Amali's privacy and data-retention policy (UAE PDPL). The prototype uses fictional data only.
