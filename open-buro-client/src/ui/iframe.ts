// src/ui/iframe.ts
import { OBCError } from '../errors.js';
import type { Capability } from '../types.js';

export interface IframeParams {
  id: string;
  clientUrl: string;
  type: string;
  allowedMimeType?: string;
  multiple?: boolean;
}

/**
 * Creates a sandboxed iframe element for a capability.
 *
 * IFR-08: same-origin guard — throws OBCError(SAME_ORIGIN_CAPABILITY) BEFORE
 * creating the iframe if the capability origin matches the host page origin.
 * Combining allow-scripts + allow-same-origin nullifies sandboxing.
 */
export function buildIframe(capability: Capability, params: IframeParams): HTMLIFrameElement {
  // IFR-08: same-origin guard — throw BEFORE creating the iframe
  const capOrigin = new URL(capability.path).origin;
  if (typeof location !== 'undefined' && capOrigin === location.origin) {
    throw new OBCError(
      'SAME_ORIGIN_CAPABILITY',
      `Capability "${capability.appName}" (${capability.path}) shares origin with host page. ` +
        'Same-origin capabilities are blocked because allow-scripts + allow-same-origin nullifies sandboxing.',
    );
  }

  const iframe = document.createElement('iframe');

  // IFR-03: query params carrying session context to the capability iframe
  const url = new URL(capability.path);
  url.searchParams.set('clientUrl', params.clientUrl);
  url.searchParams.set('id', params.id);
  url.searchParams.set('type', params.type);
  if (params.allowedMimeType !== undefined) {
    url.searchParams.set('allowedMimeType', params.allowedMimeType);
  }
  if (params.multiple !== undefined) {
    url.searchParams.set('multiple', String(params.multiple));
  }
  iframe.src = url.toString();

  // IFR-04: sandbox — allow-scripts + allow-same-origin required for Penpal postMessage
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

  // IFR-05: permissions policy for clipboard access
  iframe.setAttribute('allow', 'clipboard-read; clipboard-write');

  // IFR-06: WCAG 2.4.1 / ACT cae760 — accessible name is required on iframe elements
  iframe.title = capability.appName;

  // IFR-07: centered responsive sizing
  // Use setAttribute to preserve min() values; style.cssText normalizes them away in some DOM impls
  iframe.setAttribute(
    'style',
    'display:block;' +
      'width:min(90vw,800px);' +
      'height:min(85vh,600px);' +
      'border:none;' +
      'border-radius:8px;' +
      'box-shadow:0 4px 32px rgba(0,0,0,0.24);',
  );

  return iframe;
}
