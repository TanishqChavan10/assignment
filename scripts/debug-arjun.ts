import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

async function run() {
  const { loadEngineInput } = await import('../src/lib/data');
  const { generateWeeklyOffs } = await import('../src/engine/weeklyOff');

  const input = await loadEngineInput('2026-12');
  const arjun = input.employees.find(e => e.name === 'Arjun Mehta')!;
  const res = generateWeeklyOffs(
    input.employees,
    input.processes,
    input.assignments,
    input.holidays,
    input.leaves,
    '2026-12'
  );

  const arjunAll = res.entries.filter(e => e.employeeId === arjun.id);
  console.log('Arjun entries statuses:', arjunAll.map(e => `${e.date}:${e.status}`).slice(0, 10));
  console.log('Proposed backups for Glowvia:', res.proposedBackupAllocations.filter(b => b.processId === '00000001-0000-0004-0000-000000000000'));
  console.log('Conflicts count:', res.conflicts.length);
  res.conflicts.forEach(c => console.log('Conflict:', c.code, c.message));
}

run();

