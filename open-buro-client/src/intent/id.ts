// src/intent/id.ts
// FOUND-05: crypto.randomUUID() with getRandomValues fallback
// Chrome 90-91, Firefox 88-94, Safari 14-15.3 lack randomUUID but have getRandomValues.

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() when available (Chrome 92+, Firefox 95+, Safari 15.4+).
 * Falls back to crypto.getRandomValues() for older browsers in the stated support range.
 */
export function generateSessionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 via getRandomValues — covers Chrome 90-91, FF 88-94, Safari 14-15.3
  // biome-ignore format: operator precedence in UUID fallback is load-bearing — do not reformat
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      Number(c) ^
      ((crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) & (15 >> (Number(c) / 4)))
    ).toString(16),
  );
}
