# 05 - Demo Script on the Seeded Database (about 4:30)

All names and dates come from `04-demo-data-checklist.md`. Run its reset SQL first, so December 2026 is empty and Arjun has no leave on Dec 6.

## Setup (not recorded)
- Browser zoom at 110%, two tabs open: `/manage` and `/`.
- Terminal ready, with `npm test` typed but not run.
- Month selector set to **2026-12**, **not generated yet**.

---

## Step 1: The data (0:00-0:30), `/manage`

**Do:**
1. Show the Employees table (34 rows, 4 pods).
2. Show Brands (25), then Assignments filtered to **Glowvia**.
3. Show **Spectra** and **LuxeCore** in the Assignments table.

**Say:**
> "This is a roster tool for a company running support for D2C brands: 34 employees, 4 pods, 25 brands. Twenty brands have one employee, five have two or three. Every process has its own calendar rule and minimum staffing, and all of it is editable here without touching code."

**Point at:**
- Glowvia: **Arjun Mehta (PRIMARY)** and **Kavya Joshi (BACKUP)**, same pod.
- Spectra: one employee, no backup.
- LuxeCore: three employees on CS, ACC and NDR.

---

## Step 2: Generate (0:30-1:10), `/`

**Do:** Select **2026-12**, click **Generate Roster**.

**Say:**
> "The engine first works out when each process needs coverage, from its calendar rule and the holidays. Then it gives each employee one weekly off, most-constrained employees first, and backtracks if a placement would leave another process uncovered."

**Point at:**
- The grid statuses (W, WO, H, L).
- The coverage row under it.
- **Arjun's weekly offs on Wednesdays** and **Kavya's on Tuesdays**, which come from their preferences.

---

## Step 3: Different brand schedules (1:10-1:50), filter dropdown

**Do:**
1. **Brand → the Sunday-off brand.** Show that the employee's off falls on **Sundays**.
2. **Brand → Glowvia.** Show that coverage is required **all 31 days**, including **Sunday Dec 20** and the holidays **Dec 24 and 25**.
3. **Brand → LuxeCore.** Show the three employees with **different off days**, and one coverage row per process.

**Say:**
> "A brand's operating calendar is separate from an employee's own schedule. The Sunday-off brand needs nobody on Sundays, so the weekly off fits there naturally. Glowvia runs 365 days, so even holidays need someone working. LuxeCore has three people on three processes, and their offs are staggered."

---

## Step 4: Conflicts (1:50-2:30), conflicts panel

**Do:**
1. Open the conflicts panel and click the **Spectra** `NO_VALID_WEEKLY_OFF` error.
2. Filter to Glowvia and show the `BACKUP_PENDING` entries on Arjun's off Wednesdays (Dec 2, 9, 16, 23, 30).
3. **Approve those pending backups** (use "approve all" if you have it), so Glowvia shows green.

**Say:**
> "Spectra is a 365-day brand with one employee and no backup, so no valid weekly off exists. The system doesn't hide that or invent staff. It raises an error, and the roster can't be published until someone fixes it. Glowvia has a backup, so the engine proposes Kavya on Arjun's off days. Backups don't count as coverage until a manager approves them."

**Expect:** Spectra's error is the only red error. If Glowvia shows red rather than amber on those Wednesdays, that is the "unapproved backup isn't coverage" rule, and approving fixes it.

> If approving five days drags on, cut this part in editing, but make sure Glowvia is fully green before Step 5.

---

## Step 5: Handling a change (2:30-3:40)

**Do:**
1. In `/manage` → Leaves, add **Arjun Mehta, 2026-12-06 (Sunday), LEAVE**.
2. Return to `/` and filter to Glowvia. Show **Dec 6 turning red** and the new `NO_COVERAGE` error.
3. Click **Suggest** on that conflict.
4. Show **Kavya Joshi at the top**, and point out the ranking reasons: same pod, free that day, spare capacity.
5. Click **Approve**.
6. Show the error cleared and Dec 6 green.

**Say:**
> "Arjun is Glowvia's only primary employee. His leave on a Sunday leaves the brand with nobody. The system doesn't regenerate the roster. It revalidates only, and flags the gap. Suggestions are limited to people assigned to this process, free that day and with spare capacity, ranked by same pod first and then lowest workload. Kavya fits. I approve, and the gap closes. The engine suggests, the manager decides."

---

## Step 6: Manual edit and tests (3:40-4:20)

**Do:**
1. Click any grid cell for a LuxeCore employee and change **W to WO**.
2. Show the conflicts panel update instantly. For example, a LuxeCore process may become uncovered.
3. Click the cell back to **W**, and the conflict clears.
4. Switch to the terminal and run `npm test`.

**Say:**
> "Manual edits are validated immediately. The scheduling engine is pure TypeScript with no database or framework dependency, which is why I could cover it with 71 passing tests: capacity overflow, backtracking, duplicate leaves, the unsolvable weekly-off case."

---

## Step 7: Close (4:20-4:35)

**Say:**
> "To sum up: calendars and employee schedules are modeled separately, coverage is checked on allocations, impossible cases are flagged instead of hidden, and the manager stays in control of backups and approvals. The README answers the eight design questions. Thanks for watching."

---

## Fallback lines if something looks off live
- **Kavya doesn't appear in suggestions:** check the Dec 6 status for her. Reset the DB and recheck her brand's calendar and preferred off day (checklist query 6).
- **Dec 6 doesn't turn red:** Arjun's off probably fell on Dec 6. Check his preferred off day (checklist query 1) and regenerate.
- **More than one red error in Step 4:** another 365-day single-employee brand has no backup (checklist query 5).

## Timing
| Step | Time |
|---|---|
| 1 Data | 0:30 |
| 2 Generate | 0:40 |
| 3 Brands | 0:40 |
| 4 Conflicts | 0:40 |
| 5 Change | 1:10 |
| 6 Edit + tests | 0:40 |
| 7 Close | 0:15 |
| **Total** | **~4:35** |

If you run over 5 minutes, cut Step 3's LuxeCore part first, then the manual-edit part of Step 6.
