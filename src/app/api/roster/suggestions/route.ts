import { NextRequest, NextResponse } from 'next/server';
import { loadEngineInput, loadRosterState } from '@/lib/data';
import { suggestReplacements } from '@/engine/replacements';
import type { Conflict } from '@/engine/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    const processId = searchParams.get('processId');
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');

    if (!month || !processId || !date) {
      return NextResponse.json(
        { error: 'month, processId, date query params required' },
        { status: 400 },
      );
    }

    const input = await loadEngineInput(month);
    const roster = await loadRosterState(month);

    const conflict: Conflict = {
      code: 'NO_COVERAGE',
      severity: 'error',
      date,
      processId,
      employeeId: employeeId ?? undefined,
      message: '',
    };

    const candidates = suggestReplacements(input, roster, conflict);

    return NextResponse.json({ candidates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

