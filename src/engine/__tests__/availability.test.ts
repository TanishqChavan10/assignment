// ============================================================
// availability.test.ts — Vitest unit tests for availability.ts
// Phase 1 "done when" gate: all these must pass
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  isHolidayForEmployee,
  isOnLeave,
  isOnCompOff,
  isAvailable,
  getUnavailableDates,
} from '../availability';
import type { Employee, Holiday, Leave } from '../types';

// ── Fixtures ──────────────────────────────────────────────

const podAlpha = '00000001-0000-0001-0000-000000000000';
const podBeta  = '00000002-0000-0001-0000-000000000000';

const emp = (id: string, podId: string): Employee => ({
  id,
  name: 'Test Employee',
  podId,
  dailyCapacity: 1.0,
  preferredOffDay: null,
});

const alphaEmp = emp('emp-alpha', podAlpha);
const betaEmp  = emp('emp-beta',  podBeta);

const DATE = '2026-12-10';

const allHoliday = (date: string): Holiday => ({
  id: 'h-all',
  date,
  name: 'All-Pod Holiday',
  appliesToAll: true,
  podIds: null,
});

const podHoliday = (date: string, podIds: string[]): Holiday => ({
  id: 'h-pod',
  date,
  name: 'Pod Holiday',
  appliesToAll: false,
  podIds,
});

const leave = (employeeId: string, date: string, type: Leave['type'] = 'LEAVE'): Leave => ({
  employeeId,
  date,
  type,
});

// ── isHolidayForEmployee ──────────────────────────────────

describe('isHolidayForEmployee', () => {
  it('ALL holiday applies to every employee', () => {
    const holidays = [allHoliday(DATE)];
    expect(isHolidayForEmployee(alphaEmp, DATE, holidays)).toBe(true);
    expect(isHolidayForEmployee(betaEmp,  DATE, holidays)).toBe(true);
  });

  it('pod-specific holiday applies only to matching pod', () => {
    const holidays = [podHoliday(DATE, [podAlpha])];
    expect(isHolidayForEmployee(alphaEmp, DATE, holidays)).toBe(true);
    expect(isHolidayForEmployee(betaEmp,  DATE, holidays)).toBe(false);
  });

  it('pod-specific holiday with multiple pods', () => {
    const holidays = [podHoliday(DATE, [podAlpha, podBeta])];
    expect(isHolidayForEmployee(alphaEmp, DATE, holidays)).toBe(true);
    expect(isHolidayForEmployee(betaEmp,  DATE, holidays)).toBe(true);
  });

  it('returns false when no holiday on that date', () => {
    const holidays = [allHoliday('2026-12-25')];
    expect(isHolidayForEmployee(alphaEmp, DATE, holidays)).toBe(false);
  });

  it('returns false with empty holidays', () => {
    expect(isHolidayForEmployee(alphaEmp, DATE, [])).toBe(false);
  });

  it('pod-specific holiday does NOT affect employee in a different pod', () => {
    const thirdPod = '00000003-0000-0001-0000-000000000000';
    const holidays = [podHoliday(DATE, [podAlpha])];
    const thirdEmp = emp('emp-gamma', thirdPod);
    expect(isHolidayForEmployee(thirdEmp, DATE, holidays)).toBe(false);
  });
});

// ── isOnLeave ─────────────────────────────────────────────

describe('isOnLeave', () => {
  const leaves: Leave[] = [leave(alphaEmp.id, DATE, 'LEAVE')];

  it('returns true when employee has LEAVE on that date', () => {
    expect(isOnLeave(alphaEmp, DATE, leaves)).toBe(true);
  });

  it('returns false for a different date', () => {
    expect(isOnLeave(alphaEmp, '2026-12-11', leaves)).toBe(false);
  });

  it('returns false for a different employee', () => {
    expect(isOnLeave(betaEmp, DATE, leaves)).toBe(false);
  });

  it('COMP_OFF entry does NOT count as LEAVE', () => {
    const compOffLeaves: Leave[] = [leave(alphaEmp.id, DATE, 'COMP_OFF')];
    expect(isOnLeave(alphaEmp, DATE, compOffLeaves)).toBe(false);
  });

  it('handles duplicate leave entries gracefully (both return true)', () => {
    const dupLeaves: Leave[] = [
      leave(alphaEmp.id, DATE, 'LEAVE'),
      leave(alphaEmp.id, DATE, 'LEAVE'), // duplicate
    ];
    expect(isOnLeave(alphaEmp, DATE, dupLeaves)).toBe(true);
  });
});

// ── isOnCompOff ───────────────────────────────────────────

describe('isOnCompOff', () => {
  const leaves: Leave[] = [leave(alphaEmp.id, DATE, 'COMP_OFF')];

  it('returns true when employee has COMP_OFF on that date', () => {
    expect(isOnCompOff(alphaEmp, DATE, leaves)).toBe(true);
  });

  it('LEAVE entry does NOT count as COMP_OFF', () => {
    const leaveOnly: Leave[] = [leave(alphaEmp.id, DATE, 'LEAVE')];
    expect(isOnCompOff(alphaEmp, DATE, leaveOnly)).toBe(false);
  });
});

// ── isAvailable ───────────────────────────────────────────

describe('isAvailable', () => {
  it('returns true when employee has no leave or holiday', () => {
    expect(isAvailable(alphaEmp, DATE, [], [])).toBe(true);
  });

  it('returns false when employee is on LEAVE', () => {
    const leaves = [leave(alphaEmp.id, DATE, 'LEAVE')];
    expect(isAvailable(alphaEmp, DATE, [], leaves)).toBe(false);
  });

  it('returns false when employee is on COMP_OFF', () => {
    const leaves = [leave(alphaEmp.id, DATE, 'COMP_OFF')];
    expect(isAvailable(alphaEmp, DATE, [], leaves)).toBe(false);
  });

  it('returns false on ALL holiday', () => {
    const holidays = [allHoliday(DATE)];
    expect(isAvailable(alphaEmp, DATE, holidays, [])).toBe(false);
  });

  it('returns false on pod-specific holiday for matching pod', () => {
    const holidays = [podHoliday(DATE, [podAlpha])];
    expect(isAvailable(alphaEmp, DATE, holidays, [])).toBe(false);
  });

  it('returns true on pod-specific holiday for a DIFFERENT pod', () => {
    const holidays = [podHoliday(DATE, [podAlpha])];
    expect(isAvailable(betaEmp, DATE, holidays, [])).toBe(true);
  });

  it('leave on a holiday date still returns false (not double counted, just unavailable)', () => {
    const holidays = [allHoliday(DATE)];
    const leaves = [leave(alphaEmp.id, DATE, 'LEAVE')];
    // Rule 5: a leave on a holiday is not double-counted, but employee is still unavailable
    expect(isAvailable(alphaEmp, DATE, holidays, leaves)).toBe(false);
  });

  it('leave on a weekly-off day: employee unavailable (weekly-off is not placed on leave days anyway)', () => {
    // This just confirms leave makes employee unavailable on that date
    const sundayLeave = [leave(alphaEmp.id, '2026-12-13', 'LEAVE')]; // Sunday
    expect(isAvailable(alphaEmp, '2026-12-13', [], sundayLeave)).toBe(false);
  });
});

// ── getUnavailableDates ───────────────────────────────────

describe('getUnavailableDates', () => {
  it('returns set of dates on which employee is unavailable', () => {
    const holidays: Holiday[] = [allHoliday('2026-12-25')];
    const leaves: Leave[]    = [leave(alphaEmp.id, '2026-12-15', 'LEAVE')];
    const monthDates = ['2026-12-15', '2026-12-16', '2026-12-25', '2026-12-26'];

    const unavailable = getUnavailableDates(alphaEmp, holidays, leaves, monthDates);

    expect(unavailable.has('2026-12-15')).toBe(true);  // leave
    expect(unavailable.has('2026-12-25')).toBe(true);  // holiday
    expect(unavailable.has('2026-12-16')).toBe(false); // available
    expect(unavailable.has('2026-12-26')).toBe(false); // available
    expect(unavailable.size).toBe(2);
  });

  it('returns empty set when employee is fully available all month', () => {
    const monthDates = ['2026-12-01', '2026-12-02', '2026-12-03'];
    const unavailable = getUnavailableDates(alphaEmp, [], [], monthDates);
    expect(unavailable.size).toBe(0);
  });

  it('pod-specific holiday only blocks the right pod employee', () => {
    const holidays: Holiday[] = [podHoliday('2026-12-10', [podAlpha])];
    const monthDates = ['2026-12-10'];

    expect(getUnavailableDates(alphaEmp, holidays, [], monthDates).size).toBe(1);
    expect(getUnavailableDates(betaEmp,  holidays, [], monthDates).size).toBe(0);
  });
});

