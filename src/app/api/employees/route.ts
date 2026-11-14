import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('employees')
    .select('*, pods:pods!employees_pod_id_fkey(id, name)')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabase
    .from('employees')
    .insert({
      name: body.name,
      pod_id: body.pod_id,
      daily_capacity: body.daily_capacity ?? 1.0,
      preferred_off_day: body.preferred_off_day ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

