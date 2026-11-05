# 02 - Locked Data Model and Scheduling Engine

> Status: LOCKED. This is the core of the assignment.

## 1. Data model

| Entity | Fields |
|---|---|
| **Pod** | id, name, leadEmployeeId |
| **Employee** | id, name, podId, dailyCapacity (default 1.0), preferredOffDay (0-6, optional) |
| **Brand** | id, name |
| **Process** | id, brandId, name (CS / ACC / NDR / Retention...), calendarRule, minStaff (default 1), minStaffOverrides (JSONB: weekday -> number) |
| **Assignment** | employeeId, processId, role (`PRIMARY` or `BACKUP`), weight (workload this process takes, default 1.0) |
| **Holiday** | id, date, name, appliesTo (`ALL` or list of podIds) |
| **Leave** | employeeId, date, type (`LEAVE` or `COMP_OFF`). Unique on (employeeId, date, type) |
| **RosterEntry** | employeeId, date, status |
| **Allocation** | employeeId, processId, date, approved (bool). Who covers which process that day |
| **CompOffCredit** | employeeId, earnedOn (date) |

> [!NOTE]
> `minStaffOverrides` is stored as a **JSONB column** in Supabase Postgres (e.g. `{"1": 2, "6": 2}` for Mon/Sat overrides). No special extension needed — JSONB is native to Postgres.

**calendarRule values:** `ALL_DAYS_365`, `ALL_EXCEPT_HOLIDAYS`, `EXCEPT_SUNDAYS_AND_HOLIDAYS`

**RosterEntry status values:** `WORKING`, `WEEKLY_OFF`, `HOLIDAY`, `LEAVE`, `COMP_OFF`

### Key separations (non-negotiable)

1. **Process calendar** = when coverage is required. **Roster entry** = when a person works. These are independent.
2. **Roster entry** = is the person working. **Allocation** = which process they cover that day. Coverage is checked on allocations, never on roster status.
3. A multi-brand employee is **one resource** with limited capacity, not one resource per brand.

## 2. Rules (documented assumptions)

1. Day-level roster only. No shift timings.
2. Each week (Mon-Sun) gives each employee exactly **one weekly off**. A partial week at a month edge gets one only if it has 4 or more days in the month.
3. **Holidays** apply to `ALL` or listed pods. A holiday does **not** consume the weekly off.
4. On a holiday, an employee is `HOLIDAY` by default. If a 365-day process needs coverage, the engine picks an available assigned employee to work, sets them `WORKING`, and records a `CompOffCredit`. Comp-off dates are granted manually.
5. A leave on a weekly-off or holiday day is not double counted. Weekly off is never placed on a leave day.
6. **Capacity:** on any day, the sum of `weight` of allocated processes per employee must be at most `dailyCapacity`. Exceeding it is an error (`OVERLOAD`).
7. **Backup** assignments never count as coverage unless an allocation is created and approved by the manager.
8. A process requires `minStaff` allocated employees on every required day (or the weekday override).
9. Mandatory = coverage, capacity, process calendar. Preference = preferred off day.

## 3. Engine steps

### Step 1: Requirements
For each process and date: `required(process, date)` and `minStaff(process, date)` from calendar rule, holidays and overrides.

### Step 2: Availability
`available(employee, date)` is false if the date is a leave, comp-off, or a holiday applying to the employee's pod. Holiday work on a 365-day process is the only exception (rule 4).

### Step 3: Weekly-off generation
1. For each employee-week, compute **candidate off days**: days where, if this employee is off, every PRIMARY process of theirs still meets minStaff using other available primary employees (or is not required that day). Exclude leave and holiday days.
2. Sort employee-weeks by **fewest candidates first** (most constrained).
3. Assign the candidate matching `preferredOffDay` if possible, otherwise the candidate that keeps the most slack.
4. If an employee-week has zero candidates, **backtrack**: undo the last 2 placements, try the next candidate for them, then retry. Maximum **100 attempts** in total.
5. If still impossible: if a BACKUP exists for the blocking process, propose an **unapproved backup allocation** for that day. Otherwise raise `NO_VALID_WEEKLY_OFF`. Never crash, never silently produce an invalid roster.

### Step 4: Allocation
For each date, for each employee with status `WORKING`: allocate them to each PRIMARY process required that day. Check capacity. Add proposed backup allocations from Step 3.

### Step 5: Validation (also used alone after any edit)

| Code | Severity | Meaning |
|---|---|---|
| `NO_COVERAGE` | error | Required process day with zero approved allocations |
| `UNDERSTAFFED` | error | Some coverage, below minStaff |
| `OVERLOAD` | error | Employee allocated beyond capacity |
| `NO_VALID_WEEKLY_OFF` | error | Generator could not place an off day |
| `PROCESS_UNASSIGNED` | error | Process has no assigned employee |
| `BACKUP_PENDING` | warning | Backup allocation awaiting approval |
| `PREFERENCE_VIOLATED` | warning | Weekly off not on preferred day |

Every conflict carries: code, severity, date, brandId, processId, employeeId (if any), and a human-readable explanation of what needs attention.

Publish is blocked while any **error** exists. Warnings do not block.

## 4. Handling a change

1. Manager adds a leave or edits a cell.
2. Data is saved (duplicates ignored).
3. **Validation only** reruns. The roster is not regenerated.
4. New conflicts appear.
5. For each gap, `suggestReplacements` returns candidates.

### Replacement filter and ranking
**Filter (all required):** assigned to the process (PRIMARY or BACKUP), available that date, remaining capacity at least the process weight.
**Rank:** same pod first, then lowest allocated workload in the month, then name.

Choosing a candidate creates an approved allocation, and validation reruns.

## 5. Required unit tests

- Calendar rules: 365, except holidays, except Sundays and holidays, min-staff override on a weekday
- Pod-specific holiday
- Duplicate leave entries
- Process with zero assigned employees
- Single-employee 365-day brand: weekly off needs backup, else `NO_VALID_WEEKLY_OFF`
- Multi-brand employee capacity overflow
- Weekly-off backtracking resolves a case greedy fails
- Backup does not count until approved
- Leave on a weekly-off day is not double counted
- Leave added on sole-resource day produces `NO_COVERAGE` and a valid suggestion
- 3-employee brand with one on leave stays covered
- Partial week at month edge
