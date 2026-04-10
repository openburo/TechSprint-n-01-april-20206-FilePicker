// src/index.ts — public API barrel (Phase 1 scope only)
// Later phases add their own exports here.

export { OBCError } from './errors';
export type { OBCErrorCode } from './errors';

export type {
  Capability,
  CastPlan,
  FileResult,
  IntentCallback,
  IntentRequest,
  IntentResult,
  OBCOptions,
} from './types';

export { generateSessionId } from './intent/id';
