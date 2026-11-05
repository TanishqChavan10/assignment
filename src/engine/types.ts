// ============================================================
// Engine types — pure data shapes, no I/O, no framework deps
// ============================================================

export type CalendarRule =
  | 'ALL_DAYS_365'
  | 'ALL_EXCEPT_HOLIDAYS'
  | 'EXCEPT_SUNDAYS_AND_HOLIDAYS';

export type AssignmentRole = 'PRIMARY' | 'BACKUP';

export type RosterStatus =
  | 'WORKING'
  | 'WEEKLY_OFF'
  | 'HOLIDAY'
  | 'LEAVE'
  | 'COMP_OFF';

export type ConflictCode =
  | 'NO_COVERAGE'
  | 'UNDERSTAFFED'
  | 'OVERLOAD'
  | 'NO_VALID_WEEKLY_OFF'
  | 'PROCESS_UNASSIGNED'
  | 'BACKUP_PENDING'
  | 'PREFERENCE_VIOLATED';

export type ConflictSeverity = 'error' | 'warning';

// ── Domain entities ────────────────────────────────────────

export interface Pod {
  id: string;
  name: string;
  leadEmployeeId: string | null;
}

export interface Employee {
  id: string;
  name: string;
  podId: string;
  dailyCapacity: number;       // default 1.0
  preferredOffDay: number | null; // 0=Sun … 6=Sat; null = no preference
}

export interface Brand {
  id: string;
  name: string;
}

export interface Process {
  id: string;
  brandId: string;
  name: string;                // CS | ACC | NDR | Retention …
  calendarRule: CalendarRule;
  minStaff: number;            // default 1
  minStaffOverrides: Record<string, number>; // weekday (0-6 as string key) → count
}

export interface Assignment {
  employeeId: string;
  processId: string;
  role: AssignmentRole;
  weight: number;              // workload fraction, default 1.0
}

export interface Holiday {
  id: string;
  date: string;                // 'YYYY-MM-DD'
  name: string;
  appliesToAll: boolean;
  podIds: string[] | null;     // null when appliesToAll = true
}

export interface Leave {
  employeeId: string;
  date: string;                // 'YYYY-MM-DD'
  type: 'LEAVE' | 'COMP_OFF';
}

export interface RosterEntry {
  employeeId: string;
  date: string;
  status: RosterStatus;
}

export interface Allocation {
  employeeId: string;
  processId: string;
  date: string;
  approved: boolean;
}

// ── Engine I/O ────────────────────────────────────────────

export interface EngineInput {
  employees: Employee[];
  pods: Pod[];
  brands: Brand[];
  processes: Process[];
  assignments: Assignment[];
  holidays: Holiday[];
  leaves: Leave[];
  month: string;               // 'YYYY-MM'
}

export interface RosterState {
  entries: RosterEntry[];
  allocations: Allocation[];
}

export interface EngineResult {
  entries: RosterEntry[];
  allocations: Allocation[];
  conflicts: Conflict[];
}

// ── Conflict ──────────────────────────────────────────────

export interface Conflict {
  code: ConflictCode;
  severity: ConflictSeverity;
  date: string;
  brandId?: string;
  processId?: string;
  employeeId?: string;
  message: string;
}

// ── Replacement suggestion ────────────────────────────────

export interface Candidate {
  employeeId: string;
  name: string;
  samePod: boolean;
  monthlyWorkload: number;     // sum of weights already allocated this month
}

