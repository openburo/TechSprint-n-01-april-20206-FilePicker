import { OBCError } from '../errors.js';

export interface WsListenerOptions {
  wsUrl: string;
  maxAttempts?: number; // default 5 (WS-04)
  onUpdate: () => void; // fires on REGISTRY_UPDATED
  onError: (err: OBCError) => void;
}

/**
 * WsListener — subscribes to a WebSocket endpoint for live registry updates.
 *
 * WS-05: The `destroyed` flag is checked in start(), stop(), the top of
 * connect(), and at the top of the setTimeout callback to prevent any
 * reconnect attempt after stop() is called.
 *
 * WS-04: Full-jitter exponential backoff:
 *   delay = Math.random() * Math.min(30_000, 1_000 * Math.pow(2, attempt))
 *
 * WS-06: After `maxAttempts` consecutive failures (without a successful open),
 *   onError is called with OBCError(WS_CONNECTION_FAILED) and no more retries.
 */
export class WsListener {
  private destroyed = false; // WS-05: guards post-destroy reconnect
  private attempt = 0;
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxAttempts: number;
  private readonly wsUrl: string;
  private readonly onUpdate: () => void;
  private readonly onError: (err: OBCError) => void;

  constructor(opts: WsListenerOptions) {
    this.wsUrl = opts.wsUrl;
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.onUpdate = opts.onUpdate;
    this.onError = opts.onError;
  }

  start(): void {
    if (this.destroyed) return;
    this.connect();
  }

  stop(): void {
    this.destroyed = true; // WS-05
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer); // cancel pending reconnect
      this.retryTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private connect(): void {
    if (this.destroyed) return; // WS-05: double-check after async gap

    // WS-07: reject non-wss in HTTPS context
    if (
      new URL(this.wsUrl).protocol !== 'wss:' &&
      typeof location !== 'undefined' &&
      (location as Location).protocol === 'https:'
    ) {
      this.onError(
        new OBCError(
          'WS_CONNECTION_FAILED',
          'WebSocket URL must use wss:// when host page is HTTPS',
        ),
      );
      return;
    }

    this.socket = new WebSocket(this.wsUrl);

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type?: string };
        if (data.type === 'REGISTRY_UPDATED') {
          this.onUpdate(); // WS-03
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.socket.onopen = () => {
      this.attempt = 0; // reset backoff on successful connection
    };

    this.socket.onerror = () => {
      // onclose fires after onerror; handle retry there
    };

    this.socket.onclose = () => {
      if (this.destroyed) return; // WS-05: guard
      this.attempt += 1;
      if (this.attempt >= this.maxAttempts) {
        // WS-06: exhausted retries
        this.onError(
          new OBCError(
            'WS_CONNECTION_FAILED',
            `WebSocket failed after ${this.maxAttempts} attempts`,
          ),
        );
        return;
      }
      // WS-04: full-jitter delay = random(0, min(30000, 1000 * 2^attempt))
      const cap = 30_000;
      const base = 1_000 * 2 ** this.attempt;
      const delay = Math.random() * Math.min(cap, base);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.destroyed) return; // WS-05: double guard in setTimeout callback
        this.connect(); // WS-05: connect() re-checks destroyed
      }, delay);
    };
  }
}

/**
 * Derives the WebSocket URL from a capabilities HTTP URL.
 * https → wss, http → ws; appends /ws to the /capabilities path segment.
 */
export function deriveWsUrl(capabilitiesUrl: string): string {
  const u = new URL(capabilitiesUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = u.pathname.replace(/\/capabilities$/, '/capabilities/ws');
  return u.toString();
}
