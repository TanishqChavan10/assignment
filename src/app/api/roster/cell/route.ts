import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadEngineInput, loadRosterState } from '@/lib/data';
import { validateExistingRoster } from '@/engine/index';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_id, date, status } = body;

    if (!employee_id || !date || !status) {
      return NextResponse.json({ error: 'employee_id, date, status required' }, { status: 400 });
    }

    // Upsert the roster entry
    const { error } = await supabase
      .from('roster_entries')
      .upsert(
        { employee_id, date, status },
        { onConflict: 'employee_id,date' },
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (status !== 'WORKING') {
      await supabase
        .from('allocations')
        .delete()
        .match({ employee_id, date });
    } else {
      // If status restored to WORKING, restore primary allocations
      const { data: prims } = await supabase
        .from('assignments')
        .select('process_id')
        .eq('employee_id', employee_id)
        .eq('role', 'PRIMARY');

      if (prims && prims.length > 0) {
        const rows = prims.map((p) => ({
          employee_id,
          process_id: p.process_id,
          date,
          approved: true,
        }));
        await supabase.from('allocations').upsert(rows, { onConflict: 'employee_id,process_id,date' });
      }
    }

    // Revalidate
    const month = date.substring(0, 7);
    const input = await loadEngineInput(month);
    const roster = await loadRosterState(month);
    const conflicts = validateExistingRoster(input, roster);

    return NextResponse.json({ ok: true, conflicts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

