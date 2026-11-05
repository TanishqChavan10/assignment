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
   - 6 Seed Leaves (with duplicate deduplication verification)

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

## 5. Tell Us How You Think (The 8 Questions)

### 1. Modeling
**How did you model pods, brands, processes, calendars, employees, assignments, leaves, and the roster? What are the key entities and relationships?**

- **`Pod`**: Organizational grouping containing a `leadEmployeeId`.
- **`Employee`**: Belongs to one Pod, has a `dailyCapacity` (default 1.00), and an optional `preferredOffDay` (0–6).
- **`Brand` & `Process`**: Brands own one or more Processes (e.g. CS, ACC, NDR). Each Process defines its `calendarRule` (`ALL_DAYS_365`, `ALL_EXCEPT_HOLIDAYS`, `EXCEPT_SUNDAYS_AND_HOLIDAYS`), baseline `minStaff`, and a `minStaffOverrides` JSONB map for weekday-specific rules (e.g. `{"0": 2, "6": 2}` for weekend surges).
- **`Assignment`**: Links an Employee to a Process with a designated `role` (`PRIMARY` or `BACKUP`) and workload `weight` (e.g. 0.5 for split focus, 1.0 for full-time).
- **`Holiday` & `Leave`**: Holidays are scoped either globally or to selected pods. Leaves are unique on `(employeeId, date, type)`, natively preventing double-counting.
- **`RosterEntry` vs. `Allocation`**: `RosterEntry` stores human work states (`WORKING`, `WEEKLY_OFF`, `HOLIDAY`, `LEAVE`, `COMP_OFF`). `Allocation` stores process coverage `(employeeId, processId, date, approved)`. This separation ensures business coverage checks remain completely decoupled from personal work status.

---

### 2. Generation and Constraint Checking
**How does your scheduling engine work? Walk through the steps from inputs to the final roster.**

1. **Step 1 (Requirements Calculation)**: Computes whether coverage is required for every process and date based on its calendar rule and holiday overlaps, applying weekday `minStaff` overrides.
2. **Step 2 (Employee Availability)**: Flags employee availability by checking leaves, comp-offs, and pod-specific holidays.
3. **Step 3 (Weekly-Off Assignment with Backtracking)**:
   - Evaluates candidate off-days for each employee-week where all their primary processes retain sufficient alternative primary coverage.
   - Sorts employee-weeks **most-constrained-first** (fewest valid candidates).
   - Attempts placement prioritizing `preferredOffDay`, falling back to the day that preserves the most system-wide staffing slack.
   - If an employee hits 0 valid candidates, the engine performs chronological backtracking (undoing up to the last 2 placements and trying alternate branches, capped at 100 iterations).
   - If still unresolvable, it evaluates eligible backups to propose an unapproved backup allocation; otherwise, it records a deterministic `NO_VALID_WEEKLY_OFF` conflict without crashing.
4. **Step 4 (Allocation Generation)**: Maps working employees to their required primary processes, accumulates daily weights, detects over-capacity conditions (`OVERLOAD`), and awards comp-off credits for holiday work on 365-day brands.
5. **Step 5 (Validation)**: Validates approved allocations against process minimums to flag `NO_COVERAGE`, `UNDERSTAFFED`, `OVERLOAD`, `PROCESS_UNASSIGNED`, and `BACKUP_PENDING`.

---

### 3. Single vs. Multi-Employee Brands
**How did you handle the difference between single-employee and multi-employee brands?**

- **Multi-Employee Brands**: Provide natural redundancy. When Employee A takes their weekly off or leave, the candidate evaluator verifies that the remaining primary employees meet `minStaff`. The system dynamically balances off-days across the week so that both workers are not off simultaneously.
- **Single-Employee Brands**: Have zero native slack. For non-365 processes (e.g., Sunday-off or holiday-off), weekly offs naturally slot into those closed days. For `ALL_DAYS_365` single-employee brands, the algorithm identifies that the primary employee cannot take any day off without violating coverage. It specifically looks for a designated `BACKUP` assignment. If a backup exists (e.g., Glowvia), it places the off-day and generates an unapproved backup allocation (`BACKUP_PENDING`). If no backup exists (e.g., the deliberate Spectra scenario), it halts greedy placement and records an explicit `NO_VALID_WEEKLY_OFF` error.

---

### 4. Sole Employee Unavailable
**What happens when the sole assigned employee for a brand goes on leave or has a weekly off? How does your system respond?**

1. If scheduled for a **weekly off**: The generator searches for an available employee assigned as `BACKUP` for that process who has remaining capacity. It slots the off-day and creates an allocation flagged with `approved = false`.
2. If the manager **adds an unscheduled leave**:
   - The cell update saves the leave.
   - The engine runs **revalidation only** (preserving the existing schedule).
   - The process immediately turns **red** on the coverage row and logs a `NO_COVERAGE` error in the conflicts panel.
   - Clicking **"Suggest"** activates `suggestReplacements()`, which filters all assigned backups, verifies they are not on leave/holiday/weekly off on that date, ensures they have available capacity, and ranks them (same pod first → lowest monthly workload).
   - Clicking **"Approve"** creates an approved allocation, immediately clearing the conflict without full roster regeneration.

---

### 5. Conflicts and Insufficient Staffing
**How do you detect, surface, and handle conflicts? What can a manager do when there aren't enough people to cover?**

- **Detection**: The validator inspects every required process-date pair, comparing approved allocations against required minimums, checking capacity ceilings, and tracking assignment integrity.
- **Surfacing**:
  - **Color-Coded Coverage Row**: Green (fully covered), Red (uncovered/understaffed), Amber (coverage contingent on pending backup approval).
  - **Conflicts Panel**: Categorized into **Errors** (blocking publish: `NO_COVERAGE`, `UNDERSTAFFED`, `OVERLOAD`, `NO_VALID_WEEKLY_OFF`, `PROCESS_UNASSIGNED`) and **Warnings** (non-blocking: `BACKUP_PENDING`, `PREFERENCE_VIOLATED`).
- **Manager Actions**:
  - One-click approval of pending backups.
  - Reviewing ranked suggestions for emergency coverage.
  - Modifying assignments or overriding statuses directly in the editable matrix.
  - Using `/manage` to assign secondary personnel or adjust minimum staffing parameters.

---

### 6. Automated vs. Human
**What did you automate, and what did you leave for the human ops manager to decide? Why?**

- **Automated**:
  - Calculation of requirements from calendar rules, holidays, and overrides.
  - Placement of weekly offs using constraint-satisfaction heuristics and backtracking.
  - Detection and classification of all 7 conflict types.
  - Ranking and filtering of replacement candidates based on pod alignment and workload fairness.
  - Automatic calculation and logging of comp-off credits earned on holidays.
- **Human Ops Manager Decisions**:
  - **Approval of Backups**: Backups intentionally require human confirmation because pulling an employee from one pod/brand to another has operational trade-offs that software should not commit autonomously.
  - **Resolving Impossible Constraints**: Situations like single-resource 365-day brands with no backup (`Spectra`) surface as explicit errors rather than having the engine invent non-existent staff.
  - **Comp-Off Date Redemption**: When earned comp-offs are redeemed is left to manager-employee agreement.

---

### 7. Doubling Scale
**If the team doubled to 70 employees and 50 brands tomorrow, what would break first? How would you adapt your design?**

- **What breaks first**:
  - In-memory backtracking for weekly-off assignment could hit recursion/attempt ceilings if cross-brand constraints grow densely interconnected.
  - Client-side full-month matrix rendering would experience DOM bloat (70 rows × 31 columns = 2,170 interactive cells).
  - Loading the entire database state into memory for every validation call would introduce network and memory overhead.
- **Architectural Adaptations**:
  - **Engine**: Replace heuristic backtracking with an industrial constraint programming solver (e.g. Google OR-Tools CP-SAT or an integer programming solver) running asynchronously in background workers.
  - **Database**: Add composite indexing on `(date, process_id, approved)` and partition roster entries by month/year.
  - **Incremental Validation**: Perform localized validation scoped to the affected pod or process group rather than recalculating the entire company month.
  - **UI**: Virtualize the table rows (e.g., via `@tanstack/react-virtual`) to render only visible viewport elements.

---

### 8. One More Week
**If you had one more week to work on this, what would you add or improve?**

1. **Shift Timings & Intra-Day Hours**: Expand the day-level abstraction to support multi-shift operations (e.g. Morning, Afternoon, Night, Weekend On-Call) with minimum rest-period constraints between consecutive shifts.
2. **Workload & Weekend Fairness Optimizer**: Introduce multi-objective scoring to balance weekend shifts evenly across employees over rolling 90-day windows.
3. **Formal Approval & Request Workflows**: An employee portal for requesting leaves and swap requests with automated manager approval queues.
4. **Audit Logging & Roster Versioning**: Historical snapshot diffing (`v1.0 Published` vs `v1.1 After Leaves`) allowing ops teams to view schedule evolution over time.
5. **CSV/Excel Export & Webhooks**: One-click export to Google Sheets/Excel and automated Slack/Discord alerts when emergency gaps arise.

---

## 6. Demo Video Walkthrough Script (3–5 Minutes)

1. **0:00 - 0:30 (Data Management & Setup)**:
   - Navigate to `/manage`.
   - Point out the 4 pods, 34 employees, multi-brand split (e.g. Brand A with 3 processes vs. single-employee brands), and the Glowvia demo configuration.
2. **0:30 - 1:10 (Roster Generation & Grid Overview)**:
   - Return to `/` and click **"Generate Roster"** for `2026-12`.
   - Show the generated matrix: color-coded statuses (`W` = Working, `WO` = Weekly Off, `H` = Holiday, `L` = Leave).
3. **1:10 - 1:50 (Multi-View Filtering & Coverage Rows)**:
   - Filter by Brand: select `Glowvia` (365-day) vs. a Sunday-off brand.
   - Switch filter to multi-employee Brand A (`LuxeCore`) and inspect the individual process coverage rows.
4. **1:50 - 2:30 (Surfacing Conflicts & Deliberate Failures)**:
   - Highlight the conflicts panel.
   - Showcase the deliberate unsolvable case (`Spectra`: 365-day brand with 1 employee and no backup) showing `NO_VALID_WEEKLY_OFF`.
5. **2:30 - 3:30 (Change Handling & Replacement Workflow)**:
   - Navigate to `/manage` -> **Leaves**, add a leave for Glowvia's primary employee (`Arjun Mehta`) on a working Sunday (`2026-12-06`).
   - Return to `/`: show the coverage row turning **red** and the new `NO_COVERAGE` error.
   - Click **"Suggest"**: show the ranked candidates modal displaying the backup (`Kavya Joshi`, same pod, available).
   - Click **"Approve"**: show the conflict clearing and coverage turning green.
6. **3:30 - 4:00 (Manual Editing & Test Suite)**:
   - Click any grid cell to manually edit status and demonstrate instantaneous conflict revalidation.
   - Switch to the terminal and execute `npm test` to show all 71 unit and integration tests passing.

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
