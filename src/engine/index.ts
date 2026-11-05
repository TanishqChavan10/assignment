// ============================================================
// index.ts — Engine entry point
// Orchestrates Steps 1-5 and exposes the public API.
// Pure functions — no I/O.
// ============================================================

import type {
  EngineInput,
  EngineResult,
  RosterState,
  Conflict,
  Candidate,
} from './types';
import { generateWeeklyOffs } from './weeklyOff';
import { generateAllocations } from './allocation';
import { validateRoster } from './validator';

/**
 * Generate a full monthly roster.
 *
 * Steps:
 *  1. Requirements (handled inside calendar / weekly-off)
 *  2. Availability (handled inside weekly-off)
 *  3. Weekly-off generation
 *  4. Allocation
 *  5. Validation
 */
export function generateRoster(input: EngineInput): EngineResult {
  const {
    employees,
    pods,
    brands,
    processes,
    assignments,
    holidays,
    leaves,
    month,
  } = input;

  // Step 3: Generate weekly offs
  const weeklyOffResult = generateWeeklyOffs(
    employees,
    processes,
    assignments,
    holidays,
    leaves,
    month,
  );

  // Step 4: Generate allocations
  const allocationResult = generateAllocations(
    weeklyOffResult.entries,
    employees,
    processes,
    assignments,
    holidays,
    weeklyOffResult.proposedBackupAllocations,
  );

  // Merge entries (weekly-off step may have mutated statuses for holiday workers)
  const entries = weeklyOffResult.entries;
  const allocations = allocationResult.allocations;

  // Step 5: Validate
  const validationConflicts = validateRoster(
    entries,
    allocations,
    employees,
    processes,
    brands,
    assignments,
    holidays,
    month,
    [...weeklyOffResult.conflicts, ...allocationResult.conflicts],
  );

  return {
    entries,
    allocations,
    conflicts: validationConflicts,
  };
}

/**
 * Validate an existing roster state (used after manual edits).
 * Does NOT regenerate — only checks for conflicts.
 */
export function validateExistingRoster(
  input: EngineInput,
  roster: RosterState,
): Conflict[] {
  return validateRoster(
    roster.entries,
    roster.allocations,
    input.employees,
    input.processes,
    input.brands,
    input.assignments,
    input.holidays,
    input.month,
  );
}

export { generateWeeklyOffs } from './weeklyOff';
export { generateAllocations } from './allocation';
export { validateRoster } from './validator';
export { suggestReplacements } from './replacements';

