// ============================================================
// allocation.ts
// Step 4: Allocate employees to processes for each working day.
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
} from './types';
import { isProcessRequired } from './calendar';

export interface AllocationResult {
  allocations: Allocation[];
  conflicts: Conflict[];
  compOffCredits: { employeeId: string; earnedOn: string }[];
}

/**
 * Step 4: For each date, for each employee with status WORKING,
 * allocate them to each PRIMARY process required that day.
 * Also add proposed backup allocations from weekly-off step.
 * Track capacity and flag OVERLOAD conflicts.
 */
export function generateAllocations(
  entries: RosterEntry[],
  employees: Employee[],
  processes: Process[],
  assignments: Assignment[],
  holidays: Holiday[],
  proposedBackupAllocations: Allocation[],
): AllocationResult {
  const allocations: Allocation[] = [];
  const conflicts: Conflict[] = [];
  const compOffCredits: { employeeId: string; earnedOn: string }[] = [];

  // Index: which dates are in the roster
  const allDates = Array.from(new Set(entries.map((e) => e.date))).sort();

  // Index: entries by empId|date
  const entryMap = new Map<string, RosterEntry>();
  for (const e of entries) {
    entryMap.set(`${e.employeeId}|${e.date}`, e);
  }

  // Index: assignments by employee
  const assignmentsByEmployee = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = assignmentsByEmployee.get(a.employeeId) ?? [];
    list.push(a);
    assignmentsByEmployee.set(a.employeeId, list);
  }

  // Handle holiday workers for 365-day processes
  // If a process is ALL_DAYS_365 and required on a holiday, pick an assigned
  // employee who is on HOLIDAY status, mark them WORKING, create comp-off credit.
  for (const date of allDates) {
    for (const proc of processes) {
      if (proc.calendarRule !== 'ALL_DAYS_365') continue;
      if (!isProcessRequired(proc, date, holidays)) continue;

      // Is this date a holiday at all?
      const isHolidayDate = holidays.some((h) => h.date === date);
      if (!isHolidayDate) continue;

      // Find primary assigned employees who are on HOLIDAY status
      const primaryAssigned = assignments.filter(
        (a) => a.processId === proc.id && a.role === 'PRIMARY',
      );

      for (const pa of primaryAssigned) {
        const entry = entryMap.get(`${pa.employeeId}|${date}`);
        if (entry && entry.status === 'HOLIDAY') {
          // Check if the holiday actually applies to their pod
          const emp = employees.find((e) => e.id === pa.employeeId)!;
          const holidayApplies = holidays.some((h) => {
            if (h.date !== date) return false;
            if (h.appliesToAll) return true;
            return h.podIds?.includes(emp.podId) ?? false;
          });

          if (holidayApplies) {
            // Mark as WORKING and create comp-off credit
            entry.status = 'WORKING';
            compOffCredits.push({ employeeId: pa.employeeId, earnedOn: date });
          }
        }
      }
    }
  }

  // Now allocate: for each date, each WORKING employee → allocate to PRIMARY processes
  for (const date of allDates) {
    // Track capacity usage per employee on this date
    const dailyCapacityUsed = new Map<string, number>();

    for (const emp of employees) {
      const entry = entryMap.get(`${emp.id}|${date}`);
      if (!entry || entry.status !== 'WORKING') continue;

      const empAssignments = assignmentsByEmployee.get(emp.id) ?? [];

      for (const a of empAssignments) {
        if (a.role !== 'PRIMARY') continue;

        const proc = processes.find((p) => p.id === a.processId)!;
        if (!isProcessRequired(proc, date, holidays)) continue;

        // Create approved allocation
        allocations.push({
          employeeId: emp.id,
          processId: a.processId,
          date,
          approved: true,
        });

        // Track capacity
        const used = (dailyCapacityUsed.get(emp.id) ?? 0) + a.weight;
        dailyCapacityUsed.set(emp.id, used);
      }
    }

    // Check capacity overloads
    for (const emp of employees) {
      const used = dailyCapacityUsed.get(emp.id) ?? 0;
      if (used > emp.dailyCapacity) {
        const proc = processes.find((p) => {
          const a = assignments.find(
            (a2) => a2.employeeId === emp.id && a2.processId === p.id,
          );
          return !!a;
        });
        conflicts.push({
          code: 'OVERLOAD',
          severity: 'error',
          date,
          employeeId: emp.id,
          brandId: proc?.brandId,
          message: `${emp.name} is overloaded on ${date}: allocated ${used.toFixed(2)} but capacity is ${emp.dailyCapacity.toFixed(2)}.`,
        });
      }
    }
  }

  // Add proposed backup allocations (unapproved)
  for (const ba of proposedBackupAllocations) {
    // Avoid duplicates
    const exists = allocations.some(
      (a) =>
        a.employeeId === ba.employeeId &&
        a.processId === ba.processId &&
        a.date === ba.date,
    );
    if (!exists) {
      allocations.push(ba);
    }
  }

  return { allocations, conflicts, compOffCredits };
}

