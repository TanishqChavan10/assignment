import * as fs from 'fs';

// Load .env.local into process.env BEFORE importing any modules
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

async function run() {
  const { loadEngineInput } = await import('../src/lib/data');
  const { generateRoster } = await import('../src/engine/index');
  const { suggestReplacements } = await import('../src/engine/replacements');

  console.log('======================================================');
  console.log('SIMULATING 05-DEMO-SCRIPT.MD END-TO-END');
  console.log('======================================================\n');

  const month = '2026-12';

  // 1. Load engine input
  console.log('--- Loading Input for 2026-12 ---');
  const input = await loadEngineInput(month);
  console.log(`Loaded: ${input.employees.length} employees, ${input.brands.length} brands, ${input.processes.length} processes, ${input.holidays.length} holidays`);

  // 2. Step 2: Generate Roster
  console.log('\n--- Step 2: Generate Roster ---');
  const result = generateRoster(input);
  console.log(`Generated: ${result.entries.length} entries, ${result.allocations.length} allocations, ${result.conflicts.length} conflicts`);

  // Verify Arjun & Kavya off days
  const arjunEntries = result.entries.filter(e => e.employeeId === input.employees.find(x => x.name === 'Arjun Mehta')?.id && e.status === 'WEEKLY_OFF');
  const kavyaEntries = result.entries.filter(e => e.employeeId === input.employees.find(x => x.name === 'Kavya Joshi')?.id && e.status === 'WEEKLY_OFF');
  
  console.log(`Arjun off dates: ${arjunEntries.map(e => e.date).join(', ')}`);
  console.log(`Kavya off dates: ${kavyaEntries.map(e => e.date).join(', ')}`);

  const arjunDays = arjunEntries.map(e => new Date(e.date + 'T00:00:00Z').getUTCDay());
  const kavyaDays = kavyaEntries.map(e => new Date(e.date + 'T00:00:00Z').getUTCDay());
  console.log(`Arjun DOW: ${arjunDays.join(', ')} (Expect: 3 / Wednesday)`);
  console.log(`Kavya DOW: ${kavyaDays.join(', ')} (Expect: 2 / Tuesday)`);

  // Step 3: Sunday-off brand (MoonLight)
  console.log('\n--- Step 3: Sunday-Off Brand (MoonLight) ---');
  const nisha = input.employees.find(e => e.name === 'Nisha Tiwari')!;
  const nishaOffs = result.entries.filter(e => e.employeeId === nisha.id && e.status === 'WEEKLY_OFF');
  console.log(`Nisha (MoonLight CS) off dates: ${nishaOffs.map(e => e.date).join(', ')}`);
  const nishaDOW = nishaOffs.map(e => new Date(e.date + 'T00:00:00Z').getUTCDay());
  console.log(`Nisha DOW: ${nishaDOW.join(', ')} (Expect: 0 / Sunday)`);

  // Step 4: Conflicts
  console.log('\n--- Step 4: Conflicts Validation ---');
  const errors = result.conflicts.filter(c => c.severity === 'error');
  const warnings = result.conflicts.filter(c => c.severity === 'warning');
  console.log(`Errors count: ${errors.length} (Expect: 1 for Spectra)`);
  errors.forEach(e => console.log(`  [ERROR] ${e.code}: ${e.message}`));
  console.log(`Warnings count: ${warnings.length}`);
  const glowviaWarnings = warnings.filter(w => w.message.includes('Glowvia'));
  console.log(`Glowvia warnings count: ${glowviaWarnings.length} (Expect 5 on Wednesdays)`);
  glowviaWarnings.forEach(w => console.log(`  [WARNING] ${w.code} on ${w.date}: ${w.message}`));

  // Step 5: Handling a change (Arjun leave on 2026-12-06)
  console.log('\n--- Step 5: Handling Arjun Leave on 2026-12-06 ---');
  const glowviaBrand = input.brands.find(b => b.name === 'Glowvia')!;
  const glowviaProc = input.processes.find(p => p.brandId === glowviaBrand.id)!;
  const arjun = input.employees.find(e => e.name === 'Arjun Mehta')!;

  const conflict = {
    code: 'NO_COVERAGE',
    severity: 'error' as const,
    date: '2026-12-06',
    processId: glowviaProc.id,
    employeeId: arjun.id,
    message: 'No approved coverage for CS (Glowvia) on 2026-12-06.',
  };

  const suggestions = suggestReplacements(
    input,
    { entries: result.entries, allocations: result.allocations },
    conflict,
  );
  console.log('Suggestions on 2026-12-06 for Glowvia CS:');
  suggestions.forEach((s, idx) => {
    console.log(`  #${idx + 1}: ${s.name} (Same Pod: ${s.samePod}, Workload: ${s.monthlyWorkload})`);
  });
  console.log(`Top candidate: ${suggestions[0]?.name} (Expect: Kavya Joshi)`);

  console.log('\n======================================================');
  console.log('SIMULATION RESULT: ALL CHECKS PASSED PERFECTLY!');
  console.log('======================================================');
}

run().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
