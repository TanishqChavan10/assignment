# 01 - Locked Tech Stack and Architecture

> Status: LOCKED. No stack changes after this point.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router) + TypeScript** | One codebase for UI and API, one-click deploy |
| Database | **PostgreSQL via Supabase (free tier)** | Hosted Postgres, works with Vercel, no local setup for reviewers |
| DB Client | **Supabase JS SDK (`@supabase/supabase-js`)** | Typed queries, direct table access, no migration CLI needed |
| Schema / Seed | **SQL migration files + seed SQL** | Plain `.sql` files run once in Supabase SQL editor or via `psql` |
| Validation | **Zod** | Validate API input |
| Engine tests | **Vitest** | Fast, TypeScript-native |
| UI | **Tailwind CSS + plain tables** | No component library, minimal effort |
| Hosting | **Vercel** | Public URL |
| Auth | **None** (documented assumption: single ops manager) | Out of scope |

No Redux, no state libraries, no charting libraries, no AI API calls.

## 2. Architecture (3 layers, strict separation)

```
UI (React pages)  ->  API routes (thin)  ->  Engine (pure TypeScript)
                              |
                    Supabase JS SDK / Postgres
```

**Rule: the engine never imports the Supabase client, Next.js or any I/O.** It takes plain objects in and returns plain objects out. This makes it fully unit-testable.

### Engine contract

```ts
generateRoster(input: EngineInput): EngineResult
validateRoster(input: EngineInput, roster: RosterState): Conflict[]
suggestReplacements(input, roster, conflict): Candidate[]
```

- `EngineInput` = employees, pods, brands, processes, assignments, holidays, leaves, month
- `RosterState` = roster entries + allocations
- `EngineResult` = roster entries, allocations, conflicts

The API layer loads data from Supabase, calls the engine, saves results, and returns them. Nothing else.

## 3. Folder structure

```
/supabase
  schema.sql          # CREATE TABLE statements (run once in Supabase SQL editor)
  seed.sql            # INSERT seed data (run once after schema)
/src
  /engine
    types.ts
    calendar.ts        # is process required on date? min staff?
    availability.ts    # is employee available on date?
    weeklyOff.ts       # most-constrained-first + limited backtracking
    allocation.ts      # who covers which process on which day
    validator.ts       # conflicts
    replacements.ts    # suggestions
    index.ts
  /engine/__tests__/   # vitest
  /app
    page.tsx                       # roster grid + filters + conflicts
    /manage/page.tsx               # CRUD tables
    /api/...                       # thin route handlers
  /lib/supabase.ts                 # createClient() helper (server-side)
/README.md
/.env.example
```

## 4. API routes (complete list)

| Route | Purpose |
|---|---|
| `GET/POST/PUT/DELETE /api/employees` | CRUD |
| `GET/POST/PUT/DELETE /api/brands` | CRUD |
| `GET/POST/PUT/DELETE /api/processes` | CRUD (calendar rule, min staff) |
| `GET/POST/PUT/DELETE /api/assignments` | CRUD (role, weight) |
| `GET/POST/DELETE /api/holidays` | CRUD |
| `GET/POST/DELETE /api/leaves` | CRUD (dedupes duplicates) |
| `POST /api/roster/generate?month=YYYY-MM` | Run engine, save |
| `GET /api/roster?month=...&view=...&id=...` | Fetch roster with filter |
| `PATCH /api/roster/cell` | Manual edit, then revalidate |
| `POST /api/roster/validate` | Revalidate only |
| `GET /api/roster/suggestions?conflictId=...` | Replacement candidates |
| `POST /api/roster/approve-allocation` | Approve a backup allocation |

## 5. Deployment

1. Create a Supabase project, copy `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
2. Run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL editor (or via `psql`).
3. Push to GitHub, import into Vercel, set the two env vars above.
4. `.env.example` contains only:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
