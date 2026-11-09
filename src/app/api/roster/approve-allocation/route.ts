import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadEngineInput, loadRosterState } from '@/lib/data';
import { validateExistingRoster } from '@/engine/index';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support "Approve All Pending"
    if (body.all) {
      const month = body.month || '2026-12';
      const startDate = `${month}-01`;
      const [year, m] = month.split('-').map(Number);
      const endDate = `${year}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(year, m, 0)).getUTCDate()}`;

      let updateQuery = supabase
        .from('allocations')
        .update({ approved: true })
        .eq('approved', false)
        .gte('date', startDate)
        .lte('date', endDate);

      if (body.process_id) {
        updateQuery = updateQuery.eq('process_id', body.process_id);
      } else if (body.brand_id) {
        const { data: procs } = await supabase
          .from('processes')
          .select('id')
          .eq('brand_id', body.brand_id);
        const pIds = (procs ?? []).map((p: any) => p.id);
        if (pIds.length > 0) {
          updateQuery = updateQuery.in('process_id', pIds);
        }
      }

      const { error: updErr } = await updateQuery;
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

      const input = await loadEngineInput(month);
      const roster = await loadRosterState(month);
      const conflicts = validateExistingRoster(input, roster);

      return NextResponse.json({ ok: true, conflicts });
    }

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

