// ============================================================
// replacements.ts
// Suggest ranked replacement candidates for a coverage gap.
// Pure functions — no I/O.
// ============================================================

import type {
  EngineInput,
  RosterState,
  Conflict,
  Candidate,
  Assignment,
} from './types';

/**
 * Suggest replacement candidates for a conflict.
 *
 * Filter (all required):
 *  - Assigned to the process (PRIMARY or BACKUP)
 *  - Available that date (not on leave/comp-off/holiday, not on weekly off)
 *  - Remaining capacity >= process weight
 *
 * Rank:
 *  - Same pod first
 *  - Then lowest allocated workload in the month
 *  - Then name (alphabetical)
 */
export function suggestReplacements(
  input: EngineInput,
  roster: RosterState,
  conflict: Conflict,
): Candidate[] {
  if (!conflict.processId || !conflict.date) return [];

  const { employees, assignments, holidays, leaves, processes } = input;
  const { entries, allocations } = roster;

  const proc = processes.find((p) => p.id === conflict.processId);
  if (!proc) return [];

  // Find the assignment weight for this process
  const getWeight = (empId: string): number => {
    const a = assignments.find(
      (a) => a.employeeId === empId && a.processId === proc.id,
    );
    return a?.weight ?? 1.0;
  };

  // Get all employees assigned to this process (PRIMARY or BACKUP)
  const assignedEmployees = assignments.filter(
    (a) => a.processId === conflict.processId,
  );

  const candidates: Candidate[] = [];

  for (const assignment of assignedEmployees) {
    const emp = employees.find((e) => e.id === assignment.employeeId);
    if (!emp) continue;

    // Skip the employee who caused the conflict (if any)
    if (conflict.employeeId && emp.id === conflict.employeeId) continue;

    // Check availability: not on leave/comp-off
    const hasLeave = leaves.some(
      (l) => l.employeeId === emp.id && l.date === conflict.date,
    );
    if (hasLeave) continue;

    // Check: not on holiday for their pod
    const isHoliday = holidays.some((h) => {
      if (h.date !== conflict.date) return false;
      if (h.appliesToAll) return true;
      return h.podIds?.includes(emp.podId) ?? false;
    });
    if (isHoliday) continue;

    // Check roster status: not on weekly off
    const entry = entries.find(
      (e) => e.employeeId === emp.id && e.date === conflict.date,
    );
    if (entry && entry.status !== 'WORKING') continue;

    // Check remaining capacity
    const dayAllocations = allocations.filter(
      (a) => a.employeeId === emp.id && a.date === conflict.date,
    );
    let usedCapacity = 0;
    for (const alloc of dayAllocations) {
      const allocAssignment = assignments.find(
        (a) => a.employeeId === emp.id && a.processId === alloc.processId,
      );
      usedCapacity += allocAssignment?.weight ?? 1.0;
    }
    const remaining = emp.dailyCapacity - usedCapacity;
    const needed = getWeight(emp.id);
    if (remaining < needed) continue;

    // Calculate monthly workload
    const monthlyWorkload = allocations
      .filter((a) => a.employeeId === emp.id)
      .reduce((sum, a) => {
        const w = assignments.find(
          (as) => as.employeeId === emp.id && as.processId === a.processId,
        );
        return sum + (w?.weight ?? 1.0);
      }, 0);

    // Check if same pod as the conflict employee
    const conflictEmp = conflict.employeeId
      ? employees.find((e) => e.id === conflict.employeeId)
      : null;
    const samePod = conflictEmp ? emp.podId === conflictEmp.podId : false;

    candidates.push({
      employeeId: emp.id,
      name: emp.name,
      samePod,
      monthlyWorkload,
    });
  }

  // Sort: same pod first, then lowest workload, then name
  candidates.sort((a, b) => {
    if (a.samePod !== b.samePod) return a.samePod ? -1 : 1;
    if (a.monthlyWorkload !== b.monthlyWorkload)
      return a.monthlyWorkload - b.monthlyWorkload;
    return a.name.localeCompare(b.name);
  });

  return candidates;
}

