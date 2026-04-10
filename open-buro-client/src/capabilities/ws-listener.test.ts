import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OBCError } from '../errors.js';
import { deriveWsUrl, WsListener } from './ws-listener.js';

// ---------------------------------------------------------------------------
// WebSocket ready-state constants (not available in Node env without DOM)
// ---------------------------------------------------------------------------
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

// ---------------------------------------------------------------------------
// FakeWebSocket — in-process fake, no external dependency
// ---------------------------------------------------------------------------
class FakeWebSocket {
  static instance: FakeWebSocket | null = null;
  static instanceCount = 0;
  readyState = WS_CONNECTING;
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;

  // Static constants so the module code (ws-listener.ts) can reference WebSocket.CLOSED etc.
  static CONNECTING = WS_CONNECTING;
  static OPEN = WS_OPEN;
  static CLOSED = WS_CLOSED;

  constructor(public url: string) {
    FakeWebSocket.instance = this;
    FakeWebSocket.instanceCount += 1;
    // Auto-open in next microtask so handlers can be attached synchronously
    Promise.resolve().then(() => {
      this.readyState = WS_OPEN;
      this.onopen?.(new Event('open'));
    });
  }

  close() {
    this.readyState = WS_CLOSED;
  }

  send(_data: unknown) {}

  // Test helper: simulate incoming server message
  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  // Test helper: simulate server-side close
  simulateClose() {
    this.readyState = WS_CLOSED;
    this.onclose?.(new Event('close'));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  FakeWebSocket.instance = null;
  FakeWebSocket.instanceCount = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// deriveWsUrl helper
// ---------------------------------------------------------------------------
describe('deriveWsUrl', () => {
  it('converts https:// to wss:// and appends /ws to /capabilities path', () => {
    expect(deriveWsUrl('https://api.example.com/capabilities')).toBe(
      'wss://api.example.com/capabilities/ws',
    );
  });

  it('converts http:// to ws:// variant', () => {
    expect(deriveWsUrl('http://localhost:3000/capabilities')).toBe(
      'ws://localhost:3000/capabilities/ws',
    );
  });
});

// ---------------------------------------------------------------------------
// WsListener behaviour
// ---------------------------------------------------------------------------
describe('WsListener', () => {
  const wsUrl = 'wss://api.example.com/capabilities/ws';

  function makeListener(overrides?: { onUpdate?: () => void; onError?: (e: OBCError) => void }) {
    const onUpdate = overrides?.onUpdate ?? vi.fn();
    const onError = overrides?.onError ?? vi.fn();
    return { listener: new WsListener({ wsUrl, onUpdate, onError }), onUpdate, onError };
  }

  it('start() constructs exactly one FakeWebSocket', () => {
    const { listener } = makeListener();
    listener.start();
    expect(FakeWebSocket.instance).not.toBeNull();
    expect(FakeWebSocket.instanceCount).toBe(1);
  });

  it('REGISTRY_UPDATED message fires onUpdate exactly once', async () => {
    const { listener, onUpdate } = makeListener();
    listener.start();
    // Wait for auto-open microtask
    await Promise.resolve();
    FakeWebSocket.instance?.simulateMessage({ type: 'REGISTRY_UPDATED' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('non-REGISTRY_UPDATED message does NOT fire onUpdate', async () => {
    const { listener, onUpdate } = makeListener();
    listener.start();
    await Promise.resolve();
    FakeWebSocket.instance?.simulateMessage({ type: 'OTHER' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('malformed JSON message does NOT throw and does NOT fire onUpdate', async () => {
    const { listener, onUpdate } = makeListener();
    listener.start();
    await Promise.resolve();
    // Send raw non-JSON string via onmessage directly
    const instance = FakeWebSocket.instance;
    expect(() => {
      instance?.onmessage?.(new MessageEvent('message', { data: '{not valid json' }));
    }).not.toThrow();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('onopen resets attempt counter (close → open → close increments from 0)', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const { listener } = makeListener({ onError });
    listener.start();

    // Flush the auto-open Promise.resolve() microtask
    await Promise.resolve();
    const first = FakeWebSocket.instance;
    expect(first).not.toBeNull();

    // Simulate close — triggers retry timer (attempt → 1)
    first?.simulateClose();
    expect(FakeWebSocket.instanceCount).toBe(1);

    // Advance timer to trigger reconnect
    vi.runAllTimers();
    // Flush auto-open microtask for second socket
    await Promise.resolve();
    expect(FakeWebSocket.instanceCount).toBe(2);

    // Second socket's onopen fired → attempt reset to 0
    // Simulate close again — only attempt=1 this time
    const second = FakeWebSocket.instance;
    second?.simulateClose();

    // Should still retry (not exhausted — attempt just incremented from 0 again)
    vi.runAllTimers();
    await Promise.resolve();
    expect(FakeWebSocket.instanceCount).toBe(3);
    // onError should NOT have been called (maxAttempts=5, attempt=1 now)
    expect(onError).not.toHaveBeenCalled();
    listener.stop();
  });

  it('reconnect backoff: schedules a timer after onclose and opens new socket', async () => {
    vi.useFakeTimers();
    const { listener } = makeListener();
    listener.start();
    await Promise.resolve();

    const first = FakeWebSocket.instance;
    first?.simulateClose();
    expect(FakeWebSocket.instanceCount).toBe(1); // No new socket yet

    // Advance timers past any jitter delay (max 2000ms for attempt=1)
    vi.runAllTimers();
    await Promise.resolve();
    expect(FakeWebSocket.instanceCount).toBe(2);
    listener.stop();
  });

  it('WS-05: stop() during scheduled retry prevents new socket from opening', async () => {
    vi.useFakeTimers();
    const { listener } = makeListener();
    listener.start();
    await Promise.resolve();

    const first = FakeWebSocket.instance;
    first?.simulateClose(); // schedules retry timer

    // STOP before the timer fires
    listener.stop();

    // Advance past any possible jitter delay
    vi.runAllTimers();
    await Promise.resolve();

    // Must NOT have opened a new socket after stop()
    expect(FakeWebSocket.instanceCount).toBe(1);
  });

  it('after 5 closes without opens, onError fires with WS_CONNECTION_FAILED; no 6th socket', () => {
    // Stub Math.random to return 0 so delay is always 0 (deterministic)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
    const onError = vi.fn();
    const { listener } = makeListener({ onError });

    // maxAttempts=5; close sockets immediately before auto-open microtask fires
    // so attempt keeps incrementing (onopen would reset it to 0)
    listener.start();
    // Close immediately — onopen hasn't fired yet (queued in Promise microtask)
    // attempt: 0→1, schedules timer with delay=0
    FakeWebSocket.instance?.simulateClose();
    expect(FakeWebSocket.instanceCount).toBe(1);

    // 4 more closes to reach attempt=5 (which triggers onError)
    for (let i = 0; i < 4; i++) {
      // Fire the pending timer (delay=0) → calls connect() → creates new socket
      vi.runAllTimers();
      // Close immediately before auto-open microtask runs
      const inst = FakeWebSocket.instance;
      if (inst && inst.readyState !== WS_CLOSED) {
        inst.simulateClose();
      }
    }

    // attempt=5 ≥ maxAttempts=5 → onError fires once
    expect(onError).toHaveBeenCalledTimes(1);
    const err = (onError as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OBCError;
    expect(err.code).toBe('WS_CONNECTION_FAILED');

    const countAfterExhaustion = FakeWebSocket.instanceCount;
    // Advance more timers — should NOT create another socket
    vi.runAllTimers();
    expect(FakeWebSocket.instanceCount).toBe(countAfterExhaustion);

    randomSpy.mockRestore();
  });

  it('WS-07: non-wss URL in https: context fires onError with WS_CONNECTION_FAILED; no socket created', () => {
    vi.stubGlobal('location', { protocol: 'https:' });
    const onError = vi.fn();
    const listener = new WsListener({
      wsUrl: 'ws://api.example.com/capabilities/ws',
      onUpdate: vi.fn(),
      onError,
    });
    listener.start();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = (onError as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as OBCError;
    expect(err.code).toBe('WS_CONNECTION_FAILED');
    // No WebSocket was constructed
    expect(FakeWebSocket.instance).toBeNull();
  });
});
