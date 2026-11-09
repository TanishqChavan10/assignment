import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('leaves')
    .select('*, employees(name)')
    .order('date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase
    .from('leaves')
    .upsert(
      {
        employee_id: body.employee_id,
        date: body.date,
        type: body.type ?? 'LEAVE',
      },
      { onConflict: 'employee_id,date,type' },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Sync to roster_entries and allocations if this month has been generated
  await supabase
    .from('roster_entries')
    .update({ status: body.type ?? 'LEAVE' })
    .match({ employee_id: body.employee_id, date: body.date });

  await supabase
    .from('allocations')
    .delete()
    .match({ employee_id: body.employee_id, date: body.date });

  return NextResponse.json(data, { status: 201 });
}

