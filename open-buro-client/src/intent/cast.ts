// src/intent/cast.ts
import type { Capability, CastPlan } from '../types.js';

/**
 * Pure decision function: given a pre-filtered list of matching capabilities,
 * return the CastPlan that the orchestrator should execute.
 *
 * - 0 matches: no-match (orchestrator fires NO_MATCHING_CAPABILITY + cancel callback)
 * - 1 match: direct (orchestrator opens iframe, skips modal)
 * - 2+ matches: select (orchestrator shows chooser modal)
 *
 * This function has no DOM dependency and no side effects — it is fully
 * unit-testable in a Node environment.
 */
export function planCast(matches: Capability[]): CastPlan {
  if (matches.length === 0) {
    return { kind: 'no-match' };
  }
  const first = matches[0];
  if (matches.length === 1 && first !== undefined) {
    return { kind: 'direct', capability: first };
  }
  return { kind: 'select', capabilities: matches };
}
