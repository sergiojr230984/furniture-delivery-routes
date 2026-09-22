# Belliza Delivery

A furniture-delivery marketplace platform: retailers see a price, pick an
available window, book, pay and track a delivery — fulfilled either by
Belliza's own crew or by an approved independent delivery provider —
without calling a dispatcher.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS ·
PostgreSQL**.

---

## Why this stack (read before assuming Supabase)

This started from an existing single-store Next.js/Supabase app. That app's
core dependency — a hosted Supabase project (Auth + PostgREST + Storage) —
can't be run in this environment (no Docker, so `supabase start` doesn't
work), and the brief requires actually running and verifying the app, not
just writing code against an assumed backend. So the data layer was
rebuilt on **plain PostgreSQL** (the `pg` driver) with a small custom
session-cookie auth (scrypt password hashing, HMAC-signed cookies) instead
of a hosted auth provider. Every server action/page re-verifies the
session against the database (so a deactivated user or suspended
organization is locked out immediately), and every query is scoped by
organization — there is no client-trusted tenant ID anywhere.

This is a deliberate, portable choice: it is a completely ordinary
relational-database + TypeScript + cookie-auth stack, runs fully offline,
and points at any managed Postgres (Neon, RDS, Supabase-as-just-a-Postgres,
etc.) for production by changing one connection string.

Other notable choices:
- **File storage**: private local disk (`.data/uploads`, gitignored),
  served only through a route handler requiring a signed, time-limited
  token (`lib/storage.ts`). Swap for S3/Supabase Storage in production —
  callers only touch `saveFile` / `readStoredFile` / `signedFileUrl`.
- **Payments**: `stripe` (test mode) when `STRIPE_SECRET_KEY` is set,
  otherwise an in-app demo adapter that never calls out to a real payment
  network (`lib/payments.ts`).
- **Notifications**: Twilio SMS when configured, otherwise every
  notification is recorded in a `notifications_outbox` table with a
  dedupe key, visible at **Admin → Notifications** (`lib/notify.ts`). No
  email provider is wired up by default (SMTP hook is stubbed).
- **Routing**: a transparent nearest-neighbour + 2-opt heuristic
  (`lib/routing.ts`, carried over from the original app) — no external
  maps/geocoding API, no claim of "AI-optimized" routing.
- **i18n**: a small English/Spanish dictionary (`lib/i18n`) with a cookie
  based locale switch, applied to navigation, login and the customer
  facing tracking page. Not every string in the admin/provider back office
  is translated yet — see **Known limitations**.

---

## Roles & operating modes

Roles: `platform_admin`, `dispatcher`, `retailer_owner`, `retailer_staff`,
`provider_owner`, `crew_member`. Belliza's own delivery crew is modeled as
a **provider organization** with `is_internal_fleet = true`, so it flows
through the exact same dispatch/assignment code as an outside provider,
with its cost recorded as `internal_delivery_cost` rather than a payout.

`APP_MODE` (env var) is one of:
- `demo` — seeded fictional data, every screen that would send a real
  charge/payout/SMS instead shows the simulated/demo path. **Default.**
- `pilot` — internal Belliza stores + internal crew only; the "send to
  delivery network" option and `/providers/apply` signup are disabled.
- `marketplace` — external retailers and approved providers enabled.

---

## Setup

### 1. Point at a Postgres database

```bash
createdb belliza
cp .env.example .env.local
```

Edit `.env.local` — at minimum set `DATABASE_URL` and a random
`SESSION_SECRET` (`openssl rand -hex 32`). Everything else has a working
demo fallback.

### 2. Install, migrate, seed

```bash
npm install
npm run db:migrate
npm run db:seed
```

`npm run db:reset` drops and recreates everything (migrate `--reset` +
seed) — handy in development.

### 3. Run it

```bash
npm run dev
```

Open <http://localhost:3000>. All demo accounts share the password
`demo1234` (also shown on the login screen in demo mode):

| Email | Role |
| --- | --- |
| `admin@belliza.demo` | Platform admin |
| `dispatch@belliza.demo` | Dispatcher |
| `owner@casamiami.demo` | Retailer owner (Casa Miami Furniture) |
| `sales@casamiami.demo` | Retailer salesperson |
| `owner@sunshinemovers.demo` | External provider owner (approved) |
| `crew@sunshinemovers.demo` | External provider crew member |
| `owner@tricounty.demo` | External provider owner (**pending review** — approve it at Admin → Organizations to see that workflow) |
| `fleet@belliza.demo` | Belliza internal-fleet "provider" owner |
| `jorge.crew@belliza.demo` / `wilfredo.crew@belliza.demo` | Belliza internal crew |

### 4. Tests

```bash
npm run db:test:setup   # once, against a separate belliza_test database
npm test
```

`tests/*.test.ts` are pure unit tests (pricing engine, state machine,
vehicle-fit heuristic). `tests/integration/*.test.ts` run against a real
Postgres and exercise the concurrency-sensitive guarantees directly (see
**What's verified** below).

---

## Core workflow (what actually works end to end)

1. **Retailer books** (`/retailer/book`): pickup (store / address /
   Belliza warehouse) → furniture items (saved product or custom, with
   dimensions/weight/"unknown", photos placeholder, packaging, assembly)
   → destination & access details → service level (curbside / room of
   choice / room of choice + assembly, debris/old-furniture removal,
   priority) → itemized quote.
2. **Instant confirmation** picks an internal-fleet vehicle with real
   remaining capacity for the chosen date, atomically reserves it
   (`lib/capacity.ts`), authorizes payment, records ledger entries,
   creates a tracking token, and only then marks the booking
   **Confirmed**. If no capacity exists, that option isn't offered.
3. **Marketplace path** ("send to delivery network") authorizes payment
   and creates offers to every approved external provider; the booking
   sits at **Awaiting provider acceptance** — never "confirmed" — until
   one provider atomically accepts (`lib/offers.ts`); every other pending
   offer for that booking is cancelled the instant one is accepted.
4. **Crew mobile job screen** (`/crew/jobs`): confirm crew/vehicle → en
   route to pickup → arrived, pickup-condition photo + collected-items
   checklist required before "picked up" is allowed → en route to
   delivery → arrived, delivered-items checklist + completion photo +
   signature (or an explicit waiver reason) required before "delivered"
   is allowed. Every transition is validated server-side against a state
   machine (`lib/state-machine.ts`, `lib/crew-service.ts`); missing
   evidence is rejected with a specific message, not silently skipped.
5. **Recipient tracking** (`/track/[token]`): status, window, crew
   identity (Belliza vs. named external provider), instructions — no
   account needed, link expires.
6. **Dispatch board** (`/admin/dispatch`): bookings awaiting acceptance
   with a "widen pool / raise payout" action (capped at 1.25× the
   original payout — it does not raise indefinitely), today's jobs,
   multi-stop route batching + re-optimize, expiring-document alerts.
7. **Provider lifecycle**: apply at `/providers/apply` → admin approves
   the org and reviews uploaded documents (`/admin/organizations/[id]`) →
   provider adds vehicles/crew → accepts offers → gets paid (payouts move
   `pending → eligible` only once the crew actually marks the job
   delivered, never before).
8. **Claims**: retailer files a claim from a delivered/failed booking →
   admin approves/denies with an adjustment amount, which posts a
   `claims_payout` ledger entry.
9. **Finance** (`/admin/ledger`): retailer charges, provider payouts,
   processing fees, internal delivery cost and an explicitly-labeled
   **illustrative contribution estimate** — never called "profit."

## What's verified (not just written)

I ran the actual app against a real local Postgres (migrations apply
clean, `next build` succeeds) and drove it end to end with a browser
(Playwright) and direct calls into the domain functions:

- Full retailer wizard → instant internal confirmation → crew completes
  every step with evidence gates enforced → tracking page shows
  "Delivered", notifications outbox shows the confirmed/out-for-delivery/
  delivered SMS chain, deduplicated.
- Marketplace path → two different providers racing to accept the same
  booking's offers concurrently → exactly one wins, the loser gets "no
  longer available," the booking has exactly one assignment.
- `tests/integration/concurrency.test.ts` (real DB, run with `npm test`):
  concurrent capacity-hold races on a single-slot vehicle, concurrent
  double-click accept on the *same* offer, sequential acceptance after a
  booking is already taken, webhook idempotency, expired vs. valid
  tracking tokens — 28/28 tests passing, re-runnable without reseeding.
- Tenant isolation: a retailer org cannot read/act on another retailer's
  booking (enforced in `lib/booking-service.ts`, tested).
- `npm run build` produces a clean production build of all 40+ routes.

## Demo / simulated integrations

Everything below runs with **zero external credentials** and never sends
a real charge, payout, or message:

| Integration | Demo behavior | To go live |
| --- | --- | --- |
| Payments | Records a `demo_recorded` payment/ledger entry | Set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (Stripe test mode supported end to end, manual-capture PaymentIntents, webhook signature verification + idempotent event log) |
| SMS | Written to `notifications_outbox`, visible at Admin → Notifications | Set `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` |
| Email | Same outbox, `status: demo_sent` | Wire an SMTP client into `lib/notify.ts`'s `tryEmail` (stubbed to return `false`) |
| Map view | List/calendar views only, banner explains why | Set `NEXT_PUBLIC_MAPBOX_TOKEN` and add a map component (not built) |
| Geocoding | None — distance falls back to a flat estimate, noted as a line item | Add a geocoding call when saving pickup/destination addresses |

## Known limitations / not implemented

Being direct about what a "senior engineer" ships in this scope vs. what's
left, per the instruction not to overclaim:

- **No real map view** — list/calendar only (see table above).
- **i18n coverage is partial** — the mechanism (dictionary + cookie
  switch) is real and applied to login, all three app shells' navigation,
  and the customer tracking page, but most in-app copy (form labels,
  admin screens) is English-only. Extending `lib/i18n/dictionaries.ts` is
  mechanical.
- **Route batching is basic** — one button re-sequences a day's stops
  with the transparent heuristic; there's no manual drag-and-drop
  reorder UI, and bundled-route *offers* to providers aren't implemented
  (only individual-job offers are — the spec allows this: "individual jobs
  **and** bundled routes").
- **Photo uploads have no client-side compression/validation beyond
  MIME/extension**, and there's no offline evidence queue in the crew UI
  (a dropped connection loses an in-progress upload rather than queuing
  it) — the spec's "preserve drafts and queued evidence locally" is not
  built.
- **Change-order approval workflow** has a table and audit trail
  (`change_orders`) but no UI yet to raise/approve one from a page — price/
  window changes after confirmation aren't exposed to end users at all,
  which is safer (nothing can silently change) but incomplete.
- **Retailer discounts and per-retailer pricing** are supported by the
  pricing engine (`retailer_discounts` map in the rule-set config) but
  have no dedicated admin UI — set them by editing the JSON on the
  Pricing page.
- **No automatic expired-offer sweep job** — expiry is checked lazily
  (whenever a hold/offer is read or accepted); there's no cron/queue
  actually running in the background. `app/api/webhooks/stripe` exists,
  but nothing schedules a periodic "widen pool" pass — a dispatcher
  triggers it manually from the dispatch board today.
- **Password reset / email verification** don't exist — an admin/owner
  hands out a temporary password out-of-band (shown once in the UI after
  creating a login).
- The document-upload flow accepts any file up to what Next's default
  body-size limit allows; there's no virus scanning or strict file-type
  sniffing beyond the extension.

## Security posture

- Every server action re-derives the acting user + org from the signed
  session and the database on each call — no role/org is trusted from a
  form field.
- Retailer/provider/crew data access is always scoped by `org_id` in the
  SQL itself, not filtered client-side.
- Uploaded files (proof-of-delivery photos, signatures, provider
  insurance/license documents) are stored outside any public path and
  served only via a route that checks an HMAC-signed, short-lived token.
- Passwords are hashed with `scrypt` (Node's built-in, no external native
  dependency) and compared with a constant-time check.
- Stripe webhooks verify the signature and record the event id before
  acting on it, so a replayed/duplicated delivery is a no-op.

**Before any real customer, payment, or payout**: get a real security
review of the session/cookie implementation, add rate limiting on login
and file upload, add virus scanning on uploads, replace local file
storage with object storage + a CDN, add real geocoding, and have counsel
review the cancellation/claims terms and tax handling (deliberately left
configurable/unset in this build).

---

## Project structure

```
app/
  admin/            platform admin + dispatcher area
  retailer/         retailer owner/salesperson area (booking wizard, bookings, staff, spending…)
  provider/         delivery-provider area (offers, routes, vehicles, crew, documents, earnings)
  crew/             mobile job screen for crew members
  providers/apply/  public provider-onboarding signup
  track/[token]/    public recipient tracking (no auth)
  access/[token]/   public secure link for the recipient to fill in access details
  api/files/        authorized, expiring file serving
  api/webhooks/     Stripe webhook (idempotent)
lib/
  db.ts             pg pool + query helpers + withTransaction
  session.ts        signed-cookie sessions
  auth.ts           requireUser/requireRole (re-verified against the DB every call)
  pricing.ts        pure, unit-tested pricing engine
  capacity.ts       transactional capacity holds + vehicle-fit heuristic
  booking-service.ts core booking domain logic (used by both the UI and the seed script)
  offers.ts         atomic marketplace offer accept/decline/widen
  crew-service.ts   crew job state machine + evidence gates
  route-service.ts  multi-stop route batching (nearest-neighbour + 2-opt)
  ledger.ts, payments.ts, notify.ts, tracking.ts, storage.ts, time.ts, i18n/
db/
  migrations/*.sql  applied in order by db/migrate.ts, tracked in `_migrations`
  seed.ts           demo data (all is_demo = true), reusing the same domain functions as the UI
tests/
  *.test.ts             pure unit tests
  integration/*.test.ts real-Postgres concurrency/isolation tests
```

## Deployment

No CI/CD or hosting config is included on purpose. This build stores
uploaded files on local disk and expects a long-lived Postgres connection
— both are incompatible with a serverless/ephemeral host as-is, and the
task explicitly calls for not deploying publicly or activating real
payments/messages automatically. To deploy for real: point `DATABASE_URL`
at a managed Postgres, replace `lib/storage.ts` with an S3-compatible
client, set the real Stripe/Twilio credentials, and set `APP_MODE` to
`pilot` or `marketplace` deliberately.

## Environment variables

See `.env.example` for the full list with explanations. Nothing beyond
`DATABASE_URL` and `SESSION_SECRET` is required for a complete local demo.
