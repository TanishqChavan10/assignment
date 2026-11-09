// ============================================================
// validator.ts
// Step 5: Validate roster state — coverage, staffing, capacity,
// pending backups. Also used standalone after manual edits.
// Pure functions — no I/O.
// ============================================================

import type {
  Employee,
  Process,
  Assignment,
  Holiday,
  RosterEntry,
  Allocation,
  Conflict,
  Brand,
} from './types';
import { isProcessRequired, getMinStaff, getMonthDates, getWeeksInMonth } from './calendar';

/**
 * Validate the full roster state and return all conflicts.
 *
 * Checks (from spec Step 5):
 *  - NO_COVERAGE:        Required process day with zero approved allocations
 *  - UNDERSTAFFED:       Some coverage, below minStaff
 *  - OVERLOAD:           Employee allocated beyond capacity
 *  - PROCESS_UNASSIGNED: Process has no assigned employee at all
 *  - BACKUP_PENDING:     Backup allocation awaiting approval
 *  - PREFERENCE_VIOLATED: Weekly off not on preferred day (passed through)
 *  - NO_VALID_WEEKLY_OFF: Passed through from generation step
 */
export function validateRoster(
  entries: RosterEntry[],
  allocations: Allocation[],
  employees: Employee[],
  processes: Process[],
  brands: Brand[],
  assignments: Assignment[],
  holidays: Holiday[],
  month: string,
  existingConflicts: Conflict[] = [],
): Conflict[] {
  const conflicts: Conflict[] = [
    ...existingConflicts.filter(
      (c) => c.code === 'NO_VALID_WEEKLY_OFF' || c.code === 'PREFERENCE_VIOLATED',
    ),
  ];

  const allDates = getMonthDates(month);

  // ── PROCESS_UNASSIGNED ──────────────────────────────────
  for (const proc of processes) {
    const hasAssignment = assignments.some((a) => a.processId === proc.id);
    if (!hasAssignment) {
      const brand = brands.find((b) => b.id === proc.brandId);
      conflicts.push({
        code: 'PROCESS_UNASSIGNED',
        severity: 'error',
        date: allDates[0],
        processId: proc.id,
        brandId: proc.brandId,
        message: `Process "${proc.name}" for brand "${brand?.name ?? proc.brandId}" has no assigned employees.`,
      });
    }
  }

  // ── NO_VALID_WEEKLY_OFF checks (ensures consistency even during standalone validation) ──
  const weeks = getWeeksInMonth(allDates);
  for (const emp of employees) {
    const empPrimaries = assignments.filter((a) => a.employeeId === emp.id && a.role === 'PRIMARY');
    if (empPrimaries.length === 0) continue;

    for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
      const weekDates = weeks[wIdx];
      if (weekDates.length < 7) continue;

      const hasRestDay = weekDates.some((d) => {
        const entry = entries.find((e) => e.employeeId === emp.id && e.date === d);
        return entry && entry.status !== 'WORKING';
      });

      if (!hasRestDay) {
        const firstProc = processes.find((p) => p.id === empPrimaries[0].processId);
        const alreadyFlagged = conflicts.some(
          (c) => c.code === 'NO_VALID_WEEKLY_OFF' && c.employeeId === emp.id
        );
        if (!alreadyFlagged) {
          conflicts.push({
            code: 'NO_VALID_WEEKLY_OFF',
            severity: 'error',
            date: weekDates[0],
            employeeId: emp.id,
            processId: firstProc?.id,
            brandId: firstProc?.brandId,
            message: `No valid weekly off found for ${emp.name} in week ${wIdx + 1} (${weekDates[0]} to ${weekDates[weekDates.length - 1]}). All candidate days leave processes uncovered.`,
          });
        }
      }
    }
  }

  // ── Per-date checks ─────────────────────────────────────
  for (const date of allDates) {
    // ── COVERAGE checks (NO_COVERAGE, UNDERSTAFFED) ───────
    for (const proc of processes) {
      if (!isProcessRequired(proc, date, holidays)) continue;

      const needed = getMinStaff(proc, date);
      const approvedCount = allocations.filter(
        (a) =>
          a.processId === proc.id &&
          a.date === date &&
          a.approved === true,
      ).length;

      const pendingCount = allocations.filter(
        (a) =>
          a.processId === proc.id &&
          a.date === date &&
          a.approved === false,
      ).length;

      if (approvedCount === 0 && pendingCount === 0) {
        const brand = brands.find((b) => b.id === proc.brandId);
        conflicts.push({
          code: 'NO_COVERAGE',
          severity: 'error',
          date,
          processId: proc.id,
          brandId: proc.brandId,
          message: `No approved coverage for "${proc.name}" (${brand?.name ?? proc.brandId}) on ${date}. Need ${needed} staff.`,
        });
      } else if (approvedCount < needed && pendingCount === 0) {
        const brand = brands.find((b) => b.id === proc.brandId);
        conflicts.push({
          code: 'UNDERSTAFFED',
          severity: 'error',
          date,
          processId: proc.id,
          brandId: proc.brandId,
          message: `"${proc.name}" (${brand?.name ?? proc.brandId}) on ${date} has ${approvedCount}/${needed} approved staff.`,
        });
      }
    }

    // ── BACKUP_PENDING ────────────────────────────────────
    const pendingBackups = allocations.filter(
      (a) => a.date === date && a.approved === false,
    );
    for (const ba of pendingBackups) {
      const proc = processes.find((p) => p.id === ba.processId);
      const brand = proc ? brands.find((b) => b.id === proc.brandId) : undefined;
      const emp = employees.find((e) => e.id === ba.employeeId);
      conflicts.push({
        code: 'BACKUP_PENDING',
        severity: 'warning',
        date,
        processId: ba.processId,
        brandId: proc?.brandId,
        employeeId: ba.employeeId,
        message: `Backup allocation for ${emp?.name ?? ba.employeeId} on "${proc?.name ?? ba.processId}" (${brand?.name ?? ''}) on ${date} is pending approval.`,
      });
    }

    // ── OVERLOAD ──────────────────────────────────────────
    for (const emp of employees) {
      const empAllocations = allocations.filter(
        (a) => a.employeeId === emp.id && a.date === date && a.approved === true,
      );
      if (empAllocations.length === 0) continue;

      let totalWeight = 0;
      for (const alloc of empAllocations) {
        const assignment = assignments.find(
          (a) => a.employeeId === emp.id && a.processId === alloc.processId,
        );
        totalWeight += assignment?.weight ?? 1.0;
      }

      if (totalWeight > emp.dailyCapacity) {
        conflicts.push({
          code: 'OVERLOAD',
          severity: 'error',
          date,
          employeeId: emp.id,
          message: `${emp.name} is overloaded on ${date}: allocated weight ${totalWeight.toFixed(2)} exceeds capacity ${emp.dailyCapacity.toFixed(2)}.`,
        });
      }
    }
  }

  return conflicts;
}

