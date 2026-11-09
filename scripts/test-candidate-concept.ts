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
  console.log('Testing elegant weekly-off candidate computation...');

  // Let's test for Arjun
  const arjun = input.employees.find(e => e.name === 'Arjun Mehta')!;
  const kavya = input.employees.find(e => e.name === 'Kavya Joshi')!;
  const rahulNair = input.employees.find(e => e.name === 'Rahul Nair')!;

  console.log('Arjun pref off:', arjun.preferredOffDay);
  console.log('Kavya pref off:', kavya.preferredOffDay);
  console.log('Rahul Nair pref off:', rahulNair.preferredOffDay);
}

run();

