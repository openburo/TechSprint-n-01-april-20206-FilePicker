---
phase: 02-core-implementation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/capabilities/resolver.ts
  - src/capabilities/resolver.test.ts
  - src/capabilities/loader.ts
  - src/capabilities/loader.test.ts
  - src/capabilities/ws-listener.ts
  - src/capabilities/ws-listener.test.ts
autonomous: true
requirements:
  - CAP-01
  - CAP-02
  - CAP-03
  - CAP-04
  - CAP-05
  - CAP-06
  - CAP-07
  - RES-01
  - RES-02
  - RES-03
  - RES-04
  - RES-05
  - RES-06
  - WS-01
  - WS-02
  - WS-03
  - WS-04
  - WS-05
  - WS-06
  - WS-07

must_haves:
  truths:
    - "resolve(capabilities, intent) returns only capabilities whose action matches intent.action"
    - "resolve() treats absent/empty allowedMimeType as match-all"
    - "resolve() treats '*/*' (from intent OR capability.mimeTypes) as match-all"
    - "resolve() exact-mime-matches capability.mimeTypes against intent.allowedMimeType"
    - "fetchCapabilities(url, signal) rejects with OBCError(CAPABILITIES_FETCH_FAILED) on non-https URL in https context"
    - "fetchCapabilities() returns { capabilities, isOpenBuroServer } where isOpenBuroServer reads X-OpenBuro-Server header"
    - "fetchCapabilities() rejects when AbortController fires before or during fetch"
    - "WsListener.stop() sets destroyed=true, clears any pending retry timer, and closes any open socket"
    - "WsListener reconnects with full-jitter exponential backoff, stops after 5 attempts, emits OBCError(WS_CONNECTION_FAILED)"
    - "WsListener does NOT open a new socket after stop() even if a retry was already scheduled"
    - "WsListener calls onUpdate() only on JSON messages with type === 'REGISTRY_UPDATED'"
  artifacts:
    - path: "src/capabilities/resolver.ts"
      provides: "Pure MIME resolver — resolve(caps, intent): Capability[]"
      exports: ["resolve"]
      min_lines: 20
    - path: "src/capabilities/resolver.test.ts"
      provides: "Unit tests for all 6 resolver match rules (RES-02..06)"
      min_lines: 40
    - path: "src/capabilities/loader.ts"
      provides: "HTTP loader — fetchCapabilities(url, signal): Promise<LoaderResult>"
      exports: ["fetchCapabilities", "LoaderResult"]
      min_lines: 30
    - path: "src/capabilities/loader.test.ts"
      provides: "Unit tests for fetch happy path, HTTPS guard, AbortSignal, X-OpenBuro-Server header, OBCError mapping"
      min_lines: 50
    - path: "src/capabilities/ws-listener.ts"
      provides: "WsListener class + deriveWsUrl helper"
      exports: ["WsListener", "WsListenerOptions", "deriveWsUrl"]
      min_lines: 80
    - path: "src/capabilities/ws-listener.test.ts"
      provides: "Unit tests using FakeWebSocket for reconnect, jitter, destroyed guard, protocol check, REGISTRY_UPDATED handling"
      min_lines: 80
  key_links:
    - from: "src/capabilities/loader.ts"
      to: "src/errors.ts (OBCError)"
      via: "import { OBCError } from '../errors.js'"
      pattern: "new OBCError\\(.CAPABILITIES_FETCH_FAILED."
    - from: "src/capabilities/ws-listener.ts"
      to: "src/errors.ts (OBCError)"
      via: "import { OBCError } from '../errors.js'"
      pattern: "new OBCError\\(.WS_CONNECTION_FAILED."
    - from: "src/capabilities/ws-listener.ts"
      to: "destroyed flag guard"
      via: "instance property"
      pattern: "this\\.destroyed"
    - from: "src/capabilities/resolver.ts"
      to: "src/types.ts (Capability, IntentRequest)"
      via: "import type"
      pattern: "import type \\{ Capability, IntentRequest \\}"
---

<objective>
Build the Capability layer — pure MIME resolver, HTTPS-guarded HTTP loader with AbortSignal support, and a WebSocket listener with full-jitter exponential backoff and `destroyed` flag guard. This layer has zero DOM and zero Penpal knowledge (strict layer isolation).

Purpose: The orchestrator (Phase 3) calls `fetchCapabilities()` on init/refresh, runs the result through `resolve()` during `castIntent()`, and optionally starts `WsListener` for live registry updates. Each module is independently unit-testable with no mocks beyond global `fetch` and `WebSocket`.

Output:
- `src/capabilities/resolver.ts` + test (Node env)
- `src/capabilities/loader.ts` + test (Node env)
- `src/capabilities/ws-listener.ts` + test (Node env, FakeWebSocket)
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
<!-- Types already exported from Phase 1 — executor uses these directly. -->

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
  args: {
    allowedMimeType?: string;
    multiple?: boolean;
  };
}
```

From src/errors.ts:
```typescript
export type OBCErrorCode =
  | 'CAPABILITIES_FETCH_FAILED'
  | 'NO_MATCHING_CAPABILITY'
  | 'IFRAME_TIMEOUT'
  | 'WS_CONNECTION_FAILED'
  | 'INTENT_CANCELLED'
  | 'SAME_ORIGIN_CAPABILITY';

export class OBCError extends Error {
  readonly code: OBCErrorCode;
  readonly cause?: unknown;
  constructor(code: OBCErrorCode, message: string, cause?: unknown);
}
```

Import paths use the `.js` extension (ESM convention preserved through tsdown).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure MIME resolver (RES-01..06)</name>
  <files>src/capabilities/resolver.ts, src/capabilities/resolver.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (Pattern 1: Pure Resolver section, lines ~260-310)
    - .planning/phases/02-core-implementation/02-CONTEXT.md (decisions block)
    - src/types.ts
    - src/errors.ts
  </read_first>

  <behavior>
    - resolve([], {action: 'PICK', args: {}}) returns []
    - resolve returns only capabilities where cap.action === intent.action
    - resolve with intent.args.allowedMimeType === undefined matches all action-matching capabilities (RES-03)
    - resolve with intent.args.allowedMimeType === '' matches all action-matching capabilities (RES-03 empty variant)
    - resolve with intent.args.allowedMimeType === '*/*' matches all action-matching capabilities (RES-06)
    - resolve with capability.properties.mimeTypes containing '*/*' matches any intent mime (RES-04)
    - resolve with exact mime match succeeds (RES-05: cap has ['image/png'], intent asks 'image/png')
    - resolve with exact mime mismatch fails (cap has ['image/png'], intent asks 'application/pdf')
    - resolve with action mismatch returns [] (cap.action='SAVE', intent.action='PICK')
  </behavior>

  <action>
    Create `src/capabilities/resolver.ts` exporting a single pure function:

    ```typescript
    import type { Capability, IntentRequest } from "../types.js";

    export function resolve(
      capabilities: Capability[],
      intent: IntentRequest
    ): Capability[] {
      const requestedMime = intent.args.allowedMimeType;

      return capabilities.filter((cap) => {
        if (cap.action !== intent.action) return false;
        if (!requestedMime) return true;
        if (requestedMime === "*/*") return true;
        if (cap.properties.mimeTypes.includes("*/*")) return true;
        return cap.properties.mimeTypes.includes(requestedMime);
      });
    }
    ```

    Rules (in order):
    1. RES-02: action equality
    2. RES-03: absent/empty `allowedMimeType` → match-all
    3. RES-06: intent wildcard `*/*` → match-all
    4. RES-04: capability wildcard `*/*` in `mimeTypes` → match any mime
    5. RES-05: exact mime string match

    Use **double quotes** for string literals (Biome rule from Phase 1). Import type-only from `"../types.js"`.

    Create `src/capabilities/resolver.test.ts` with **at least 7 test cases** covering:
    - action mismatch → empty array
    - absent `allowedMimeType` → all matching-action caps returned
    - empty string `allowedMimeType` → same as absent
    - intent `*/*` → all matching-action caps returned
    - capability `*/*` in mimeTypes → matched for any specific intent mime
    - exact mime match → included
    - exact mime mismatch → excluded
    - mixed list (2 match, 1 doesn't) → only 2 returned, preserves input order

    Build fixtures inline in the test file — do not create a separate fixture file. Use `vi.fn()` for nothing; these are pure functions.

    DO NOT import from penpal. DO NOT touch DOM. DO NOT use `innerHTML`. Resolver is a Node-env test (no docblock annotation needed).
  </action>

  <verify>
    <automated>pnpm vitest run src/capabilities/resolver.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/capabilities/resolver.ts` exports `resolve` function
    - `src/capabilities/resolver.ts` contains the literal `cap.properties.mimeTypes.includes("*/*")`
    - `src/capabilities/resolver.ts` does NOT contain the literal `penpal`
    - `src/capabilities/resolver.ts` does NOT contain `document` or `window`
    - `src/capabilities/resolver.test.ts` contains at least 7 `it(` or `test(` calls
    - `pnpm vitest run src/capabilities/resolver.test.ts` exits 0
    - `pnpm typecheck` exits 0 (no new type errors)
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    All 6 action+mime matching rules verified; resolver file is pure with no DOM/Penpal imports; 7+ tests green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: HTTP capability loader (CAP-01..07)</name>
  <files>src/capabilities/loader.ts, src/capabilities/loader.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (Pattern 2: HTTP Loader + AbortController Teardown Test Pattern)
    - .planning/phases/02-core-implementation/02-CONTEXT.md
    - src/errors.ts
    - src/types.ts
  </read_first>

  <behavior>
    - fetchCapabilities("https://...", signal) returns { capabilities, isOpenBuroServer } on 200 + JSON body
    - fetchCapabilities("http://...") when location.protocol === "https:" throws OBCError(CAPABILITIES_FETCH_FAILED)
    - fetchCapabilities with a pre-aborted signal rejects (fetch throws AbortError) and cause is propagated
    - fetchCapabilities wraps any fetch error in OBCError(CAPABILITIES_FETCH_FAILED, ..., cause)
    - fetchCapabilities returns isOpenBuroServer=true when response header 'X-OpenBuro-Server' === 'true'
    - fetchCapabilities returns isOpenBuroServer=false when header absent or differs
    - fetchCapabilities rejects with OBCError when response.ok is false (e.g. 500)
  </behavior>

  <action>
    Create `src/capabilities/loader.ts` per RESEARCH.md Pattern 2 verbatim. Exact signature:

    ```typescript
    import { OBCError } from "../errors.js";
    import type { Capability } from "../types.js";

    export interface LoaderResult {
      capabilities: Capability[];
      isOpenBuroServer: boolean;
    }

    export async function fetchCapabilities(
      url: string,
      signal?: AbortSignal
    ): Promise<LoaderResult>;
    ```

    Implementation requirements:
    1. **CAP-05**: Before calling fetch, check `new URL(url).protocol`. If it is not `"https:"` AND `typeof location !== "undefined"` AND `location.protocol === "https:"`, throw `new OBCError("CAPABILITIES_FETCH_FAILED", "capabilitiesUrl must use HTTPS when host page is HTTPS: " + url)`. Do NOT block non-https in a non-https context (Node/test).
    2. **CAP-04**: Pass `{ signal }` to fetch. Wrap fetch in try/catch — on rejection, re-throw as `OBCError("CAPABILITIES_FETCH_FAILED", "Failed to fetch capabilities from " + url, cause)`.
    3. **CAP-03**: If `!response.ok`, throw `OBCError("CAPABILITIES_FETCH_FAILED", "Capabilities endpoint returned " + response.status)`.
    4. **CAP-02**: Read header `response.headers.get("X-OpenBuro-Server") === "true"` into `isOpenBuroServer`.
    5. **CAP-01**: Parse JSON as `Capability[]` and return `{ capabilities, isOpenBuroServer }`.

    Use **double quotes** everywhere. Use `import type` for `Capability` (type-only). Concatenate strings with `+` (no template literals needed, but template literals also OK — match Phase 1 style).

    **Note on CAP-06/CAP-07:** These are _getter methods_ on the orchestrator (`getCapabilities()`, `refreshCapabilities()`) — the orchestrator itself lives in Phase 3. This plan satisfies them by providing the loader that `refreshCapabilities()` will call and the in-memory shape that `getCapabilities()` will return. The requirements IDs are claimed here because Phase 3 has no loader work to do.

    Create `src/capabilities/loader.test.ts` (Node env, no docblock) with at least **6 test cases**:
    1. Happy path: `vi.stubGlobal("fetch", ...)` returning a Response-like `{ ok: true, status: 200, headers: { get: () => "true" }, json: async () => [fakeCap] }`. Assert `isOpenBuroServer === true` and `capabilities.length === 1`.
    2. Header absent → `isOpenBuroServer === false`.
    3. Non-200: stub `ok: false, status: 500` → rejects with OBCError, `err.code === "CAPABILITIES_FETCH_FAILED"`.
    4. Fetch throws (network error) → rejects with OBCError, `err.cause` is the original thrown value.
    5. HTTPS guard: stub `globalThis.location` to `{ protocol: "https:" }` via `vi.stubGlobal("location", { protocol: "https:" })`. Call with `"http://example.com/caps"`. Assert rejects with OBCError before fetch is even called (assert fetch spy not called).
    6. AbortController: create controller, stub fetch to return `new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))`. Call `fetchCapabilities(url, controller.signal)` then `controller.abort()`. Assert rejects.

    After each test, `vi.unstubAllGlobals()` in `afterEach`.

    DO NOT use msw or any external HTTP mocking library — stub globals directly.
  </action>

  <verify>
    <automated>pnpm vitest run src/capabilities/loader.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/capabilities/loader.ts` exports `fetchCapabilities` and `LoaderResult`
    - `src/capabilities/loader.ts` contains the literal `new URL(url).protocol`
    - `src/capabilities/loader.ts` contains the literal `X-OpenBuro-Server`
    - `src/capabilities/loader.ts` contains the literal `CAPABILITIES_FETCH_FAILED`
    - `src/capabilities/loader.ts` passes `{ signal }` to fetch (grep for `fetch\(url, \{ signal \}\)` or equivalent)
    - `src/capabilities/loader.ts` does NOT contain the literal `penpal`
    - `src/capabilities/loader.ts` does NOT contain `document`
    - `src/capabilities/loader.test.ts` contains at least 6 `it(` or `test(` calls
    - `src/capabilities/loader.test.ts` contains the literal `vi.stubGlobal("fetch"` or `vi.stubGlobal('fetch'`
    - `pnpm vitest run src/capabilities/loader.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    Loader happy path + 5 error/abort paths all verified with stubbed fetch; no external HTTP mocking lib; OBCError code chain correct.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: WebSocket listener with full-jitter backoff + destroyed guard (WS-01..07)</name>
  <files>src/capabilities/ws-listener.ts, src/capabilities/ws-listener.test.ts</files>

  <read_first>
    - .planning/phases/02-core-implementation/02-RESEARCH.md (Pattern 3: WebSocket Listener, Pitfall 7, FakeWebSocket Pattern)
    - .planning/phases/02-core-implementation/02-CONTEXT.md
    - src/errors.ts
  </read_first>

  <behavior>
    - deriveWsUrl("https://api.example.com/capabilities") === "wss://api.example.com/capabilities/ws"
    - deriveWsUrl("http://localhost:3000/capabilities") === "ws://localhost:3000/capabilities/ws"
    - new WsListener({wsUrl, onUpdate, onError}).start() constructs a WebSocket once
    - onmessage with JSON.stringify({type: "REGISTRY_UPDATED"}) fires onUpdate exactly once
    - onmessage with JSON.stringify({type: "OTHER"}) does NOT fire onUpdate
    - onmessage with malformed JSON does NOT throw and does NOT fire onUpdate
    - onclose triggers reconnect with jittered delay; delay ∈ [0, min(30000, 1000 * 2^attempt))
    - After 5 close cycles without an onopen, onError is called with OBCError(WS_CONNECTION_FAILED) and no 6th socket is created
    - onopen resets attempt counter to 0
    - stop() sets destroyed=true, clears retryTimer, closes socket
    - stop() called during a scheduled retry prevents the retry from opening a new socket
    - connect() called on already-destroyed instance is a no-op (early return)
    - In https context, non-wss URL → onError fires with WS_CONNECTION_FAILED before WebSocket is constructed
  </behavior>

  <action>
    Create `src/capabilities/ws-listener.ts` verbatim from RESEARCH.md Pattern 3 (lines ~356-460 of 02-RESEARCH.md). Exact class shape:

    ```typescript
    import { OBCError } from "../errors.js";

    export interface WsListenerOptions {
      wsUrl: string;
      maxAttempts?: number;
      onUpdate: () => void;
      onError: (err: OBCError) => void;
    }

    export class WsListener {
      private destroyed = false;
      private attempt = 0;
      private socket: WebSocket | null = null;
      private retryTimer: ReturnType<typeof setTimeout> | null = null;
      private readonly maxAttempts: number;
      private readonly wsUrl: string;
      private readonly onUpdate: () => void;
      private readonly onError: (err: OBCError) => void;

      constructor(opts: WsListenerOptions) { /* ... */ }
      start(): void { /* destroyed guard; then this.connect() */ }
      stop(): void { /* destroyed=true; clearTimeout; socket?.close(); nullify */ }
      private connect(): void { /* destroyed re-check; protocol guard; new WebSocket; handlers */ }
    }

    export function deriveWsUrl(capabilitiesUrl: string): string {
      const u = new URL(capabilitiesUrl);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      u.pathname = u.pathname.replace(/\/capabilities$/, "/capabilities/ws");
      return u.toString();
    }
    ```

    Handler requirements:
    - `socket.onmessage`: parse `event.data` as JSON in try/catch; only fire `onUpdate` on `data.type === "REGISTRY_UPDATED"`; swallow parse errors silently (no throw).
    - `socket.onopen`: reset `this.attempt = 0`.
    - `socket.onerror`: no-op (onclose handles retry).
    - `socket.onclose`: `if (this.destroyed) return;` early; increment attempt; if `attempt >= maxAttempts` → call `onError(new OBCError("WS_CONNECTION_FAILED", ...))` and return without scheduling; else schedule retry via `setTimeout` with full-jitter: `Math.random() * Math.min(30_000, 1_000 * Math.pow(2, this.attempt))`.
    - **WS-05 double guard**: Both the setTimeout callback body AND the top of `connect()` must start with `if (this.destroyed) return;`. This is not stylistic — it's the pitfall #7 fix.
    - **WS-07 protocol guard**: `if (new URL(this.wsUrl).protocol !== "wss:" && typeof location !== "undefined" && (location as Location).protocol === "https:")` → call `onError` with OBCError, return.

    Use `Math.pow(this.attempt, ...)` or `**` — either works; match Phase 1 style (no `**` is fine).

    Create `src/capabilities/ws-listener.test.ts` (Node env, no docblock) with the FakeWebSocket helper from RESEARCH.md copied verbatim at the top of the file (inside the test file, not a separate export). At least **10 test cases**:

    1. `deriveWsUrl` happy path: https→wss, replaces `/capabilities` with `/capabilities/ws`
    2. `deriveWsUrl` http→ws variant
    3. `start()` opens a FakeWebSocket (assert `FakeWebSocket.instance !== null`)
    4. Incoming `REGISTRY_UPDATED` message fires `onUpdate` once
    5. Incoming non-REGISTRY message does NOT fire `onUpdate`
    6. Malformed JSON does NOT throw and does NOT fire `onUpdate`
    7. `onopen` resets attempt counter (simulate one close, one open, another close — attempt should increment from 0)
    8. Reconnect backoff: use `vi.useFakeTimers()`; trigger simulateClose; assert a timer is scheduled with a positive delay; advance timers; assert a second FakeWebSocket was constructed
    9. **WS-05 critical test**: start(); simulateClose() (schedules retry); stop() (should clear timer + mark destroyed); advance timers past the scheduled delay; assert NO new FakeWebSocket was constructed after stop()
    10. After 5 consecutive closes without opens, onError is called with `err.code === "WS_CONNECTION_FAILED"` and no 6th socket is constructed
    11. Non-wss URL in https context: stub `globalThis.location = { protocol: "https:" }`; call start() with `ws://`; assert onError fires with WS_CONNECTION_FAILED and NO WebSocket is constructed

    Use `vi.stubGlobal("WebSocket", FakeWebSocket)` in `beforeEach` and `vi.unstubAllGlobals()` + `vi.useRealTimers()` in `afterEach`. Also reset `FakeWebSocket.instance = null` between tests.

    **CRITICAL**: The `destroyed` flag must appear in the ws-listener.ts source as a literal string `this.destroyed`. Grep-verifiable.

    DO NOT import msw-ws. DO NOT touch DOM.
  </action>

  <verify>
    <automated>pnpm vitest run src/capabilities/ws-listener.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/capabilities/ws-listener.ts` exports `WsListener`, `WsListenerOptions`, `deriveWsUrl`
    - `src/capabilities/ws-listener.ts` contains the literal `this.destroyed`
    - `src/capabilities/ws-listener.ts` contains the literal `Math.random()`
    - `src/capabilities/ws-listener.ts` contains the literal `clearTimeout`
    - `src/capabilities/ws-listener.ts` contains the literal `WS_CONNECTION_FAILED`
    - `src/capabilities/ws-listener.ts` contains the literal `REGISTRY_UPDATED`
    - `src/capabilities/ws-listener.ts` does NOT contain the literal `penpal`
    - `src/capabilities/ws-listener.ts` does NOT contain the literal `document`
    - `src/capabilities/ws-listener.test.ts` contains at least 10 `it(` or `test(` calls
    - `src/capabilities/ws-listener.test.ts` contains the literal `FakeWebSocket`
    - `src/capabilities/ws-listener.test.ts` contains the literal `vi.useFakeTimers`
    - `pnpm vitest run src/capabilities/ws-listener.test.ts` exits 0
    - `pnpm typecheck` exits 0
    - `pnpm lint` exits 0
  </acceptance_criteria>

  <done>
    WsListener reconnects with jitter, stops cleanly, protocol-guards wss in https context, and the post-stop() retry guard is verified by an explicit test that advances fake timers after `stop()`.
  </done>
</task>

</tasks>

<verification>
All three tasks produce a green `pnpm vitest run src/capabilities/` and do not break `pnpm run ci`. No file in this plan imports `penpal`. No file touches `document` or `window.HTMLElement`. OBCError is the only error class used.
</verification>

<success_criteria>
- `pnpm vitest run src/capabilities/` exits 0 with 23+ tests (7 resolver + 6 loader + 10+ ws-listener)
- `pnpm run ci` exits 0 (typecheck + lint + test + attw)
- `grep -r "penpal" src/capabilities/` returns nothing
- `grep -r "document\." src/capabilities/` returns nothing
- All 20 requirement IDs (CAP-01..07, RES-01..06, WS-01..07) covered by at least one test assertion
</success_criteria>

<output>
After completion, create `.planning/phases/02-core-implementation/02-01-SUMMARY.md` using the standard summary template. Record:
- Files created (6: 3 source + 3 test)
- Test count per file
- Any FakeWebSocket quirks or happy-dom-vs-node differences encountered
- Whether the `noUncheckedIndexedAccess` setting required any extra guards beyond the resolver/loader pattern
</output>
