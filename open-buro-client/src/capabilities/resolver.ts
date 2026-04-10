import type { Capability, IntentRequest } from '../types.js';

/**
 * Pure MIME resolver — filters capabilities by action match and MIME type match.
 *
 * Rules applied in order (RES-02..06):
 * 1. RES-02: action must match
 * 2. RES-03: absent or empty allowedMimeType matches all capabilities
 * 3. RES-06: intent requests *\/* — matches any capability
 * 4. RES-04: capability supports *\/* — matches any mime request
 * 5. RES-05: exact mime string match
 */
export function resolve(capabilities: Capability[], intent: IntentRequest): Capability[] {
  const requestedMime = intent.args.allowedMimeType;

  return capabilities.filter((cap) => {
    // RES-02: action must match
    if (cap.action !== intent.action) return false;

    // RES-03: absent or empty allowedMimeType matches all capabilities
    if (!requestedMime) return true;

    // RES-06: intent requests */* — matches any capability
    if (requestedMime === '*/*') return true;

    // RES-04: capability supports */* — matches any mime request
    if (cap.properties.mimeTypes.includes('*/*')) return true;

    // RES-05: exact mime string match
    return cap.properties.mimeTypes.includes(requestedMime);
  });
}
