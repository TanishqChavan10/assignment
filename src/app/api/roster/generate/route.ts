import { NextRequest, NextResponse } from 'next/server';
import { loadEngineInput, saveRosterResult } from '@/lib/data';
import { generateRoster } from '@/engine/index';
import { generateAllocations } from '@/engine/allocation';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month query param required (YYYY-MM)' }, { status: 400 });
    }

    const input = await loadEngineInput(month);
    const result = generateRoster(input);

    // Extract comp-off credits from allocation step
    const allocationResult = generateAllocations(
      result.entries,
      input.employees,
      input.processes,
      input.assignments,
      input.holidays,
      [],
    );

    await saveRosterResult(
      result.entries,
      result.allocations,
      month,
      allocationResult.compOffCredits,
    );

    return NextResponse.json({
      entries: result.entries.length,
      allocations: result.allocations.length,
      conflicts: result.conflicts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

