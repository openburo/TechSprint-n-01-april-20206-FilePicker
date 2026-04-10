// src/intent/session.ts
import type { ConnectionHandle } from '../messaging/bridge-adapter.js';
import type { Capability, IntentResult } from '../types.js';

/**
 * Per-session state held by the orchestrator's Map<string, ActiveSession>.
 *
 * Every field is load-bearing for leak-free teardown:
 * - id: used as the Map key and the stale-message filter (INT-09)
 * - capability: the selected capability (for error context)
 * - iframe / shadowHost: DOM nodes to remove in destroy() (IFR-01..10)
 * - connectionHandle: destroy() closes the Penpal bridge (MSG-06)
 * - timeoutHandle: watchdog setTimeout to clear on resolve/cancel (INT-08)
 * - resolve / reject: the Promise returned by castIntent() (INT-01)
 * - callback: the user's IntentCallback, called exactly once (INT-01)
 *
 * Phase 3 instantiates this type inside OpenBuroClient; Phase 2 only
 * defines the shape so each layer can reference it.
 */
export interface ActiveSession {
  id: string;
  capability: Capability;
  iframe: HTMLIFrameElement;
  shadowHost: HTMLElement;
  connectionHandle: ConnectionHandle;
  timeoutHandle: ReturnType<typeof setTimeout>;
  resolve: (result: IntentResult) => void;
  reject: (err: Error) => void;
  callback: (result: IntentResult) => void;
}
