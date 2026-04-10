// src/intent/cast.test.ts
// Node environment — no DOM, no Penpal

import { describe, expect, it } from 'vitest';
import type { Capability } from '../types.js';
import { planCast } from './cast.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const cap1: Capability = {
  id: 'a',
  appName: 'App A',
  action: 'PICK',
  path: 'https://a.example.com/pick',
  properties: { mimeTypes: ['image/png'] },
};

const cap2: Capability = {
  id: 'b',
  appName: 'App B',
  action: 'PICK',
  path: 'https://b.example.com/pick',
  properties: { mimeTypes: ['image/jpeg'] },
};

const cap3: Capability = {
  id: 'c',
  appName: 'App C',
  action: 'PICK',
  path: 'https://c.example.com/pick',
  properties: { mimeTypes: ['*/*'] },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('planCast', () => {
  it("returns { kind: 'no-match' } for an empty array", () => {
    expect(planCast([])).toEqual({ kind: 'no-match' });
  });

  it("returns { kind: 'direct', capability: cap } for a single capability", () => {
    const result = planCast([cap1]);
    expect(result).toEqual({ kind: 'direct', capability: cap1 });
  });

  it('capability reference is preserved (reference equality) for direct branch', () => {
    const result = planCast([cap1]);
    if (result.kind !== 'direct') throw new Error('Expected direct');
    expect(result.capability).toBe(cap1);
  });

  it("returns { kind: 'select', capabilities: [...] } for two capabilities", () => {
    const result = planCast([cap1, cap2]);
    expect(result).toEqual({ kind: 'select', capabilities: [cap1, cap2] });
  });

  it("returns { kind: 'select', capabilities: [...] } for three capabilities (length 3)", () => {
    const result = planCast([cap1, cap2, cap3]);
    expect(result.kind).toBe('select');
    if (result.kind !== 'select') throw new Error('Expected select');
    expect(result.capabilities).toHaveLength(3);
  });

  it('select branch preserves order of input capabilities', () => {
    const result = planCast([cap2, cap1]);
    if (result.kind !== 'select') throw new Error('Expected select');
    expect(result.capabilities[0]).toBe(cap2);
    expect(result.capabilities[1]).toBe(cap1);
  });

  it('type-narrowing compile smoke test — all branches accessible without error', () => {
    function handlePlan(caps: Capability[]): string {
      const plan = planCast(caps);
      switch (plan.kind) {
        case 'no-match':
          return 'no-match';
        case 'direct':
          // TypeScript must narrow plan.capability here — compile fails if union is wrong
          return plan.capability.id;
        case 'select':
          // TypeScript must narrow plan.capabilities here
          return plan.capabilities.map((c) => c.id).join(',');
      }
    }

    expect(handlePlan([])).toBe('no-match');
    expect(handlePlan([cap1])).toBe('a');
    expect(handlePlan([cap1, cap2])).toBe('a,b');
  });

  it('array reference is preserved in the select branch (same array identity)', () => {
    const arr = [cap1, cap2];
    const result = planCast(arr);
    if (result.kind !== 'select') throw new Error('Expected select');
    expect(result.capabilities).toBe(arr);
  });
});
