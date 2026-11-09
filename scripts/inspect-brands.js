const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

// Import compiled or ts-node or run via Next.js API
// Since Next.js uses TS, we can inspect brands and processes first
async function inspectBrands() {
  const { data: sundayBrands } = await supabase
    .from('processes')
    .select('name, calendar_rule, brands(name), assignments(role, employees(name, preferred_off_day))')
    .eq('calendar_rule', 'EXCEPT_SUNDAYS_AND_HOLIDAYS');
  
  console.log('Sunday-off brands:');
  sundayBrands.forEach(p => {
    console.log(`- Brand: ${p.brands.name}, Process: ${p.name}, Rule: ${p.calendar_rule}`);
    p.assignments.forEach(a => {
      console.log(`  Staff: ${a.employees?.name}, Role: ${a.role}, PrefOff: ${a.employees?.preferred_off_day}`);
    });
  });

  const { data: luxecore } = await supabase
    .from('processes')
    .select('name, calendar_rule, brands(name), assignments(role, employees(name, preferred_off_day))')
    .eq('brands.name', 'LuxeCore');
  
  console.log('\nLuxeCore processes:');
  luxecore.filter(p => p.brands?.name === 'LuxeCore').forEach(p => {
    console.log(`- Process: ${p.name}`);
    p.assignments.forEach(a => {
      console.log(`  Staff: ${a.employees?.name}, Role: ${a.role}, PrefOff: ${a.employees?.preferred_off_day}`);
    });
  });
}

inspectBrands();

