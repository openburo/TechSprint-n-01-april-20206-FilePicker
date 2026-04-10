import type { BridgeAdapter, ConnectionHandle, ParentMethods } from './bridge-adapter.js';

/**
 * MSG-05: Test double for BridgeAdapter. Use in orchestrator tests so the
 * full castIntent lifecycle can be exercised without real iframes, real
 * Penpal, or cross-origin postMessage.
 *
 * Tests simulate the child iframe calling `parent.resolve(result)` by
 * invoking `mockBridge.lastMethods?.resolve(result)` manually.
 */
export class MockBridge implements BridgeAdapter {
  public lastMethods: ParentMethods | null = null;
  public connectCallCount = 0;
  public destroyCallCount = 0;

  async connect(
    _iframe: HTMLIFrameElement,
    _allowedOrigin: string,
    methods: ParentMethods,
    _timeoutMs?: number,
  ): Promise<ConnectionHandle> {
    this.connectCallCount += 1;
    this.lastMethods = methods;
    return {
      destroy: () => {
        this.destroyCallCount += 1;
      },
    };
  }
}
