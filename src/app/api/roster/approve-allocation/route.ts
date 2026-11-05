import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadEngineInput, loadRosterState } from '@/lib/data';
import { validateExistingRoster } from '@/engine/index';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_id, process_id, date } = body;

    if (!employee_id || !process_id || !date) {
      return NextResponse.json(
        { error: 'employee_id, process_id, date required' },
        { status: 400 },
      );
    }

    // Upsert the allocation as approved
    const { error } = await supabase
      .from('allocations')
      .upsert(
        { employee_id, process_id, date, approved: true },
        { onConflict: 'employee_id,process_id,date' },
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

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

