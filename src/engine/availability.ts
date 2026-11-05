// ============================================================
// availability.ts
// Answers: is an employee available to work on a date?
// Pure functions — no I/O.
// ============================================================

import type { Employee, Holiday, Leave } from './types';

/**
 * Returns true if the given date is a holiday that applies to the employee's pod.
 * A holiday with appliesToAll = true affects every employee.
 * A holiday with specific podIds affects only employees in those pods.
 */
export function isHolidayForEmployee(
  employee: Employee,
  date: string,
  holidays: Holiday[],
): boolean {
  return holidays.some((h) => {
    if (h.date !== date) return false;
    if (h.appliesToAll) return true;
    return h.podIds?.includes(employee.podId) ?? false;
  });
}

/**
 * Returns true if the employee has an active LEAVE on the given date.
 */
export function isOnLeave(
  employee: Employee,
  date: string,
  leaves: Leave[],
): boolean {
  return leaves.some(
    (l) =>
      l.employeeId === employee.id && l.date === date && l.type === 'LEAVE',
  );
}

/**
 * Returns true if the employee is using a COMP_OFF on the given date.
 */
export function isOnCompOff(
  employee: Employee,
  date: string,
  leaves: Leave[],
): boolean {
  return leaves.some(
    (l) =>
      l.employeeId === employee.id && l.date === date && l.type === 'COMP_OFF',
  );
}

/**
 * Returns true if the employee is available to be scheduled on the given date.
 *
 * An employee is UNAVAILABLE when:
 *  - They are on LEAVE
 *  - They are on COMP_OFF
 *  - The date is a holiday that applies to their pod
 *
 * Note: weekly-off status is not checked here — that is determined later by
 * the weeklyOff engine step.  Holiday exceptions (working a 365-day process
 * on a holiday for comp-off credit) are handled at the roster-entry level.
 */
export function isAvailable(
  employee: Employee,
  date: string,
  holidays: Holiday[],
  leaves: Leave[],
): boolean {
  if (isOnLeave(employee, date, leaves)) return false;
  if (isOnCompOff(employee, date, leaves)) return false;
  if (isHolidayForEmployee(employee, date, holidays)) return false;
  return true;
}

/**
 * Convenience: returns all leave/comp-off dates for an employee (deduped).
 * Useful for quick lookups in the engine steps.
 */
export function getUnavailableDates(
  employee: Employee,
  holidays: Holiday[],
  leaves: Leave[],
  monthDates: string[],
): Set<string> {
  const result = new Set<string>();
  for (const date of monthDates) {
    if (!isAvailable(employee, date, holidays, leaves)) {
      result.add(date);
    }
  }
  return result;
}

