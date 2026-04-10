import { describe, expect, it } from 'vitest';
import {
  type Capability,
  type CastPlan,
  type FileResult,
  generateSessionId,
  type IntentCallback,
  type IntentRequest,
  type IntentResult,
  OBCError,
  type OBCErrorCode,
  type OBCOptions,
} from './index';

describe('public API surface (FOUND-04)', () => {
  it('exports OBCError as a constructor', () => {
    expect(typeof OBCError).toBe('function');
    expect(new OBCError('INTENT_CANCELLED', 'x')).toBeInstanceOf(Error);
  });

  it('exports generateSessionId as a function returning a UUID-shaped string', () => {
    expect(typeof generateSessionId).toBe('function');
    expect(generateSessionId()).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('all shared types are assignable (compile-time check)', () => {
    const cap: Capability = {
      id: 'x',
      appName: 'X',
      action: 'PICK',
      path: 'https://x/',
      properties: { mimeTypes: ['*/*'] },
    };
    const req: IntentRequest = { action: 'PICK', args: {} };
    const file: FileResult = { name: 'f', type: 't', size: 0, url: 'u' };
    const res: IntentResult = { id: 'id', status: 'done', results: [file] };
    const cb: IntentCallback = (_r) => {};
    const opts: OBCOptions = { capabilitiesUrl: 'https://x/' };
    const plan: CastPlan = { kind: 'no-match' };
    const code: OBCErrorCode = 'CAPABILITIES_FETCH_FAILED';
    expect([cap, req, file, res, cb, opts, plan, code]).toBeDefined();
  });
});
