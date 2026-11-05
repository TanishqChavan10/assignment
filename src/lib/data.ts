// ============================================================
// data.ts — Load all DB tables into EngineInput shape.
// Used by API routes to bridge Supabase → Engine.
// ============================================================

import { supabase } from './supabase';
import type {
  EngineInput,
  Pod,
  Employee,
  Brand,
  Process,
  Assignment,
  Holiday,
  Leave,
  RosterEntry,
  Allocation,
  RosterState,
} from '@/engine/types';

// ── Row-to-type mappers (snake_case → camelCase) ──────────

function toPod(r: any): Pod {
  return { id: r.id, name: r.name, leadEmployeeId: r.lead_employee_id };
}
function toEmployee(r: any): Employee {
  return {
    id: r.id,
    name: r.name,
    podId: r.pod_id,
    dailyCapacity: parseFloat(r.daily_capacity),
    preferredOffDay: r.preferred_off_day,
  };
}
function toBrand(r: any): Brand {
  return { id: r.id, name: r.name };
}
function toProcess(r: any): Process {
  return {
    id: r.id,
    brandId: r.brand_id,
    name: r.name,
    calendarRule: r.calendar_rule,
    minStaff: r.min_staff,
    minStaffOverrides: r.min_staff_overrides ?? {},
  };
}
function toAssignment(r: any): Assignment {
  return {
    employeeId: r.employee_id,
    processId: r.process_id,
    role: r.role,
    weight: parseFloat(r.weight),
  };
}
function toHoliday(r: any): Holiday {
  return {
    id: r.id,
    date: r.date,
    name: r.name,
    appliesToAll: r.applies_to_all,
    podIds: r.pod_ids,
  };
}
function toLeave(r: any): Leave {
  return { employeeId: r.employee_id, date: r.date, type: r.type };
}

export function toRosterEntry(r: any): RosterEntry {
  return { employeeId: r.employee_id, date: r.date, status: r.status };
}
export function toAllocation(r: any): Allocation {
  return {
    employeeId: r.employee_id,
    processId: r.process_id,
    date: r.date,
    approved: r.approved,
  };
}

// ── Loaders ───────────────────────────────────────────────

async function load<T>(table: string, mapper: (r: any) => T): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  return (data ?? []).map(mapper);
}

export async function loadEngineInput(month: string): Promise<EngineInput> {
  const [pods, employees, brands, processes, assignments, holidays, leaves] =
    await Promise.all([
      load('pods', toPod),
      load('employees', toEmployee),
      load('brands', toBrand),
      load('processes', toProcess),
      load('assignments', toAssignment),
      load('holidays', toHoliday),
      load('leaves', toLeave),
    ]);

  return { pods, employees, brands, processes, assignments, holidays, leaves, month };
}

export async function loadRosterState(month: string): Promise<RosterState> {
  const startDate = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`;

  const [entriesRes, allocationsRes] = await Promise.all([
    supabase
      .from('roster_entries')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('allocations')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate),
  ]);

  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (allocationsRes.error) throw new Error(allocationsRes.error.message);

  return {
    entries: (entriesRes.data ?? []).map(toRosterEntry),
    allocations: (allocationsRes.data ?? []).map(toAllocation),
  };
}

export async function saveRosterResult(
  entries: RosterEntry[],
  allocations: Allocation[],
  month: string,
  compOffCredits: { employeeId: string; earnedOn: string }[] = [],
) {
  const startDate = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`;

  // Delete existing data for this month
  await supabase
    .from('allocations')
    .delete()
    .gte('date', startDate)
    .lte('date', endDate);

  await supabase
    .from('roster_entries')
    .delete()
    .gte('date', startDate)
    .lte('date', endDate);

  // Insert new entries (batch in chunks of 500)
  const entryRows = entries.map((e) => ({
    employee_id: e.employeeId,
    date: e.date,
    status: e.status,
  }));

  for (let i = 0; i < entryRows.length; i += 500) {
    const chunk = entryRows.slice(i, i + 500);
    const { error } = await supabase.from('roster_entries').insert(chunk);
    if (error) throw new Error(`Failed to insert roster entries: ${error.message}`);
  }

  // Insert allocations
  const allocRows = allocations.map((a) => ({
    employee_id: a.employeeId,
    process_id: a.processId,
    date: a.date,
    approved: a.approved,
  }));

  for (let i = 0; i < allocRows.length; i += 500) {
    const chunk = allocRows.slice(i, i + 500);
    const { error } = await supabase.from('allocations').insert(chunk);
    if (error) throw new Error(`Failed to insert allocations: ${error.message}`);
  }

  // Insert comp-off credits
  if (compOffCredits.length > 0) {
    const creditRows = compOffCredits.map((c) => ({
      employee_id: c.employeeId,
      earned_on: c.earnedOn,
    }));
    await supabase.from('comp_off_credits').insert(creditRows);
  }
}

