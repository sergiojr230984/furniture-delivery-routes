# La Cuevita — Furniture Delivery & Route Management

A web app for a retail furniture store to manage customer deliveries, supplier
pickups, vans, drivers/helpers, routes and proof-of-delivery.

Built with **Next.js (App Router) · TypeScript · Tailwind CSS · Supabase**
(Postgres + Auth + Storage).

---

## Roles

| Role | Can do |
| --- | --- |
| **Admin / Dispatcher** | Everything: deliveries, routes, vehicles, drivers, customers, staff logins |
| **Manager** | Same as admin except staff/user management |
| **Salesperson** | Create deliveries, view deliveries & customers |
| **Driver** | Mobile driver app: see assigned stops, update status, capture proof |

## Features (v1)

- Email/password login with role-based navigation
- Delivery order creation (customer or supplier pickup) with line items
- Delivery list filtered by date and status
- Delivery detail with full status tracking + audit history
- Vehicle / van management
- Driver & helper management (with optional login provisioning)
- Route assignment screen (assign van + driver + helper, order the stops)
- Mobile-first driver view of today's routes & stops
- Mark **delivered** / **failed** (with reason) / out-for-delivery / rescheduled
- Upload proof-of-delivery photos (camera capture on mobile)
- Capture customer signature on a canvas
- Delivery notes

**Statuses:** Pending · Scheduled · Loaded · Out for Delivery · Delivered ·
Failed · Rescheduled

## Smart routing (Onfleet-style)

- **Route optimization** — a nearest-neighbour + 2-opt engine re-sequences each
  route around your depot to cut distance and drive time. It **gets smarter with
  every delivery**: real on-site durations (arrival → completion) are learned per
  customer and fed back into future ETAs (see `lib/routing.ts`, `lib/optimize.ts`).
- **On-demand auto-dispatch** — new on-demand orders are woven into the best
  same-day route automatically (capacity-feasible, lowest added distance, zone
  match as a tie-breaker), then the route is re-optimised — no manual planning.
- **Predictive ETAs & delay detection** — every stop gets a projected arrival
  time; stops expected to miss their delivery window are flagged on the route, the
  dispatch board, and an **At-risk deliveries** widget on the dashboard.
- **Scheduled, on-demand, or both** — plan routes ahead, handle on-demand orders
  live from the Auto-Dispatch board, or run both from one place.
- **Custom routing constraints** — delivery zones, per-vehicle capacity (weight)
  and max-stops, service times, toll avoidance, and delivery windows all shape the
  optimised result. Configure the depot/defaults on the **Settings** screen and
  areas on the **Zones** screen.
- **Driver live-location tracking** — drivers flip on “Live location” in the
  mobile app to broadcast their GPS position; dispatchers watch the crew on the
  **Live tracking** screen (auto-refreshing OpenStreetMap maps, online/offline
  status, speed & accuracy) — again, no paid maps API required.

> The routing engine is fully self-contained (great-circle distance with a road
> correction factor) and needs **no external map/geocoding API**. Provide
> latitude/longitude on orders and the depot to enable optimisation and ETAs.

---

## Database

The full schema lives in [`supabase/schema.sql`](supabase/schema.sql) and creates:

`profiles`, `customers`, `delivery_orders`, `delivery_items`, `vehicles`,
`drivers`, `routes`, `route_stops`, `delivery_photos`, `delivery_signatures`,
`delivery_status_history`

…plus enums, an auto-generated order number (`DO-000001`), an automatic
status-history trigger, row-level-security policies for every role, and two
private storage buckets (`delivery-photos`, `signatures`).

---

## Setup

### 1. Create a Supabase project

Go to [app.supabase.com](https://app.supabase.com) → **New project**.

### 2. Run the schema

In the Supabase dashboard → **SQL Editor**, paste and run the contents of
[`supabase/schema.sql`](supabase/schema.sql) — it includes the advanced routing
tables/columns. Optionally run [`supabase/seed.sql`](supabase/seed.sql) for sample
vans, crew, customers, a depot, a zone and an on-demand order.

> Already have an earlier version of the database? Run
> [`supabase/upgrade_routing.sql`](supabase/upgrade_routing.sql) instead — it adds
> the routing tables, coordinates, constraints and ETA columns idempotently.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."   # server-only, used to create logins
```

### 4. Create the first admin

New sign-ups default to the `salesperson` role. To bootstrap an admin:

1. Supabase dashboard → **Authentication → Users → Add user** (set email + password,
   tick *Auto confirm*).
2. Then in **SQL Editor**:

   ```sql
   update public.profiles set role = 'admin'
   where email = 'you@store.com';
   ```

After that, the admin can create every other login from the **Staff & users**
screen, and driver logins from the **Drivers** screen.

### 5. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Drivers are redirected to `/driver`; staff land on
the dashboard.

---

## Deploy to Vercel

This repo includes a [`vercel.json`](vercel.json) so Vercel auto-detects the
Next.js framework. There are two ways to ship it — pick **one** (running both
causes duplicate deploys).

### One-time project setup (required for either option)

1. In [vercel.com](https://vercel.com) → **Add New → Project**, import this
   GitHub repo (this creates the Vercel project and its org/project IDs).
2. Add the three environment variables (Project → **Settings → Environment
   Variables**) for **both** the **Production** and **Preview** environments —
   the same values from your `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```

> Without these env vars the build's static prerender fails (the Supabase
> client requires a URL and key), so set them **before** the first deploy.

### Option A — Vercel's native Git integration (simplest)

Leave Vercel connected to the repo. Every push to `main` deploys to production
and every PR gets a preview URL automatically. Nothing else to configure.

### Option B — Deploy from GitHub Actions

Use [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds
and deploys with the Vercel CLI: production on pushes to `main`, a preview URL on
every PR. If you use this, **disable** Vercel's native Git integration for this
project (Project → **Settings → Git**) to avoid double deploys.

Add these three repository secrets (GitHub → **Settings → Secrets and variables
→ Actions → New repository secret**):

| Secret | Where to find it |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com → **Account Settings → Tokens → Create** |
| `VERCEL_ORG_ID` | Project → **Settings → General** (or `.vercel/project.json` after `vercel link`) |
| `VERCEL_PROJECT_ID` | Project → **Settings → General** (or `.vercel/project.json` after `vercel link`) |

The workflow reads the Supabase env vars from the Vercel project itself (via
`vercel pull`), so they only need to be set in Vercel — not duplicated as GitHub
secrets.

---

## Project structure

```
app/
  (dashboard)/        # staff app (sidebar layout)
    dashboard/        # today's KPIs
    deliveries/       # list, new, [id] detail + status
    dispatch/         # on-demand auto-dispatch board
    routes/           # list + [id] route assignment + optimization
    tracking/         # live driver GPS map (dispatcher)
    vehicles/         # van management + routing constraints
    drivers/          # crew + login provisioning
    zones/            # delivery zones
    customers/        # customer book
    settings/         # depot + routing defaults
    staff/            # admin-only user/role management
  driver/             # mobile driver app
    stops/[id]/       # proof-of-delivery: status, photo, signature, notes
  login/              # email/password sign-in
  auth/signout/       # sign-out route handler
components/           # UI + client widgets (forms, signature pad, etc.)
lib/
  supabase/           # browser / server / middleware / admin clients
  routing.ts          # distance, nearest-neighbour + 2-opt, ETA scheduling
  optimize.ts         # DB-facing optimisation + auto-dispatch + learning
  constants.ts        # statuses, roles, labels, colours
  types.ts            # row types
  auth.ts             # getProfile() + role helpers
supabase/
  schema.sql           # full schema + RLS + storage (routing + tracking incl.)
  upgrade_routing.sql  # idempotent upgrade (routing + tracking) for existing DBs
  upgrade_tracking.sql # tracking-only upgrade
  seed.sql             # optional sample data
```

## Deploying

Deploy to **Vercel** (zero config). Set the three environment variables in the
project settings. The Supabase project is already your hosted database, auth and
file storage — no extra infrastructure needed.
