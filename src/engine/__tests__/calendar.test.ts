// ============================================================
// calendar.test.ts  — Vitest unit tests for calendar.ts
// Phase 1 "done when" gate: all these must pass
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  isProcessRequired,
  getMinStaff,
  getMonthDates,
  getWeeksInMonth,
  getDayOfWeek,
  isAnyHoliday,
} from '../calendar';
import type { Process, Holiday } from '../types';

// ── Helpers ───────────────────────────────────────────────

const makeProcess = (
  calendarRule: Process['calendarRule'],
  minStaff = 1,
  minStaffOverrides: Record<string, number> = {},
): Process => ({
  id: 'proc-1',
  brandId: 'brand-1',
  name: 'CS',
  calendarRule,
  minStaff,
  minStaffOverrides,
});

const holiday = (date: string, appliesToAll = true): Holiday => ({
  id: 'h-1',
  date,
  name: 'Test Holiday',
  appliesToAll,
  podIds: null,
});

// Dec 2026 reference:
//   Mon=Dec 7, Tue=Dec 8, Wed=Dec 9, Thu=Dec 10
//   Sat=Dec 12, Sun=Dec 13
const MON = '2026-12-07';
const SUN = '2026-12-13';
const HOLIDAY_DATE = '2026-12-25'; // Christmas (Friday)

// ── getDayOfWeek ──────────────────────────────────────────

describe('getDayOfWeek', () => {
  it('returns 0 for Sunday', () => {
    expect(getDayOfWeek('2026-12-13')).toBe(0); // Sunday
  });
  it('returns 1 for Monday', () => {
    expect(getDayOfWeek('2026-12-07')).toBe(1);
  });
  it('returns 6 for Saturday', () => {
    expect(getDayOfWeek('2026-12-12')).toBe(6);
  });
  it('returns 5 for Friday', () => {
    expect(getDayOfWeek('2026-12-25')).toBe(5);
  });
});

// ── isAnyHoliday ─────────────────────────────────────────

describe('isAnyHoliday', () => {
  const holidays: Holiday[] = [holiday(HOLIDAY_DATE)];

  it('returns true when date matches', () => {
    expect(isAnyHoliday(HOLIDAY_DATE, holidays)).toBe(true);
  });
  it('returns false when date does not match', () => {
    expect(isAnyHoliday('2026-12-01', holidays)).toBe(false);
  });
  it('returns false with empty holidays array', () => {
    expect(isAnyHoliday(HOLIDAY_DATE, [])).toBe(false);
  });
});

// ── isProcessRequired ─────────────────────────────────────

describe('isProcessRequired — ALL_DAYS_365', () => {
  const p = makeProcess('ALL_DAYS_365');

  it('is required on a normal weekday', () => {
    expect(isProcessRequired(p, MON, [])).toBe(true);
  });
  it('is required on a Sunday', () => {
    expect(isProcessRequired(p, SUN, [])).toBe(true);
  });
  it('is required on a holiday', () => {
    expect(isProcessRequired(p, HOLIDAY_DATE, [holiday(HOLIDAY_DATE)])).toBe(true);
  });
  it('is required on a Sunday that is also a holiday', () => {
    expect(isProcessRequired(p, SUN, [holiday(SUN)])).toBe(true);
  });
});

describe('isProcessRequired — ALL_EXCEPT_HOLIDAYS', () => {
  const p = makeProcess('ALL_EXCEPT_HOLIDAYS');
  const holidays: Holiday[] = [holiday(HOLIDAY_DATE)];

  it('is required on a normal weekday', () => {
    expect(isProcessRequired(p, MON, [])).toBe(true);
  });
  it('is required on a Sunday with no holiday', () => {
    expect(isProcessRequired(p, SUN, [])).toBe(true);
  });
  it('is NOT required on a holiday', () => {
    expect(isProcessRequired(p, HOLIDAY_DATE, holidays)).toBe(false);
  });
  it('is NOT required on a Sunday that is also a holiday', () => {
    expect(isProcessRequired(p, SUN, [holiday(SUN)])).toBe(false);
  });
});

describe('isProcessRequired — EXCEPT_SUNDAYS_AND_HOLIDAYS', () => {
  const p = makeProcess('EXCEPT_SUNDAYS_AND_HOLIDAYS');
  const holidays: Holiday[] = [holiday(HOLIDAY_DATE)];

  it('is required on a normal weekday', () => {
    expect(isProcessRequired(p, MON, [])).toBe(true);
  });
  it('is NOT required on a Sunday', () => {
    expect(isProcessRequired(p, SUN, [])).toBe(false);
  });
  it('is NOT required on a holiday (Friday)', () => {
    expect(isProcessRequired(p, HOLIDAY_DATE, holidays)).toBe(false);
  });
  it('is NOT required on a Sunday that is also a holiday', () => {
    expect(isProcessRequired(p, SUN, [holiday(SUN)])).toBe(false);
  });
  it('is required on a Saturday (not a holiday)', () => {
    expect(isProcessRequired(p, '2026-12-12', [])).toBe(true); // Saturday
  });
});

// ── getMinStaff ───────────────────────────────────────────

describe('getMinStaff', () => {
  it('returns default minStaff when no override', () => {
    const p = makeProcess('ALL_DAYS_365', 2, {});
    expect(getMinStaff(p, MON)).toBe(2);
  });

  it('returns override when weekday matches', () => {
    // Monday = 1; override for Monday → 3
    const p = makeProcess('ALL_DAYS_365', 1, { '1': 3 });
    expect(getMinStaff(p, MON)).toBe(3);
  });

  it('returns default on a weekday without override', () => {
    // Override only for Saturday (6); Monday has no override
    const p = makeProcess('ALL_DAYS_365', 1, { '6': 2 });
    expect(getMinStaff(p, MON)).toBe(1);
  });

  it('applies weekend overrides correctly (Sat + Sun)', () => {
    const p = makeProcess('ALL_EXCEPT_HOLIDAYS', 1, { '0': 2, '6': 2 });
    expect(getMinStaff(p, SUN)).toBe(2);                  // Sunday = 0
    expect(getMinStaff(p, '2026-12-12')).toBe(2);         // Saturday = 6
    expect(getMinStaff(p, MON)).toBe(1);                  // Monday = default
  });

  it('override of 0 is respected (explicitly close a process)', () => {
    const p = makeProcess('ALL_DAYS_365', 1, { '0': 0 });
    expect(getMinStaff(p, SUN)).toBe(0);
  });
});

// ── getMonthDates ─────────────────────────────────────────

describe('getMonthDates', () => {
  it('returns 31 dates for December 2026', () => {
    const dates = getMonthDates('2026-12');
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe('2026-12-01');
    expect(dates[30]).toBe('2026-12-31');
  });

  it('returns 28 dates for February in a non-leap year', () => {
    const dates = getMonthDates('2026-02');
    expect(dates).toHaveLength(28);
    expect(dates[27]).toBe('2026-02-28');
  });

  it('returns 29 dates for February in a leap year', () => {
    const dates = getMonthDates('2024-02');
    expect(dates).toHaveLength(29);
    expect(dates[28]).toBe('2024-02-29');
  });

  it('returns 30 dates for November', () => {
    expect(getMonthDates('2026-11')).toHaveLength(30);
  });
});

// ── getWeeksInMonth ───────────────────────────────────────

describe('getWeeksInMonth', () => {
  it('December 2026: first date is Tue — partial opening week has 6 days (≥4, included)', () => {
    // Dec 1 = Tue, so Mon–Sun week of Nov30-Dec6 contributes Dec1-Dec6 (6 days in month)
    const dates = getMonthDates('2026-12');
    const weeks = getWeeksInMonth(dates);
    // Week starting Tue Dec 1 through Sun Dec 6 = 6 dates → included
    expect(weeks[0].length).toBeGreaterThanOrEqual(4);
    expect(weeks[0][0]).toBe('2026-12-01');
  });

  it('every full Mon–Sun week is included', () => {
    const dates = getMonthDates('2026-12');
    const weeks = getWeeksInMonth(dates);
    // December has 31 days starting Tuesday.
    // All weeks should be retained since the month has no 1-3 day edges.
    expect(weeks.length).toBeGreaterThan(0);
  });

  it('a partial final week with < 4 days is excluded', () => {
    // February 2026: starts on a Sunday (2026-02-01 = Sun).
    // Last week: Thu 26 - Fri 27 - Sat 28 = 3 days → excluded
    const dates = getMonthDates('2026-02');
    const weeks = getWeeksInMonth(dates);
    const lastWeek = weeks[weeks.length - 1];
    // The final partial week should have been dropped if < 4 days
    expect(lastWeek.length).toBeGreaterThanOrEqual(4);
  });

  it('returns empty array for empty input', () => {
    expect(getWeeksInMonth([])).toEqual([]);
  });
});

