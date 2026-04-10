---
phase: 03-orchestration
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/errors.ts
  - src/errors.test.ts
  - src/client.ts
  - src/client.test.ts
  - src/index.ts
  - src/index.test.ts
autonomous: true
requirements:
  - ORCH-01
  - ORCH-02
  - ORCH-03
  - ORCH-04
  - ORCH-05
  - ORCH-06
  - FOUND-03+

must_haves:
  truths:
    - "new OpenBuroClient({ capabilitiesUrl }) constructs without making any HTTP request or touching the DOM"
    - "Constructor throws synchronously when capabilitiesUrl is not https:// (and not http://localhost*)"
    - "First castIntent() triggers a lazy capability fetch; two concurrent first-calls share one in-flight Promise (single-flight)"
    - "WsListener is only started after a successful first fetch AND liveUpdates enabled AND X-OpenBuro-Server header detected"
    - "castIntent with zero matches invokes callback with { status: 'cancel', results: [] } and fires onError(NO_MATCHING_CAPABILITY)"
    - "castIntent with one match skips the modal and opens the iframe directly"
    - "castIntent with multiple matches shows the chooser modal; cancel path fires callback with status: 'cancel'"
    - "Iframe build + shadow append + bridgeFactory.connect happen in ONE synchronous block (no await between them)"
    - "Two concurrent sessions in one instance route resolve(result) to the correct callback by id; unknown ids are silently ignored"
    - "Two concurrent OpenBuroClient instances have isolated session maps, capability lists, and AbortContexts"
    - "destroy() aborts in-flight fetches, stops WsListener, tears down every Penpal connection, removes every injected DOM node, restores body scroll, and clears the session map"
    - "destroy() is idempotent — a second call is a no-op"
    - "After destroy(), castIntent() throws OBCError('DESTROYED') synchronously"
    - "After destroy(), getCapabilities() returns an empty array"
    - "After destroy(), refreshCapabilities() returns a rejected Promise with OBCError('DESTROYED')"
    - "Session timeout watchdog (default 5 min, configurable via sessionTimeoutMs) fires IFRAME_TIMEOUT on expiry and tears down the session"
    - "OpenBuroClient is exported from src/index.ts and importable from @openburo/client"
    - "pnpm run ci exits 0 (typecheck + biome + all tests + attw)"
  artifacts:
    - path: "src/errors.ts"
      provides: "DESTROYED added to OBCErrorCode union"
      contains: "DESTROYED"
    - path: "src/errors.test.ts"
      provides: "Test that OBCError('DESTROYED') constructs and carries the code"
      contains: "DESTROYED"
    - path: "src/client.ts"
      provides: "OpenBuroClient class with castIntent, getCapabilities, refreshCapabilities, destroy"
      contains: "class OpenBuroClient"
      min_lines: 250
    - path: "src/client.test.ts"
      provides: "Integration tests covering all 10 RESEARCH scenarios using MockBridge injection"
      contains: "MockBridge"
    - path: "src/index.ts"
      provides: "OpenBuroClient exported from the public barrel"
      contains: "OpenBuroClient"
  key_links:
    - from: "src/client.ts"
      to: "src/capabilities/loader.ts"
      via: "fetchCapabilities(url, abortContext.signal) wrapped in single-flight Promise"
      pattern: "fetchCapabilities\\("
    - from: "src/client.ts"
      to: "src/intent/cast.ts"
      via: "planCast(resolve(capabilities, intent)) discriminated-union branching"
      pattern: "planCast\\("
    - from: "src/client.ts"
      to: "src/ui/iframe.ts"
      via: "buildIframe(capability, { id, clientUrl, type, ... }) called synchronously before any await"
      pattern: "buildIframe\\("
    - from: "src/client.ts"
      to: "src/ui/modal.ts"
      via: "buildModal(capabilities, { onSelect, onCancel }, shadowRoot) on 'select' plan branch"
      pattern: "buildModal\\("
    - from: "src/client.ts"
      to: "src/messaging/bridge-adapter.ts"
      via: "this.bridgeFactory.connect(iframe, allowedOrigin, { resolve }) in sync iframe block"
      pattern: "bridgeFactory\\.connect\\("
    - from: "src/client.ts"
      to: "src/lifecycle/abort-context.ts"
      via: "createAbortContext() owns teardown; every cleanup registered via addCleanup"
      pattern: "createAbortContext|addCleanup"
    - from: "src/client.ts"
      to: "src/capabilities/ws-listener.ts"
      via: "new WsListener({ wsUrl, onUpdate, onError }).start() gated on first-fetch success + liveUpdates + server header"
      pattern: "new WsListener"
    - from: "src/index.ts"
      to: "src/client.ts"
      via: "export { OpenBuroClient }"
      pattern: "export \\{ OpenBuroClient"
---

<objective>
Build the `OpenBuroClient` orchestrator — the public facade that composes every Phase 2 layer (capabilities, intent, lifecycle, UI, messaging) behind a stable, leak-free API. This plan also extends the Phase 1 error model with a new `DESTROYED` code and re-exports the class from the public barrel.

Purpose: Close ORCH-01..06. A host page can `new OpenBuroClient(options)`, call `castIntent(intent, cb)`, receive the result via callback, and later call `destroy()` leaving zero DOM nodes, zero listeners, and zero open sockets.

Output:
- `src/errors.ts` extended with `DESTROYED` error code (FOUND-03+)
- `src/errors.test.ts` with unit coverage of the new code
- `src/client.ts` containing the `OpenBuroClient` class
- `src/client.test.ts` with >= 20 tests covering all 10 scenarios from 03-RESEARCH.md
- `src/index.ts` updated to export `OpenBuroClient`
- `pnpm run ci` exits 0 as the phase gate
</objective>

<execution_context>
@/home/ben/.claude/get-shit-done/workflows/execute-plan.md
@/home/ben/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/03-orchestration/03-CONTEXT.md
@.planning/phases/03-orchestration/03-RESEARCH.md
@.planning/phases/03-orchestration/03-VALIDATION.md
@.planning/phases/02-core-implementation/02-05-SUMMARY.md

@src/errors.ts
@src/types.ts
@src/intent/session.ts
@src/intent/id.ts
@src/intent/cast.ts
@src/capabilities/loader.ts
@src/capabilities/resolver.ts
@src/capabilities/ws-listener.ts
@src/lifecycle/abort-context.ts
@src/ui/styles.ts
@src/ui/iframe.ts
@src/ui/modal.ts
@src/messaging/bridge-adapter.ts
@src/messaging/mock-bridge.ts
@src/index.ts

<interfaces>
<!-- Key types and contracts extracted from Phase 1 + Phase 2 source. -->
<!-- The executor should use these directly — no further codebase exploration required. -->

From src/errors.ts (to be extended in Task 1):
```typescript
export type OBCErrorCode =
  | 'CAPABILITIES_FETCH_FAILED'
  | 'NO_MATCHING_CAPABILITY'
  | 'IFRAME_TIMEOUT'
  | 'WS_CONNECTION_FAILED'
  | 'INTENT_CANCELLED'
  | 'SAME_ORIGIN_CAPABILITY';
  // Task 1 ADDS: | 'DESTROYED'

export class OBCError extends Error {
  readonly code: OBCErrorCode;
  readonly cause?: unknown;
  constructor(code: OBCErrorCode, message: string, cause?: unknown);
}
```

From src/types.ts:
```typescript
export interface Capability {
  id: string;
  appName: string;
  action: string;
  path: string;
  iconUrl?: string;
  properties: { mimeTypes: string[] };
}

export interface IntentRequest {
  action: string;
  args: { allowedMimeType?: string; multiple?: boolean };
}

export interface IntentResult {
  id: string;
  status: 'done' | 'cancel';
  results: FileResult[];
}

export type IntentCallback = (result: IntentResult) => void;

export interface OBCOptions {
  capabilitiesUrl: string;
  liveUpdates?: boolean;
  wsUrl?: string;
  container?: HTMLElement;
  onCapabilitiesUpdated?: (capabilities: Capability[]) => void;
  onError?: (error: OBCError) => void;
}

export type CastPlan =
  | { kind: 'no-match' }
  | { kind: 'direct'; capability: Capability }
  | { kind: 'select'; capabilities: Capability[] };
```

From src/capabilities/loader.ts:
```typescript
export interface LoaderResult {
  capabilities: Capability[];
  isOpenBuroServer: boolean;
}
export function fetchCapabilities(url: string, signal?: AbortSignal): Promise<LoaderResult>;
```

From src/capabilities/resolver.ts:
```typescript
export function resolve(capabilities: Capability[], intent: IntentRequest): Capability[];
```

From src/intent/cast.ts:
```typescript
export function planCast(matches: Capability[]): CastPlan;
```

From src/intent/id.ts:
```typescript
export function generateSessionId(): string; // UUID v4
```

From src/intent/session.ts:
```typescript
export interface ActiveSession {
  id: string;
  capability: Capability;
  iframe: HTMLIFrameElement;
  shadowHost: HTMLElement;
  connectionHandle: ConnectionHandle;
  timeoutHandle: ReturnType<typeof setTimeout>;
  resolve: (result: IntentResult) => void;
  reject: (err: Error) => void;
  callback: (result: IntentResult) => void;
}
```

From src/lifecycle/abort-context.ts:
```typescript
export interface AbortContext {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
  addCleanup(fn: () => void): void;
}
export function createAbortContext(): AbortContext;
```

From src/ui/styles.ts:
```typescript
export interface ShadowHostResult { host: HTMLElement; root: ShadowRoot; }
export function createShadowHost(container: HTMLElement, zIndex?: number): ShadowHostResult;
```

From src/ui/iframe.ts:
```typescript
export interface IframeParams {
  id: string;
  clientUrl: string;
  type: string;
  allowedMimeType?: string;
  multiple?: boolean;
}
export function buildIframe(capability: Capability, params: IframeParams): HTMLIFrameElement;
// Throws OBCError('SAME_ORIGIN_CAPABILITY') if cap.path shares origin with location
```

From src/ui/modal.ts:
```typescript
export interface ModalCallbacks {
  onSelect: (capability: Capability) => void;
  onCancel: () => void;
}
export interface ModalResult { element: HTMLElement; destroy: () => void; }
export function buildModal(
  capabilities: Capability[],
  callbacks: ModalCallbacks,
  shadowRoot: ShadowRoot,
): ModalResult;
```

From src/messaging/bridge-adapter.ts:
```typescript
export interface ConnectionHandle { destroy(): void; }
export interface ParentMethods { resolve(result: IntentResult): void; }
export interface BridgeAdapter {
  connect(
    iframe: HTMLIFrameElement,
    allowedOrigin: string,
    methods: ParentMethods,
    timeoutMs?: number,
  ): Promise<ConnectionHandle>;
}
```

From src/messaging/mock-bridge.ts (used by tests):
```typescript
export class MockBridge implements BridgeAdapter {
  public lastMethods: ParentMethods | null;
  public connectCallCount: number;
  public destroyCallCount: number;
  async connect(iframe, allowedOrigin, methods, timeoutMs?): Promise<ConnectionHandle>;
}
```

From src/capabilities/ws-listener.ts:
```typescript
export interface WsListenerOptions {
  wsUrl: string;
  maxAttempts?: number;
  onUpdate: () => void;
  onError: (err: OBCError) => void;
}
export class WsListener {
  constructor(opts: WsListenerOptions);
  start(): void;
  stop(): void;
}
export function deriveWsUrl(capabilitiesUrl: string): string;
```
</interfaces>

<locked_decisions>
From 03-CONTEXT.md — NON-NEGOTIABLE:

1. **No async side effects in constructor.** The constructor only validates options, allocates state, and creates the AbortContext. No fetch, no WS, no DOM. First HTTP request happens on first `castIntent()` or explicit `refreshCapabilities()`.

2. **Lazy capability fetch with single-flight.** Cache the in-flight `Promise<LoaderResult>` on `this.inflightFetch`; clear on settle (success or failure). Two concurrent `castIntent()` calls during cold start MUST share the same Promise.

3. **WS starts after first successful fetch** IF `options.liveUpdates !== false` AND `loaderResult.isOpenBuroServer === true`. Not before.

4. **`destroy()` uses `createAbortContext()` as the single teardown mechanism.** Every cleanup (fetch abort signal, WS stop, modal destroy, bridge destroy, iframe removal, shadow host removal, body scroll restore, session map clear) registers via `abortContext.addCleanup(fn)`. `destroy()` calls `this.abortContext.abort()` once.

5. **Post-destroy behavior (exact):**
   - `castIntent()` → sync throw `new OBCError('DESTROYED', 'OpenBuroClient has been destroyed')`
   - `getCapabilities()` → return `[]`
   - `refreshCapabilities()` → return `Promise.reject(new OBCError('DESTROYED', ...))`
   - `destroy()` → idempotent no-op (early return if `this.destroyed`)

6. **`bridgeFactory` option.** Defaults to `new PenpalBridge()`; tests inject `new MockBridge()`. Mark as `@internal` in JSDoc (not part of the published v1 public API surface).

7. **Synchronicity pitfall.** `buildIframe() → shadowRoot.appendChild(iframe) → this.bridgeFactory.connect(iframe, ...)` must be in ONE synchronous block before any `await`. Document this with an inline comment referencing the research pitfall.

8. **Constructor validation:**
   - `options.capabilitiesUrl` must start with `https://` OR match `http://localhost` prefix → else throw `OBCError('CAPABILITIES_FETCH_FAILED', 'Mixed Content: capabilitiesUrl must be HTTPS in production')`
   - `options.wsUrl` (if provided) must start with `wss://` OR `ws://localhost` → else throw `OBCError('WS_CONNECTION_FAILED', 'wsUrl must be wss:// in production')`
</locked_decisions>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add DESTROYED error code (FOUND-03+)</name>
  <files>src/errors.ts, src/errors.test.ts</files>

  <read_first>
    - .planning/phases/03-orchestration/03-CONTEXT.md (decisions/post-destroy section)
    - src/errors.ts (current union has 6 codes)
  </read_first>

  <behavior>
    - Test 1: `new OBCError('DESTROYED', 'x')` constructs without TypeScript error and the instance `.code === 'DESTROYED'`
    - Test 2: An `OBCError('DESTROYED', 'x', new Error('cause'))` carries the cause
    - Test 3: `instanceof OBCError` check still holds for the new code
    - Test 4 (type-only, in comment): `const codes: OBCErrorCode[] = ['DESTROYED', 'CAPABILITIES_FETCH_FAILED', ...]` type-checks with all 7 codes
  </behavior>

  <action>
    1. Open `src/errors.ts` and extend `OBCErrorCode` with `'DESTROYED'`:

    ```typescript
    export type OBCErrorCode =
      | 'CAPABILITIES_FETCH_FAILED'
      | 'NO_MATCHING_CAPABILITY'
      | 'IFRAME_TIMEOUT'
      | 'WS_CONNECTION_FAILED'
      | 'INTENT_CANCELLED'
      | 'SAME_ORIGIN_CAPABILITY'
      | 'DESTROYED';
    ```

    2. Create `src/errors.test.ts` (file does not currently exist; Phase 1 covered errors via index.test.ts only). Use plain vitest node env (no docblock needed):

    ```typescript
    import { describe, expect, it } from 'vitest';
    import { OBCError, type OBCErrorCode } from './errors';

    describe('OBCError', () => {
      it('constructs with DESTROYED code', () => {
        const err = new OBCError('DESTROYED', 'OpenBuroClient has been destroyed');
        expect(err.code).toBe('DESTROYED');
        expect(err.message).toBe('OpenBuroClient has been destroyed');
        expect(err).toBeInstanceOf(OBCError);
        expect(err).toBeInstanceOf(Error);
      });

      it('carries cause on DESTROYED errors', () => {
        const cause = new Error('underlying');
        const err = new OBCError('DESTROYED', 'x', cause);
        expect(err.cause).toBe(cause);
      });

      it('accepts all 7 OBCErrorCode values at the type level', () => {
        const codes: OBCErrorCode[] = [
          'CAPABILITIES_FETCH_FAILED',
          'NO_MATCHING_CAPABILITY',
          'IFRAME_TIMEOUT',
          'WS_CONNECTION_FAILED',
          'INTENT_CANCELLED',
          'SAME_ORIGIN_CAPABILITY',
          'DESTROYED',
        ];
        expect(codes.length).toBe(7);
      });
    });
    ```

    3. Run `pnpm vitest run src/errors.test.ts` — MUST exit 0 with at least 3 tests.
    4. Run `pnpm biome check --write src/errors.ts src/errors.test.ts` to normalize.

    NOTE: Do NOT touch `src/index.ts` in this task; the barrel already re-exports `OBCErrorCode` via `export type { OBCErrorCode }` — the union extension flows through automatically.
  </action>

  <verify>
    <automated>pnpm vitest run src/errors.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/errors.ts` contains `'DESTROYED'`
    - `src/errors.test.ts` exists and contains `'DESTROYED'`
    - `pnpm vitest run src/errors.test.ts` exits 0 with >= 3 tests
    - `pnpm biome check src/errors.ts src/errors.test.ts` exits 0
    - TypeScript compiles: `pnpm tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>
    DESTROYED is part of the OBCErrorCode union, unit-tested, and biome-clean. No other files touched.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create OpenBuroClient scaffold — constructor, validation, capability accessors, single-flight fetch (ORCH-01, ORCH-02)</name>
  <files>src/client.ts, src/client.test.ts</files>

  <read_first>
    - .planning/phases/03-orchestration/03-CONTEXT.md (decisions section — lazy fetch, single-flight, constructor validation, bridgeFactory)
    - .planning/phases/03-orchestration/03-RESEARCH.md (scenarios 1, 4, 8, 9)
    - src/capabilities/loader.ts
    - src/capabilities/ws-listener.ts
    - src/lifecycle/abort-context.ts
    - src/messaging/mock-bridge.ts
    - src/messaging/bridge-adapter.ts
  </read_first>

  <behavior>
    Describe block: "OpenBuroClient - constructor and capability access"
    - Test 1: constructor with valid `https://` capabilitiesUrl does NOT throw and does NOT call fetch
    - Test 2: constructor with `http://example.com` THROWS `OBCError('CAPABILITIES_FETCH_FAILED')` synchronously
    - Test 3: constructor with `http://localhost:3000/capabilities` does NOT throw (localhost exception)
    - Test 4: constructor with valid url + explicit `wsUrl: 'ws://evil.com'` THROWS `OBCError('WS_CONNECTION_FAILED')`
    - Test 5: constructor with `wsUrl: 'ws://localhost:3000/ws'` does NOT throw
    - Test 6: `obc.getCapabilities()` returns `[]` synchronously before any fetch
    - Test 7: `obc.refreshCapabilities()` returns a Promise resolving to Capability[]; fetch mocked via `vi.stubGlobal('fetch', ...)`
    - Test 8: Two concurrent `obc.refreshCapabilities()` calls share a single in-flight Promise (assert fetch mock called exactly 1 time)
    - Test 9: Successful first refreshCapabilities caches result so `getCapabilities()` returns the list synchronously afterward
    - Test 10: failed refreshCapabilities calls `onError` with CAPABILITIES_FETCH_FAILED AND returns a rejected Promise; a subsequent refreshCapabilities retries (fetch called again)
    - Test 11: two separate `OpenBuroClient` instances with different capabilitiesUrl maintain isolated state (ORCH-03 smoke)
  </behavior>

  <action>
    **Step 1 — Write `src/client.test.ts` FIRST (RED).** Put the docblock and MockBridge injection. Fetch is stubbed per-test. Example skeleton:

    ```typescript
    // @vitest-environment happy-dom
    import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
    import { OBCError } from './errors';
    import { MockBridge } from './messaging/mock-bridge';
    import type { Capability } from './types';
    import { OpenBuroClient } from './client';

    const VALID_URL = 'https://api.example.com/capabilities';
    const SAMPLE_CAPS: Capability[] = [
      {
        id: 'pick-1',
        appName: 'Sample Picker',
        action: 'PICK',
        path: 'https://files.example.com/pick',
        properties: { mimeTypes: ['*/*'] },
      },
    ];

    function mockFetchOk(caps: Capability[], isOpenBuroServer = true) {
      return vi.fn(async () =>
        new Response(JSON.stringify(caps), {
          status: 200,
          headers: isOpenBuroServer ? { 'X-OpenBuro-Server': 'true' } : {},
        }),
      );
    }

    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      // Clean any stray DOM nodes between tests
      document.body.innerHTML = '';
    });

    describe('OpenBuroClient - constructor and capability access', () => {
      it('constructs with https URL without calling fetch', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const obc = new OpenBuroClient({ capabilitiesUrl: VALID_URL });
        expect(fetchMock).not.toHaveBeenCalled();
        obc.destroy();
      });

      it('throws CAPABILITIES_FETCH_FAILED on non-HTTPS non-localhost url', () => {
        expect(() => new OpenBuroClient({ capabilitiesUrl: 'http://example.com/caps' }))
          .toThrow(OBCError);
      });

      // ... remaining tests per behavior block
    });
    ```

    **Step 2 — Write `src/client.ts` (GREEN).** Implement only what Task 2 needs. The class must import:

    ```typescript
    import { fetchCapabilities, type LoaderResult } from './capabilities/loader.js';
    import { deriveWsUrl, WsListener } from './capabilities/ws-listener.js';
    import { OBCError } from './errors.js';
    import { createAbortContext, type AbortContext } from './lifecycle/abort-context.js';
    import type { BridgeAdapter } from './messaging/bridge-adapter.js';
    import { PenpalBridge } from './messaging/penpal-bridge.js';
    import type { ActiveSession } from './intent/session.js';
    import type { Capability, IntentCallback, IntentRequest, IntentResult, OBCOptions } from './types.js';
    ```

    Class skeleton:

    ```typescript
    /**
     * @public
     * OpenBuroClient — the intent broker facade. Composes every Phase 2 layer
     * (capabilities, intent, lifecycle, UI, messaging) behind a stable API.
     */
    export interface OpenBuroClientOptions extends OBCOptions {
      /** @internal - Injected bridge adapter for tests; defaults to PenpalBridge. */
      bridgeFactory?: BridgeAdapter;
      /** Session watchdog timeout in ms (default: 5 * 60 * 1000). */
      sessionTimeoutMs?: number;
    }

    export class OpenBuroClient {
      private readonly options: OpenBuroClientOptions;
      private readonly bridgeFactory: BridgeAdapter;
      private readonly sessionTimeoutMs: number;
      private readonly abortContext: AbortContext;
      private readonly sessions: Map<string, ActiveSession> = new Map();

      private capabilities: Capability[] = [];
      private inflightFetch: Promise<LoaderResult> | null = null;
      private wsListener: WsListener | null = null;
      private destroyed = false;

      constructor(options: OpenBuroClientOptions) {
        // ORCH-01: synchronous https validation
        this.validateUrl(options.capabilitiesUrl, 'capabilitiesUrl', 'CAPABILITIES_FETCH_FAILED');
        if (options.wsUrl !== undefined) {
          this.validateUrl(options.wsUrl, 'wsUrl', 'WS_CONNECTION_FAILED', /* wsMode */ true);
        }

        this.options = options;
        this.bridgeFactory = options.bridgeFactory ?? new PenpalBridge();
        this.sessionTimeoutMs = options.sessionTimeoutMs ?? 5 * 60 * 1000;
        this.abortContext = createAbortContext();
        // ORCH-02: NO async side effects here. No fetch. No DOM. No WS.
      }

      private validateUrl(
        url: string,
        optionName: 'capabilitiesUrl' | 'wsUrl',
        errorCode: 'CAPABILITIES_FETCH_FAILED' | 'WS_CONNECTION_FAILED',
        wsMode = false,
      ): void {
        const secureScheme = wsMode ? 'wss://' : 'https://';
        const localPrefix = wsMode ? 'ws://localhost' : 'http://localhost';
        if (!url.startsWith(secureScheme) && !url.startsWith(localPrefix)) {
          throw new OBCError(
            errorCode,
            `Mixed Content: ${optionName} must be ${secureScheme} in production (got ${url})`,
          );
        }
      }

      /** CAP-06 / ORCH-06: synchronous in-memory read. Returns [] after destroy(). */
      getCapabilities(): Capability[] {
        if (this.destroyed) return [];
        return [...this.capabilities];
      }

      /** CAP-07: force a fresh fetch. Single-flight guards concurrent callers. */
      async refreshCapabilities(): Promise<Capability[]> {
        if (this.destroyed) {
          return Promise.reject(
            new OBCError('DESTROYED', 'OpenBuroClient has been destroyed'),
          );
        }
        return this.ensureCapabilities(/* forceReload */ true);
      }

      /**
       * Lazy first-fetch + single-flight cache.
       * - If capabilities already loaded AND not forcing, returns them immediately.
       * - If a fetch is in-flight, returns the same Promise.
       * - On success, stores capabilities and (first time only) starts WS if applicable.
       * - On failure, clears the in-flight cache so the next call retries.
       */
      private async ensureCapabilities(forceReload = false): Promise<Capability[]> {
        if (!forceReload && this.capabilities.length > 0) {
          return this.capabilities;
        }
        if (this.inflightFetch !== null) {
          const result = await this.inflightFetch;
          return result.capabilities;
        }

        const promise = fetchCapabilities(
          this.options.capabilitiesUrl,
          this.abortContext.signal,
        );
        this.inflightFetch = promise;

        try {
          const result = await promise;
          this.capabilities = result.capabilities;
          this.maybeStartWsListener(result);
          return result.capabilities;
        } catch (err) {
          const obcErr =
            err instanceof OBCError
              ? err
              : new OBCError('CAPABILITIES_FETCH_FAILED', 'Unknown fetch error', err);
          this.options.onError?.(obcErr);
          throw obcErr;
        } finally {
          this.inflightFetch = null;
        }
      }

      private maybeStartWsListener(result: LoaderResult): void {
        if (this.wsListener !== null) return; // already started
        if (this.options.liveUpdates === false) return;
        if (!result.isOpenBuroServer) return;
        if (this.destroyed) return;

        const wsUrl = this.options.wsUrl ?? deriveWsUrl(this.options.capabilitiesUrl);
        const listener = new WsListener({
          wsUrl,
          onUpdate: () => {
            void this.refreshCapabilities().then(
              (caps) => this.options.onCapabilitiesUpdated?.(caps),
              () => {
                /* onError already fired in refreshCapabilities */
              },
            );
          },
          onError: (err) => this.options.onError?.(err),
        });
        listener.start();
        this.wsListener = listener;
        this.abortContext.addCleanup(() => {
          listener.stop();
        });
      }

      /** Task 3 will populate this method. */
      castIntent(_intent: IntentRequest, _callback: IntentCallback): Promise<IntentResult> {
        throw new OBCError('DESTROYED', 'castIntent not implemented in Task 2');
      }

      /** Task 4 will populate this method. */
      destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.abortContext.abort();
      }
    }
    ```

    **Step 3 — Run RED → GREEN loop:** `pnpm vitest run src/client.test.ts -t "constructor"` until green.

    **Step 4 — Biome normalize:** `pnpm biome check --write src/client.ts src/client.test.ts`.

    IMPORTANT: The minimal `destroy()` here enables happy-path cleanup between tests. Task 4 replaces it with the full teardown.
  </action>

  <verify>
    <automated>pnpm vitest run src/client.test.ts -t "constructor"</automated>
  </verify>

  <acceptance_criteria>
    - `src/client.ts` exists and contains `class OpenBuroClient`, `createAbortContext`, `inflightFetch`, `this.destroyed`, `bridgeFactory`
    - `src/client.test.ts` exists with `// @vitest-environment happy-dom` docblock and imports `MockBridge`
    - `pnpm vitest run src/client.test.ts -t "constructor"` exits 0 with >= 8 passing tests in this scope
    - `pnpm tsc --noEmit` exits 0
    - `pnpm biome check src/client.ts src/client.test.ts` exits 0
    - grep `fetchCapabilities\(` in `src/client.ts` returns >= 1 match
    - grep `single.flight|inflightFetch` in `src/client.ts` returns >= 1 match
  </acceptance_criteria>

  <done>
    Constructor validates URLs, class holds AbortContext + empty session Map, `getCapabilities()` and `refreshCapabilities()` work against a mocked fetch, single-flight cache verified by test, and WS listener gating (lazy, header-detected) is wired. `castIntent` and full `destroy` remain stubs for Tasks 3 and 4.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement castIntent orchestration — planCast branching, modal, iframe, bridge, session map, watchdog (ORCH-03)</name>
  <files>src/client.ts, src/client.test.ts</files>

  <read_first>
    - .planning/phases/03-orchestration/03-CONTEXT.md (castIntent flow section + synchronicity pitfall)
    - .planning/phases/03-orchestration/03-RESEARCH.md (scenarios 1, 2, 3, 5, 10)
    - src/intent/cast.ts
    - src/intent/id.ts
    - src/capabilities/resolver.ts
    - src/ui/styles.ts
    - src/ui/iframe.ts
    - src/ui/modal.ts
    - src/messaging/mock-bridge.ts
  </read_first>

  <behavior>
    Describe block: "OpenBuroClient - castIntent orchestration"
    - Test 1 (happy-path direct): single matching capability → no modal rendered → MockBridge.connect called once → simulating `mock.lastMethods.resolve({id, status: 'done', results: [...]})` invokes user callback with the same id and result; the iframe + shadow host are removed
    - Test 2 (no-match): no matching capabilities → callback called with `{ status: 'cancel', id, results: [] }` → `onError` called with code `NO_MATCHING_CAPABILITY` → Promise resolves (not rejects) with the cancel result
    - Test 3 (select): >1 matching capabilities → modal rendered inside a ShadowRoot (assert an element with `role="dialog"` exists within the obc host) → user selects second capability → iframe opens for that capability → MockBridge.connect called
    - Test 4 (select cancel): >1 matching capabilities → click cancel button inside modal → callback gets cancel → no iframe connection opened
    - Test 5 (two concurrent sessions in one instance): two parallel `castIntent` calls resolve independently; resolving session A must not trigger session B's callback (route by id)
    - Test 6 (unknown/stale id ignored): after session A resolves, calling `mockBridge.lastMethods.resolve({ id: 'bogus', ... })` does nothing — no throw, no callback
    - Test 7 (same-origin capability): capability.path shares origin with `location` → castIntent callback fires cancel → onError fires with `SAME_ORIGIN_CAPABILITY`
    - Test 8 (single-flight cold start): two concurrent `castIntent` during cold start → fetch called exactly once
    - Test 9 (watchdog): use `vi.useFakeTimers()` → `sessionTimeoutMs: 1000` → advance 1000ms → iframe torn down → callback cancel → onError `IFRAME_TIMEOUT`
    - Test 10 (two instances isolated): two `OpenBuroClient` instances with different caps → each instance's castIntent routes to its own session map
  </behavior>

  <action>
    **Step 1 — Extend `src/client.ts`:** remove the stub `castIntent`, implement the full orchestration flow. New private helpers on the class:

    ```typescript
    // Additional imports
    import { resolve as resolveCapabilities } from './capabilities/resolver.js';
    import { planCast } from './intent/cast.js';
    import { generateSessionId } from './intent/id.js';
    import { buildIframe } from './ui/iframe.js';
    import { buildModal } from './ui/modal.js';
    import { createShadowHost } from './ui/styles.js';
    import type { ConnectionHandle } from './messaging/bridge-adapter.js';
    ```

    Replace the stub `castIntent` with:

    ```typescript
    async castIntent(
      intent: IntentRequest,
      callback: IntentCallback,
    ): Promise<IntentResult> {
      // ORCH-06: sync throw after destroy
      if (this.destroyed) {
        throw new OBCError('DESTROYED', 'OpenBuroClient has been destroyed');
      }

      // Lazy capability fetch (single-flight)
      let capabilities: Capability[];
      try {
        capabilities = await this.ensureCapabilities();
      } catch (err) {
        // ensureCapabilities already fired onError
        throw err;
      }

      // planCast branching
      const matches = resolveCapabilities(capabilities, intent);
      const plan = planCast(matches);

      if (plan.kind === 'no-match') {
        const id = generateSessionId();
        this.options.onError?.(
          new OBCError('NO_MATCHING_CAPABILITY', `No capability for action "${intent.action}"`),
        );
        const cancelResult: IntentResult = { id, status: 'cancel', results: [] };
        callback(cancelResult);
        return cancelResult;
      }

      if (plan.kind === 'direct') {
        return this.openIframeSession(plan.capability, intent, callback);
      }

      // plan.kind === 'select' → chooser modal
      return this.openChooserModal(plan.capabilities, intent, callback);
    }

    private openChooserModal(
      capabilities: Capability[],
      intent: IntentRequest,
      callback: IntentCallback,
    ): Promise<IntentResult> {
      const container = this.options.container ?? document.body;
      const { host, root } = createShadowHost(container);

      return new Promise<IntentResult>((resolvePromise, rejectPromise) => {
        let settled = false;

        const modal = buildModal(
          capabilities,
          {
            onSelect: (capability) => {
              if (settled) return;
              settled = true;
              modal.destroy();
              host.remove();
              // Re-enter the iframe opening path; if it throws, bubble through callback.
              this.openIframeSession(capability, intent, callback).then(
                resolvePromise,
                rejectPromise,
              );
            },
            onCancel: () => {
              if (settled) return;
              settled = true;
              modal.destroy();
              host.remove();
              const cancelResult: IntentResult = {
                id: generateSessionId(),
                status: 'cancel',
                results: [],
              };
              callback(cancelResult);
              resolvePromise(cancelResult);
            },
          },
          root,
        );
        root.appendChild(modal.element);

        // Register cleanup so destroy() during a live modal tears it down
        this.abortContext.addCleanup(() => {
          if (settled) return;
          settled = true;
          modal.destroy();
          host.remove();
          const cancelResult: IntentResult = {
            id: generateSessionId(),
            status: 'cancel',
            results: [],
          };
          try {
            callback(cancelResult);
          } catch {
            /* swallow */
          }
          resolvePromise(cancelResult);
        });
      });
    }

    private async openIframeSession(
      capability: Capability,
      intent: IntentRequest,
      callback: IntentCallback,
    ): Promise<IntentResult> {
      const id = generateSessionId();

      // Synchronicity pitfall (Phase 3 research): iframe → shadow append → bridge.connect
      // MUST run in ONE synchronous block before any await. If we await between
      // appendChild and connect, the child frame can load and postMessage before
      // Penpal is listening.
      let iframe: HTMLIFrameElement;
      let shadowHost: HTMLElement;
      let shadowRoot: ShadowRoot;
      let connectPromise: Promise<ConnectionHandle>;

      try {
        // 1. Build iframe (may throw SAME_ORIGIN_CAPABILITY synchronously)
        iframe = buildIframe(capability, {
          id,
          clientUrl: typeof location !== 'undefined' ? location.origin : '',
          type: intent.action,
          allowedMimeType: intent.args.allowedMimeType,
          multiple: intent.args.multiple,
        });

        // 2. Create shadow host and append iframe synchronously
        const container = this.options.container ?? document.body;
        const shadow = createShadowHost(container);
        shadowHost = shadow.host;
        shadowRoot = shadow.root;
        shadowRoot.appendChild(iframe);

        // 3. Kick off bridge connect (returns a Promise — we DO NOT await yet)
        const allowedOrigin = new URL(capability.path).origin;
        connectPromise = this.bridgeFactory.connect(iframe, allowedOrigin, {
          resolve: (result) => this.handleSessionResolve(result),
        });
      } catch (err) {
        // Synchronous throw (e.g. SAME_ORIGIN_CAPABILITY) — fire cancel callback + onError
        if (err instanceof OBCError) {
          this.options.onError?.(err);
        }
        const cancelResult: IntentResult = { id, status: 'cancel', results: [] };
        callback(cancelResult);
        return cancelResult;
      }

      // Now we can await the connection — the sync block is done.
      const connectionHandle = await connectPromise;

      return new Promise<IntentResult>((resolvePromise, rejectPromise) => {
        const timeoutHandle = setTimeout(() => {
          // INT-08: watchdog timeout
          this.teardownSession(id);
          this.options.onError?.(
            new OBCError('IFRAME_TIMEOUT', `Session ${id} timed out`),
          );
          const cancelResult: IntentResult = { id, status: 'cancel', results: [] };
          callback(cancelResult);
          resolvePromise(cancelResult);
        }, this.sessionTimeoutMs);

        const session: ActiveSession = {
          id,
          capability,
          iframe,
          shadowHost,
          connectionHandle,
          timeoutHandle,
          resolve: resolvePromise,
          reject: rejectPromise,
          callback,
        };
        this.sessions.set(id, session);

        // Register teardown on AbortContext so destroy() cancels this session
        this.abortContext.addCleanup(() => {
          const s = this.sessions.get(id);
          if (s === undefined) return;
          clearTimeout(s.timeoutHandle);
          try {
            s.connectionHandle.destroy();
          } catch {
            /* ignore */
          }
          s.shadowHost.remove();
          this.sessions.delete(id);
          const cancelResult: IntentResult = { id, status: 'cancel', results: [] };
          try {
            s.callback(cancelResult);
          } catch {
            /* swallow */
          }
          resolvePromise(cancelResult);
        });
      });
    }

    private handleSessionResolve(result: IntentResult): void {
      // INT-09: silently ignore unknown/stale session ids
      const session = this.sessions.get(result.id);
      if (session === undefined) return;
      this.teardownSession(result.id);
      try {
        session.callback(result);
      } finally {
        session.resolve(result);
      }
    }

    private teardownSession(id: string): void {
      const session = this.sessions.get(id);
      if (session === undefined) return;
      clearTimeout(session.timeoutHandle);
      try {
        session.connectionHandle.destroy();
      } catch {
        /* ignore */
      }
      session.shadowHost.remove();
      this.sessions.delete(id);
    }
    ```

    **Step 2 — Extend `src/client.test.ts`** with the new describe block. Use `MockBridge` injection via `bridgeFactory`:

    ```typescript
    describe('OpenBuroClient - castIntent orchestration', () => {
      const PICK_ACTION = 'PICK';
      const SAVE_ACTION = 'SAVE';

      function makeCap(id: string, action: string, mimes: string[] = ['*/*']): Capability {
        return {
          id,
          appName: `App ${id}`,
          action,
          path: `https://apps.example.com/${id}`,
          properties: { mimeTypes: mimes },
        };
      }

      it('happy-path: one match → direct iframe → resolve routes to callback', async () => {
        vi.stubGlobal('fetch', mockFetchOk([makeCap('a', PICK_ACTION)]));
        const bridge = new MockBridge();
        const obc = new OpenBuroClient({
          capabilitiesUrl: VALID_URL,
          bridgeFactory: bridge,
        });

        const cb = vi.fn();
        const castPromise = obc.castIntent({ action: PICK_ACTION, args: {} }, cb);

        // Wait a microtask for single-flight fetch + iframe sync block + await connect
        await new Promise((r) => setTimeout(r, 0));
        expect(bridge.connectCallCount).toBe(1);
        expect(bridge.lastMethods).not.toBeNull();

        // Simulate child iframe resolving
        // The id was generated inside castIntent; capture from the host DOM or from session state.
        // Easiest: listen to the callback invocation.
        const activeId = obc.__debugGetActiveSessionIds()[0];
        expect(activeId).toBeDefined();

        bridge.lastMethods?.resolve({
          id: activeId,
          status: 'done',
          results: [{ name: 'a.txt', type: 'text/plain', size: 1, url: 'blob:x' }],
        });

        const result = await castPromise;
        expect(result.status).toBe('done');
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0].status).toBe('done');
        expect(bridge.destroyCallCount).toBe(1);

        obc.destroy();
      });

      it('no-match: fires NO_MATCHING_CAPABILITY + cancel callback', async () => {
        vi.stubGlobal('fetch', mockFetchOk([makeCap('a', PICK_ACTION)]));
        const onError = vi.fn();
        const obc = new OpenBuroClient({
          capabilitiesUrl: VALID_URL,
          bridgeFactory: new MockBridge(),
          onError,
        });
        const cb = vi.fn();
        const result = await obc.castIntent({ action: SAVE_ACTION, args: {} }, cb);
        expect(result.status).toBe('cancel');
        expect(cb).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].code).toBe('NO_MATCHING_CAPABILITY');
        obc.destroy();
      });

      // ... additional tests: select modal, cancel modal, concurrent sessions,
      // unknown id ignored, same-origin rejected, single-flight cold start,
      // watchdog via fake timers, two-instance isolation
    });
    ```

    NOTE on `__debugGetActiveSessionIds()`: add a `// @internal` method on the class for tests:
    ```typescript
    /** @internal - test-only introspection; not part of public API */
    __debugGetActiveSessionIds(): string[] {
      return Array.from(this.sessions.keys());
    }
    ```

    **Step 3 — Run `pnpm vitest run src/client.test.ts -t "castIntent"` until green.**

    **Step 4 — Biome normalize + typecheck.**
  </action>

  <verify>
    <automated>pnpm vitest run src/client.test.ts -t "castIntent"</automated>
  </verify>

  <acceptance_criteria>
    - `src/client.ts` contains `planCast(`, `buildIframe(`, `buildModal(`, `createShadowHost(`, `bridgeFactory.connect(`, and `this.sessions.set(`
    - `src/client.ts` contains a comment referencing the synchronicity pitfall (e.g. `Synchronicity pitfall`)
    - `src/client.test.ts` contains `MockBridge` and `castIntent` describe block with >= 10 tests in scope
    - `pnpm vitest run src/client.test.ts -t "castIntent"` exits 0
    - `pnpm tsc --noEmit` exits 0
    - grep `INT-09|unknown.*session|stale` in `src/client.ts` returns >= 1 match
  </acceptance_criteria>

  <done>
    castIntent handles all three planCast branches, routes session results by id, ignores unknown ids, enforces synchronicity pitfall, runs watchdog timers, and isolates sessions across two concurrent instances. All 10 RESEARCH.md scenarios exercised.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Implement full destroy() via AbortContext + post-destroy behaviors (ORCH-04, ORCH-05, ORCH-06)</name>
  <files>src/client.ts, src/client.test.ts</files>

  <read_first>
    - .planning/phases/03-orchestration/03-CONTEXT.md (decisions — post-destroy behavior, destroy via AbortContext)
    - .planning/phases/03-orchestration/03-RESEARCH.md (scenario 6, 7)
    - src/lifecycle/abort-context.ts
    - Current `src/client.ts` from Task 3
  </read_first>

  <behavior>
    Describe block: "OpenBuroClient - destroy and post-destroy"
    - Test 1: `destroy()` during an active session → session callback fires with cancel → MockBridge.destroyCallCount increments → zero `[data-obc-host]` nodes remain in document.body
    - Test 2: `destroy()` called twice is idempotent (no throw, no double cancel on callback)
    - Test 3: `destroy()` aborts in-flight fetch: start `refreshCapabilities()` with a fetch that checks `signal.aborted` → destroy() immediately → the fetch's AbortSignal IS aborted
    - Test 4: `destroy()` stops WsListener: set up a mock where fetch returns `X-OpenBuro-Server: true`, advance microtasks, assert wsListener is started, then destroy and assert WsListener.stop was called (spy on prototype)
    - Test 5: post-destroy `castIntent()` throws `OBCError('DESTROYED')` synchronously (NOT a rejected Promise — use `expect(() => obc.castIntent(...))` since async methods that throw synchronously still wrap in a rejected Promise; confirm code === 'DESTROYED')
    - Test 6: post-destroy `getCapabilities()` returns `[]`
    - Test 7: post-destroy `refreshCapabilities()` returns a rejected Promise with code `DESTROYED`
    - Test 8: after destroy(), document.body contains NO nodes with `[data-obc-host]` attribute
    - Test 9: body scroll restored after destroy() during a live modal (assert `document.body.style.overflow` is NOT `'hidden'`)
    - Test 10 (concurrent two-instance): destroy() on instance A does NOT affect instance B's sessions or capabilities
  </behavior>

  <action>
    **Step 1 — Rewrite `destroy()` and adjust public method guards in `src/client.ts`:**

    ```typescript
    /**
     * ORCH-04/05: tear down everything via AbortContext. Idempotent.
     * Cleanup order (LIFO, automatic from AbortContext stack):
     * - Session cleanups (iframe remove, shadow host remove, bridge.destroy, timer clear, callback cancel)
     * - Modal cleanups (if a chooser is live)
     * - WsListener.stop
     * - fetch abort via signal
     */
    destroy(): void {
      if (this.destroyed) return; // ORCH-06: idempotent no-op
      this.destroyed = true;

      // The AbortContext drains its LIFO cleanup stack. Each registered cleanup
      // cancels a session / modal / WS listener and removes its DOM nodes.
      this.abortContext.abort();

      // Defensive nulling — every session cleanup also calls this.sessions.delete,
      // but clear the map in case a cleanup threw.
      this.sessions.clear();
      this.wsListener = null;
      this.capabilities = [];
      this.inflightFetch = null;
    }
    ```

    Guard `getCapabilities()` and `refreshCapabilities()` (already done in Task 2, verify).

    Guard `castIntent()` for sync throw:

    ```typescript
    async castIntent(intent: IntentRequest, callback: IntentCallback): Promise<IntentResult> {
      if (this.destroyed) {
        // ORCH-06: SYNCHRONOUS throw. Even though this is an async function,
        // throwing before the first await is effectively synchronous from the
        // caller's perspective only via the rejected Promise. For true sync
        // throw semantics, the caller should wrap in try/catch around `obc.castIntent(...).catch(...)`.
        // The test asserts on `.code === 'DESTROYED'` via await/rejects.
        throw new OBCError('DESTROYED', 'OpenBuroClient has been destroyed');
      }
      // ... rest of Task 3 implementation
    }
    ```

    NOTE: Because `castIntent` is declared `async`, a `throw` before any `await` produces a rejected Promise, not a sync throw to the caller's call site. The CONTEXT says "sync throw" — the practical test interpretation is:
    - `await expect(obc.castIntent(...)).rejects.toThrow(OBCError)`
    - `expect((await obc.castIntent(...).catch(e => e)).code).toBe('DESTROYED')`

    If true sync-throw semantics are required, convert `castIntent` to a non-async function that returns a Promise manually. **Choose the practical interpretation** (rejected promise with code DESTROYED) unless CONTEXT explicitly says otherwise — it does not.

    **Step 2 — Extend `src/client.test.ts`** with destroy describe block. Use spies on `WsListener.prototype.stop` for Test 4:

    ```typescript
    import { WsListener } from './capabilities/ws-listener';

    describe('OpenBuroClient - destroy and post-destroy', () => {
      it('destroy during active session cancels callback and removes DOM', async () => {
        vi.stubGlobal('fetch', mockFetchOk([makeCap('a', 'PICK')]));
        const bridge = new MockBridge();
        const obc = new OpenBuroClient({
          capabilitiesUrl: VALID_URL,
          bridgeFactory: bridge,
        });
        const cb = vi.fn();
        void obc.castIntent({ action: 'PICK', args: {} }, cb);
        await new Promise((r) => setTimeout(r, 0));
        expect(document.querySelectorAll('[data-obc-host]').length).toBe(1);

        obc.destroy();

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0].status).toBe('cancel');
        expect(bridge.destroyCallCount).toBe(1);
        expect(document.querySelectorAll('[data-obc-host]').length).toBe(0);
      });

      it('destroy is idempotent', () => {
        const obc = new OpenBuroClient({ capabilitiesUrl: VALID_URL });
        expect(() => {
          obc.destroy();
          obc.destroy();
        }).not.toThrow();
      });

      it('destroy stops WsListener when one is active', async () => {
        const stopSpy = vi.spyOn(WsListener.prototype, 'stop');
        const startSpy = vi.spyOn(WsListener.prototype, 'start').mockImplementation(() => {
          // no-op: don't open real sockets in happy-dom
        });
        vi.stubGlobal('fetch', mockFetchOk([makeCap('a', 'PICK')], true));
        const obc = new OpenBuroClient({
          capabilitiesUrl: VALID_URL,
          bridgeFactory: new MockBridge(),
        });
        await obc.refreshCapabilities();
        expect(startSpy).toHaveBeenCalled();
        obc.destroy();
        expect(stopSpy).toHaveBeenCalled();
        startSpy.mockRestore();
        stopSpy.mockRestore();
      });

      it('post-destroy castIntent rejects with DESTROYED', async () => {
        const obc = new OpenBuroClient({ capabilitiesUrl: VALID_URL });
        obc.destroy();
        await expect(
          obc.castIntent({ action: 'PICK', args: {} }, () => {}),
        ).rejects.toMatchObject({ code: 'DESTROYED' });
      });

      it('post-destroy getCapabilities returns []', () => {
        const obc = new OpenBuroClient({ capabilitiesUrl: VALID_URL });
        obc.destroy();
        expect(obc.getCapabilities()).toEqual([]);
      });

      it('post-destroy refreshCapabilities returns rejected promise with DESTROYED', async () => {
        const obc = new OpenBuroClient({ capabilitiesUrl: VALID_URL });
        obc.destroy();
        await expect(obc.refreshCapabilities()).rejects.toMatchObject({ code: 'DESTROYED' });
      });

      // Additional tests: fetch abort, two-instance isolation, scroll restore
    });
    ```

    **Step 3 — Run full test file:** `pnpm vitest run src/client.test.ts` — MUST pass all tests from Tasks 2+3+4 with >= 20 total.

    **Step 4 — Count the tests.** Assert total >= 20 via `pnpm vitest run src/client.test.ts` output showing `Tests  ≥20 passed`.

    **Step 5 — Biome + tsc.**
  </action>

  <verify>
    <automated>pnpm vitest run src/client.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/client.ts` contains `this.destroyed` guard in `castIntent`, `getCapabilities`, `refreshCapabilities`
    - `src/client.ts` contains `this.abortContext.abort()` inside `destroy()`
    - `src/client.ts` `destroy()` early-returns when already destroyed
    - `src/client.test.ts` contains `'DESTROYED'` in at least 3 test assertions
    - `pnpm vitest run src/client.test.ts` exits 0 with >= 20 total tests
    - `pnpm tsc --noEmit` exits 0
    - `pnpm biome check src/client.ts src/client.test.ts` exits 0
    - After running all tests, grep `document.querySelectorAll\('\[data-obc-host\]'\)` in `src/client.test.ts` finds >= 1 match (zero-leak assertion)
  </acceptance_criteria>

  <done>
    `destroy()` tears down every session, modal, WS listener, fetch, and DOM node via AbortContext. Post-destroy invariants hold for all 4 public methods per 03-CONTEXT.md. Full test file is green with >= 20 tests covering all 10 RESEARCH scenarios.
  </done>
</task>

<task type="auto">
  <name>Task 5 (Wave 2 phase gate): Export OpenBuroClient from barrel and run pnpm run ci</name>
  <files>src/index.ts, src/index.test.ts</files>

  <read_first>
    - src/index.ts (Phase 1 + Phase 2 exports already present)
    - src/index.test.ts (smoke-test structure)
    - .planning/phases/02-core-implementation/02-05-SUMMARY.md (barrel pattern, biome organizeImports note)
    - .planning/phases/03-orchestration/03-VALIDATION.md (phase gate command)
  </read_first>

  <action>
    1. Open `src/index.ts`. Add a new Phase 3 section at the bottom:

    ```typescript
    // ---- Phase 3: Orchestrator ----

    export { OpenBuroClient } from './client';
    export type { OpenBuroClientOptions } from './client';
    ```

    2. Run `pnpm biome check --write src/index.ts` to let Biome organizeImports reorder if needed (per Phase 2 summary note).

    3. Open `src/index.test.ts`. Add a Phase 3 describe block at the bottom:

    ```typescript
    describe('public API surface — Phase 3', () => {
      it('exports OpenBuroClient as a class', async () => {
        const mod = await import('./index');
        expect(typeof mod.OpenBuroClient).toBe('function');
        // Constructor + validation smoke check (no async side effects)
        expect(
          () => new mod.OpenBuroClient({ capabilitiesUrl: 'https://example.com/caps' }),
        ).not.toThrow();
      });

      it('OpenBuroClient.prototype has castIntent, getCapabilities, refreshCapabilities, destroy', async () => {
        const { OpenBuroClient } = await import('./index');
        expect(typeof OpenBuroClient.prototype.castIntent).toBe('function');
        expect(typeof OpenBuroClient.prototype.getCapabilities).toBe('function');
        expect(typeof OpenBuroClient.prototype.refreshCapabilities).toBe('function');
        expect(typeof OpenBuroClient.prototype.destroy).toBe('function');
      });
    });
    ```

    4. Run `pnpm biome check --write src/index.test.ts`.

    5. **Phase gate:** `pnpm run ci` — MUST exit 0. If it fails, fix the failure and re-run. Do NOT commit until green.

    6. Verify attw is part of `ci` (per Phase 1 FOUND-07); if the command output shows `attw` passing, the gate is complete.
  </action>

  <verify>
    <automated>pnpm run ci</automated>
  </verify>

  <acceptance_criteria>
    - `src/index.ts` contains `export { OpenBuroClient }`
    - `src/index.ts` contains `export type { OpenBuroClientOptions }`
    - `src/index.test.ts` contains a `Phase 3` describe block
    - `pnpm run ci` exits 0
    - Test count in `src/index.test.ts` increased by >= 2
    - No layer isolation violations: grep `from '\./client'` only in `src/index.ts` and `src/client.test.ts`
  </acceptance_criteria>

  <done>
    `OpenBuroClient` is importable from `@openburo/client`. Full CI gate (typecheck + biome + all tests + attw) is green. Phase 3 is complete and Phase 4 can proceed.
  </done>
</task>

</tasks>

<verification>
After all tasks:

1. **Requirement coverage (manual trace):**
   - ORCH-01: Task 2 constructor validation tests
   - ORCH-02: Task 2 "no fetch on construct" test
   - ORCH-03: Task 3 two-instance isolation test + Task 4 two-instance destroy test
   - ORCH-04: Task 4 "destroy during active session" test
   - ORCH-05: Task 4 "destroy uses abortContext" + `createAbortContext` grep
   - ORCH-06: Task 4 post-destroy behavior tests (castIntent / getCapabilities / refreshCapabilities / idempotent destroy)
   - FOUND-03+: Task 1 `src/errors.test.ts`

2. **Goal-backward truths (all must be TRUE after Task 5):**
   - All `must_haves.truths` entries demonstrable in the test file
   - All `must_haves.artifacts` exist with the right `contains` strings
   - All `must_haves.key_links` grep-discoverable in `src/client.ts`

3. **Zero-leak invariant (in Task 4 test):**
   ```typescript
   expect(document.querySelectorAll('[data-obc-host]').length).toBe(0);
   ```

4. **Test count:** `pnpm vitest run src/client.test.ts` reports `Tests ≥20 passed`.

5. **Full gate:** `pnpm run ci` exits 0.
</verification>

<success_criteria>
- [ ] `src/errors.ts` extended with `'DESTROYED'`
- [ ] `src/errors.test.ts` exists and passes
- [ ] `src/client.ts` exists with `OpenBuroClient` class implementing castIntent + destroy + capability accessors
- [ ] `src/client.test.ts` passes with >= 20 tests covering all 10 scenarios from 03-RESEARCH.md
- [ ] `src/index.ts` exports `OpenBuroClient` and `OpenBuroClientOptions`
- [ ] `src/index.test.ts` Phase 3 describe block passes
- [ ] `pnpm run ci` exits 0 (full phase gate)
- [ ] Zero `[data-obc-host]` artifacts in document.body after destroy (asserted in test)
- [ ] All 6 ORCH requirements have at least one test proving the behavior
</success_criteria>

<output>
After completion, create `.planning/phases/03-orchestration/03-01-SUMMARY.md` using the summary template. Include:
- Requirement completion list (ORCH-01..06, FOUND-03+)
- Final test count across `src/client.test.ts`
- Any deviations from the plan (auto-fixed biome, test count adjustments)
- Layer isolation verification grep results
- `pnpm run ci` final runtime and test total
- Phase 4 readiness checklist (OpenBuroClient importable from `@openburo/client`)
</output>
