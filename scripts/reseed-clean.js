const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function reseedClean() {
  console.log('--- 1. CLEARING ALL DATABASE TABLES ---');
  
  await supabase.from('allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('roster_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comp_off_credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('leaves').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('processes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('holidays').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  await supabase.from('pods').update({ lead_employee_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pods').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Tables cleared.');

  console.log('--- 2. INSERTING CLEAN, MINIMAL DEMO DATA ---');

  // 1. Pods (2 pods: Alpha and Beta)
  const podsData = [
    { id: '00000001-0000-0001-0000-000000000000', name: 'Pod Alpha', lead_employee_id: null },
    { id: '00000002-0000-0001-0000-000000000000', name: 'Pod Beta', lead_employee_id: null },
  ];
  await supabase.from('pods').insert(podsData);

  // 2. Employees (8 staff members)
  const empData = [
    // Pod Alpha
    { id: '00000001-0000-0002-0000-000000000000', name: 'Arjun Mehta', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 3 }, // Wed
    { id: '00000002-0000-0002-0000-000000000000', name: 'Kavya Joshi', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 2 }, // Tue
    { id: '00000003-0000-0002-0000-000000000000', name: 'Priya Sharma', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 1 }, // Mon
    { id: '00000004-0000-0002-0000-000000000000', name: 'Rohan Varma', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 4 }, // Thu (Floater)
    // Pod Beta
    { id: '00000005-0000-0002-0000-000000000000', name: 'Rahul Nair', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 1 }, // Mon (Spectra, no backup)
    { id: '00000006-0000-0002-0000-000000000000', name: 'Sneha Patel', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 3 }, // Wed
    { id: '00000007-0000-0002-0000-000000000000', name: 'Vikram Singh', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 5 }, // Fri
    { id: '00000008-0000-0002-0000-000000000000', name: 'Nisha Tiwari', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 0 }, // Sun (MoonLight)
  ];
  await supabase.from('employees').insert(empData);

  // Set Pod leads
  await supabase.from('pods').update({ lead_employee_id: empData[0].id }).eq('id', podsData[0].id);
  await supabase.from('pods').update({ lead_employee_id: empData[4].id }).eq('id', podsData[1].id);

  // 3. Brands (5 brands)
  const brandsData = [
    { id: '00000001-0000-0003-0000-000000000000', name: 'Glowvia' },
    { id: '00000002-0000-0003-0000-000000000001', name: 'Spectra' },
    { id: '00000003-0000-0003-0000-000000000002', name: 'LuxeCore' },
    { id: '00000004-0000-0003-0000-000000000003', name: 'MoonLight' },
    { id: '00000005-0000-0003-0000-000000000004', name: 'SwiftPulse' },
  ];
  await supabase.from('brands').insert(brandsData);

  // 4. Processes (7 processes)
  const procData = [
    // Glowvia CS (365 days, min staff 1)
    { id: '00000001-0000-0004-0000-000000000000', brand_id: brandsData[0].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    // Spectra CS (365 days, min staff 1, NO BACKUP)
    { id: '00000002-0000-0004-0000-000000000001', brand_id: brandsData[1].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    // LuxeCore (3 processes: CS, ACC, NDR)
    { id: '00000003-0000-0004-0000-000000000002', brand_id: brandsData[2].id, name: 'CS', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000004-0000-0004-0000-000000000003', brand_id: brandsData[2].id, name: 'ACC', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000005-0000-0004-0000-000000000004', brand_id: brandsData[2].id, name: 'NDR', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    // MoonLight CS (Sunday-off brand)
    { id: '00000006-0000-0004-0000-000000000005', brand_id: brandsData[3].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    // SwiftPulse CS (Kavya's primary brand, works Sundays, off Tuesdays)
    { id: '00000007-0000-0004-0000-000000000006', brand_id: brandsData[4].id, name: 'CS', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
  ];
  await supabase.from('processes').insert(procData);

  // 5. Assignments
  const assignData = [
    // Glowvia: Arjun PRIMARY 1.0 (pref Wed), Kavya BACKUP 0.5 (pref Tue, Pod Alpha)
    { employee_id: empData[0].id, process_id: procData[0].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[1].id, process_id: procData[0].id, role: 'BACKUP', weight: 0.5 },

    // Spectra: Rahul Nair PRIMARY only (NO backup!)
    { employee_id: empData[4].id, process_id: procData[1].id, role: 'PRIMARY', weight: 1.0 },

    // LuxeCore: Priya CS (Mon), Sneha ACC (Wed), Vikram NDR (Fri) + Rohan Varma as backup
    { employee_id: empData[2].id, process_id: procData[2].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[3].id, process_id: procData[2].id, role: 'BACKUP', weight: 1.0 },
    { employee_id: empData[5].id, process_id: procData[3].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[3].id, process_id: procData[3].id, role: 'BACKUP', weight: 1.0 },
    { employee_id: empData[6].id, process_id: procData[4].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[3].id, process_id: procData[4].id, role: 'BACKUP', weight: 1.0 },

    // MoonLight: Nisha Tiwari PRIMARY (pref Sun)
    { employee_id: empData[7].id, process_id: procData[5].id, role: 'PRIMARY', weight: 1.0 },

    // SwiftPulse: Kavya PRIMARY 0.5 + Rohan BACKUP 0.5
    { employee_id: empData[1].id, process_id: procData[6].id, role: 'PRIMARY', weight: 0.5 },
    { employee_id: empData[3].id, process_id: procData[6].id, role: 'BACKUP', weight: 0.5 },
  ];
  await supabase.from('assignments').insert(assignData);

  // 6. Holidays (4 in December 2026; Dec 6 clean)
  const holidaysData = [
    { id: '00000001-0000-0005-0000-000000000000', date: '2026-12-11', name: 'Pod Beta Holiday', applies_to_all: false, pod_ids: [podsData[1].id] },
    { id: '00000002-0000-0005-0000-000000000000', date: '2026-12-20', name: 'Weekend-coinciding Holiday', applies_to_all: true, pod_ids: null },
    { id: '00000003-0000-0005-0000-000000000000', date: '2026-12-24', name: 'Company Holiday', applies_to_all: true, pod_ids: null },
    { id: '00000004-0000-0005-0000-000000000000', date: '2026-12-25', name: 'Christmas', applies_to_all: true, pod_ids: null },
  ];
  await supabase.from('holidays').insert(holidaysData);

  // 7. Leaves (2 clean leaves, neither on Dec 2 or Dec 6 for demo people)
  const leavesData = [
    { employee_id: empData[2].id, date: '2026-12-15', type: 'LEAVE' }, // Priya (LuxeCore CS)
    { employee_id: empData[5].id, date: '2026-12-08', type: 'LEAVE' }, // Sneha (LuxeCore ACC)
  ];
  await supabase.from('leaves').insert(leavesData);

  console.log('--- CLEAN DEMO SEED COMPLETED SUCCESSFULLY ---');
  console.log('Pods: 2 | Employees: 8 | Brands: 5 | Processes: 7 | Assignments: 11 | Holidays: 4 | Leaves: 2');
}

reseedClean().catch(err => {
  console.error('Reseed clean error:', err);
});

