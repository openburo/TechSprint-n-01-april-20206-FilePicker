---
phase: 02-core-implementation
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - src/messaging/bridge-adapter.ts
  - src/messaging/bridge-adapter.test.ts
  - src/messaging/mock-bridge.ts
  - src/messaging/mock-bridge.test.ts
  - src/messaging/penpal-bridge.ts
  - src/messaging/penpal-bridge.test.ts
autonomous: true
requirements:
  - MSG-01
  - MSG-02
  - MSG-03
  - MSG-04
  - MSG-05
  - MSG-06

must_haves:
  truths:
    - "BridgeAdapter interface is defined with connect(iframe, allowedOrigin, methods, timeoutMs?) → Promise<ConnectionHandle>"
    - "Penpal is imported ONLY inside src/messaging/penpal-bridge.ts — no other file in the codebase mentions 'penpal'"
    - "PenpalBridge uses the v7 API: connect({ messenger: new WindowMessenger({ remoteWindow, allowedOrigins }), methods, timeout }) — NOT connectToChild"
    - "PenpalBridge.connect() passes [allowedOrigin] (single-element array) as WindowMessenger allowedOrigins"
    - "MockBridge implements BridgeAdapter and exposes lastMethods for tests to invoke parent.resolve() manually"
    - "ConnectionHandle.destroy() tears down the Penpal connection"
  artifacts:
    - path: "src/messaging/bridge-adapter.ts"
      provides: "BridgeAdapter + ConnectionHandle + ParentMethods interfaces — pure types, no runtime code"
      exports: ["BridgeAdapter", "ConnectionHandle", "ParentMethods"]
      min_lines: 20
    - path: "src/messaging/mock-bridge.ts"
      provides: "MockBridge implements BridgeAdapter for unit tests"
      exports: ["MockBridge"]
      min_lines: 25
    - path: "src/messaging/penpal-bridge.ts"
      provides: "PenpalBridge implements BridgeAdapter using Penpal v7 connect + WindowMessenger"
      exports: ["PenpalBridge"]
      min_lines: 30
  key_links:
    - from: "src/messaging/penpal-bridge.ts"
      to: "penpal package (SOLE import site)"
      via: "import { connect, WindowMessenger } from 'penpal'"
      pattern: "from \"penpal\""
    - from: "src/messaging/penpal-bridge.ts"
      to: "Penpal v7 connect API (NOT v6 connectToChild)"
      via: "connect({ messenger, methods, timeout })"
      pattern: "connect\\(\\{"
    - from: "src/messaging/mock-bridge.ts"
      to: "BridgeAdapter interface"
      via: "implements BridgeAdapter"
      pattern: "implements BridgeAdapter"
---

<objective>
Build the Messaging layer — the `BridgeAdapter` interface plus two implementations: `PenpalBridge` (real, Penpal v7 `connect` + `WindowMessenger`) and `MockBridge` (test double). The `BridgeAdapter` interface is the _only_ seam between the orchestrator and Penpal. Outside of `src/messaging/penpal-bridge.ts`, the word "penpal" must not appear anywhere in the codebase (grep-enforceable).

Purpose: The orchestrator (Phase 3) holds a `BridgeAdapter` instance (injected via test hook or defaulting to `PenpalBridge`) and calls `connect(iframe, allowedOrigin, methods)` to open each session. `MockBridge` lets Phase 3 orchestrator tests exercise the full session lifecycle without real iframes. `PenpalBridge` is tested via a `vi.mock("penpal")` spy that verifies `connect()` is called with the exact v7 arguments (we do NOT try to complete a real handshake in happy-dom).

Output:
- `src/messaging/bridge-adapter.ts` + test (Node env — pure types, test is a compile-time smoke)
- `src/messaging/mock-bridge.ts` + test (happy-dom env)
- `src/messaging/penpal-bridge.ts` + test (happy-dom env with `vi.mock("penpal")`)
</objective>

<execution_context>
@/home/ben/.claude/get-shit-done/workflows/execute-plan.md
@/home/ben/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-core-implementation/02-CONTEXT.md
@.planning/phases/02-core-implementation/02-RESEARCH.md
@.planning/phases/01-foundations/01-01-SUMMARY.md
@src/types.ts
@src/errors.ts

<interfaces>
<!-- Types already exported from Phase 1. -->

From src/types.ts:
```typescript
export interface IntentResult {
  id: string;
  status: "done" | "cancel";
  results: FileResult[];
}
```

**Penpal v7 API (verified against installed penpal@7.0.6 type declarations in 02-RESEARCH.md line ~702):**
```typescript
// from 'penpal' package
export function connect<TMethods>(opts: {
  messenger: Messenger;
  methods?: LocalMethods;
  timeout?: number;
  channel?: string;
  log?: Log;
}): Connection<TMethods>;

export type Connection<TMethods> = {
  promise: Promise<RemoteProxy<TMethods>>;
  destroy: () => void;
};

export class WindowMessenger {
  constructor(opts: {
    remoteWindow: Window;
    allowedOrigins: (string | RegExp)[];
  });
}
```

**DO NOT use `connectToChild` or `connectToParent` — those are Penpal v6 and do not exist in v7.**
</interfaces>

<locked_timing>
From 02-CONTEXT.md (user-confirmed): Penpal handshake timeout: **10 seconds**
</locked_timing>
</context>

<tasks>

<task type="auto">
  <name>Task 1: BridgeAdapter interface + ConnectionHandle + ParentMethods types (MSG-01, MSG-04)</name>
  <files>src/messaging/bridge-adapter.ts, src/messaging/bridge-adapter.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (bridge-adapter.ts section, Pattern 7)
    - .planning/phases/02-core-implementation/02-CONTEXT.md
    - src/types.ts (IntentResult)
  </read_first>

  <action>
    Create `src/messaging/bridge-adapter.ts` — pure types, no runtime code. Verbatim from 02-RESEARCH.md lines ~714-733, adjusted for double quotes:

    ```typescript
    import type { IntentResult } from "../types.js";

    /** Handle returned from BridgeAdapter.connect() — tears down on destroy(). */
    export interface ConnectionHandle {
      destroy(): void;
    }

    /**
     * Methods exposed by the parent (host page) to the child iframe via Penpal.
     *
     * MSG-04: `resolve` is bound per session — the orchestrator supplies a closure
     * that captures the specific sessionId so IntentResults route to the correct
     * ActiveSession in the session Map. The child iframe calls `parent.resolve(result)`
     * and the closure re-enters orchestrator state with the right key.
     */
    export interface ParentMethods {
      resolve(result: IntentResult): void;
    }

    /**
     * MSG-01: The interface sits between the orchestrator and Penpal. No file
     * other than src/messaging/penpal-bridge.ts is allowed to import 'penpal'.
     *
     * Implementations: PenpalBridge (production) and MockBridge (tests).
     */
    export interface BridgeAdapter {
      connect(
        iframe: HTMLIFrameElement,
        allowedOrigin: string,
        methods: ParentMethods,
        timeoutMs?: number
      ): Promise<ConnectionHandle>;
    }
    ```

    Use **type-only import** for `IntentResult`. Use **double quotes**. Nothing else in this file — no classes, no constants.

    Create `src/messaging/bridge-adapter.test.ts` — this is a **compile-time smoke test**. Because BridgeAdapter is type-only, the test exists to ensure the types are importable from the barrel and that a fictional implementation compiles. Minimum content:

    ```typescript
    import { describe, expect, it } from "vitest";
    import type {
      BridgeAdapter,
      ConnectionHandle,
      ParentMethods,
    } from "./bridge-adapter.js";
    import type { IntentResult } from "../types.js";

    describe("bridge-adapter types", () => {
      it("ParentMethods.resolve signature accepts IntentResult", () => {
        const methods: ParentMethods = {
          resolve: (_result: IntentResult) => {
            /* intentionally empty */
          },
        };
        methods.resolve({ id: "test", status: "cancel", results: [] });
        expect(typeof methods.resolve).toBe("function");
      });

      it("ConnectionHandle has destroy method", () => {
        const handle: ConnectionHandle = {
          destroy: () => {
            /* intentionally empty */
          },
        };
        handle.destroy();
        expect(typeof handle.destroy).toBe("function");
      });

      it("BridgeAdapter can be implemented by a plain object", async () => {
        // This test exists to guarantee the interface surface never silently changes.
        const fakeAdapter: BridgeAdapter = {
          connect: async (_iframe, _origin, _methods, _timeoutMs) => ({
            destroy: () => {
              /* intentionally empty */
            },
          }),
        };
        const handle = await fakeAdapter.connect(
          null as unknown as HTMLIFrameElement,
          "https://cap.example.com",
          { resolve: () => {} }
        );
        expect(handle.destroy).toBeDefined();
      });
    });
    ```

    This file runs in Node env (no docblock). It does NOT exercise DOM. The `null as unknown as HTMLIFrameElement` cast is intentional — the fake adapter does not use the iframe argument.

    **Wave-ordering note:** This task is the FIRST TASK of Plan 02-04 and should be committed before Plan 02-02's Task 2 (`src/intent/session.ts`). Plan 02-02 Task 2 imports `ConnectionHandle` from this file. Because both plans run in Wave 1 with shared working tree, the executor of Plan 02-02 Task 2 should verify this file exists before committing session.ts.
  </action>

  <verify>
    <automated>pnpm vitest run src/messaging/bridge-adapter.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/messaging/bridge-adapter.ts` exports `BridgeAdapter`, `ConnectionHandle`, `ParentMethods`
    - `src/messaging/bridge-adapter.ts` contains the literal `import type { IntentResult }`
    - `src/messaging/bridge-adapter.ts` does NOT contain `import { connect`
    - `src/messaging/bridge-adapter.ts` does NOT contain the literal `penpal`
    - `src/messaging/bridge-adapter.ts` does NOT contain `function` or `class` declarations (pure types only)
    - `src/messaging/bridge-adapter.test.ts` contains at least 3 `it(` or `test(` calls
    - `pnpm vitest run src/messaging/bridge-adapter.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    BridgeAdapter surface defined; ConnectionHandle and ParentMethods exported; compile-time smoke test green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: MockBridge implementation for unit tests (MSG-05)</name>
  <files>src/messaging/mock-bridge.ts, src/messaging/mock-bridge.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (mock-bridge.ts section, MockBridge usage in orchestrator tests)
    - .planning/phases/02-core-implementation/02-CONTEXT.md
    - src/messaging/bridge-adapter.ts
  </read_first>

  <behavior>
    - MockBridge implements BridgeAdapter
    - new MockBridge() starts with lastMethods=null, connectCallCount=0, destroyCallCount=0
    - mock.connect(iframe, origin, methods) returns a ConnectionHandle
    - After connect(), lastMethods === the methods object passed in
    - After connect(), connectCallCount === 1
    - handle.destroy() increments destroyCallCount
    - Calling connect() twice increments connectCallCount and overwrites lastMethods
  </behavior>

  <action>
    Create `src/messaging/mock-bridge.ts` verbatim from 02-RESEARCH.md lines ~793-816, adjusted for double quotes:

    ```typescript
    import type {
      BridgeAdapter,
      ConnectionHandle,
      ParentMethods,
    } from "./bridge-adapter.js";

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
        _timeoutMs?: number
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
    ```

    **Biome note:** Unused parameters are prefixed with `_` to satisfy Biome's `noUnusedVariables` rule. The `implements BridgeAdapter` clause forces the parameter names even when unused.

    Create `src/messaging/mock-bridge.test.ts` with FIRST LINE `// @vitest-environment happy-dom` (because the test uses `HTMLIFrameElement` — even though MockBridge never touches it, we pass a real element to match production call sites). At least **6 tests**:

    1. New MockBridge() initializes counters to 0 and lastMethods to null
    2. connect(iframe, origin, methods) returns a ConnectionHandle with a destroy function
    3. After connect, lastMethods === methods (reference equality)
    4. After connect, connectCallCount === 1
    5. handle.destroy() called once → destroyCallCount === 1
    6. Multiple connects increment count and overwrite lastMethods; destroy from each handle increments destroyCallCount independently (two connects + two destroys → destroyCallCount === 2)

    Test helper: create a real iframe via `document.createElement("iframe")` and pass it as the first argument (MockBridge does not touch it).
  </action>

  <verify>
    <automated>pnpm vitest run src/messaging/mock-bridge.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/messaging/mock-bridge.ts` exports `MockBridge`
    - `src/messaging/mock-bridge.ts` contains the literal `implements BridgeAdapter`
    - `src/messaging/mock-bridge.ts` contains the literal `lastMethods`
    - `src/messaging/mock-bridge.ts` contains the literal `connectCallCount`
    - `src/messaging/mock-bridge.ts` contains the literal `destroyCallCount`
    - `src/messaging/mock-bridge.ts` does NOT contain the literal `penpal`
    - `src/messaging/mock-bridge.ts` does NOT contain `import { connect`
    - `src/messaging/mock-bridge.test.ts` first line contains `@vitest-environment happy-dom`
    - `src/messaging/mock-bridge.test.ts` contains at least 6 `it(` or `test(` calls
    - `pnpm vitest run src/messaging/mock-bridge.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    MockBridge implements BridgeAdapter; all 3 counters + lastMethods verified across 6+ tests.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: PenpalBridge — real Penpal v7 connect + WindowMessenger (MSG-02, MSG-03, MSG-06)</name>
  <files>src/messaging/penpal-bridge.ts, src/messaging/penpal-bridge.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (penpal-bridge.ts section Pattern 7, Spike 2: Penpal v7 Handshake Test Fixture, Pitfall 1)
    - .planning/phases/02-core-implementation/02-CONTEXT.md (locked 10s timeout)
    - src/messaging/bridge-adapter.ts
    - node_modules/penpal/dist/penpal.d.ts (verify the connect signature)
  </read_first>

  <behavior>
    - PenpalBridge implements BridgeAdapter
    - PenpalBridge.connect(iframe, origin, methods) calls Penpal's connect() with { messenger: new WindowMessenger({ remoteWindow: iframe.contentWindow, allowedOrigins: [origin] }), methods, timeout }
    - PenpalBridge passes timeoutMs to Penpal connect() (default 10000)
    - PenpalBridge throws synchronously if iframe.contentWindow is null
    - PenpalBridge.connect() awaits connection.promise before resolving
    - The returned ConnectionHandle.destroy() calls the underlying Penpal connection.destroy()
  </behavior>

  <action>
    Create `src/messaging/penpal-bridge.ts` — the SOLE file in the codebase that imports from "penpal". Verbatim from 02-RESEARCH.md lines ~737-774, adjusted for double quotes:

    ```typescript
    // MSG-01: This is the ONLY file in the codebase that imports from 'penpal'.
    // All other layers must depend on BridgeAdapter instead.
    import { connect, WindowMessenger } from "penpal";
    import type {
      BridgeAdapter,
      ConnectionHandle,
      ParentMethods,
    } from "./bridge-adapter.js";

    export class PenpalBridge implements BridgeAdapter {
      async connect(
        iframe: HTMLIFrameElement,
        allowedOrigin: string,
        methods: ParentMethods,
        timeoutMs = 10_000
      ): Promise<ConnectionHandle> {
        const remoteWindow = iframe.contentWindow;
        if (!remoteWindow) {
          throw new Error(
            "iframe has no contentWindow — ensure it is attached to the DOM before connecting"
          );
        }

        // MSG-03: restrict to specific capability origin per session
        const messenger = new WindowMessenger({
          remoteWindow,
          allowedOrigins: [allowedOrigin],
        });

        // MSG-02: Penpal v7 connect() API — NOT connectToChild
        const connection = connect<Record<string, never>>({
          messenger,
          methods,
          timeout: timeoutMs,
        });

        // Wait for handshake to complete
        await connection.promise;

        // MSG-06: destroy tears down the Penpal connection
        return {
          destroy: () => {
            connection.destroy();
          },
        };
      }
    }
    ```

    **Critical synchronicity rule (Pitfall 1, for the orchestrator in Phase 3):** The orchestrator must call `buildIframe() → shadowRoot.appendChild(iframe) → bridge.connect(iframe, ...)` in a single synchronous block, with no `await` between appendChild and connect. This plan does not enforce that — it's an orchestrator-level rule — but do NOT add any code that delays the call (no setTimeout, no onload listener). The PenpalBridge itself is synchronous until `await connection.promise`.

    Create `src/messaging/penpal-bridge.test.ts` with FIRST LINE `// @vitest-environment happy-dom`. Use `vi.mock("penpal")` to spy on the Penpal API calls — we do NOT attempt a real handshake in happy-dom (Spike 2 in 02-RESEARCH.md explains why).

    Exact mock shape:

    ```typescript
    // @vitest-environment happy-dom

    import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

    // Mock Penpal BEFORE importing PenpalBridge so the class picks up the mock.
    const mockDestroy = vi.fn();
    const mockConnectionPromise = vi.fn();

    vi.mock("penpal", () => {
      return {
        connect: vi.fn(() => ({
          promise: Promise.resolve({}),
          destroy: mockDestroy,
        })),
        WindowMessenger: vi.fn().mockImplementation((opts) => ({
          _mockOpts: opts, // capture constructor args
        })),
      };
    });

    // Import AFTER vi.mock so the mock is in place
    import { connect, WindowMessenger } from "penpal";
    import { PenpalBridge } from "./penpal-bridge.js";

    describe("PenpalBridge", () => {
      let iframe: HTMLIFrameElement;

      beforeEach(() => {
        vi.clearAllMocks();
        iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
      });

      afterEach(() => {
        iframe.remove();
      });

      it("calls WindowMessenger with remoteWindow and single-origin allowedOrigins", async () => {
        const bridge = new PenpalBridge();
        await bridge.connect(iframe, "https://cap.example.com", {
          resolve: () => {},
        });

        expect(WindowMessenger).toHaveBeenCalledTimes(1);
        const ctorArgs = (WindowMessenger as unknown as vi.Mock).mock.calls[0]?.[0];
        expect(ctorArgs?.remoteWindow).toBe(iframe.contentWindow);
        expect(ctorArgs?.allowedOrigins).toEqual(["https://cap.example.com"]);
      });

      it("calls Penpal connect() with messenger, methods, and default timeout 10000", async () => {
        const bridge = new PenpalBridge();
        const methods = { resolve: vi.fn() };
        await bridge.connect(iframe, "https://cap.example.com", methods);

        expect(connect).toHaveBeenCalledTimes(1);
        const connectArgs = (connect as unknown as vi.Mock).mock.calls[0]?.[0];
        expect(connectArgs?.methods).toBe(methods);
        expect(connectArgs?.timeout).toBe(10000);
        expect(connectArgs?.messenger).toBeDefined();
      });

      it("passes custom timeoutMs to Penpal connect()", async () => {
        const bridge = new PenpalBridge();
        await bridge.connect(iframe, "https://cap.example.com", { resolve: () => {} }, 5000);

        const connectArgs = (connect as unknown as vi.Mock).mock.calls[0]?.[0];
        expect(connectArgs?.timeout).toBe(5000);
      });

      it("returned ConnectionHandle.destroy() invokes Penpal destroy", async () => {
        const bridge = new PenpalBridge();
        const handle = await bridge.connect(iframe, "https://cap.example.com", {
          resolve: () => {},
        });

        handle.destroy();
        expect(mockDestroy).toHaveBeenCalledTimes(1);
      });

      it("throws when iframe.contentWindow is null", async () => {
        const bridge = new PenpalBridge();
        const detachedIframe = document.createElement("iframe");
        // do NOT append to DOM — contentWindow may still exist in happy-dom, so override:
        Object.defineProperty(detachedIframe, "contentWindow", { value: null });

        await expect(
          bridge.connect(detachedIframe, "https://cap.example.com", { resolve: () => {} })
        ).rejects.toThrow(/contentWindow/);
      });

      it("does NOT import penpal at runtime from any other file path", () => {
        // Smoke test: verify this test file's mock is the one being consumed.
        // If PenpalBridge somehow bypassed vi.mock (e.g., dynamic import), connect
        // would be the real Penpal function and this assertion would fail.
        expect(vi.isMockFunction(connect)).toBe(true);
      });
    });
    ```

    **happy-dom caveat:** In happy-dom 20.8.9, `iframe.contentWindow` may return a non-null stub object. If test 5 (null contentWindow) fails because happy-dom auto-provides a window, use `Object.defineProperty` with `value: null` as shown above.

    DO NOT attempt a real Penpal handshake in this test file. Spike 2 in 02-RESEARCH.md documents why (happy-dom `window.open()` is limited). Real handshake correctness is deferred to Phase 4 Playwright tests.
  </action>

  <verify>
    <automated>pnpm vitest run src/messaging/penpal-bridge.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/messaging/penpal-bridge.ts` exports `PenpalBridge`
    - `src/messaging/penpal-bridge.ts` contains the literal `from "penpal"`
    - `src/messaging/penpal-bridge.ts` contains the literal `new WindowMessenger`
    - `src/messaging/penpal-bridge.ts` contains the literal `allowedOrigins: [allowedOrigin]`
    - `src/messaging/penpal-bridge.ts` contains the literal `timeout: timeoutMs`
    - `src/messaging/penpal-bridge.ts` contains the literal `timeoutMs = 10_000` OR `timeoutMs = 10000`
    - `src/messaging/penpal-bridge.ts` does NOT contain the literal `connectToChild`
    - `src/messaging/penpal-bridge.ts` does NOT contain the literal `connectToParent`
    - `src/messaging/penpal-bridge.ts` does NOT contain the literal `document.body` (messaging layer does not touch DOM except via the iframe passed in)
    - `src/messaging/penpal-bridge.test.ts` first line contains `@vitest-environment happy-dom`
    - `src/messaging/penpal-bridge.test.ts` contains the literal `vi.mock("penpal"` or `vi.mock('penpal'`
    - `src/messaging/penpal-bridge.test.ts` contains at least 5 `it(` or `test(` calls
    - `pnpm vitest run src/messaging/penpal-bridge.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
    - `grep -rn "from \"penpal\"" src/ --include="*.ts" | grep -v "penpal-bridge.ts" | grep -v ".test.ts"` returns nothing (penpal import is exclusive to penpal-bridge.ts and its own test)
  </acceptance_criteria>

  <done>
    PenpalBridge uses v7 API verbatim; vi.mock spies confirm correct argument shape; 10s default timeout locked; destroy() plumbing verified; no stray penpal imports.
  </done>
</task>

</tasks>

<verification>
All three tasks produce green test runs. Only `src/messaging/penpal-bridge.ts` imports penpal; grep across the entire `src/` directory (excluding penpal-bridge.ts and its test) returns no penpal references. `connectToChild` and `connectToParent` do not appear anywhere.
</verification>

<success_criteria>
- `pnpm vitest run src/messaging/` exits 0 with 14+ tests (3 bridge-adapter + 6 mock-bridge + 5+ penpal-bridge)
- `pnpm run ci` exits 0
- `grep -r "penpal" src/ --include="*.ts" | grep -v "src/messaging/penpal-bridge"` returns nothing
- `grep -r "connectToChild\|connectToParent" src/` returns nothing
- All 6 requirement IDs (MSG-01..06) covered
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-implementation/02-04-SUMMARY.md`. Record:
- Per-file test counts
- Whether happy-dom iframe.contentWindow auto-provided a stub (required Object.defineProperty override)
- Confirmation that `vi.mock("penpal")` intercepts the import correctly in Vitest 4
- Any Penpal v7 type mismatches between 02-RESEARCH.md documentation and actual 7.0.6 declarations (should be none)
</output>
