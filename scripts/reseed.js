const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function reseed() {
  console.log('--- 1. CLEARING EXISTING DATABASE TABLES ---');
  
  await supabase.from('allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('roster_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('comp_off_credits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('leaves').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('processes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('holidays').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Unlink pod leads first to avoid circular FK
  await supabase.from('pods').update({ lead_employee_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('pods').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('All tables cleared.');

  console.log('--- 2. INSERTING NEW DEMO SEED DATA ---');

  // 1. Pods
  const podsData = [
    { id: '00000001-0000-0001-0000-000000000000', name: 'Pod A', lead_employee_id: null },
    { id: '00000002-0000-0001-0000-000000000000', name: 'Pod B', lead_employee_id: null },
    { id: '00000003-0000-0001-0000-000000000000', name: 'Pod C', lead_employee_id: null },
    { id: '00000004-0000-0001-0000-000000000000', name: 'Pod D', lead_employee_id: null },
  ];
  await supabase.from('pods').insert(podsData);

  // 2. Employees (34)
  const empData = [
    // Pod A (9)
    { id: '00000001-0000-0002-0000-000000000000', name: 'Amit Kumar', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: null },
    { id: '00000002-0000-0002-0000-000000000000', name: 'Priya Sharma', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 1 },
    { id: '00000003-0000-0002-0000-000000000000', name: 'Rahul Verma', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 3 },
    { id: '00000004-0000-0002-0000-000000000000', name: 'Sneha Patel', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 5 },
    { id: '00000005-0000-0002-0000-000000000000', name: 'Vikram Singh', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 6 },
    { id: '00000006-0000-0002-0000-000000000000', name: 'Deepa Nair', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: null },
    { id: '00000007-0000-0002-0000-000000000000', name: 'Arjun Mehta', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 3 }, // Wed
    { id: '00000008-0000-0002-0000-000000000000', name: 'Kavya Joshi', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: 2 }, // Tue
    { id: '00000009-0000-0002-0000-000000000000', name: 'Rahul Nair', pod_id: podsData[0].id, daily_capacity: 1.0, preferred_off_day: null },
    // Pod B (9)
    { id: '0000000a-0000-0002-0000-000000000000', name: 'Sana Khan', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '0000000b-0000-0002-0000-000000000000', name: 'Mohit Gupta', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: null },
    { id: '0000000c-0000-0002-0000-000000000000', name: 'Aisha Reddy', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: null },
    { id: '0000000d-0000-0002-0000-000000000000', name: 'Nikhil Roy', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '0000000e-0000-0002-0000-000000000000', name: 'Pooja Iyer', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 4 },
    { id: '0000000f-0000-0002-0000-000000000000', name: 'Karan Malhotra', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 3 },
    { id: '00000010-0000-0002-0000-000000000000', name: 'Meera Chopra', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 2 },
    { id: '00000011-0000-0002-0000-000000000000', name: 'Ravi Pillai', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000012-0000-0002-0000-000000000000', name: 'Divya Saxena', pod_id: podsData[1].id, daily_capacity: 1.0, preferred_off_day: 0 },
    // Pod C (8)
    { id: '00000013-0000-0002-0000-000000000000', name: 'Dev Kapoor', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000014-0000-0002-0000-000000000000', name: 'Anjali Bose', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000015-0000-0002-0000-000000000000', name: 'Suresh Menon', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000016-0000-0002-0000-000000000000', name: 'Nisha Tiwari', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 }, // Sun
    { id: '00000017-0000-0002-0000-000000000000', name: 'Pranav Desai', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000018-0000-0002-0000-000000000000', name: 'Swati Kulkarni', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000019-0000-0002-0000-000000000000', name: 'Aarav Shah', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '0000001a-0000-0002-0000-000000000000', name: 'Ritika Jain', pod_id: podsData[2].id, daily_capacity: 1.0, preferred_off_day: null },
    // Pod D (8)
    { id: '0000001b-0000-0002-0000-000000000000', name: 'Leela Nambiar', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: 2 },
    { id: '0000001c-0000-0002-0000-000000000000', name: 'Farhan Sheikh', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '0000001d-0000-0002-0000-000000000000', name: 'Tanvi Bhatt', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '0000001e-0000-0002-0000-000000000000', name: 'Yusuf Ahmed', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '0000001f-0000-0002-0000-000000000000', name: 'Shweta Pandey', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: 0 },
    { id: '00000020-0000-0002-0000-000000000000', name: 'Kabir Raza', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: null },
    { id: '00000021-0000-0002-0000-000000000000', name: 'Preethi Ramaswamy', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: null },
    { id: '00000022-0000-0002-0000-000000000000', name: 'Vinay Krishnaswamy', pod_id: podsData[3].id, daily_capacity: 1.0, preferred_off_day: null },
  ];
  await supabase.from('employees').insert(empData);

  // Set Pod leads
  await supabase.from('pods').update({ lead_employee_id: empData[0].id }).eq('id', podsData[0].id);
  await supabase.from('pods').update({ lead_employee_id: empData[9].id }).eq('id', podsData[1].id);
  await supabase.from('pods').update({ lead_employee_id: empData[18].id }).eq('id', podsData[2].id);
  await supabase.from('pods').update({ lead_employee_id: empData[26].id }).eq('id', podsData[3].id);

  // 3. Brands (25)
  const brandsData = [
    { id: '00000001-0000-0003-0000-000000000000', name: 'Glowvia' },
    { id: '00000002-0000-0003-0000-000000000001', name: 'Spectra' },
    { id: '00000003-0000-0003-0000-000000000002', name: 'LuxeCore' },
    { id: '00000004-0000-0003-0000-000000000003', name: 'PulseX' },
    { id: '00000005-0000-0003-0000-000000000004', name: 'ArcLight' },
    { id: '00000006-0000-0003-0000-000000000005', name: 'ZenBrand' },
    { id: '00000007-0000-0003-0000-000000000006', name: 'SkyReach' },
    { id: '00000008-0000-0003-0000-000000000007', name: 'NovaCom' },
    { id: '00000009-0000-0003-0000-000000000008', name: 'BrightPath' },
    { id: '0000000a-0000-0003-0000-000000000009', name: 'ClearView' },
    { id: '0000000b-0000-0003-0000-00000000000a', name: 'ApexCare' },
    { id: '0000000c-0000-0003-0000-00000000000b', name: 'ZenithLine' },
    { id: '0000000d-0000-0003-0000-00000000000c', name: 'SwiftPulse' }, // Kavya's brand
    { id: '0000000e-0000-0003-0000-00000000000d', name: 'SwiftServe' },
    { id: '0000000f-0000-0003-0000-00000000000e', name: 'RaviAlpha' },
    { id: '00000010-0000-0003-0000-00000000000f', name: 'RaviBeta' },
    { id: '00000011-0000-0003-0000-000000000010', name: 'Streamline' },
    { id: '00000012-0000-0003-0000-000000000011', name: 'GreenLeaf' },
    { id: '00000013-0000-0003-0000-000000000012', name: 'MoonLight' },
    { id: '00000014-0000-0003-0000-000000000013', name: 'StarRise' },
    { id: '00000015-0000-0003-0000-000000000014', name: 'BluePeak' },
    { id: '00000016-0000-0003-0000-000000000015', name: 'SilverLine' },
    { id: '00000017-0000-0003-0000-000000000016', name: 'RiverFlow' },
    { id: '00000018-0000-0003-0000-000000000017', name: 'SunGlow' },
    { id: '00000019-0000-0003-0000-000000000018', name: 'IronClad' },
  ];
  await supabase.from('brands').insert(brandsData);

  // 4. Processes
  const procData = [
    { id: '00000001-0000-0004-0000-000000000000', brand_id: brandsData[0].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '00000002-0000-0004-0000-000000000001', brand_id: brandsData[1].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '00000003-0000-0004-0000-000000000002', brand_id: brandsData[2].id, name: 'CS', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000004-0000-0004-0000-000000000003', brand_id: brandsData[2].id, name: 'ACC', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000005-0000-0004-0000-000000000004', brand_id: brandsData[2].id, name: 'NDR', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000006-0000-0004-0000-000000000005', brand_id: brandsData[3].id, name: 'CS', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: { "0": 2, "6": 2 } },
    { id: '00000007-0000-0004-0000-000000000006', brand_id: brandsData[4].id, name: 'CS', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000008-0000-0004-0000-000000000007', brand_id: brandsData[4].id, name: 'NDR', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000009-0000-0004-0000-000000000008', brand_id: brandsData[5].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000000a-0000-0004-0000-000000000009', brand_id: brandsData[5].id, name: 'ACC', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000000b-0000-0004-0000-00000000000a', brand_id: brandsData[6].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '0000000c-0000-0004-0000-00000000000b', brand_id: brandsData[6].id, name: 'NDR', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000000d-0000-0004-0000-00000000000c', brand_id: brandsData[7].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '0000000e-0000-0004-0000-00000000000d', brand_id: brandsData[8].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '0000000f-0000-0004-0000-00000000000e', brand_id: brandsData[9].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '00000010-0000-0004-0000-00000000000f', brand_id: brandsData[10].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '00000011-0000-0004-0000-000000000010', brand_id: brandsData[11].id, name: 'CS', calendar_rule: 'ALL_DAYS_365', min_staff: 1, min_staff_overrides: {} },
    { id: '00000012-0000-0004-0000-000000000011', brand_id: brandsData[12].id, name: 'CS', calendar_rule: 'ALL_EXCEPT_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000013-0000-0004-0000-000000000012', brand_id: brandsData[13].id, name: 'NDR', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000014-0000-0004-0000-000000000013', brand_id: brandsData[14].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000015-0000-0004-0000-000000000014', brand_id: brandsData[15].id, name: 'ACC', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000016-0000-0004-0000-000000000015', brand_id: brandsData[16].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000017-0000-0004-0000-000000000016', brand_id: brandsData[17].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000018-0000-0004-0000-000000000017', brand_id: brandsData[18].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '00000019-0000-0004-0000-000000000018', brand_id: brandsData[19].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000001a-0000-0004-0000-000000000019', brand_id: brandsData[20].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000001b-0000-0004-0000-00000000001a', brand_id: brandsData[21].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000001c-0000-0004-0000-00000000001b', brand_id: brandsData[22].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000001d-0000-0004-0000-00000000001c', brand_id: brandsData[23].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
    { id: '0000001e-0000-0004-0000-00000000001d', brand_id: brandsData[24].id, name: 'CS', calendar_rule: 'EXCEPT_SUNDAYS_AND_HOLIDAYS', min_staff: 1, min_staff_overrides: {} },
  ];
  await supabase.from('processes').insert(procData);

  // 5. Assignments
  const assignData = [
    // Glowvia: Arjun PRIMARY 1.0 (pref 3), Kavya BACKUP 0.5 (pref 2)
    { employee_id: empData[6].id, process_id: procData[0].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[7].id, process_id: procData[0].id, role: 'BACKUP', weight: 0.5 },
    // Kavya's own brand SwiftPulse: Kavya PRIMARY 0.5 (pref 2) + Vinay BACKUP 0.5
    { employee_id: empData[7].id, process_id: procData[17].id, role: 'PRIMARY', weight: 0.5 },
    { employee_id: empData[33].id, process_id: procData[17].id, role: 'BACKUP', weight: 0.5 },
    // Spectra: Rahul Nair PRIMARY only (NO backup)
    { employee_id: empData[8].id, process_id: procData[1].id, role: 'PRIMARY', weight: 1.0 },
    // LuxeCore: Priya CS, Rahul ACC, Sneha NDR + floater backups
    { employee_id: empData[1].id, process_id: procData[2].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[25].id, process_id: procData[2].id, role: 'BACKUP', weight: 1.0 },
    { employee_id: empData[2].id, process_id: procData[3].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[32].id, process_id: procData[3].id, role: 'BACKUP', weight: 1.0 },
    { employee_id: empData[3].id, process_id: procData[4].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[33].id, process_id: procData[4].id, role: 'BACKUP', weight: 1.0 },
    // PulseX: Vikram & Deepa
    { employee_id: empData[4].id, process_id: procData[5].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[5].id, process_id: procData[5].id, role: 'PRIMARY', weight: 1.0 },
    // ArcLight: Mohit & Aisha CS, Nikhil NDR, Ritika NDR Backup
    { employee_id: empData[10].id, process_id: procData[6].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[11].id, process_id: procData[6].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[12].id, process_id: procData[7].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[25].id, process_id: procData[7].id, role: 'BACKUP', weight: 1.0 },
    // ZenBrand: Dev CS, Anjali ACC
    { employee_id: empData[18].id, process_id: procData[8].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[19].id, process_id: procData[9].id, role: 'PRIMARY', weight: 1.0 },
    // SkyReach (365): Leela PRIMARY, Vinay BACKUP; Farhan NDR
    { employee_id: empData[26].id, process_id: procData[10].id, role: 'PRIMARY', weight: 1.0 },
    { employee_id: empData[33].id, process_id: procData[10].id, role: 'BACKUP', weight: 1.0 },
    { employee_id: empData[27].id, process_id: procData[11].id, role: 'PRIMARY', weight: 1.0 },
    // Other 365 brands (all have dedicated floater backups so ONLY Spectra lacks one):
    { employee_id: empData[0].id, process_id: procData[12].id, role: 'PRIMARY', weight: 1.0 },  // NovaCom: Amit
    { employee_id: empData[25].id, process_id: procData[12].id, role: 'BACKUP', weight: 1.0 },  // Ritika
    { employee_id: empData[13].id, process_id: procData[13].id, role: 'PRIMARY', weight: 1.0 }, // BrightPath: Pooja
    { employee_id: empData[32].id, process_id: procData[13].id, role: 'BACKUP', weight: 1.0 },  // Preethi
    { employee_id: empData[14].id, process_id: procData[14].id, role: 'PRIMARY', weight: 1.0 }, // ClearView: Karan
    { employee_id: empData[32].id, process_id: procData[14].id, role: 'BACKUP', weight: 1.0 },  // Preethi
    { employee_id: empData[15].id, process_id: procData[15].id, role: 'PRIMARY', weight: 1.0 }, // ApexCare: Meera
    { employee_id: empData[33].id, process_id: procData[15].id, role: 'BACKUP', weight: 1.0 },  // Vinay
    { employee_id: empData[31].id, process_id: procData[16].id, role: 'PRIMARY', weight: 1.0 }, // ZenithLine: Kabir
    { employee_id: empData[25].id, process_id: procData[16].id, role: 'BACKUP', weight: 1.0 },  // Ritika
    // Non-365 single brands:
    { employee_id: empData[9].id, process_id: procData[18].id, role: 'PRIMARY', weight: 1.0 },  // SwiftServe
    { employee_id: empData[16].id, process_id: procData[19].id, role: 'PRIMARY', weight: 0.5 }, // RaviAlpha
    { employee_id: empData[16].id, process_id: procData[20].id, role: 'PRIMARY', weight: 0.5 }, // RaviBeta
    { employee_id: empData[17].id, process_id: procData[21].id, role: 'PRIMARY', weight: 1.0 }, // Streamline
    { employee_id: empData[20].id, process_id: procData[22].id, role: 'PRIMARY', weight: 1.0 }, // GreenLeaf
    { employee_id: empData[21].id, process_id: procData[23].id, role: 'PRIMARY', weight: 1.0 }, // MoonLight (Sunday-off)
    { employee_id: empData[22].id, process_id: procData[24].id, role: 'PRIMARY', weight: 1.0 }, // StarRise
    { employee_id: empData[23].id, process_id: procData[25].id, role: 'PRIMARY', weight: 1.0 }, // BluePeak
    { employee_id: empData[24].id, process_id: procData[26].id, role: 'PRIMARY', weight: 1.0 }, // SilverLine
    { employee_id: empData[28].id, process_id: procData[27].id, role: 'PRIMARY', weight: 1.0 }, // RiverFlow
    { employee_id: empData[29].id, process_id: procData[28].id, role: 'PRIMARY', weight: 1.0 }, // SunGlow
    { employee_id: empData[30].id, process_id: procData[29].id, role: 'PRIMARY', weight: 1.0 }, // IronClad
  ];
  await supabase.from('assignments').insert(assignData);

  // 6. Holidays (4 for December 2026; Dec 6 clean)
  const holidaysData = [
    { id: '00000001-0000-0005-0000-000000000000', date: '2026-12-11', name: 'Pod Holiday', applies_to_all: false, pod_ids: [podsData[1].id] },
    { id: '00000002-0000-0005-0000-000000000000', date: '2026-12-20', name: 'Weekend-coinciding Holiday', applies_to_all: true, pod_ids: null },
    { id: '00000003-0000-0005-0000-000000000000', date: '2026-12-24', name: 'Company Holiday', applies_to_all: true, pod_ids: null },
    { id: '00000004-0000-0005-0000-000000000000', date: '2026-12-25', name: 'Christmas', applies_to_all: true, pod_ids: null },
  ];
  await supabase.from('holidays').insert(holidaysData);

  // 7. Leaves (6 records; none on Dec 2 or Dec 6 for Arjun, Kavya, or Rahul)
  const leavesData = [
    { employee_id: empData[10].id, date: '2026-12-15', type: 'LEAVE' }, // Mohit (ArcLight CS, Aisha covers)
    { employee_id: empData[11].id, date: '2026-12-01', type: 'LEAVE' }, // Aisha (ArcLight CS, Mohit covers)
    { employee_id: empData[5].id,  date: '2026-12-08', type: 'LEAVE' }, // Deepa (PulseX CS, Vikram covers)
    { employee_id: empData[4].id,  date: '2026-12-23', type: 'LEAVE' }, // Vikram (PulseX CS, Deepa covers)
    { employee_id: empData[32].id, date: '2026-12-22', type: 'LEAVE' }, // Preethi (Floater)
    { employee_id: empData[33].id, date: '2026-12-28', type: 'LEAVE' }, // Vinay (Floater)
  ];
  await supabase.from('leaves').insert(leavesData);

  console.log('--- SEED COMPLETED SUCCESSFULLY ---');
}

reseed().catch(err => {
  console.error('Reseed error:', err);
});

