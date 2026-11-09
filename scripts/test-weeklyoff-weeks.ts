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
  const allDates = getMonthDates('2026-12');
  const weeks = getWeeksInMonth(allDates);

  console.log(`Weeks count: ${weeks.length}`);
  weeks.forEach((w, i) => console.log(`Week ${i+1}: ${w[0]} to ${w[w.length - 1]} (${w.length} days)`));
}

run();

