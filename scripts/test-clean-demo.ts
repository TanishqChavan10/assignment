import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
});

async function testCleanDemo() {
  const { loadEngineInput } = await import('../src/lib/data');
  const { getWeeksInMonth, getMonthDates, isProcessRequired, getMinStaff, getDayOfWeek } = await import('../src/engine/calendar');
  const { generateAllocations } = await import('../src/engine/allocation');
  const { validateRoster } = await import('../src/engine/validator');

  const input = await loadEngineInput('2026-12');
  console.log('Testing clean demo configuration...');
}

testCleanDemo();

