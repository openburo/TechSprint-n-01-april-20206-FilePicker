// src/index.ts — public API barrel (Phase 1 scope only)
// Later phases add their own exports here.

export type { OBCErrorCode } from './errors';
export { OBCError } from './errors';
export { generateSessionId } from './intent/id';
export type {
  Capability,
  CastPlan,
  FileResult,
  IntentCallback,
  IntentRequest,
  IntentResult,
  OBCOptions,
} from './types';
