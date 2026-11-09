const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function resetDemo() {
  console.log('--- RESETTING FOR DEMO RECORDING TAKE ---');
  
  // 1. Remove demo leave if Arjun has one on Dec 6
  const { data: arjun } = await supabase.from('employees').select('id').eq('name', 'Arjun Mehta').single();
  if (arjun) {
    await supabase.from('leaves').delete().eq('employee_id', arjun.id).eq('date', '2026-12-06');
    console.log('Removed demo leave for Arjun Mehta on 2026-12-06 (if present).');
  }

  // 2. Clear generated December allocations and roster entries
  await supabase.from('allocations').delete().gte('date', '2026-12-01').lte('date', '2026-12-31');
  await supabase.from('roster_entries').delete().gte('date', '2026-12-01').lte('date', '2026-12-31');
  await supabase.from('comp_off_credits').delete().gte('earned_on', '2026-12-01').lte('earned_on', '2026-12-31');
  console.log('Cleared December 2026 allocations, roster entries, and comp-off credits.');

  console.log('--- RESET COMPLETE! Ready for a fresh demo recording take. ---');
}

resetDemo();

