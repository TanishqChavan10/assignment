# 03 - Locked Features, Sample Data and Build Plan

> Status: LOCKED. Anything not listed here is out of scope.

## 1. In-scope features (final)

1. **Manage data (CRUD):** employees, pods, brands, processes (calendar rule, min staff, overrides), assignments (role, weight), holidays (ALL or pods), leaves and comp-offs.
2. **Generate monthly roster** for the whole team.
3. **Roster grid:** employees x days, color-coded by status.
4. **Views via one filter dropdown:** company, pod, brand, process, employee. Same grid, filtered.
5. **Coverage row** per brand/process: green if covered, red if error, amber if backup pending.
6. **Conflicts panel:** errors and warnings with date, brand, process, explanation.
7. **Manual edit of a cell**, then automatic revalidation.
8. **Change handling:** add a leave after generation, see the gap, see ranked replacement suggestions, approve one, see the roster valid again.

## 2. Explicitly out of scope

Auth, approval workflows, notifications, CSV/Excel export, fairness balancing, roster comparison, AI explanations, shift timings, drag-and-drop, mobile layout polish.

## 3. Sample data (seed)

- **4 pods**, each with a pod lead who is also an employee.
- **34 employees.**
- **25 brands:** 20 single-employee brands (80%), 5 multi-employee brands (2-3 each).
- **Calendar mix:**
  - 8 brands on `ALL_DAYS_365`
  - 9 on `ALL_EXCEPT_HOLIDAYS`
  - 8 on `EXCEPT_SUNDAYS_AND_HOLIDAYS`
- **Multi-employee brands:**
  - Brand A: 3 employees, CS / ACC / NDR split (CS is 365-day, others are not)
  - Brand B: 2 employees sharing CS (minStaff 2 on weekends)
  - Brand C: 3 employees, two on CS, one on NDR
  - Brand D, E: 2 employees each, different processes
- **Demo brand ("Glowvia"):** `ALL_DAYS_365`, one PRIMARY employee, **one BACKUP** employee from the same pod who owns a lighter brand.
- **Shared resource:** one employee on two brands at weight 0.5 each.
- **One deliberate unsolvable case:** a 365-day single-employee brand with no backup, to show `NO_VALID_WEEKLY_OFF`.
- **Holidays:** 4 in the month (2 `ALL`, 1 pod-specific, 1 on a Sunday).
- **Leaves:** 6 pre-existing, including one duplicate entry.

## 4. Build order (4 phases, locked)

| Phase | Work | Done when |
|---|---|---|
| 1 | Repo, Supabase schema (`schema.sql`), seed (`seed.sql`), `types.ts`, `calendar.ts`, `availability.ts` | Calendar and availability tests pass |
| 2 | `weeklyOff.ts` with backtracking, `allocation.ts`, `validator.ts` | Generate on seed data returns roster plus expected conflicts, all engine tests pass |
| 3 | `replacements.ts`, API routes (using Supabase JS SDK), roster grid page, filters, conflicts panel, manage page | Full demo flow works locally |
| 4 | Deploy to Vercel + Supabase, README, record demo, email submission | Public URL works, video recorded |

**Rule:** do not start Phase 3 UI work until Phase 2 tests are green.

## 5. README outline

1. Overview and live URL
2. Setup (`npm i`, set env vars, run `schema.sql` + `seed.sql` in Supabase SQL editor, `npm run dev`, `npm test`)
3. Assumptions (copy rules from file 02)
4. Architecture (the 3-layer diagram)
5. **Tell Us How You Think** (the 8 questions). Answer sources:

| Question | Answer from |
|---|---|
| 1. Modeling | Data model section |
| 2. Generation and constraint check | Engine steps 1-5 |
| 3. Single vs multi-employee brands | Weekly-off candidate logic plus minStaff and backups |
| 4. Sole employee unavailable | `NO_COVERAGE` error, backup suggestion, manager approval |
| 5. Conflicts and insufficient staffing | Conflict table, publish blocked on errors |
| 6. Automated vs human | Automated: requirements, weekly offs, validation, suggestions. Human: approving backups, resolving unsolvable conflicts, comp-off dates |
| 7. Doubling scale | Move generation to a constraint solver (OR-Tools/CP-SAT), add DB indexes, run generation as a background job, per-pod incremental validation |
| 8. One more week | Fairness of weekly offs, shift timings, approval workflow |

## 6. Demo script (3-5 minutes)

1. **(30s)** Show manage page: pods, brands, a single-employee brand and a 3-employee brand.
2. **(40s)** Generate the month. Show the company grid and the coverage row.
3. **(40s)** Filter by brand: show a 365-day brand vs a Sundays-off brand, and the multi-employee brand split by process.
4. **(40s)** Show the conflicts panel: the deliberate `NO_VALID_WEEKLY_OFF` case and its explanation.
5. **(60s)** **Change:** add a leave for Glowvia's primary employee on a Sunday. Coverage turns red, `NO_COVERAGE` appears.
6. **(40s)** Open suggestions: the backup ranks first (same pod, capacity available). Approve it, the conflict clears.
7. **(30s)** Manual edit of a cell, validation reruns instantly. Close with the 8 README answers and the test suite passing.

## 7. Submission checklist

- [ ] Public app URL
- [ ] GitHub repo with README, `.env.example`
- [ ] Demo video (3-5 min)
- [ ] 2-3 sentence approach note
- [ ] LinkedIn link (open it logged out to confirm it works)
- [ ] Email to ozair.shaikh@datastraw.in and aryan.jaiswal@datastraw.in, CC talent@datastraw
- [ ] Subject: `Smart Roster Management System Assignment - [Your Full Name]`

## 8. Approach note (paste into email)

> I built the roster tool as a constraint-based coverage system with a pure TypeScript scheduling engine, separate from the UI and database. The engine keeps process calendars, employee roster status and per-process allocations as distinct concepts, generates weekly offs most-constrained-first with limited backtracking, and flags every uncovered or understaffed process day instead of producing an invalid roster. When availability changes, it revalidates only the affected data and suggests ranked replacements for the manager to approve.
