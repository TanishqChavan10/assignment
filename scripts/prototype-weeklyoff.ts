import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

async function run() {
  const { loadEngineInput } = await import('../src/lib/data');
  const { getWeeksInMonth, getMonthDates, isProcessRequired, getMinStaff, getDayOfWeek } = await import('../src/engine/calendar');

  const input = await loadEngineInput('2026-12');
  const { employees, processes, assignments, holidays, leaves, month } = input;

  const allDates = getMonthDates(month);
  const weeks = getWeeksInMonth(allDates);

  // Primary assignments map
  const primaryAssignments = new Map();
  const backupAssignments = new Map();
  for (const a of assignments) {
    if (a.role === 'PRIMARY') {
      const list = primaryAssignments.get(a.employeeId) ?? [];
      list.push(a);
      primaryAssignments.set(a.employeeId, list);
    } else if (a.role === 'BACKUP') {
      const list = backupAssignments.get(a.processId) ?? [];
      list.push(a);
      backupAssignments.set(a.processId, list);
    }
  }

  // Pre-fill entries
  const statusMap = new Map();
  for (const emp of employees) {
    for (const date of allDates) {
      let status = 'WORKING';
      const hasLeave = leaves.some(l => l.employeeId === emp.id && l.date === date && l.type === 'LEAVE');
      const hasCompOff = leaves.some(l => l.employeeId === emp.id && l.date === date && l.type === 'COMP_OFF');
      const isHoliday = holidays.some(h => {
        if (h.date !== date) return false;
        if (h.appliesToAll) return true;
        return h.podIds?.includes(emp.podId) ?? false;
      });

      if (hasLeave) status = 'LEAVE';
      else if (hasCompOff) status = 'COMP_OFF';
      else if (isHoliday) status = 'HOLIDAY';

      statusMap.set(`${emp.id}|${date}`, status);
    }
  }

  const conflicts = [];
  const proposedBackups = [];
  const assignedOffs = new Map(); // empId|date -> true

  for (const week of weeks) {
    const weekPlacements = new Map(); // empId -> date
    const weekBackupsUsed = new Map(); // empId|date -> allocated weight

    // Process most-constrained employees first
    // Single-primary 365 employees with backups, vs multi-staff, etc.
    for (const emp of employees) {
      const empPrimaries = primaryAssignments.get(emp.id) ?? [];
      
      interface CandidateOption {
        date: string;
        backupsNeeded: any[];
      }
      const candidates: CandidateOption[] = [];

      for (const date of week) {
        const status = statusMap.get(`${emp.id}|${date}`);
        if (status !== 'WORKING') continue;

        let viable = true;
        const backupsForDay: any[] = [];

        for (const pa of empPrimaries) {
          const proc = processes.find(p => p.id === pa.processId)!;
          if (!isProcessRequired(proc, date, holidays)) continue;

          const needed = getMinStaff(proc, date);
          // Check other primaries
          const otherPrimaries = assignments.filter(
            a => a.processId === proc.id && a.role === 'PRIMARY' && a.employeeId !== emp.id
          );
          const activePrimaries = otherPrimaries.filter(a => {
            if (statusMap.get(`${a.employeeId}|${date}`) !== 'WORKING') return false;
            if (weekPlacements.get(a.employeeId) === date) return false;
            return true;
          });

          if (activePrimaries.length < needed) {
            // Need backup
            const procBackups = backupAssignments.get(proc.id) ?? [];
            const availableBackup = procBackups.find(ba => {
              if (ba.employeeId === emp.id) return false;
              if (statusMap.get(`${ba.employeeId}|${date}`) !== 'WORKING') return false;
              if (weekPlacements.get(ba.employeeId) === date) return false;
              
              const used = weekBackupsUsed.get(`${ba.employeeId}|${date}`) ?? 0;
              const backupEmp = employees.find(e => e.id === ba.employeeId)!;
              // Check if capacity allows
              if (used + ba.weight > backupEmp.dailyCapacity) return false;
              return true;
            });

            if (availableBackup) {
              backupsForDay.push({
                employeeId: availableBackup.employeeId,
                processId: proc.id,
                date,
                approved: false,
                weight: availableBackup.weight
              });
            } else {
              viable = false;
              break;
            }
          }
        }

        if (viable) {
          candidates.push({ date, backupsNeeded: backupsForDay });
        }
      }

      if (candidates.length === 0) {
        conflicts.push({
          code: 'NO_VALID_WEEKLY_OFF',
          severity: 'error',
          date: week[0],
          employeeId: emp.id,
          message: `Cannot assign a weekly off for ${emp.name} in week starting ${week[0]}. No candidate day keeps all processes covered, and no backup is available.`
        });
        continue;
      }

      // Pick candidate: prefer preferredOffDay
      let chosen = candidates.find(c => emp.preferredOffDay !== null && getDayOfWeek(c.date) === emp.preferredOffDay);
      if (!chosen) {
        chosen = candidates[0];
      }

      weekPlacements.set(emp.id, chosen.date);
      assignedOffs.set(`${emp.id}|${chosen.date}`, true);

      for (const b of chosen.backupsNeeded) {
        proposedBackups.push({
          employeeId: b.employeeId,
          processId: b.processId,
          date: b.date,
          approved: false
        });
        const prev = weekBackupsUsed.get(`${b.employeeId}|${b.date}`) ?? 0;
        weekBackupsUsed.set(`${b.employeeId}|${b.date}`, prev + b.weight);
      }
    }
  }

  console.log('--- Prototype Execution Results ---');
  console.log(`Proposed backups count: ${proposedBackups.length}`);
  console.log(`Conflicts count: ${conflicts.length}`);
  conflicts.forEach(c => console.log(`  [${c.severity.toUpperCase()}] ${c.code}: ${c.message}`));

  const arjun = employees.find(e => e.name === 'Arjun Mehta')!;
  const kavya = employees.find(e => e.name === 'Kavya Joshi')!;

  const arjunOffs = allDates.filter(d => assignedOffs.has(`${arjun.id}|${d}`));
  const kavyaOffs = allDates.filter(d => assignedOffs.has(`${kavya.id}|${d}`));

  console.log(`Arjun off days: ${arjunOffs.join(', ')} (DOW: ${arjunOffs.map(d => getDayOfWeek(d)).join(', ')})`);
  console.log(`Kavya off days: ${kavyaOffs.join(', ')} (DOW: ${kavyaOffs.map(d => getDayOfWeek(d)).join(', ')})`);

  const glowviaBackups = proposedBackups.filter(b => b.processId === '00000001-0000-0004-0000-000000000000');
  console.log(`Glowvia CS backups: ${glowviaBackups.length}`);
  glowviaBackups.forEach(b => console.log(`  Date: ${b.date}, Employee: ${employees.find(e => e.id === b.employeeId)?.name}`));
}

run();

