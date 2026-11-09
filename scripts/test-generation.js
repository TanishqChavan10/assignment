const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

// We can test via the actual local server or run the engine directly
async function checkCurrentState() {
  const { data: entries } = await supabase.from('roster_entries').select('*').gte('date', '2026-12-01').lte('date', '2026-12-31');
  const { data: allocs } = await supabase.from('allocations').select('*').gte('date', '2026-12-01').lte('date', '2026-12-31');
  console.log('Current December entries in DB:', entries?.length ?? 0);
  console.log('Current December allocations in DB:', allocs?.length ?? 0);
}

checkCurrentState();

