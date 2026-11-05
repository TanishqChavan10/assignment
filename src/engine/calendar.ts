// ============================================================
// calendar.ts
// Answers: is a process required on a date? what is minStaff?
// Also: generate all dates in a month, classify weeks.
// Pure functions — no I/O.
// ============================================================

import type { Process, Holiday } from './types';

/**
 * Returns true if at least one holiday record covers the given date,
 * regardless of which pods it applies to.
 * Used for process calendar evaluation (process runs regardless of pod).
 */
export function isAnyHoliday(date: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === date);
}

/**
 * Returns true if the process requires coverage on the given date.
 *
 * Rules:
 *  ALL_DAYS_365                → always true
 *  ALL_EXCEPT_HOLIDAYS         → false on any holiday
 *  EXCEPT_SUNDAYS_AND_HOLIDAYS → false on Sundays (UTC day 0) or any holiday
 */
export function isProcessRequired(
  process: Process,
  date: string,
  holidays: Holiday[],
): boolean {
  const holiday = isAnyHoliday(date, holidays);

  switch (process.calendarRule) {
    case 'ALL_DAYS_365':
      return true;

    case 'ALL_EXCEPT_HOLIDAYS':
      return !holiday;

    case 'EXCEPT_SUNDAYS_AND_HOLIDAYS': {
      const dow = getDayOfWeek(date); // 0 = Sunday
      return dow !== 0 && !holiday;
    }
  }
}

/**
 * Returns the effective minStaff for a process on a given date.
 * Checks minStaffOverrides keyed by weekday (0-6 as string).
 */
export function getMinStaff(process: Process, date: string): number {
  const dow = getDayOfWeek(date);
  const override = process.minStaffOverrides[String(dow)];
  return override !== undefined ? override : process.minStaff;
}

/**
 * Returns all ISO date strings ('YYYY-MM-DD') in the given month.
 * month format: 'YYYY-MM'
 */
export function getMonthDates(month: string): string[] {
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate(); // day 0 of next month
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(
      `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }
  return dates;
}

/**
 * Groups dates into ISO weeks (Mon–Sun).
 * Returns an array of week arrays; each week contains only dates that fall
 * within the given month.
 *
 * A partial week (at month edges) is included only if it has ≥ 4 days in the
 * month — matching rule 2: "A partial week at a month edge gets one [weekly
 * off] only if it has 4 or more days in the month."
 */
export function getWeeksInMonth(
  dates: string[],
): string[][] {
  if (dates.length === 0) return [];

  const weeks: string[][] = [];
  let currentWeek: string[] = [];

  for (const date of dates) {
    const dow = getDayOfWeek(date); // 0=Sun … 6=Sat

    // Monday starts a new week
    if (dow === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(date);
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Filter partial weeks: keep only if ≥ 4 days fall in the month
  return weeks.filter((w) => w.length >= 4);
}

/**
 * Returns the UTC day-of-week for an ISO date string.
 * 0 = Sunday, 1 = Monday … 6 = Saturday
 */
export function getDayOfWeek(date: string): number {
  return new Date(date + 'T00:00:00Z').getUTCDay();
}

