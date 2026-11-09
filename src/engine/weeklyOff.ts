// ============================================================
// weeklyOff.ts
// Step 3: Weekly-off generation
// Most-constrained-first assignment + limited backtracking.
// Pure functions — no I/O.
// ============================================================

import type {
  Employee,
  Process,
  Assignment,
  Holiday,
  Leave,
  RosterEntry,
  Allocation,
  Conflict,
  RosterStatus,
} from './types';
import { getWeeksInMonth, getMonthDates, isProcessRequired, getMinStaff, getDayOfWeek } from './calendar';
import { isAvailable } from './availability';

/** Internal type for tracking weekly-off placement state */
interface EmployeeWeek {
  employeeId: string;
  weekDates: string[];
  candidates: string[];       // eligible off-day dates
  assignedOff: string | null;
}

/** Result of the weekly-off generation step */
export interface WeeklyOffResult {
  entries: RosterEntry[];
  proposedBackupAllocations: Allocation[];
  conflicts: Conflict[];
}

/**
 * Generate weekly offs for all employees in the given month.
 *
 * Algorithm (from spec Step 3):
 * 1. For each employee-week, compute candidate off days.
 * 2. Sort by fewest candidates first (most constrained).
 * 3. Assign preferred day if possible, else the day with most slack.
 * 4. On zero candidates, backtrack last 2 placements, retry. Max 100 attempts.
 * 5. If still impossible: propose backup allocation or raise NO_VALID_WEEKLY_OFF.
 */
export function generateWeeklyOffs(
  employees: Employee[],
  processes: Process[],
  assignments: Assignment[],
  holidays: Holiday[],
  leaves: Leave[],
  month: string,
): WeeklyOffResult {
  const allDates = getMonthDates(month);
  const weeks = getWeeksInMonth(allDates);

  // Pre-compute per-employee primary processes
  const primaryAssignments = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (a.role === 'PRIMARY') {
      const list = primaryAssignments.get(a.employeeId) ?? [];
      list.push(a);
      primaryAssignments.set(a.employeeId, list);
    }
  }

  // Build the initial roster entries for non-weekly-off statuses
  const entries: RosterEntry[] = [];
  const statusMap = new Map<string, RosterStatus>(); // key: empId|date

  for (const emp of employees) {
    for (const date of allDates) {
      let status: RosterStatus = 'WORKING';

      // Check leave first (leave on holiday = leave takes precedence for status, not double counted)
      const hasLeave = leaves.some(
        (l) => l.employeeId === emp.id && l.date === date && l.type === 'LEAVE',
      );
      const hasCompOff = leaves.some(
        (l) => l.employeeId === emp.id && l.date === date && l.type === 'COMP_OFF',
      );
      const isHoliday = holidays.some((h) => {
        if (h.date !== date) return false;
        if (h.appliesToAll) return true;
        return h.podIds?.includes(emp.podId) ?? false;
      });

      if (hasLeave) {
        status = 'LEAVE';
      } else if (hasCompOff) {
        status = 'COMP_OFF';
      } else if (isHoliday) {
        status = 'HOLIDAY';
      }

      const key = `${emp.id}|${date}`;
      statusMap.set(key, status);
      entries.push({ employeeId: emp.id, date, status });
    }
  }

  // Helper: get entry by empId+date
  const getEntry = (empId: string, date: string) =>
    entries.find((e) => e.employeeId === empId && e.date === date)!;

  // Helper: count how many other available PRIMARY employees cover a process on a date
  // (excluding a specific employee, and accounting for already-assigned weekly offs)
  const countOtherPrimaryCoverage = (
    processId: string,
    date: string,
    excludeEmpId: string,
    weeklyOffs: Map<string, string>, // empId -> off date (current placements)
  ): number => {
    let count = 0;
    const procAssignments = assignments.filter(
      (a) => a.processId === processId && a.role === 'PRIMARY' && a.employeeId !== excludeEmpId,
    );
    for (const a of procAssignments) {
      const empStatus = statusMap.get(`${a.employeeId}|${date}`);
      if (empStatus !== 'WORKING') continue; // on leave/holiday/comp-off
      if (weeklyOffs.get(a.employeeId) === date) continue; // already assigned off
      count++;
    }
    return count;
  };

  // Build employee-week items
  const allEmployeeWeeks: EmployeeWeek[] = [];
  for (const emp of employees) {
    for (const week of weeks) {
      allEmployeeWeeks.push({
        employeeId: emp.id,
        weekDates: week,
        candidates: [],
        assignedOff: null,
      });
    }
  }

  // The main assignment loop with backtracking
  const weeklyOffs = new Map<string, string>(); // empId|weekIndex -> off date
  const globalWeeklyOffDates = new Map<string, string>(); // empId -> off date (per week tracking)
  const proposedBackupAllocations: Allocation[] = [];
  const conflicts: Conflict[] = [];

  // We need a more structured approach: process week by week
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi];

    // Build employee-week items for this week
    const ewItems: EmployeeWeek[] = [];
    for (const emp of employees) {
      ewItems.push({
        employeeId: emp.id,
        weekDates: week,
        candidates: [],
        assignedOff: null,
      });
    }

    // Track placements for this week
    const weekPlacements = new Map<string, string>(); // empId -> off date

    // Compute candidates for each employee-week
    const computeCandidates = (ew: EmployeeWeek): string[] => {
      const emp = employees.find((e) => e.id === ew.employeeId)!;
      const empPrimaryAssignments = primaryAssignments.get(emp.id) ?? [];
      const candidates: string[] = [];

      for (const date of ew.weekDates) {
        const status = statusMap.get(`${emp.id}|${date}`);
        // Can't place weekly off on leave, holiday, or comp-off days
        if (status !== 'WORKING') continue;
        // Can't place on a day already assigned as weekly off for this employee
        if (weekPlacements.get(emp.id) === date) continue;

        // Check: if this employee is off on this date, does every PRIMARY
        // process of theirs still meet minStaff (via other primaries or backup)?
        let viable = true;
        for (const assignment of empPrimaryAssignments) {
          const proc = processes.find((p) => p.id === assignment.processId)!;
          if (!isProcessRequired(proc, date, holidays)) continue;

          const needed = getMinStaff(proc, date);
          const otherCoverage = countOtherPrimaryCoverage(
            proc.id,
            date,
            emp.id,
            weekPlacements,
          );
          if (otherCoverage < needed) {
            // Check if an available backup exists on this date
            const backupAssignments = assignments.filter(
              (a) =>
                a.processId === proc.id &&
                a.role === 'BACKUP' &&
                a.employeeId !== emp.id,
            );
            const availableBackup = backupAssignments.find((ba) => {
              const bStatus = statusMap.get(`${ba.employeeId}|${date}`);
              if (bStatus !== 'WORKING') return false;
              if (weekPlacements.get(ba.employeeId) === date) return false;
              return true;
            });
            if (!availableBackup) {
              viable = false;
              break;
            }
          }
        }

        if (viable) {
          candidates.push(date);
        }
      }

      return candidates;
    };

    // Compute initial candidates
    for (const ew of ewItems) {
      ew.candidates = computeCandidates(ew);
    }

    // Sort: fewest candidates first (most constrained)
    ewItems.sort((a, b) => a.candidates.length - b.candidates.length);

    // Assign with backtracking
    const assignmentOrder: number[] = []; // indices into ewItems of successful placements
    let attempts = 0;
    const MAX_ATTEMPTS = 100;
    let i = 0;

    while (i < ewItems.length) {
      const ew = ewItems[i];

      // Recompute candidates (placements may have changed)
      ew.candidates = computeCandidates(ew);

      if (ew.candidates.length === 0) {
        // If this is a partial week at month boundary (< 7 days), the employee's weekly off
        // falls on the days outside this month (e.g. Sunday falling on Jan 1-3).
        if (ew.weekDates.length < 7) {
          i++;
          continue;
        }

        const currentEmp = employees.find((e) => e.id === ew.employeeId)!;
        // If employee has a rest day via a holiday in this week (e.g. Sunday holiday Dec 20)
        const hasCoincidingHoliday = ew.weekDates.some(
          (d) =>
            (currentEmp.preferredOffDay === null || getDayOfWeek(d) === currentEmp.preferredOffDay) &&
            statusMap.get(`${currentEmp.id}|${d}`) === 'HOLIDAY',
        );
        if (hasCoincidingHoliday) {
          i++;
          continue;
        }

        // Check if the employee already has a non-WORKING day this week
        // (all leave/holiday/comp-off) — they might not need a weekly off
        const workingDays = ew.weekDates.filter(
          (d) => statusMap.get(`${ew.employeeId}|${d}`) === 'WORKING' &&
                 weekPlacements.get(ew.employeeId) !== d,
        );

        if (workingDays.length === 0) {
          // Employee isn't working any day this week, skip
          i++;
          continue;
        }

        // Backtrack: undo last 2 placements and try alternates if within attempt budget
        if (assignmentOrder.length >= 1 && attempts < MAX_ATTEMPTS) {
          attempts++;
          const toUndo = Math.min(2, assignmentOrder.length);
          for (let u = 0; u < toUndo; u++) {
            const undoIdx = assignmentOrder.pop()!;
            const undoneEw = ewItems[undoIdx];
            weekPlacements.delete(undoneEw.employeeId);
            undoneEw.assignedOff = null;
            i = Math.min(i, undoIdx);
          }
          continue;
        }

        // Exhausted candidates & backtracking — flag NO_VALID_WEEKLY_OFF
        const emp = employees.find((e) => e.id === ew.employeeId)!;
        const empPrimaries = primaryAssignments.get(emp.id) ?? [];
        const firstProc = empPrimaries[0]
          ? processes.find((p) => p.id === empPrimaries[0].processId)
          : undefined;

        conflicts.push({
          code: 'NO_VALID_WEEKLY_OFF',
          severity: 'error',
          date: ew.weekDates[0],
          employeeId: emp.id,
          processId: firstProc?.id,
          brandId: firstProc?.brandId,
          message: `Cannot assign a weekly off for ${emp.name} in week starting ${ew.weekDates[0]}. No candidate day keeps all processes covered, and no backup is available.`,
        });

        i++;
        continue;
      }

      // Pick the best candidate
      const emp = employees.find((e) => e.id === ew.employeeId)!;
      let chosen: string;

      // Prefer the employee's preferred off day
      const preferredCandidate = ew.candidates.find(
        (d) => getDayOfWeek(d) === emp.preferredOffDay,
      );

      if (preferredCandidate) {
        chosen = preferredCandidate;
      } else {
        // Pick the candidate that keeps the most slack
        const empPrimaryAssignments = primaryAssignments.get(emp.id) ?? [];
        let bestSlack = -Infinity;
        chosen = ew.candidates[0];

        for (const candidate of ew.candidates) {
          let totalSlack = 0;
          for (const assignment of empPrimaryAssignments) {
            const proc = processes.find((p) => p.id === assignment.processId)!;
            if (!isProcessRequired(proc, candidate, holidays)) continue;
            const needed = getMinStaff(proc, candidate);
            const coverage = countOtherPrimaryCoverage(proc.id, candidate, emp.id, weekPlacements);
            totalSlack += coverage - needed;
          }
          if (totalSlack > bestSlack) {
            bestSlack = totalSlack;
            chosen = candidate;
          }
        }
      }

      ew.assignedOff = chosen;
      weekPlacements.set(emp.id, chosen);
      assignmentOrder.push(i);

      // Check if this placement requires backup allocations
      const empPrimaryAssignments = primaryAssignments.get(emp.id) ?? [];
      for (const assignment of empPrimaryAssignments) {
        const proc = processes.find((p) => p.id === assignment.processId)!;
        if (!isProcessRequired(proc, chosen, holidays)) continue;

        const needed = getMinStaff(proc, chosen);
        const otherCoverage = countOtherPrimaryCoverage(proc.id, chosen, emp.id, weekPlacements);

        if (otherCoverage < needed) {
          const backupAssignments = assignments.filter(
            (a) =>
              a.processId === proc.id &&
              a.role === 'BACKUP' &&
              a.employeeId !== emp.id,
          );
          const availableBackup = backupAssignments.find((ba) => {
            const bStatus = statusMap.get(`${ba.employeeId}|${chosen}`);
            if (bStatus !== 'WORKING') return false;
            if (weekPlacements.get(ba.employeeId) === chosen) return false;
            return true;
          });

          if (availableBackup) {
            proposedBackupAllocations.push({
              employeeId: availableBackup.employeeId,
              processId: proc.id,
              date: chosen,
              approved: false,
            });
          }
        }
      }

      i++;
    }

    // Apply weekly offs to entries
    for (const ew of ewItems) {
      if (ew.assignedOff) {
        const entry = getEntry(ew.employeeId, ew.assignedOff);
        entry.status = 'WEEKLY_OFF';

        // Check preference violation
        const emp = employees.find((e) => e.id === ew.employeeId)!;
        if (
          emp.preferredOffDay !== null &&
          getDayOfWeek(ew.assignedOff) !== emp.preferredOffDay
        ) {
          conflicts.push({
            code: 'PREFERENCE_VIOLATED',
            severity: 'warning',
            date: ew.assignedOff,
            employeeId: emp.id,
            message: `${emp.name}'s weekly off on ${ew.assignedOff} is not on their preferred day (${emp.preferredOffDay}).`,
          });
        }
      }
    }
  }

  return { entries, proposedBackupAllocations, conflicts };
}

