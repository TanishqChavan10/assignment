import { NextRequest, NextResponse } from 'next/server';
import { loadEngineInput, loadRosterState } from '@/lib/data';
import { validateExistingRoster } from '@/engine/index';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const month = body.month;
    if (!month) {
      return NextResponse.json({ error: 'month required in body' }, { status: 400 });
    }

    const input = await loadEngineInput(month);
    const roster = await loadRosterState(month);
    const conflicts = validateExistingRoster(input, roster);

    return NextResponse.json({ conflicts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

