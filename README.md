# FleetView

Furniture delivery & route management system built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Dashboard** — Today's routes, delivery counts, active driver summary
- **Routes** — Create and manage delivery routes with date filtering and progress tracking
- **Deliveries** — Per-route delivery list with status updates (pending → delivered / failed / rescheduled)
- **Drivers** — Driver roster with vehicle info and activate/deactivate controls
- **Admin** — User management and role assignment (admin / driver)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth + DB | Supabase (PostgreSQL) |

## Setup

### 1. Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the contents of [`supabase/schema.sql`](./supabase/schema.sql).  
   This creates the `profiles`, `drivers`, `routes`, and `deliveries` tables, RLS policies, and triggers.

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in the three values from your Supabase project under **Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Bootstrap the first admin

After you create your account via the login page, promote it to admin in the **Supabase SQL Editor**:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

### 4. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database schema

```
profiles    — extends auth.users; stores role (admin | driver)
drivers     — driver records with vehicle info; optionally linked to a profile
routes      — delivery routes with date, assigned driver, and status
deliveries  — individual stops within a route, ordered by sequence_order
```

Row Level Security is enabled on all tables. Admins have full access; drivers can view and update only their own routes and deliveries.

## Project structure

```
app/
  (protected)/        # Auth-gated pages (sidebar layout)
    dashboard/
    routes/
      [id]/           # Route detail + delivery management
      new/
    drivers/
    admin/
  login/
components/
  Sidebar.tsx
  LogoutButton.tsx
  StatusBadge.tsx
lib/
  supabase/
    client.ts         # Browser Supabase client
    server.ts         # Server Supabase client (cookies)
    admin.ts          # Service-role client for admin ops
  types.ts
supabase/
  schema.sql
middleware.ts         # Auth redirect guard
```
