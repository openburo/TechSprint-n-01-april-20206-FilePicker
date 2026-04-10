import { describe, it, expect } from 'vitest';
import { OBCError, type OBCErrorCode } from './errors';

describe('OBCError', () => {
  it('is an instance of Error and OBCError', () => {
    const e = new OBCError('CAPABILITIES_FETCH_FAILED', 'boom');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(OBCError);
    expect(e.code).toBe('CAPABILITIES_FETCH_FAILED');
    expect(e.message).toBe('boom');
    expect(e.name).toBe('OBCError');
  });

  it('accepts all six error codes', () => {
    const codes: OBCErrorCode[] = [
      'CAPABILITIES_FETCH_FAILED',
      'NO_MATCHING_CAPABILITY',
      'IFRAME_TIMEOUT',
      'WS_CONNECTION_FAILED',
      'INTENT_CANCELLED',
      'SAME_ORIGIN_CAPABILITY',
    ];
    for (const code of codes) {
      const e = new OBCError(code, 'x');
      expect(e.code).toBe(code);
    }
  });

  it('preserves cause when provided', () => {
    const root = new Error('root');
    const e = new OBCError('INTENT_CANCELLED', 'wrap', root);
    expect(e.cause).toBe(root);
  });

  it('cause is undefined when omitted', () => {
    const e = new OBCError('INTENT_CANCELLED', 'noCause');
    expect(e.cause).toBeUndefined();
  });
});
