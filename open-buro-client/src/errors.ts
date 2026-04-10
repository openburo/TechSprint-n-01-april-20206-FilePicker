// src/errors.ts

export type OBCErrorCode =
  | 'CAPABILITIES_FETCH_FAILED'
  | 'NO_MATCHING_CAPABILITY'
  | 'IFRAME_TIMEOUT'
  | 'WS_CONNECTION_FAILED'
  | 'INTENT_CANCELLED'
  | 'SAME_ORIGIN_CAPABILITY'
  | 'DESTROYED';

export class OBCError extends Error {
  readonly code: OBCErrorCode;
  // Declare cause as a plain property since ES2020 lib does not include Error.cause
  readonly cause?: unknown;

  constructor(code: OBCErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'OBCError';
    this.code = code;
    this.cause = cause;
    // Fix prototype chain for instanceof checks across transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
