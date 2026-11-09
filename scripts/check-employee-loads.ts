import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

async function run() {
  const { loadEngineInput } = await import('../src/lib/data');
  const input = await loadEngineInput('2026-12');

  for (const emp of input.employees) {
    const assigns = input.assignments.filter(a => a.employeeId === emp.id);
    const prims = assigns.filter(a => a.role === 'PRIMARY');
    const backs = assigns.filter(a => a.role === 'BACKUP');
    const primWeight = prims.reduce((sum, a) => sum + a.weight, 0);
    const backWeight = backs.reduce((sum, a) => sum + a.weight, 0);
    console.log(`${emp.name.padEnd(20)} | Cap: ${emp.dailyCapacity} | PrimWeight: ${primWeight} | BackWeight: ${backWeight} | Assignments: ${assigns.length}`);
  }
}

run();

