const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function runVerification() {
  console.log('====================================================');
  console.log('RUNNING VERIFICATION QUERIES (SECTION 3 OF CHECKLIST)');
  console.log('====================================================\n');

  // Query 1: Glowvia
  console.log('--- Query 1: Glowvia: primary and backup, same pod, roles and weights ---');
  const { data: glowviaBrand } = await supabase.from('brands').select('id').eq('name', 'Glowvia').single();
  const { data: glowviaProc } = await supabase.from('processes').select('id').eq('brand_id', glowviaBrand.id).single();
  const { data: q1 } = await supabase
    .from('assignments')
    .select('role, weight, employees(name, pod_id, daily_capacity, preferred_off_day)')
    .eq('process_id', glowviaProc.id);

  q1.forEach(r => {
    console.log(`  ${r.employees.name} | Role: ${r.role} | Weight: ${r.weight} | Pod: ${r.employees.pod_id} | Cap: ${r.employees.daily_capacity} | PrefOff: ${r.employees.preferred_off_day}`);
  });
  console.log('  Expect: Arjun Mehta PRIMARY 1.0 (pref 3), Kavya Joshi BACKUP 0.5 (pref 2), same pod_id\n');

  // Query 2: Kavya's capacity
  console.log("--- Query 2: Kavya's capacity: total weight must be <= her capacity ---");
  const { data: kavyaEmp } = await supabase.from('employees').select('id, name, daily_capacity').eq('name', 'Kavya Joshi').single();
  const { data: q2 } = await supabase
    .from('assignments')
    .select('role, weight, processes(name, brands(name))')
    .eq('employee_id', kavyaEmp.id);

  let totalWeight = 0;
  q2.forEach(r => {
    totalWeight += parseFloat(r.weight);
    console.log(`  Assigned to: ${r.processes.brands.name} (${r.processes.name}) | Role: ${r.role} | Weight: ${r.weight}`);
  });
  console.log(`  Total Weight: ${totalWeight} | Daily Capacity: ${kavyaEmp.daily_capacity}`);
  console.log('  Expect: total_weight 1.0, capacity 1.0\n');

  // Query 3: Spectra: one primary, no backup
  console.log('--- Query 3: Spectra: one primary, no backup ---');
  const { data: spectraBrand } = await supabase.from('brands').select('id').eq('name', 'Spectra').single();
  const { data: spectraProc } = await supabase.from('processes').select('id').eq('brand_id', spectraBrand.id).single();
  const { data: q3 } = await supabase
    .from('assignments')
    .select('role, weight, employees(name)')
    .eq('process_id', spectraProc.id);

  q3.forEach(r => {
    console.log(`  ${r.employees.name} | Role: ${r.role} | Weight: ${r.weight}`);
  });
  console.log('  Expect: exactly one row, role PRIMARY\n');

  // Query 4: Holidays
  console.log('--- Query 4: Holidays (no holiday on 2026-12-06) ---');
  const { data: q4 } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', '2026-12-01')
    .lte('date', '2026-12-31')
    .order('date');
  q4.forEach(r => console.log(`  ${r.date} | ${r.name} | Applies to all: ${r.applies_to_all}`));
  const hasDec6 = q4.some(r => r.date === '2026-12-06');
  console.log(`  Dec 6 free of holidays: ${!hasDec6}`);
  console.log('  Expect: 4 rows, none on 2026-12-06\n');

  // Query 5: 365-day single-primary processes without a backup (should be Spectra only)
  console.log('--- Query 5: 365-day single-primary processes without a backup ---');
  const { data: all365Procs } = await supabase
    .from('processes')
    .select('id, name, calendar_rule, brands(name)')
    .eq('calendar_rule', 'ALL_DAYS_365');
  
  const { data: allAssignments } = await supabase.from('assignments').select('*');
  
  const noBackup365 = [];
  for (const p of all365Procs) {
    const assigns = allAssignments.filter(a => a.process_id === p.id);
    const primaries = assigns.filter(a => a.role === 'PRIMARY');
    const backups = assigns.filter(a => a.role === 'BACKUP');
    if (primaries.length === 1 && backups.length === 0) {
      noBackup365.push({ brand: p.brands.name, process: p.name });
    }
  }
  console.log('  Found single-primary 365 processes without backup:', noBackup365);
  console.log('  Expect: exactly one row: Spectra\n');

  // Query 6: Leaves clean on 2026-12-02 & 2026-12-06 for Arjun, Kavya, Rahul
  console.log('--- Query 6: Leaves clean on 2026-12-02 & 2026-12-06 for Arjun, Kavya, Rahul ---');
  const { data: demoEmps } = await supabase.from('employees').select('id, name').in('name', ['Arjun Mehta', 'Kavya Joshi', 'Rahul Nair']);
  const demoEmpIds = demoEmps.map(e => e.id);
  const { data: q6 } = await supabase
    .from('leaves')
    .select('date, type, employee_id')
    .in('employee_id', demoEmpIds)
    .in('date', ['2026-12-02', '2026-12-06']);
  console.log(`  Conflicting demo leaves found: ${q6.length}`);
  console.log('  Expect: zero rows\n');

  // Query 7: Totals
  console.log('--- Query 7: Totals ---');
  const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
  const { count: brandCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
  const { count: holidayCount } = await supabase.from('holidays').select('*', { count: 'exact', head: true });
  const { count: leaveCount } = await supabase.from('leaves').select('*', { count: 'exact', head: true });
  console.log(`  Employees: ${empCount} (Expect 34)`);
  console.log(`  Brands: ${brandCount} (Expect 25)`);
  console.log(`  Holidays: ${holidayCount} (Expect 4)`);
  console.log(`  Leaves: ${leaveCount} (Expect 6)`);
  console.log('====================================================\n');
}

runVerification();
