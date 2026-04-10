// src/types.ts

export interface Capability {
  /** Unique identifier for this capability provider */
  id: string;
  /** Display name shown in the chooser modal */
  appName: string;
  /** Action this capability handles, e.g. "PICK" or "SAVE" */
  action: string;
  /** Full URL to the capability iframe endpoint */
  path: string;
  /** Optional URL to a capability icon (shown in chooser modal) */
  iconUrl?: string;
  properties: {
    /** Supported MIME types; use "*\/*" to match any type */
    mimeTypes: string[];
  };
}

export interface IntentRequest {
  /** Action to perform, e.g. "PICK" or "SAVE" */
  action: string;
  args: {
    /** MIME type filter; absent or "*\/*" matches all capabilities */
    allowedMimeType?: string;
    /** Whether to allow selecting multiple files */
    multiple?: boolean;
  };
}

export interface FileResult {
  /** Name of the selected/saved file */
  name: string;
  /** MIME type of the file */
  type: string;
  /** Size in bytes */
  size: number;
  /** URL or data URI for the file content */
  url: string;
}

export interface IntentResult {
  /** Unique session identifier (UUID v4) */
  id: string;
  /** "done" when files were selected/saved; "cancel" when dismissed */
  status: 'done' | 'cancel';
  results: FileResult[];
}

export type IntentCallback = (result: IntentResult) => void;

export interface OBCOptions {
  /** HTTPS URL to the OpenBuro capabilities endpoint */
  capabilitiesUrl: string;
  /** Whether to subscribe to live registry updates via WebSocket (default: auto-detect) */
  liveUpdates?: boolean;
  /** Explicit WebSocket URL; auto-derived from capabilitiesUrl if omitted */
  wsUrl?: string;
  /** DOM element into which the modal/backdrop is injected (default: document.body) */
  container?: HTMLElement;
  /** Called when capabilities are refreshed via WebSocket event */
  onCapabilitiesUpdated?: (capabilities: Capability[]) => void;
  /** Called on any OBCError */
  onError?: (error: import('./errors').OBCError) => void;
}

/** Discriminated union produced by planCast() in Phase 2 */
export type CastPlan =
  | { kind: 'no-match' }
  | { kind: 'direct'; capability: Capability }
  | { kind: 'select'; capabilities: Capability[] };
