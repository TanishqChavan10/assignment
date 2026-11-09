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
  const week1 = weeks[0];

  // Primary assignments map
  const primaryAssignments = new Map();
  for (const a of input.assignments) {
    if (a.role === 'PRIMARY') {
      const list = primaryAssignments.get(a.employeeId) ?? [];
      list.push(a);
      primaryAssignments.set(a.employeeId, list);
    }
  }

  // Find employees with 0 candidates in week 1
  for (const emp of input.employees) {
    const empPrimaryAssignments = primaryAssignments.get(emp.id) ?? [];
    let candidates = [];
    for (const date of week1) {
      let viable = true;
      for (const assignment of empPrimaryAssignments) {
        const proc = input.processes.find(p => p.id === assignment.processId);
        if (!isProcessRequired(proc, date, input.holidays)) continue;
        const needed = getMinStaff(proc, date);
        // Assuming no other primary
        const otherPrimaries = input.assignments.filter(
          a => a.processId === proc.id && a.role === 'PRIMARY' && a.employeeId !== emp.id
        );
        if (otherPrimaries.length < needed) {
          viable = false;
          break;
        }
      }
      if (viable) candidates.push(date);
    }
    console.log(`Emp: ${emp.name.padEnd(16)} | Primaries: ${empPrimaryAssignments.length} | Candidates: ${candidates.length}`);
  }
}

run();

