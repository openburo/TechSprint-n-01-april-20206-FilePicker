// src/intent/id.test.ts
import { describe, it, expect } from 'vitest';
import { generateSessionId } from './id';

describe('generateSessionId', () => {
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('returns a UUID v4 via crypto.randomUUID when available', async () => {
    // Re-import fresh module (randomUUID is present in Node 22)
    const { generateSessionId: genId } = await import('./id');
    expect(genId()).toMatch(UUID_V4_RE);
  });

  it('returns a UUID v4 via getRandomValues fallback when randomUUID is absent', async () => {
    // Temporarily remove randomUUID to force the fallback branch
    const original = crypto.randomUUID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis.crypto as any).randomUUID;
    try {
      // generateSessionId checks typeof crypto.randomUUID at call-time (not module-load-time)
      expect(generateSessionId()).toMatch(UUID_V4_RE);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it('generates unique IDs across calls', async () => {
    const { generateSessionId: genId } = await import('./id');
    const ids = new Set(Array.from({ length: 100 }, () => genId()));
    expect(ids.size).toBe(100);
  });
});
