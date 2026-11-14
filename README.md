# Smart Roster Management System

> A constraint-based, day-level coverage and roster scheduling engine with a strict three-layer architecture, deterministic conflict validation, and manager-in-the-loop backup workflows.

---

## 1. Overview & Architecture

The application is structured into **three strictly decoupled layers**:

```
UI Layer (React Server & Client Components)
   │
   ▼
API Routes Layer (/api/* Next.js Route Handlers)
   │
   ├────────► Database (PostgreSQL hosted on Supabase)
   │
   ▼
Core Engine Layer (Pure TypeScript — ZERO framework or I/O dependencies)
```

### Non-Negotiable Separation Principles:
1. **Process Calendar vs. Person Working**: Process coverage requirements (when a brand must be active) are completely decoupled from employee roster status (when an individual is on shift or off).
2. **Roster Status vs. Allocation**: A roster entry indicates whether an employee is `WORKING`, `WEEKLY_OFF`, `HOLIDAY`, `LEAVE`, or `COMP_OFF`. Allocations map which specific processes that working person covers. Coverage checks operate strictly on **allocations**, never on raw roster statuses.
3. **Multi-Brand Resource Modeling**: An employee shared across multiple brands is treated as a **single resource** with finite `dailyCapacity` (default 1.0). Each assignment carries a workload weight, preventing invisible over-allocation.
4. **Pure Engine Contract**:
   ```ts
   generateRoster(input: EngineInput): EngineResult
   validateExistingRoster(input: EngineInput, roster: RosterState): Conflict[]
   suggestReplacements(input: EngineInput, roster: RosterState, conflict: Conflict): Candidate[]
   ```

---

## 2. Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL on Supabase
- **Database Client**: `@supabase/supabase-js` and `@supabase/ssr`
- **Styling**: Tailwind CSS (clean, responsive tables without heavy UI component bloat)
- **Engine Testing**: Vitest (71 unit & integration tests)
- **Deployment**: Vercel

---

## 3. Local Setup & Verification

### Prerequisites
- Node.js (v18 or v20+)
- npm

### Installation
```bash
# 1. Clone repository & install dependencies
git clone <your-repo-url>
cd assignment
npm install

# 2. Configure environment variables
# Copy .env.example to .env.local and populate with your Supabase credentials:
cp .env.example .env.local
```

### Database Initialization
1. In your [Supabase SQL Editor](https://supabase.com/dashboard), execute `supabase/schema.sql`.
2. Next, execute `supabase/seed.sql` to populate:
   - 4 Pods
   - 34 Employees
   - 25 Brands (8 on 365-day coverage, 9 on except-holidays, 8 on except-sundays/holidays)
   - 30 Processes with custom weekend overrides
   - 35 Process Assignments
   - 4 Holidays (ALL-company, pod-specific, and weekend-coinciding)
   - 6 Initial Leaves (with duplicate deduplication verification)

### Running Tests & Dev Server
```bash
# Run the pure TypeScript engine test suite (71 tests)
npm test

# Run the production build check
npm run build

# Start local development server
npm run dev
# Open http://localhost:3000
```

---

## 4. Key Rules & Operational Assumptions

1. **Resolution**: Day-level scheduling (no sub-day shifts or hourly slots).
2. **Weekly-Off Rules**:
   - Exactly one weekly off per full Monday–Sunday week.
   - Partial edge weeks receive an off day only if at least 4 days fall within the month.
   - Weekly off is never placed on an approved leave or holiday day.
3. **Holiday & 365-Day Coverage**:
   - Holidays apply either globally (`ALL`) or to specific Pod IDs.
   - For `ALL_DAYS_365` processes requiring holiday work, the engine schedules an assigned employee as `WORKING` and automatically logs a `CompOffCredit`.
4. **Capacity & Overload**:
   - Sum of assigned process weights on any working day must not exceed `dailyCapacity`. Exceeding this creates an `OVERLOAD` error.
5. **Backups**:
   - Backup assignments are never considered valid coverage until explicitly approved by a manager. Unapproved backups surface as `BACKUP_PENDING` warnings while leaving the underlying process flagged as `NO_COVERAGE` or `UNDERSTAFFED`.

---

## 5. Architectural & Design Decisions (Answering the 8 Core Questions)

### 1. How did you model employees, brands, processes, pods, and their relationships?

The domain model enforces a strict separation between **operational requirements** (when a business process must run) and **human availability** (when an individual is working or resting):

- **`Pod`**: Organizational group with a designated `leadEmployeeId`.
- **`Employee`**: Belongs to a Pod, with a finite `dailyCapacity` (default `1.00`) and an optional `preferredOffDay` (0 = Sun, 1 = Mon ... 6 = Sat).
- **`Brand` & `Process`**: Brands own one or more Processes (e.g. CS, ACC, NDR). Each Process defines its `calendarRule` (`ALL_DAYS_365`, `ALL_EXCEPT_HOLIDAYS`, `EXCEPT_SUNDAYS_AND_HOLIDAYS`), baseline `minStaff`, and a `minStaffOverrides` map for weekday-specific demand (e.g. weekend surges).
- **`Assignment`**: Connects an Employee to a Process with a `role` (`PRIMARY` or `BACKUP`) and workload `weight` (e.g. 0.5 for split focus, 1.0 for full-time).
- **`Holiday` & `Leave`**: Holidays are scoped globally (`ALL`) or to specific pods. Leaves are recorded per employee and date, deduplicated natively.
- **`RosterEntry` vs. `Allocation`**: 
  - `RosterEntry` tracks human status: `WORKING`, `WEEKLY_OFF`, `HOLIDAY`, `LEAVE`, `COMP_OFF`.
  - `Allocation` tracks process coverage: `(employeeId, processId, date, approved)`.
  *Key principle: Coverage is verified strictly against approved allocations, never raw employee statuses.*

---

### 2. How does your system generate a roster and determine whether it satisfies the required constraints?

The roster generation pipeline runs as a pure, deterministic TypeScript engine in 5 steps:

1. **Requirements Calculation**: Computes whether each process is required on each calendar day based on its `calendarRule`, holiday schedules, and weekday minimum staffing overrides.
2. **Employee Availability**: Marks non-working dates from approved leaves, comp-offs, and applicable pod holidays.
3. **Weekly-Off Heuristic Placement with Backtracking**:
   - Divides the month into ISO weeks (Mon–Sun). Partial boundary weeks only get an off day if they have ≥ 4 days in the month.
   - Computes candidate off days for each employee-week where remaining assigned primary staff satisfy process minimums.
   - Evaluates employee-weeks **most-constrained-first** (fewest valid candidate days).
   - Attempts placement matching `preferredOffDay`, falling back to days with the greatest system staffing slack.
   - If an employee hits zero valid options, the engine backtracks up to 2 prior placements. If still unresolvable, it searches for eligible backups to propose an unapproved allocation (`BACKUP_PENDING`), or logs an explicit `NO_VALID_WEEKLY_OFF` error.
4. **Allocation Generation**: Maps working employees to their required processes, checks daily capacity limits (flagging `OVERLOAD` if exceeded), and credits comp-offs for holiday workers on 365-day brands.
5. **Validation**: Compares approved allocations against process minimums, raising blocking errors (`NO_COVERAGE`, `UNDERSTAFFED`, `OVERLOAD`, `NO_VALID_WEEKLY_OFF`, `PROCESS_UNASSIGNED`) or warnings (`BACKUP_PENDING`).

---

### 3. How did you handle the difference between single-resource brands and brands with multiple employees?

- **Brands with Multiple Employees** (e.g., LuxeCore): Provide inherent redundancy. The candidate evaluator checks that when one worker takes their weekly off or leave, the remaining primary workers satisfy `minStaff`. Off days are staggered across the week to prevent simultaneous absences.
- **Single-Resource Brands** (e.g., Glowvia, Spectra): Zero native redundancy.
  - On non-365 calendars (e.g. MoonLight on `EXCEPT_SUNDAYS_AND_HOLIDAYS`), the weekly off naturally slots into scheduled closed days (Sundays).
  - On `ALL_DAYS_365` calendars, an employee cannot take any day off without creating a coverage void. The engine looks for a designated `BACKUP` assignment:
    - If a backup exists (e.g. **Glowvia**, with Kavya as backup for Arjun), it assigns the off day and generates a `BACKUP_PENDING` warning awaiting manager approval.
    - If **no backup exists** (e.g. **Spectra**, with Rahul only), the engine refuses to invent phantom staff and raises a deterministic `NO_VALID_WEEKLY_OFF` blocking error.

---

### 4. What happens when an employee manages all processes for a brand but is unavailable on a required working day?

When a sole worker becomes unavailable (e.g. Arjun takes leave on a working Sunday for Glowvia):
1. **Targeted Revalidation**: The system does not wipe or re-randomize the monthly roster. It saves the leave, sets the employee's roster status to `LEAVE`, removes their allocations for that date, and revalidates.
2. **Visual Surfacing**: The brand's process coverage row turns **red** on that date, and a blocking `NO_COVERAGE` error appears in the conflicts panel.
3. **Smart Replacement Engine (`suggestReplacements`)**:
   - Filters all staff assigned as `BACKUP` for that process.
   - Verifies the backup is available (not on leave, holiday, or off) and has spare daily capacity.
   - Ranks candidates: **Same Pod first** (to minimize cross-pod coordination overhead) → **Lowest monthly workload** (to balance shift equity).
4. **Manager-in-the-Loop Resolution**: The manager clicks "Approve & Slot", creating an approved allocation that immediately turns the cell green and clears the error.

---

### 5. How does your system handle conflicting requirements or insufficient staffing?

- **Detection**: Every required process-date pair is validated against approved staff count and capacity ceilings.
- **Categorization**:
  - **Blocking Errors** (prevent roster publication): `NO_COVERAGE` (0 staff), `UNDERSTAFFED` (< minStaff), `OVERLOAD` (allocated weight > capacity), `NO_VALID_WEEKLY_OFF` (unsolvable off-day), `PROCESS_UNASSIGNED`.
  - **Warnings** (operational notices): `BACKUP_PENDING` (proposed backup awaiting approval), `PREFERENCE_VIOLATED` (off-day placed away from preference).
- **Manager Resolution Tools**:
  - One-click **Approve All Pending** to batch-authorize proposed backups.
  - One-click **Find Replacement** modal with ranked, capacity-checked candidates.
  - Direct matrix inline editing with real-time constraint revalidation.
  - Master data updates via `/manage` to assign floaters or adjust staffing rules.

---

### 6. Which parts of the process did you automate, and which did you leave under human control? Why?

- **Automated**:
  - Calculation of daily requirements across complex calendar rules and holiday overlaps.
  - Constraint satisfaction and backtracking heuristics for weekly off distribution.
  - Conflict detection and classification across all 7 operational rules.
  - Replacement candidate filtering, eligibility verification, and ranking.
  - Automatic comp-off credit accrual for holiday shifts on 365-day brands.
- **Left Under Human Control**:
  - **Backup Shift Authorization**: Backups require explicit manager approval because moving an employee across brands or pods involves contextual trade-offs software cannot anticipate.
  - **Unsolvable Deadlocks**: When a brand is fundamentally understaffed (like Spectra), the system surfaces the gap clearly rather than making unsafe assumptions.
  - **Comp-Off Date Redemption**: When an earned comp-off is taken is agreed between employee and manager.

---

### 7. If the company doubled its team and brand count, what would you change about your solution?

If scaled to 70+ employees and 50+ brands:
1. **Engine Solver**: Transition from in-memory recursive backtracking to an asynchronous constraint programming solver (e.g. Google OR-Tools CP-SAT) running in background workers to handle dense cross-brand constraints.
2. **Database Optimization**: Add composite indices on `(date, process_id, approved)` and partition `roster_entries` and `allocations` by month/year.
3. **Scoped / Incremental Validation**: Validate at the pod or process cluster level instead of re-evaluating the entire company month on every single cell edit.
4. **Matrix Virtualization**: Use windowed rendering (e.g. `@tanstack/react-virtual`) so only visible grid rows and columns are rendered in the DOM.

---

### 8. If you had one additional week to work on this, what would you improve first?

1. **Shift Timings & Intra-Day Hours**: Expand from day-level granularity to multi-shift scheduling (Morning, Afternoon, Night, On-Call) with mandatory rest intervals between consecutive shifts.
2. **Workload & Weekend Equity Balancer**: Add multi-objective optimization to balance weekend shifts evenly across employees over rolling 90-day cycles.
3. **Employee Self-Service Portal**: Introduce worker portals for requesting leaves and shift swaps with integrated manager approval queues.
4. **Audit Trail & Roster Snapshots**: Implement versioning (`v1.0 Published` vs `v1.1 Post-Leave`) with visual diff comparisons for operational auditing.
5. **Direct Notification Webhooks**: Automated Slack/Teams notifications when emergency coverage gaps arise.

---

## 6. Demo Video Walkthrough Script (3–4 Minutes)

1. **0:00 - 0:40 (Domain & Master Data)**:
   - On `/manage`, show the 8 employees across 2 pods, 5 brands, and process assignments (Glowvia with Arjun & Kavya; Spectra with Rahul only; LuxeCore with 3 processes).
2. **0:40 - 1:20 (Roster Generation & Weekly Off Heuristics)**:
   - On `/` for December 2026, click **Generate Roster**. Show the matrix fill, point out Arjun's Wednesdays and Kavya's Tuesdays, and the Overall Coverage Health row.
3. **1:20 - 2:00 (Decoupled Operating Calendars)**:
   - Filter by Brand: Show **MoonLight** (Sunday-off, Nisha off on Sunday), **Glowvia** (365-day active coverage across all 31 days), and **LuxeCore** (3 staggered workers across CS, ACC, NDR).
4. **2:00 - 2:45 (Surfacing Conflicts & Approvals)**:
   - In Conflicts panel, show **Spectra** `NO_VALID_WEEKLY_OFF` (unsolvable case). Filter to **Glowvia**, show `BACKUP_PENDING` warnings, and click **Approve All Pending** to turn it 100% green.
5. **2:45 - 3:35 (Unplanned Leave & Smart Replacement)**:
   - In `/manage`, add Arjun's leave on Sunday Dec 6. Return to `/`: Glowvia Dec 6 turns red (`NO_COVERAGE`).
   - Click **Find Replacement**: Show **Kavya Joshi ranked #1** (same pod, available, capacity free) and click **Approve & Slot** to restore coverage.
6. **3:35 - 4:10 (Manual Edits & Engine Tests)**:
   - Change a cell from `W` to `WO` (instant conflict) and back to `W` (clears). Run `npm test` in the terminal to display all 71 pure TypeScript unit tests passing in ~1s.

---

## 7. Submission Checklist

- [x] Hosted on GitHub with clean commit history
- [x] Pure TypeScript scheduling engine with 0 framework/DB dependencies
- [x] All 71 engine tests green (`npm test`)
- [x] Clean production build verified (`npm run build`)
- [x] `.env.example` verified
- [x] Answers to all 8 evaluation questions documented in README
- [ ] Vercel deployment link
- [ ] 3-5 minute demo recording
- [ ] Submission email sent to `ozair.shaikh@datastraw.in` & `aryan.jaiswal@datastraw.in`, CC `talent@datastraw`
