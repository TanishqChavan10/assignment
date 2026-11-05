import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month) {
    return NextResponse.json({ error: 'month query param required' }, { status: 400 });
  }

  const startDate = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`;

  const view = searchParams.get('view') ?? 'company';
  const id = searchParams.get('id');

  // Load entries + allocations for the month
  const [entriesRes, allocationsRes, employeesRes, processesRes, brandsRes, assignmentsRes] =
    await Promise.all([
      supabase.from('roster_entries').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('allocations').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('employees').select('*, pods(id, name)').order('name'),
      supabase.from('processes').select('*, brands(id, name)').order('name'),
      supabase.from('brands').select('*').order('name'),
      supabase.from('assignments').select('*'),
    ]);

  if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 });

  let employees = employeesRes.data ?? [];
  let entries = entriesRes.data ?? [];
  const allocations = allocationsRes.data ?? [];
  const processes = processesRes.data ?? [];
  const brands = brandsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];

  // Filter by view
  if (view === 'pod' && id) {
    employees = employees.filter((e: any) => e.pod_id === id);
    const empIds = new Set(employees.map((e: any) => e.id));
    entries = entries.filter((e: any) => empIds.has(e.employee_id));
  } else if (view === 'brand' && id) {
    const brandProcessIds = processes
      .filter((p: any) => p.brand_id === id)
      .map((p: any) => p.id);
    const empIds = new Set(
      assignments
        .filter((a: any) => brandProcessIds.includes(a.process_id))
        .map((a: any) => a.employee_id),
    );
    employees = employees.filter((e: any) => empIds.has(e.id));
    entries = entries.filter((e: any) => empIds.has(e.employee_id));
  } else if (view === 'process' && id) {
    const empIds = new Set(
      assignments.filter((a: any) => a.process_id === id).map((a: any) => a.employee_id),
    );
    employees = employees.filter((e: any) => empIds.has(e.id));
    entries = entries.filter((e: any) => empIds.has(e.employee_id));
  } else if (view === 'employee' && id) {
    employees = employees.filter((e: any) => e.id === id);
    entries = entries.filter((e: any) => e.employee_id === id);
  }

  return NextResponse.json({ employees, entries, allocations, processes, brands, assignments });
}

