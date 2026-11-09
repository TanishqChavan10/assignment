import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

async function run() {
  const { loadEngineInput } = await import('../src/lib/data');
  const { getWeeksInMonth, getMonthDates, isProcessRequired, getMinStaff } = await import('../src/engine/calendar');

  const input = await loadEngineInput('2026-12');
  const allDates = getMonthDates('2026-12');
  const weeks = getWeeksInMonth(allDates);
  const arjun = input.employees.find(e => e.name === 'Arjun Mehta')!;
  console.log('Arjun:', arjun);

  const glowviaBrand = input.brands.find(b => b.name === 'Glowvia')!;
  const glowviaProc = input.processes.find(p => p.brandId === glowviaBrand.id)!;
  console.log('Glowvia process:', glowviaProc);

  const glowviaAssignments = input.assignments.filter(a => a.processId === glowviaProc.id);
  console.log('Glowvia assignments:', glowviaAssignments);

  // Check week 1
  const week1 = weeks[0];
  console.log('Week 1 dates:', week1);

  // For each date in week 1, what does isProcessRequired return?
  for (const d of week1) {
    const req = isProcessRequired(glowviaProc, d, input.holidays);
    const minStaff = getMinStaff(glowviaProc, d);
    console.log(`  Date ${d}: required=${req}, minStaff=${minStaff}`);
  }
}

run();

